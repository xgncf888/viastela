import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone, DEFAULT_DAY_SWITCH } from '@/core/local-day';
import { beginSave, confirmSave, visibleRecords, type SaveState } from '@/core/save-state';
import { recentTopicNames, type RecentTopicRow, type StudyRecord } from '@/core/study';
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
  const pendingDeleteIds = useDeferredDeleteIds();

  const loadSaved = useCallback(async (switchTime: string) => {
    const endDay = computeLocalDay(new Date(), currentTimeZone(), switchTime);
    const [records, recent] = await Promise.all([listStudyRecords(endDay), listRecentTopics()]);
    return { records, recent };
  }, []);

  const reload = useCallback(async () => {
    try {
      const nextSwitch = await getDaySwitch();
      const { records: rows, recent } = await loadSaved(nextSwitch);
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
        ({ records: rows, recent, nextSwitch }) => {
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
      setSaving(true);
      try {
        await upsertStudyRecord(record);
        try {
          const { records: rows, recent } = await loadSaved(switchTime);
          setRecentRows(recent);
          setSaveState((current) => ({
            saved: rows.some((row) => row.id === id) ? rows : confirmSave({ saved: rows, pending: [] }, record).saved,
            pending: current.pending.filter((row) => row.id !== id && !rows.some((saved) => saved.id === row.id)),
          }));
        } catch {
          setSaveState((current) => confirmSave(current, record));
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
