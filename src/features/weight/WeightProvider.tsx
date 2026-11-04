import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone, isDaySwitch, saveToastMessage } from '@/core/local-day';
import { TREND_WINDOW_DAYS, weightListWindow, type WeightRecord } from '@/core/weight-stats';
import { updateDaySwitch } from '@/data/profile';
import { removeOutboxWeight, saveOutboxWeight, type OutboxSnapshot } from '@/data/record-outbox';
import { latestWeightRecord, listWeightRecords, softDeleteWeightRecord, upsertWeightRecord } from '@/data/weights';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useOptimisticRecordStore,
  type OptimisticSaveResult,
} from '@/features/record/use-optimistic-record-store';
import { showToast } from '@/ui/toast';

export type WeightSaveResult = OptimisticSaveResult;

type WeightContextValue = {
  ready: boolean;
  loadError: string | null;
  records: WeightRecord[];
  failedIds: ReadonlySet<string>;
  pendingDeleteIds: ReadonlySet<string>;
  deletedNotice: boolean;
  savingIds: ReadonlySet<string>;
  refreshing: boolean;
  refreshError: boolean;
  daySwitch: string;
  timeZone: string;
  reload: () => Promise<void>;
  saveWeight: (weightKg: number, existingId?: string) => Promise<WeightSaveResult>;
  retry: (id: string) => Promise<void>;
  dismiss: (id: string) => void;
  dismissDeletedNotice: () => void;
  removeRecord: (id: string) => Promise<void>;
  scheduleDelete: (id: string) => void;
  saveDaySwitch: (value: string) => Promise<void>;
};

const WeightContext = createContext<WeightContextValue | null>(null);

const selectWeightOutbox = (outbox: OutboxSnapshot) => outbox.weights;

export function WeightProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  const loadSaved = useCallback(async (switchTime: string) => {
    const endDay = computeLocalDay(new Date(), currentTimeZone(), switchTime);
    const [rows, latest] = await Promise.all([
      listWeightRecords(weightListWindow(endDay, TREND_WINDOW_DAYS)),
      latestWeightRecord(),
    ]);
    const merged = !latest || rows.some((row) => row.id === latest.id) ? rows : [...rows, latest];
    return { rows: merged, extra: null };
  }, []);

  const onSaveSuccess = useCallback((record: WeightRecord, switchTime: string) => {
    showToast({ text: saveToastMessage(new Date(record.recordedAt), record.tz, switchTime) });
  }, []);

  const store = useOptimisticRecordStore<WeightRecord, null>({
    scope: 'weight',
    userId: session?.userId ?? null,
    initialExtra: null,
    selectOutboxItems: selectWeightOutbox,
    saveOutboxItem: saveOutboxWeight,
    removeOutboxItem: removeOutboxWeight,
    loadServerData: loadSaved,
    upsertServerItem: upsertWeightRecord,
    softDeleteServerItem: softDeleteWeightRecord,
    onSaveSuccess,
  });

  const {
    ready,
    loadError,
    records,
    pendingItems,
    failedIds,
    pendingDeleteIds,
    deletedNotice,
    savingIds,
    refreshing,
    refreshError,
    daySwitch,
    inFlightRef,
    reload,
    reloadForDaySwitch,
    executeOptimisticSave,
    dismiss,
    dismissDeletedNotice,
    removeRecord,
    scheduleDelete,
  } = store;

  const saveWeight = useCallback(
    async (weightKg: number, existingId?: string): Promise<WeightSaveResult> => {
      const id = existingId ?? createId();
      if (inFlightRef.current.has(id)) return 'retry';
      const existing = existingId ? pendingItems.find((item) => item.id === existingId) : undefined;
      const recordedAt = existing ? new Date(existing.recordedAt) : new Date();
      const tz = existing?.tz ?? currentTimeZone();
      const record: WeightRecord = {
        id,
        weightKg,
        recordedAt: recordedAt.toISOString(),
        tz,
        localDay: existing?.localDay ?? computeLocalDay(recordedAt, tz, daySwitch),
        updatedAt: new Date().toISOString(),
      };
      return executeOptimisticSave(record);
    },
    [daySwitch, executeOptimisticSave, inFlightRef, pendingItems],
  );

  const retry = useCallback(
    async (id: string) => {
      const record = pendingItems.find((item) => item.id === id);
      if (!record) return;
      await saveWeight(record.weightKg, id);
    },
    [pendingItems, saveWeight],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
    const onOnline = () => {
      for (const id of failedIds) void retry(id);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [failedIds, retry]);

  const saveDaySwitch = useCallback(
    async (value: string) => {
      const normalized = value.trim();
      if (!isDaySwitch(normalized)) throw new Error('日切时间格式是 04:00');
      await updateDaySwitch(normalized);
      await reloadForDaySwitch(normalized);
    },
    [reloadForDaySwitch],
  );

  const value = useMemo<WeightContextValue>(
    () => ({
      ready,
      loadError,
      records,
      failedIds,
      pendingDeleteIds,
      deletedNotice,
      savingIds,
      refreshing,
      refreshError,
      daySwitch,
      timeZone: currentTimeZone(),
      reload,
      saveWeight,
      retry,
      dismiss,
      dismissDeletedNotice,
      removeRecord,
      scheduleDelete,
      saveDaySwitch,
    }),
    [
      ready,
      loadError,
      records,
      failedIds,
      pendingDeleteIds,
      deletedNotice,
      savingIds,
      refreshing,
      refreshError,
      daySwitch,
      reload,
      saveWeight,
      retry,
      dismiss,
      dismissDeletedNotice,
      removeRecord,
      scheduleDelete,
      saveDaySwitch,
    ],
  );

  return <WeightContext.Provider value={value}>{children}</WeightContext.Provider>;
}

export function useWeight(): WeightContextValue {
  const value = useContext(WeightContext);
  if (!value) throw new Error('useWeight must be used inside WeightProvider');
  return value;
}
