import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone, DEFAULT_DAY_SWITCH } from '@/core/local-day';
import { beginSave, confirmSave, reconcileServerRows, visibleRecords, type SaveState } from '@/core/save-state';
import { recentExerciseNames, type RecentExerciseRow, type TrainingSet } from '@/core/training';
import { RECORD_DELETED, weightSaveOutcome } from '@/core/weight-write';
import { withLoadTimeout } from '@/data/load-timeout';
import { listRecentExercises, listTrainingSets, softDeleteTrainingSet, upsertTrainingSet } from '@/data/training';
import { getDaySwitch } from '@/data/profile';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  cancelDeferredDeletes,
  installDeferredDeleteLifecycle,
  scheduleDeferredDelete,
  useDeferredDeleteIds,
} from '@/features/record/deferred-delete';
import { showToast } from '@/ui/toast';

export type TrainingSaveResult = 'saved' | 'retry' | 'deleted';

type TrainingContextValue = {
  ready: boolean;
  loadError: string | null;
  sets: TrainingSet[];
  failedIds: ReadonlySet<string>;
  pendingDeleteIds: ReadonlySet<string>;
  deletedNotice: boolean;
  savingIds: ReadonlySet<string>;
  refreshing: boolean;
  refreshError: boolean;
  daySwitch: string;
  timeZone: string;
  recentExercises: readonly string[];
  reload: () => Promise<void>;
  saveSet: (input: {
    exercise: string;
    reps: number;
    weightKg: number | null;
    bandLevel: string | null;
    existingId?: string;
  }) => Promise<TrainingSaveResult>;
  retry: (id: string) => Promise<void>;
  dismiss: (id: string) => void;
  dismissDeletedNotice: () => void;
  scheduleDelete: (id: string) => void;
};

const TrainingContext = createContext<TrainingContextValue | null>(null);

export function TrainingProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [saveState, setSaveState] = useState<SaveState<TrainingSet>>({ saved: [], pending: [] });
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const [daySwitch, setDaySwitch] = useState(DEFAULT_DAY_SWITCH);
  const [ready, setReady] = useState(false);
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const readyRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState(false);
  const [recentRows, setRecentRows] = useState<RecentExerciseRow[]>([]);
  const creating = useRef(false);
  const inFlight = useRef(new Set<string>());
  const alive = useRef(new Set<string>());
  const loadTicket = useRef(0);
  const confirmedTicket = useRef(new Map<string, number>());
  const pendingDeleteIds = useDeferredDeleteIds();

  const loadSaved = useCallback(async (switchTime: string) => {
    const endDay = computeLocalDay(new Date(), currentTimeZone(), switchTime);
    const [sets, recent] = await Promise.all([listTrainingSets(endDay), listRecentExercises()]);
    return { sets, recent };
  }, []);

  const applyRows = useCallback((rows: TrainingSet[], recent: RecentExerciseRow[], nextSwitch: string, ticket: number) => {
    const keep = new Set<string>();
    for (const [id, at] of confirmedTicket.current) {
      if (at >= ticket) keep.add(id);
    }
    for (const row of rows) confirmedTicket.current.delete(row.id);
    setLoadError(null);
    setDaySwitch(nextSwitch);
    setRecentRows(recent);
    setSaveState((current) => reconcileServerRows(current, rows, keep));
    setRefreshError(false);
    setReady(true);
  }, []);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  const reload = useCallback(async () => {
    const ticket = ++loadTicket.current;
    const background = readyRef.current;
    if (background) {
      setRefreshing(true);
      setRefreshError(false);
    }
    try {
      const loaded = await withLoadTimeout(
        (async () => {
          const nextSwitch = await getDaySwitch();
          const saved = await loadSaved(nextSwitch);
          return { nextSwitch, ...saved };
        })(),
      );
      if (ticket !== loadTicket.current) return;
      applyRows(loaded.sets, loaded.recent, loaded.nextSwitch, ticket);
      setRefreshError(false);
    } catch {
      if (ticket !== loadTicket.current) return;
      if (readyRef.current) setRefreshError(true);
      else {
        setLoadError('读取失败');
        setReady(true);
      }
    } finally {
      if (ticket === loadTicket.current) setRefreshing(false);
    }
  }, [applyRows, loadSaved]);

  useEffect(() => {
    if (!session) return undefined;
    const ticket = ++loadTicket.current;
    let cancelled = false;
    void getDaySwitch()
      .then(async (nextSwitch) => ({ nextSwitch, ...(await loadSaved(nextSwitch)) }))
      .then(
        ({ sets: rows, recent, nextSwitch }) => {
          if (cancelled || ticket !== loadTicket.current) return;
          applyRows(rows, recent, nextSwitch, ticket);
        },
        () => {
          if (cancelled || ticket !== loadTicket.current) return;
          setLoadError('读取失败');
          setReady(true);
        },
      );
    return () => {
      cancelled = true;
    };
  }, [applyRows, loadSaved, session]);

  const saveSet = useCallback(
    async (input: {
      exercise: string;
      reps: number;
      weightKg: number | null;
      bandLevel: string | null;
      existingId?: string;
    }) => {
      if (!input.existingId && creating.current) return 'retry';
      const id = input.existingId ?? createId();
      if (inFlight.current.has(id)) return 'retry';
      if (!input.existingId) creating.current = true;
      const existing = input.existingId ? saveState.pending.find((item) => item.id === input.existingId) : undefined;
      const recordedAt = existing ? new Date(existing.recordedAt) : new Date();
      const tz = existing?.tz ?? currentTimeZone();
      const switchTime = daySwitch;
      const set: TrainingSet = {
        id,
        exercise: input.exercise,
        reps: input.reps,
        weightKg: input.weightKg,
        bandLevel: input.bandLevel,
        recordedAt: recordedAt.toISOString(),
        tz,
        localDay: existing?.localDay ?? computeLocalDay(recordedAt, tz, switchTime),
        updatedAt: new Date().toISOString(),
      };
      setSaveState((current) => beginSave(current, set));
      setFailedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      inFlight.current.add(id);
      alive.current.add(id);
      if (!input.existingId) creating.current = false;
      setSavingIds((current) => {
        const next = new Set(current);
        next.add(id);
        return next;
      });
      void (async () => {
        try {
          await upsertTrainingSet(set);
          if (!alive.current.has(id)) return;
          confirmedTicket.current.set(id, loadTicket.current);
          setSaveState((current) => (current.pending.some((row) => row.id === id) ? confirmSave(current, set) : current));
          setRecentRows((current) => [{ exercise: set.exercise, recordedAt: set.recordedAt }, ...current]);
        } catch (error) {
          confirmedTicket.current.delete(id);
          if (!alive.current.has(id)) return;
          if (weightSaveOutcome(error) === RECORD_DELETED) {
            alive.current.delete(id);
            setSaveState((current) => ({
              saved: current.saved.filter((row) => row.id !== id),
              pending: current.pending.filter((row) => row.id !== id),
            }));
            setFailedIds((current) => {
              const next = new Set(current);
              next.delete(id);
              return next;
            });
            setDeletedNotice(true);
            return;
          }
          setFailedIds((current) => new Set(current).add(id));
          showToast({ text: '保存失败，请重试', tone: 'error' });
        } finally {
          inFlight.current.delete(id);
          setSavingIds((current) => {
            if (!current.has(id)) return current;
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        }
      })();
      return 'saved';
    },
    [daySwitch, saveState.pending],
  );

  const retry = useCallback(
    async (id: string) => {
      const set = saveState.pending.find((item) => item.id === id);
      if (!set) return;
      await saveSet({
        exercise: set.exercise,
        reps: set.reps,
        weightKg: set.weightKg,
        bandLevel: set.bandLevel,
        existingId: id,
      });
    },
    [saveSet, saveState.pending],
  );

  const dismiss = useCallback((id: string) => {
    alive.current.delete(id);
    confirmedTicket.current.delete(id);
    setSaveState((current) => ({
      saved: current.saved,
      pending: current.pending.filter((row) => row.id !== id),
    }));
    setFailedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const dismissDeletedNotice = useCallback(() => {
    setDeletedNotice(false);
  }, []);

  const removeSet = useCallback(
    async (id: string) => {
      const isSaved = saveState.saved.some((row) => row.id === id);
      if (!isSaved) {
        dismiss(id);
        return;
      }
      try {
        await softDeleteTrainingSet(id);
        confirmedTicket.current.delete(id);
        setSaveState((current) => ({
          saved: current.saved.filter((row) => row.id !== id),
          pending: current.pending.filter((row) => row.id !== id),
        }));
      } catch (error) {
        if (weightSaveOutcome(error) === RECORD_DELETED) {
          setSaveState((current) => ({
            saved: current.saved.filter((row) => row.id !== id),
            pending: current.pending.filter((row) => row.id !== id),
          }));
          return;
        }
        showToast({ text: '删除失败，请重试', tone: 'error' });
      }
    },
    [dismiss, saveState.saved],
  );

  const removeSetRef = useRef(removeSet);
  useEffect(() => {
    removeSetRef.current = removeSet;
  }, [removeSet]);

  const scheduleDelete = useCallback((id: string) => {
    scheduleDeferredDelete('training', id, () => removeSetRef.current(id));
  }, []);

  useEffect(() => installDeferredDeleteLifecycle(), []);
  useEffect(() => () => cancelDeferredDeletes('training'), []);

  const sets = useMemo(() => visibleRecords(saveState), [saveState]);
  const recentExercises = useMemo(() => recentExerciseNames(recentRows), [recentRows]);
  const value = useMemo<TrainingContextValue>(
    () => ({
      ready,
      loadError,
      sets,
      failedIds,
      pendingDeleteIds,
      deletedNotice,
      savingIds,
      refreshing,
      refreshError,
      daySwitch,
      timeZone: currentTimeZone(),
      recentExercises,
      reload,
      saveSet,
      retry,
      dismiss,
      dismissDeletedNotice,
      scheduleDelete,
    }),
    [
      ready,
      loadError,
      sets,
      failedIds,
      pendingDeleteIds,
      deletedNotice,
      savingIds,
      refreshing,
      refreshError,
      daySwitch,
      recentExercises,
      reload,
      saveSet,
      retry,
      dismiss,
      dismissDeletedNotice,
      scheduleDelete,
    ],
  );

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingContextValue {
  const value = useContext(TrainingContext);
  if (!value) throw new Error('useTraining must be used inside TrainingProvider');
  return value;
}
