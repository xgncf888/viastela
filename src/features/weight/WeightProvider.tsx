import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone, DEFAULT_DAY_SWITCH, isDaySwitch, saveToastMessage } from '@/core/local-day';
import {
  cancelDeferredDeletes,
  installDeferredDeleteLifecycle,
  scheduleDeferredDelete,
  useDeferredDeleteIds,
} from '@/features/record/deferred-delete';
import { beginSave, confirmSave, reconcileServerRows, visibleRecords, type SaveState } from '@/core/save-state';
import { RECORD_DELETED, weightSaveOutcome } from '@/core/weight-write';
import { TREND_WINDOW_DAYS, weightListWindow, type WeightRecord } from '@/core/weight-stats';
import { getDaySwitch, updateDaySwitch } from '@/data/profile';
import { latestWeightRecord, listWeightRecords, softDeleteWeightRecord, upsertWeightRecord } from '@/data/weights';
import { showToast } from '@/ui/toast';

export type WeightSaveResult = 'saved' | 'retry' | 'deleted';

type WeightContextValue = {
  ready: boolean;
  loadError: string | null;
  records: WeightRecord[];
  failedIds: ReadonlySet<string>;
  pendingDeleteIds: ReadonlySet<string>;
  deletedNotice: boolean;
  saving: boolean;
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

export function WeightProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [saveState, setSaveState] = useState<SaveState<WeightRecord>>({ saved: [], pending: [] });
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const [daySwitch, setDaySwitch] = useState(DEFAULT_DAY_SWITCH);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState(false);
  const creating = useRef(false);
  const inFlight = useRef(new Set<string>());
  const saves = useRef(0);
  const alive = useRef(new Set<string>());
  const loadTicket = useRef(0);
  const confirmedTicket = useRef(new Map<string, number>());
  const pendingDeleteIds = useDeferredDeleteIds();

  const loadSaved = useCallback(async (switchTime: string) => {
    const endDay = computeLocalDay(new Date(), currentTimeZone(), switchTime);
    const [rows, latest] = await Promise.all([
      listWeightRecords(weightListWindow(endDay, TREND_WINDOW_DAYS)),
      latestWeightRecord(),
    ]);
    if (!latest || rows.some((row) => row.id === latest.id)) return rows;
    return [...rows, latest];
  }, []);

  const applyRows = useCallback((rows: WeightRecord[], nextSwitch: string, ticket: number) => {
    const keep = new Set<string>();
    for (const [id, at] of confirmedTicket.current) {
      if (at >= ticket) keep.add(id);
    }
    for (const row of rows) confirmedTicket.current.delete(row.id);
    setLoadError(null);
    setSaveState((current) => reconcileServerRows(current, rows, keep));
    setDaySwitch(nextSwitch);
    setReady(true);
  }, []);

  const reload = useCallback(async () => {
    const ticket = ++loadTicket.current;
    try {
      const nextSwitch = await getDaySwitch();
      const rows = await loadSaved(nextSwitch);
      if (ticket !== loadTicket.current) return;
      applyRows(rows, nextSwitch, ticket);
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
      .then(async (nextSwitch) => ({ nextSwitch, rows: await loadSaved(nextSwitch) }))
      .then(
        ({ rows, nextSwitch }) => {
          if (cancelled || ticket !== loadTicket.current) return;
          applyRows(rows, nextSwitch, ticket);
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

  const saveWeight = useCallback(async (weightKg: number, existingId?: string) => {
    if (!existingId && creating.current) return 'retry';
    const id = existingId ?? createId();
    if (inFlight.current.has(id)) return 'retry';
    if (!existingId) creating.current = true;
    const existing = existingId ? saveState.pending.find((item) => item.id === existingId) : undefined;
    const recordedAt = existing ? new Date(existing.recordedAt) : new Date();
    const tz = existing?.tz ?? currentTimeZone();
    const switchTime = daySwitch;
    const record: WeightRecord = {
      id,
      weightKg,
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
    if (!existingId) creating.current = false;
    saves.current += 1;
    setSaving(true);
    void (async () => {
      try {
        await upsertWeightRecord(record);
        if (!alive.current.has(id)) return;
        confirmedTicket.current.set(id, loadTicket.current);
        setSaveState((current) => (current.pending.some((row) => row.id === id) ? confirmSave(current, record) : current));
        showToast({ text: saveToastMessage(recordedAt, tz, switchTime) });
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
  }, [daySwitch, saveState.pending]);

  const retry = useCallback(
    async (id: string) => {
      const record = saveState.pending.find((item) => item.id === id);
      if (!record) return;
      await saveWeight(record.weightKg, id);
    },
    [saveState.pending, saveWeight],
  );

  const dismissDeletedNotice = useCallback(() => {
    setDeletedNotice(false);
  }, []);

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

  const removeRecord = useCallback(
    async (id: string) => {
      const isSaved = saveState.saved.some((row) => row.id === id);
      if (!isSaved) {
        dismiss(id);
        return;
      }
      try {
        await softDeleteWeightRecord(id);
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
    scheduleDeferredDelete('weight', id, () => removeRecordRef.current(id));
  }, []);

  useEffect(() => installDeferredDeleteLifecycle(), []);

  useEffect(() => {
    if (session) return;
    cancelDeferredDeletes();
  }, [session]);

  useEffect(() => () => cancelDeferredDeletes('weight'), []);

  const saveDaySwitch = useCallback(async (value: string) => {
    const normalized = value.trim();
    if (!isDaySwitch(normalized)) throw new Error('日切时间格式是 04:00');
    await updateDaySwitch(normalized);
    setDaySwitch(normalized);
    try {
      const ticket = ++loadTicket.current;
      const rows = await loadSaved(normalized);
      if (ticket === loadTicket.current) applyRows(rows, normalized, ticket);
    } catch {
      setLoadError('读取失败');
    }
  }, [applyRows, loadSaved]);

  const records = useMemo(() => visibleRecords(saveState), [saveState]);
  const value = useMemo<WeightContextValue>(
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
      reload,
      saveWeight,
      retry,
      dismiss,
      dismissDeletedNotice,
      removeRecord,
      scheduleDelete,
      saveDaySwitch,
    }),
    [ready, loadError, records, failedIds, pendingDeleteIds, deletedNotice, saving, daySwitch, reload, saveWeight, retry, dismiss, dismissDeletedNotice, removeRecord, scheduleDelete, saveDaySwitch],
  );

  return <WeightContext.Provider value={value}>{children}</WeightContext.Provider>;
}

export function useWeight(): WeightContextValue {
  const value = useContext(WeightContext);
  if (!value) throw new Error('useWeight must be used inside WeightProvider');
  return value;
}
