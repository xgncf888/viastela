import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone, DEFAULT_DAY_SWITCH } from '@/core/local-day';
import { beginSave, confirmSave, reconcileServerRows, visibleRecords, type SaveState } from '@/core/save-state';
import { recentTopicNames, studySaveToast, type RecentTopicRow, type StudyRecord } from '@/core/study';
import { RECORD_DELETED, weightSaveOutcome } from '@/core/weight-write';
import { getDaySwitch } from '@/data/profile';
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
  saving: boolean;
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
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState(false);
  const [recentRows, setRecentRows] = useState<RecentTopicRow[]>([]);
  const creating = useRef(false);
  const inFlight = useRef(new Set<string>());
  const saves = useRef(0);
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
    setReady(true);
  }, []);

  const reload = useCallback(async () => {
    const ticket = ++loadTicket.current;
    try {
      const nextSwitch = await getDaySwitch();
      const { records: rows, recent } = await loadSaved(nextSwitch);
      if (ticket !== loadTicket.current) return;
      applyRows(rows, recent, nextSwitch, ticket);
    } catch {
      if (ticket !== loadTicket.current) return;
      setLoadError('读取失败');
      setReady(true);
    }
  }, [applyRows, loadSaved]);

  useEffect(() => {
    if (!session) return undefined;
    const ticket = ++loadTicket.current;
    let cancelled = false;
    void getDaySwitch()
      .then(async (nextSwitch) => ({ nextSwitch, ...(await loadSaved(nextSwitch)) }))
      .then(
        ({ records: rows, recent, nextSwitch }) => {
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
      saves.current += 1;
      setSaving(true);
      void (async () => {
        try {
          await upsertStudyRecord(record);
          if (!alive.current.has(id)) return;
          confirmedTicket.current.set(id, loadTicket.current);
          setSaveState((current) => (current.pending.some((row) => row.id === id) ? confirmSave(current, record) : current));
          setRecentRows((current) => [{ topic: record.topic, recordedAt: record.recordedAt }, ...current]);
          showToast({ text: studySaveToast(record.topic, record.durationMinutes, record.localDay) });
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
          saves.current = Math.max(0, saves.current - 1);
          setSaving(saves.current > 0);
        }
      })();
      return 'saved';
    },
    [daySwitch, saveState.pending],
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
      saving,
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
      saving,
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
