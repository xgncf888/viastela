import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone } from '@/core/local-day';
import { recentTopicNames, studySaveToast, type RecentTopicRow, type StudyRecord } from '@/core/study';
import { removeOutboxStudyRecord, saveOutboxStudyRecord, type OutboxSnapshot } from '@/data/record-outbox';
import { listRecentTopics, listStudyRecords, softDeleteStudyRecord, upsertStudyRecord } from '@/data/study';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useOptimisticRecordStore,
  type OptimisticSaveResult,
} from '@/features/record/use-optimistic-record-store';
import { showToast } from '@/ui/toast';

export type StudySaveResult = OptimisticSaveResult;

type StudyContextValue = {
  ready: boolean;
  loadError: string | null;
  records: StudyRecord[];
  failedIds: ReadonlySet<string>;
  pendingDeleteIds: ReadonlySet<string>;
  deletedNotice: boolean;
  savingIds: ReadonlySet<string>;
  refreshing: boolean;
  refreshError: boolean;
  daySwitch: string;
  timeZone: string;
  recentTopics: readonly string[];
  reload: () => Promise<void>;
  saveRecord: (input: {
    topic: string;
    durationMinutes: number;
    note: string | null;
    existingId?: string;
  }) => Promise<StudySaveResult>;
  retry: (id: string) => Promise<void>;
  dismiss: (id: string) => void;
  dismissDeletedNotice: () => void;
  scheduleDelete: (id: string) => void;
};

const StudyContext = createContext<StudyContextValue | null>(null);

const INITIAL_RECENT_TOPICS: RecentTopicRow[] = [];
const selectStudyOutbox = (outbox: OutboxSnapshot) => outbox.studyRecords;

export function StudyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const creating = useRef(false);

  const loadSaved = useCallback(async (switchTime: string) => {
    const endDay = computeLocalDay(new Date(), currentTimeZone(), switchTime);
    const [records, recent] = await Promise.all([listStudyRecords(endDay), listRecentTopics()]);
    return { rows: records, extra: recent };
  }, []);

  const onSaveSuccess = useCallback((record: StudyRecord) => {
    showToast({ text: studySaveToast(record.topic, record.durationMinutes, record.localDay) });
  }, []);

  const store = useOptimisticRecordStore<StudyRecord, RecentTopicRow[]>({
    scope: 'study',
    userId: session?.userId ?? null,
    initialExtra: INITIAL_RECENT_TOPICS,
    selectOutboxItems: selectStudyOutbox,
    saveOutboxItem: saveOutboxStudyRecord,
    removeOutboxItem: removeOutboxStudyRecord,
    loadServerData: loadSaved,
    upsertServerItem: upsertStudyRecord,
    softDeleteServerItem: softDeleteStudyRecord,
    onSaveSuccess,
  });

  const {
    ready,
    loadError,
    records,
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
    if (records.length === 0) return;
    const newest = records[records.length - 1];
    if (!newest) return;
    setRecentRows((current) => {
      if (current.some((item) => item.topic === newest.topic && item.recordedAt === newest.recordedAt)) {
        return current;
      }
      return [{ topic: newest.topic, recordedAt: newest.recordedAt }, ...current];
    });
  }, [records, setRecentRows]);

  const saveRecord = useCallback(
    async (input: {
      topic: string;
      durationMinutes: number;
      note: string | null;
      existingId?: string;
    }): Promise<StudySaveResult> => {
      if (!input.existingId && creating.current) return 'retry';
      const id = input.existingId ?? createId();
      if (inFlightRef.current.has(id)) return 'retry';
      if (!input.existingId) creating.current = true;
      const existing = input.existingId ? pendingItems.find((item) => item.id === input.existingId) : undefined;
      const recordedAt = existing ? new Date(existing.recordedAt) : new Date();
      const tz = existing?.tz ?? currentTimeZone();
      const record: StudyRecord = {
        id,
        topic: input.topic,
        durationMinutes: input.durationMinutes,
        note: input.note,
        recordedAt: recordedAt.toISOString(),
        tz,
        localDay: existing?.localDay ?? computeLocalDay(recordedAt, tz, daySwitch),
        updatedAt: new Date().toISOString(),
      };
      if (!input.existingId) creating.current = false;
      return executeOptimisticSave(record);
    },
    [daySwitch, executeOptimisticSave, inFlightRef, pendingItems],
  );

  const retry = useCallback(
    async (id: string) => {
      const record = pendingItems.find((item) => item.id === id);
      if (!record) return;
      await saveRecord({
        topic: record.topic,
        durationMinutes: record.durationMinutes,
        note: record.note,
        existingId: id,
      });
    },
    [pendingItems, saveRecord],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
    const onOnline = () => {
      for (const id of failedIds) void retry(id);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [failedIds, retry]);

  const recentTopics = useMemo(() => recentTopicNames(recentRows), [recentRows]);

  const value = useMemo<StudyContextValue>(
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
      recentTopics,
      reload,
      saveRecord,
      retry,
      dismiss,
      dismissDeletedNotice,
      scheduleDelete,
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
      recentTopics,
      reload,
      saveRecord,
      retry,
      dismiss,
      dismissDeletedNotice,
      scheduleDelete,
    ],
  );

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy(): StudyContextValue {
  const value = useContext(StudyContext);
  if (!value) throw new Error('useStudy must be used inside StudyProvider');
  return value;
}

export function useOptionalStudy(): StudyContextValue | null {
  return useContext(StudyContext);
}
