import { isRecordDeleted, RECORD_DELETED, requireDeletedIds } from '@/core/weight-write';
import type { WeightRecord } from '@/core/weight-stats';

import { getAuthenticatedRemoteSession, isLocalModeSelected, isLocalOnlySession, requireRemoteUserId } from './auth';
import { getSupabase } from './client';
import { liveRows } from './live-rows';
import {
  localLatestWeightRecord,
  localListWeightRecords,
  localSoftDeleteWeightRecord,
  localUpsertWeightRecord,
} from './local-db';

export type WeightDayWindow = {
  fromDay: string;
  toDay: string;
};

const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

function asNumber(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Invalid weight from database');
  return parsed;
}

function assertWindow(window: WeightDayWindow): void {
  if (!LOCAL_DAY.test(window.fromDay) || !LOCAL_DAY.test(window.toDay) || window.fromDay > window.toDay) {
    throw new Error('Invalid weight window');
  }
}

function toRecord(row: {
  id: string;
  weight_kg: number | string;
  recorded_at: string;
  tz: string;
  local_day: string;
  updated_at: string;
}): WeightRecord {
  return {
    id: row.id,
    weightKg: asNumber(row.weight_kg),
    recordedAt: row.recorded_at,
    tz: row.tz,
    localDay: row.local_day,
    updatedAt: row.updated_at,
  };
}

const columns = 'id, weight_kg, recorded_at, tz, local_day, updated_at' as const;

/** Live rows whose accounting day falls in the window. */
export async function listWeightRecords(window: WeightDayWindow): Promise<WeightRecord[]> {
  assertWindow(window);
  const session = await getAuthenticatedRemoteSession();
  if (!session || isLocalOnlySession(session)) {
    return isLocalModeSelected() ? localListWeightRecords(window) : [];
  }
  const { data, error } = await liveRows(getSupabase().from('weight_records').select(columns))
    .gte('local_day', window.fromDay)
    .lte('local_day', window.toDay)
    .order('recorded_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => toRecord(row));
}

/** One newest live row, for one-tap reuse outside the chart window. */
export async function latestWeightRecord(): Promise<WeightRecord | null> {
  const session = await getAuthenticatedRemoteSession();
  if (!session || isLocalOnlySession(session)) {
    return isLocalModeSelected() ? localLatestWeightRecord() : null;
  }
  const { data, error } = await liveRows(getSupabase().from('weight_records').select(columns))
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toRecord(data) : null;
}

export async function upsertWeightRecord(record: WeightRecord): Promise<void> {
  const session = await getAuthenticatedRemoteSession();
  if ((!session || isLocalOnlySession(session)) && isLocalModeSelected()) {
    await localUpsertWeightRecord(record);
    return;
  }
  const userId = await requireRemoteUserId();
  const { error } = await getSupabase().from('weight_records').upsert(
    {
      id: record.id,
      user_id: userId,
      weight_kg: record.weightKg,
      recorded_at: record.recordedAt,
      tz: record.tz,
      local_day: record.localDay,
      updated_at: record.updatedAt,
    },
    { onConflict: 'id' },
  );
  if (error) {
    if (isRecordDeleted(error)) throw new Error(RECORD_DELETED);
    throw error;
  }
}

/** Plain update. A deleted id raises P0001 and is not rewritten. Zero rows is a failed delete. */
export async function softDeleteWeightRecord(id: string): Promise<void> {
  const session = await getAuthenticatedRemoteSession();
  if ((!session || isLocalOnlySession(session)) && isLocalModeSelected()) {
    await localSoftDeleteWeightRecord(id);
    return;
  }
  await requireRemoteUserId();
  const { data, error } = await getSupabase()
    .from('weight_records')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) {
    if (isRecordDeleted(error)) throw new Error(RECORD_DELETED);
    throw error;
  }
  requireDeletedIds(data);
}
