import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone, DEFAULT_DAY_SWITCH, isDaySwitch, saveToastMessage } from '@/core/local-day';
import { beginSave, confirmSave, visibleRecords, type SaveState } from '@/core/save-state';
import type { WeightRecord } from '@/core/weight-stats';
import { getDaySwitch, updateDaySwitch } from '@/data/profile';
import { listWeightRecords, upsertWeightRecord } from '@/data/weights';
import { showToast } from '@/ui/toast';

type WeightContextValue = {
  ready: boolean;
  loadError: string | null;
  records: WeightRecord[];
  failedIds: ReadonlySet<string>;
  saving: boolean;
  daySwitch: string;
  timeZone: string;
  reload: () => Promise<void>;
  saveWeight: (weightKg: number, existingId?: string) => Promise<boolean>;
  retry: (id: string) => Promise<void>;
  dismiss: (id: string) => void;
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
  const creating = useRef(false);
  const inFlight = useRef(new Set<string>());

  const reload = useCallback(async () => {
    try {
      const [rows, nextSwitch] = await Promise.all([listWeightRecords(), getDaySwitch()]);
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
    } catch {
      setLoadError('读取失败');
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;
    void Promise.all([listWeightRecords(), getDaySwitch()]).then(
      ([rows, nextSwitch]) => {
        if (cancelled) return;
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
  }, [session]);

  const saveWeight = useCallback(async (weightKg: number, existingId?: string) => {
    if (!existingId && creating.current) return false;
    const id = existingId ?? createId();
    if (inFlight.current.has(id)) return false;
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
        const rows = await listWeightRecords();
        setSaveState((current) => ({
          saved: rows.some((row) => row.id === id) ? rows : confirmSave({ saved: rows, pending: [] }, record).saved,
          pending: current.pending.filter((row) => row.id !== id && !rows.some((saved) => saved.id === row.id)),
        }));
      } catch {
        setSaveState((current) => confirmSave(current, record));
      }
      showToast({ text: saveToastMessage(recordedAt, tz, switchTime) });
      return true;
    } catch {
      setFailedIds((current) => new Set(current).add(id));
      showToast({ text: '保存失败，请重试', tone: 'error' });
      return false;
    } finally {
      inFlight.current.delete(id);
      if (!existingId) creating.current = false;
      setSaving(false);
    }
  }, [daySwitch, saveState.pending]);

  const retry = useCallback(
    async (id: string) => {
      const record = saveState.pending.find((item) => item.id === id);
      if (!record) return;
      await saveWeight(record.weightKg, id);
    },
    [saveState.pending, saveWeight],
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

  const saveDaySwitch = useCallback(async (value: string) => {
    const normalized = value.trim();
    if (!isDaySwitch(normalized)) throw new Error('日界时间格式是 04:00');
    await updateDaySwitch(normalized);
    setDaySwitch(normalized);
  }, []);

  const records = useMemo(() => visibleRecords(saveState), [saveState]);
  const value = useMemo<WeightContextValue>(
    () => ({
      ready,
      loadError,
      records,
      failedIds,
      saving,
      daySwitch,
      timeZone: currentTimeZone(),
      reload,
      saveWeight,
      retry,
      dismiss,
      saveDaySwitch,
    }),
    [ready, loadError, records, failedIds, saving, daySwitch, reload, saveWeight, retry, dismiss, saveDaySwitch],
  );

  return <WeightContext.Provider value={value}>{children}</WeightContext.Provider>;
}

export function useWeight(): WeightContextValue {
  const value = useContext(WeightContext);
  if (!value) throw new Error('useWeight must be used inside WeightProvider');
  return value;
}
