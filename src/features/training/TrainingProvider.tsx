import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone } from '@/core/local-day';
import { recentExerciseNames, type RecentExerciseRow, type TrainingSet } from '@/core/training';
import { removeOutboxTrainingSet, saveOutboxTrainingSet, type OutboxSnapshot } from '@/data/record-outbox';
import { listRecentExercises, listTrainingSets, softDeleteTrainingSet, upsertTrainingSet } from '@/data/training';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useOptimisticRecordStore,
  type OptimisticSaveResult,
} from '@/features/record/use-optimistic-record-store';

export type TrainingSaveResult = OptimisticSaveResult;

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

const INITIAL_RECENT_EXERCISES: RecentExerciseRow[] = [];
const selectTrainingOutbox = (outbox: OutboxSnapshot) => outbox.trainingSets;

export function TrainingProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const creating = useRef(false);

  const loadSaved = useCallback(async (switchTime: string) => {
    const endDay = computeLocalDay(new Date(), currentTimeZone(), switchTime);
    const [sets, recent] = await Promise.all([listTrainingSets(endDay), listRecentExercises()]);
    return { rows: sets, extra: recent };
  }, []);

  const store = useOptimisticRecordStore<TrainingSet, RecentExerciseRow[]>({
    scope: 'training',
    userId: session?.userId ?? null,
    initialExtra: INITIAL_RECENT_EXERCISES,
    selectOutboxItems: selectTrainingOutbox,
    saveOutboxItem: saveOutboxTrainingSet,
    removeOutboxItem: removeOutboxTrainingSet,
    loadServerData: loadSaved,
    upsertServerItem: upsertTrainingSet,
    softDeleteServerItem: softDeleteTrainingSet,
  });

  const {
    ready,
    loadError,
    records: sets,
    pendingItems,
    extra: recentRows,
    setExtra: setRecentRows,
    failedIds,
    pendingDeleteIds,
    deletedNotice,
    savingIds,
    refreshing,
    refreshError,
    daySwitch,
    inFlightRef,
    reload,
    executeOptimisticSave,
    dismiss,
    dismissDeletedNotice,
    scheduleDelete,
  } = store;

  useEffect(() => {
    if (sets.length === 0) return;
    const newest = sets[sets.length - 1];
    if (!newest) return;
    setRecentRows((current) => {
      if (current.some((item) => item.exercise === newest.exercise && item.recordedAt === newest.recordedAt)) {
        return current;
      }
      return [{ exercise: newest.exercise, recordedAt: newest.recordedAt }, ...current];
    });
  }, [ setRecentRows, sets ]);

  const saveSet = useCallback(
    async (input: {
      exercise: string;
      reps: number;
      weightKg: number | null;
      bandLevel: string | null;
      existingId?: string;
    }): Promise<TrainingSaveResult> => {
      if (!input.existingId && creating.current) return 'retry';
      const id = input.existingId ?? createId();
      if (inFlightRef.current.has(id)) return 'retry';
      if (!input.existingId) creating.current = true;
      const existing = input.existingId ? pendingItems.find((item) => item.id === input.existingId) : undefined;
      const recordedAt = existing ? new Date(existing.recordedAt) : new Date();
      const tz = existing?.tz ?? currentTimeZone();
      const set: TrainingSet = {
        id,
        exercise: input.exercise,
        reps: input.reps,
        weightKg: input.weightKg,
        bandLevel: input.bandLevel,
        recordedAt: recordedAt.toISOString(),
        tz,
        localDay: existing?.localDay ?? computeLocalDay(recordedAt, tz, daySwitch),
        updatedAt: new Date().toISOString(),
      };
      if (!input.existingId) creating.current = false;
      return executeOptimisticSave(set);
    },
    [daySwitch, executeOptimisticSave, inFlightRef, pendingItems],
  );

  const retry = useCallback(
    async (id: string) => {
      const set = pendingItems.find((item) => item.id === id);
      if (!set) return;
      await saveSet({
        exercise: set.exercise,
        reps: set.reps,
        weightKg: set.weightKg,
        bandLevel: set.bandLevel,
        existingId: id,
      });
    },
    [pendingItems, saveSet],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
    const onOnline = () => {
      for (const id of failedIds) void retry(id);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [failedIds, retry]);

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

export function useOptionalTraining(): TrainingContextValue | null {
  return useContext(TrainingContext);
}
