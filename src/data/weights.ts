import type { WeightRecord } from '@/core/weight-stats';

import { getSupabase } from './client';

function asNumber(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Invalid weight from database');
  return parsed;
}

export async function listWeightRecords(): Promise<WeightRecord[]> {
  const { data, error } = await getSupabase()
    .from('weight_records')
    .select('id, weight_kg, recorded_at, tz, local_day, updated_at')
    .order('recorded_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    weightKg: asNumber(row.weight_kg as number | string),
    recordedAt: row.recorded_at,
    tz: row.tz,
    localDay: row.local_day,
    updatedAt: row.updated_at,
  }));
}

export async function upsertWeightRecord(record: WeightRecord): Promise<void> {
  const { data, error: sessionError } = await getSupabase().auth.getSession();
  if (sessionError) throw sessionError;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Not signed in');
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
  if (error) throw error;
}
