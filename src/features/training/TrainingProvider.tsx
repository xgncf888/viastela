import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone, DEFAULT_DAY_SWITCH } from '@/core/local-day';
import { beginSave, confirmSave, visibleRecords, type SaveState } from '@/core/save-state';
import { recentExerciseNames, type RecentExerciseRow, type TrainingSet } from '@/core/training';
import { RECORD_DELETED, weightSaveOutcome } from '@/core/weight-write';
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
  saving: boolean;
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
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState(false);
  const [recentRows, setRecentRows] = useState<RecentExerciseRow[]>([]);
  const creating = useRef(false);
  const inFlight = useRef(new Set<string>());
  const pendingDeleteIds = useDeferredDeleteIds();

  const loadSaved = useCallback(async (switchTime: string) => {
    const endDay = computeLocalDay(new Date(), currentTimeZone(), switchTime);
    const [sets, recent] = await Promise.all([listTrainingSets(endDay), listRecentExercises()]);
    return { sets, recent };
  }, []);

  const reload = useCallback(async () => {
    try {
      const nextSwitch = await getDaySwitch();
      const { sets: rows, recent } = await loadSaved(nextSwitch);
      setLoadError(null);
      setDaySwitch(nextSwitch);
      setRecentRows(recent);
      setSaveState((current) => {
        const serverIds = new Set(rows.map((row) => row.id));
        return { saved: rows, pending: current.pending.filter((row) => !serverIds.has(row.id)) };
      });
      setReady(true);
    } catch {
      setLoadError('读取失败');
      setReady(true);
    }
  }, [loadSaved]);

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;
    void getDaySwitch()
      .then(async (nextSwitch) => ({ nextSwitch, ...(await loadSaved(nextSwitch)) }))
      .then(
        ({ sets: rows, recent, nextSwitch }) => {
          if (cancelled) return;
          setLoadError(null);
          setDaySwitch(nextSwitch);
          setRecentRows(recent);
          setSaveState((current) => {
            const serverIds = new Set(rows.map((row) => row.id));
            return { saved: rows, pending: current.pending.filter((row) => !serverIds.has(row.id)) };
          });
          setReady(true);
        },
        () => {
          if (cancelled) return;
          setLoadError('读取失败');
          setReady(true);
        },
      );
    return () => {
      cancelled = true;
    };
  }, [loadSaved, session]);

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
      setSaving(true);
      try {
        await upsertTrainingSet(set);
        try {
          const { sets: rows, recent } = await loadSaved(switchTime);
          setRecentRows(recent);
          setSaveState((current) => ({
            saved: rows.some((row) => row.id === id) ? rows : confirmSave({ saved: rows, pending: [] }, set).saved,
            pending: current.pending.filter((row) => row.id !== id && !rows.some((saved) => saved.id === row.id)),
          }));
        } catch {
          setSaveState((current) => confirmSave(current, set));
        }
        return 'saved';
      } catch (error) {
        if (weightSaveOutcome(error) === RECORD_DELETED) {
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
          return 'deleted';
        }
        setFailedIds((current) => new Set(current).add(id));
        showToast({ text: '保存失败，请重试', tone: 'error' });
        return 'retry';
      } finally {
        inFlight.current.delete(id);
        if (!input.existingId) creating.current = false;
        setSaving(false);
      }
    },
    [daySwitch, loadSaved, saveState.pending],
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
      saving,
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
      saving,
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
