import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone, DEFAULT_DAY_SWITCH } from '@/core/local-day';
import { beginSave, confirmSave, reconcileServerRows, visibleRecords, type SaveState } from '@/core/save-state';
import { recentTopicNames, studySaveToast, type RecentTopicRow, type StudyRecord } from '@/core/study';
import { RECORD_DELETED, weightSaveOutcome } from '@/core/weight-write';
import { getDaySwitch } from '@/data/profile';
import { withLoadTimeout } from '@/data/load-timeout';
import { readRecordOutbox, removeOutboxStudyRecord, saveOutboxStudyRecord } from '@/data/record-outbox';
import { listRecentTopics, listStudyRecords, softDeleteStudyRecord, upsertStudyRecord } from '@/data/study';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  cancelDeferredDeletes,
  installDeferredDeleteLifecycle,
  scheduleDeferredDelete,
  useDeferredDeleteIds,
} from '@/features/record/deferred-delete';
import { showToast } from '@/ui/toast';

export type StudySaveResult = 'saved' | 'retry' | 'deleted';

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

export function StudyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [saveState, setSaveState] = useState<SaveState<StudyRecord>>({ saved: [], pending: [] });
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const [daySwitch, setDaySwitch] = useState(DEFAULT_DAY_SWITCH);
  const [ready, setReady] = useState(false);
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const readyRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState(false);
  const [recentRows, setRecentRows] = useState<RecentTopicRow[]>([]);
  const creating = useRef(false);
  const inFlight = useRef(new Set<string>());
  const alive = useRef(new Set<string>());
  const loadTicket = useRef(0);
  const confirmedTicket = useRef(new Map<string, number>());
  const pendingDeleteIds = useDeferredDeleteIds();

  const loadSaved = useCallback(async (switchTime: string) => {
    const endDay = computeLocalDay(new Date(), currentTimeZone(), switchTime);
    const [records, recent] = await Promise.all([listStudyRecords(endDay), listRecentTopics()]);
    return { records, recent };
  }, []);

  const applyRows = useCallback((rows: StudyRecord[], recent: RecentTopicRow[], nextSwitch: string, ticket: number) => {
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
      applyRows(loaded.records, loaded.recent, loaded.nextSwitch, ticket);
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
    const userId = session.userId;
    let cancelled = false;
    void readRecordOutbox(userId).then((outbox) => {
      if (cancelled || outbox.studyRecords.length === 0) return;
      for (const item of outbox.studyRecords) alive.current.add(item.id);
      setSaveState((current) => {
        let next = current;
        for (const item of outbox.studyRecords) next = beginSave(next, item);
        return next;
      });
      setFailedIds((current) => {
        const next = new Set(current);
        for (const item of outbox.studyRecords) next.add(item.id);
        return next;
      });
    });
    const ticket = ++loadTicket.current;
    void getDaySwitch()
      .then(async (nextSwitch) => ({ nextSwitch, ...(await loadSaved(nextSwitch)) }))
      .then(
        ({ records: rows, recent, nextSwitch }) => {
          if (cancelled || ticket !== loadTicket.current) return;
          applyRows(rows, recent, nextSwitch, ticket);
          for (const row of rows) void removeOutboxStudyRecord(userId, row.id);
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

  const saveRecord = useCallback(
    async (input: {
      topic: string;
      durationMinutes: number;
      note: string | null;
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
      const userId = session?.userId ?? '';
      const record: StudyRecord = {
        id,
        topic: input.topic,
        durationMinutes: input.durationMinutes,
        note: input.note,
        recordedAt: recordedAt.toISOString(),
        tz,
        localDay: existing?.localDay ?? computeLocalDay(recordedAt, tz, switchTime),
        updatedAt: new Date().toISOString(),
      };
      setSaveState((current) => beginSave(current, record));
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
          await upsertStudyRecord(record);
          if (userId) void removeOutboxStudyRecord(userId, id);
          if (!alive.current.has(id)) return;
          confirmedTicket.current.set(id, loadTicket.current);
          setSaveState((current) => (current.pending.some((row) => row.id === id) ? confirmSave(current, record) : current));
          setRecentRows((current) => [{ topic: record.topic, recordedAt: record.recordedAt }, ...current]);
          showToast({ text: studySaveToast(record.topic, record.durationMinutes, record.localDay) });
        } catch (error) {
          confirmedTicket.current.delete(id);
          if (!alive.current.has(id)) return;
          if (weightSaveOutcome(error) === RECORD_DELETED) {
            if (userId) void removeOutboxStudyRecord(userId, id);
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
          if (userId) void saveOutboxStudyRecord(userId, record);
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
    [daySwitch, saveState.pending, session?.userId],
  );

  const retry = useCallback(
    async (id: string) => {
      const record = saveState.pending.find((item) => item.id === id);
      if (!record) return;
      await saveRecord({
        topic: record.topic,
        durationMinutes: record.durationMinutes,
        note: record.note,
        existingId: id,
      });
    },
    [saveRecord, saveState.pending],
  );

  const dismiss = useCallback((id: string) => {
    if (session) void removeOutboxStudyRecord(session.userId, id);
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
  }, [session]);

  const dismissDeletedNotice = useCallback(() => {
    setDeletedNotice(false);
  }, []);

  const removeRecord = useCallback(
    async (id: string) => {
      const isSaved = saveState.saved.some((row) => row.id === id);
      if (!isSaved) {
        dismiss(id);
        return;
      }
      try {
        await softDeleteStudyRecord(id);
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

  const removeRecordRef = useRef(removeRecord);
  useEffect(() => {
    removeRecordRef.current = removeRecord;
  }, [removeRecord]);

  const scheduleDelete = useCallback((id: string) => {
    scheduleDeferredDelete('study', id, () => removeRecordRef.current(id));
  }, []);

  useEffect(() => installDeferredDeleteLifecycle(), []);
  useEffect(() => () => cancelDeferredDeletes('study'), []);

  const records = useMemo(() => visibleRecords(saveState), [saveState]);
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
