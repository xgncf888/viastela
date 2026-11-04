import type { RecentExerciseRow, TrainingSet } from '@/core/training';
import { isRecordDeleted, RECORD_DELETED, requireDeletedIds } from '@/core/weight-write';

import { getAuthenticatedRemoteSession, isLocalModeSelected, isLocalOnlySession, requireRemoteUserId } from './auth';
import { getSupabase } from './client';
import { liveRows } from './live-rows';
import {
  localListRecentExercises,
  localListTrainingSets,
  localSoftDeleteTrainingSet,
  localUpsertTrainingSet,
} from './local-db';

const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

const columns = 'id, exercise, reps, weight_kg, band_level, recorded_at, tz, local_day, updated_at' as const;

function asWeight(value: number | string | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Invalid training weight from database');
  return parsed;
}

function toSet(row: {
  id: string;
  exercise: string;
  reps: number;
  weight_kg: number | string | null;
  band_level: string | null;
  recorded_at: string;
  tz: string;
  local_day: string;
  updated_at: string;
}): TrainingSet {
  return {
    id: row.id,
    exercise: row.exercise,
    reps: row.reps,
    weightKg: asWeight(row.weight_kg),
    bandLevel: row.band_level,
    recordedAt: row.recorded_at,
    tz: row.tz,
    localDay: row.local_day,
    updatedAt: row.updated_at,
  };
}

export async function listTrainingSets(localDay: string): Promise<TrainingSet[]> {
  if (!LOCAL_DAY.test(localDay)) throw new Error('Invalid training day');
  const session = await getAuthenticatedRemoteSession();
  if (!session || isLocalOnlySession(session)) {
    return isLocalModeSelected() ? localListTrainingSets(localDay) : [];
  }
  const { data, error } = await liveRows(getSupabase().from('training_sets').select(columns))
    .eq('local_day', localDay)
    .order('recorded_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => toSet(row));
}

/** Every live set, newest first. Callers dedupe. This is not today's list. */
export async function listRecentExercises(): Promise<RecentExerciseRow[]> {
  const session = await getAuthenticatedRemoteSession();
  if (!session || isLocalOnlySession(session)) {
    return isLocalModeSelected() ? localListRecentExercises() : [];
  }
  const { data, error } = await liveRows(getSupabase().from('training_sets').select('exercise, recorded_at'))
    .order('recorded_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({ exercise: row.exercise, recordedAt: row.recorded_at }));
}

export async function upsertTrainingSet(set: TrainingSet): Promise<void> {
  const session = await getAuthenticatedRemoteSession();
  if ((!session || isLocalOnlySession(session)) && isLocalModeSelected()) {
    await localUpsertTrainingSet(set);
    return;
  }
  const userId = await requireRemoteUserId();
  const { error } = await getSupabase().from('training_sets').upsert(
    {
      id: set.id,
      user_id: userId,
      exercise: set.exercise,
      reps: set.reps,
      weight_kg: set.weightKg,
      band_level: set.bandLevel,
      recorded_at: set.recordedAt,
      tz: set.tz,
      local_day: set.localDay,
      updated_at: set.updatedAt,
    },
    { onConflict: 'id' },
  );
  if (error) {
    if (isRecordDeleted(error)) throw new Error(RECORD_DELETED);
    throw error;
  }
}

export async function softDeleteTrainingSet(id: string): Promise<void> {
  const session = await getAuthenticatedRemoteSession();
  if ((!session || isLocalOnlySession(session)) && isLocalModeSelected()) {
    await localSoftDeleteTrainingSet(id);
    return;
  }
  await requireRemoteUserId();
  const { data, error } = await getSupabase()
    .from('training_sets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) {
    if (isRecordDeleted(error)) throw new Error(RECORD_DELETED);
    throw error;
  }
  requireDeletedIds(data);
}
