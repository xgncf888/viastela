import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_DAY_SWITCH } from '@/core/local-day';
import { beginSave, confirmSave, reconcileServerRows, visibleRecords, type SaveState } from '@/core/save-state';
import { RECORD_DELETED, weightSaveOutcome } from '@/core/weight-write';
import { withLoadTimeout } from '@/data/load-timeout';
import { getDaySwitch } from '@/data/profile';
import { readRecordOutbox, type OutboxSnapshot } from '@/data/record-outbox';
import {
  cancelDeferredDeletes,
  installDeferredDeleteLifecycle,
  scheduleDeferredDelete,
  useDeferredDeleteIds,
} from '@/features/record/deferred-delete';
import { showToast } from '@/ui/toast';

export type OptimisticSaveResult = 'saved' | 'retry' | 'deleted';

type IdentifiableRecord = {
  id: string;
  recordedAt: string;
  tz: string;
  localDay: string;
  updatedAt: string;
};

type UseOptimisticRecordStoreOptions<T extends IdentifiableRecord, TExtra> = {
  scope: 'weight' | 'training' | 'study';
  userId: string | null;
  initialExtra: TExtra;
  selectOutboxItems: (outbox: OutboxSnapshot) => T[];
  saveOutboxItem: (userId: string, item: T) => Promise<void>;
  removeOutboxItem: (userId: string, id: string) => Promise<void>;
  loadServerData: (daySwitch: string) => Promise<{ rows: T[]; extra: TExtra }>;
  upsertServerItem: (item: T) => Promise<void>;
  softDeleteServerItem: (id: string) => Promise<void>;
  onSaveSuccess?: (item: T, daySwitch: string) => void;
};

export function useOptimisticRecordStore<T extends IdentifiableRecord, TExtra>(
  options: UseOptimisticRecordStoreOptions<T, TExtra>,
) {
  const {
    scope,
    userId,
    initialExtra,
    selectOutboxItems,
    saveOutboxItem,
    removeOutboxItem,
    loadServerData,
    upsertServerItem,
    softDeleteServerItem,
    onSaveSuccess,
  } = options;

  const [saveState, setSaveState] = useState<SaveState<T>>({ saved: [], pending: [] });
  const [extra, setExtra] = useState<TExtra>(initialExtra);
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const [daySwitch, setDaySwitch] = useState(DEFAULT_DAY_SWITCH);
  const [ready, setReady] = useState(false);
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState(false);

  const readyRef = useRef(false);
  const inFlight = useRef(new Set<string>());
  const alive = useRef(new Set<string>());
  const loadTicket = useRef(0);
  const confirmedTicket = useRef(new Map<string, number>());
  const pendingDeleteIds = useDeferredDeleteIds();

  const applyLoaded = useCallback((rows: T[], nextExtra: TExtra, nextSwitch: string, ticket: number) => {
    const keep = new Set<string>();
    for (const [id, at] of confirmedTicket.current) {
      if (at >= ticket) keep.add(id);
    }
    for (const row of rows) confirmedTicket.current.delete(row.id);
    setLoadError(null);
    setDaySwitch(nextSwitch);
    setExtra(nextExtra);
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
          const server = await loadServerData(nextSwitch);
          return { nextSwitch, ...server };
        })(),
      );
      if (ticket !== loadTicket.current) return;
      applyLoaded(loaded.rows, loaded.extra, loaded.nextSwitch, ticket);
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
  }, [applyLoaded, loadServerData]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    void readRecordOutbox(userId).then((outbox) => {
      const items = selectOutboxItems(outbox);
      if (cancelled || items.length === 0) return;
      for (const item of items) alive.current.add(item.id);
      setSaveState((current) => {
        let next = current;
        for (const item of items) next = beginSave(next, item);
        return next;
      });
      setFailedIds((current) => {
        const next = new Set(current);
        for (const item of items) next.add(item.id);
        return next;
      });
    });
    const ticket = ++loadTicket.current;
    void getDaySwitch()
      .then(async (nextSwitch) => ({ nextSwitch, ...(await loadServerData(nextSwitch)) }))
      .then(
        ({ rows, extra: nextExtra, nextSwitch }) => {
          if (cancelled || ticket !== loadTicket.current) return;
          applyLoaded(rows, nextExtra, nextSwitch, ticket);
          for (const row of rows) void removeOutboxItem(userId, row.id);
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
  }, [applyLoaded, loadServerData, removeOutboxItem, selectOutboxItems, userId]);

  const executeOptimisticSave = useCallback(
    async (item: T): Promise<OptimisticSaveResult> => {
      const { id } = item;
      if (inFlight.current.has(id)) return 'retry';
      setSaveState((current) => beginSave(current, item));
      setFailedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      inFlight.current.add(id);
      alive.current.add(id);
      setSavingIds((current) => {
        const next = new Set(current);
        next.add(id);
        return next;
      });
      const currentSwitch = daySwitch;
      const currentUserId = userId ?? '';
      void (async () => {
        try {
          await upsertServerItem(item);
          if (currentUserId) void removeOutboxItem(currentUserId, id);
          if (!alive.current.has(id)) return;
          confirmedTicket.current.set(id, loadTicket.current);
          setSaveState((current) =>
            current.pending.some((row) => row.id === id) ? confirmSave(current, item) : current,
          );
          onSaveSuccess?.(item, currentSwitch);
        } catch (error) {
          confirmedTicket.current.delete(id);
          if (!alive.current.has(id)) return;
          if (weightSaveOutcome(error) === RECORD_DELETED) {
            if (currentUserId) void removeOutboxItem(currentUserId, id);
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
          if (currentUserId) void saveOutboxItem(currentUserId, item);
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
    [daySwitch, onSaveSuccess, removeOutboxItem, saveOutboxItem, upsertServerItem, userId],
  );

  const dismiss = useCallback(
    (id: string) => {
      if (userId) void removeOutboxItem(userId, id);
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
    },
    [removeOutboxItem, userId],
  );

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
        await softDeleteServerItem(id);
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
    [dismiss, saveState.saved, softDeleteServerItem],
  );

  const removeRecordRef = useRef(removeRecord);
  useEffect(() => {
    removeRecordRef.current = removeRecord;
  }, [removeRecord]);

  const scheduleDelete = useCallback(
    (id: string) => {
      scheduleDeferredDelete(scope, id, () => removeRecordRef.current(id));
    },
    [scope],
  );

  const reloadForDaySwitch = useCallback(
    async (normalizedSwitch: string) => {
      setDaySwitch(normalizedSwitch);
      try {
        const ticket = ++loadTicket.current;
        const { rows, extra: nextExtra } = await loadServerData(normalizedSwitch);
        if (ticket === loadTicket.current) {
          applyLoaded(rows, nextExtra, normalizedSwitch, ticket);
        }
      } catch {
        setLoadError('读取失败');
      }
    },
    [applyLoaded, loadServerData],
  );

  useEffect(() => installDeferredDeleteLifecycle(), []);
  useEffect(() => {
    if (userId) return;
    cancelDeferredDeletes();
  }, [userId]);
  useEffect(() => () => cancelDeferredDeletes(scope), [scope]);

  const records = useMemo(() => visibleRecords(saveState), [saveState]);

  return {
    ready,
    loadError,
    records,
    pendingItems: saveState.pending,
    extra,
    setExtra,
    failedIds,
    pendingDeleteIds,
    deletedNotice,
    savingIds,
    refreshing,
    refreshError,
    daySwitch,
    inFlightRef: inFlight,
    reload,
    reloadForDaySwitch,
    executeOptimisticSave,
    dismiss,
    dismissDeletedNotice,
    removeRecord,
    scheduleDelete,
  };
}
