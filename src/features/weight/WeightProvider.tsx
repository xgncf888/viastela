import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone, DEFAULT_DAY_SWITCH, isDaySwitch, saveToastMessage } from '@/core/local-day';
import { beginSave, confirmSave, visibleRecords, type SaveState } from '@/core/save-state';
import { RECORD_DELETED, weightSaveOutcome } from '@/core/weight-write';
import { TREND_WINDOW_DAYS, weightListWindow, type WeightRecord } from '@/core/weight-stats';
import { getDaySwitch, updateDaySwitch } from '@/data/profile';
import { latestWeightRecord, listWeightRecords, softDeleteWeightRecord, upsertWeightRecord } from '@/data/weights';
import { dismissShownToast, showToast } from '@/ui/toast';

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

const DELETE_UNDO_MS = 5000;

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
  const pendingDeletes = useRef(new Set<string>());
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<ReadonlySet<string>>(new Set());

  const loadSaved = useCallback(async (switchTime: string) => {
    const endDay = computeLocalDay(new Date(), currentTimeZone(), switchTime);
    const [rows, latest] = await Promise.all([
      listWeightRecords(weightListWindow(endDay, TREND_WINDOW_DAYS)),
      latestWeightRecord(),
    ]);
    if (!latest || rows.some((row) => row.id === latest.id)) return rows;
    return [...rows, latest];
  }, []);

  const applyRows = useCallback((rows: WeightRecord[], nextSwitch: string) => {
    setLoadError(null);
    setSaveState((current) => {
      const serverIds = new Set(rows.map((row) => row.id));
      return {
        saved: rows,
        pending: current.pending.filter((row) => !serverIds.has(row.id)),
      };
    });
    setDaySwitch(nextSwitch);
    setReady(true);
  }, []);

  const reload = useCallback(async () => {
    try {
      const nextSwitch = await getDaySwitch();
      applyRows(await loadSaved(nextSwitch), nextSwitch);
    } catch {
      setLoadError('读取失败');
      setReady(true);
    }
  }, [applyRows, loadSaved]);

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;
    void getDaySwitch()
      .then(async (nextSwitch) => ({ nextSwitch, rows: await loadSaved(nextSwitch) }))
      .then(
        ({ rows, nextSwitch }) => {
          if (cancelled) return;
          applyRows(rows, nextSwitch);
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
    setSaving(true);
    try {
      await upsertWeightRecord(record);
      try {
        const rows = await loadSaved(switchTime);
        setSaveState((current) => ({
          saved: rows.some((row) => row.id === id) ? rows : confirmSave({ saved: rows, pending: [] }, record).saved,
          pending: current.pending.filter((row) => row.id !== id && !rows.some((saved) => saved.id === row.id)),
        }));
      } catch {
        setSaveState((current) => confirmSave(current, record));
      }
      showToast({ text: saveToastMessage(recordedAt, tz, switchTime) });
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
      if (!existingId) creating.current = false;
      setSaving(false);
    }
  }, [daySwitch, loadSaved, saveState.pending]);

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

  const revealPending = useCallback((id: string) => {
    setPendingDeleteIds((current) => {
      if (!current.has(id)) return current;
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
        revealPending(id);
        return;
      }
      try {
        await softDeleteWeightRecord(id);
        setSaveState((current) => ({
          saved: current.saved.filter((row) => row.id !== id),
          pending: current.pending.filter((row) => row.id !== id),
        }));
        revealPending(id);
      } catch {
        revealPending(id);
        showToast({ text: '删除失败，请重试', tone: 'error' });
      }
    },
    [dismiss, revealPending, saveState.saved],
  );

  const removeRecordRef = useRef(removeRecord);
  useEffect(() => {
    removeRecordRef.current = removeRecord;
  }, [removeRecord]);

  const cancelPendingDeletes = useCallback(() => {
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    deleteTimer.current = null;
    if (pendingDeletes.current.size === 0) return;
    pendingDeletes.current.clear();
    setPendingDeleteIds(new Set());
    dismissShownToast();
  }, []);

  const scheduleDelete = useCallback(
    (id: string) => {
      if (pendingDeletes.current.has(id)) return;
      pendingDeletes.current.add(id);
      setPendingDeleteIds(new Set(pendingDeletes.current));
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      const count = pendingDeletes.current.size;
      showToast({
        text: count === 1 ? '已删除' : `已删除 ${count} 条`,
        duration: DELETE_UNDO_MS,
        pinned: true,
        action: { label: '撤销', onPress: () => cancelPendingDeletes() },
      });
      deleteTimer.current = setTimeout(() => {
        deleteTimer.current = null;
        const state = AppState.currentState;
        if (state === 'background' || state === 'inactive') {
          cancelPendingDeletes();
          return;
        }
        const ids = [...pendingDeletes.current];
        pendingDeletes.current.clear();
        setPendingDeleteIds(new Set());
        for (const pendingId of ids) void removeRecordRef.current(pendingId);
      }, DELETE_UNDO_MS);
    },
    [cancelPendingDeletes],
  );

  useEffect(() => {
    const onChange = (next: string) => {
      if (next === 'background' || next === 'inactive') cancelPendingDeletes();
    };
    const subscription = AppState.isAvailable ? AppState.addEventListener('change', onChange) : null;
    const onPageHide = () => cancelPendingDeletes();
    if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide);
    return () => {
      subscription?.remove();
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide);
    };
  }, [cancelPendingDeletes]);

  useEffect(() => {
    if (session) return;
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    deleteTimer.current = null;
    pendingDeletes.current.clear();
  }, [session]);

  useEffect(() => {
    const pending = pendingDeletes.current;
    return () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      deleteTimer.current = null;
      pending.clear();
    };
  }, []);

  const saveDaySwitch = useCallback(async (value: string) => {
    const normalized = value.trim();
    if (!isDaySwitch(normalized)) throw new Error('日界时间格式是 04:00');
    await updateDaySwitch(normalized);
    setDaySwitch(normalized);
    try {
      const rows = await loadSaved(normalized);
      setSaveState((current) => ({
        saved: rows,
        pending: current.pending.filter((row) => !rows.some((saved) => saved.id === row.id)),
      }));
    } catch {
      setLoadError('读取失败');
    }
  }, [loadSaved]);

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
