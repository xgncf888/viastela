import type { RecentTopicRow, StudyRecord } from '@/core/study';
import { isRecordDeleted, RECORD_DELETED, requireDeletedIds } from '@/core/weight-write';

import { getSupabase } from './client';
import { liveRows } from './live-rows';

const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

const columns = 'id, topic, duration_minutes, note, recorded_at, tz, local_day, updated_at' as const;

function toRecord(row: {
  id: string;
  topic: string;
  duration_minutes: number;
  note: string | null;
  recorded_at: string;
  tz: string;
  local_day: string;
  updated_at: string;
}): StudyRecord {
  return {
    id: row.id,
    topic: row.topic,
    durationMinutes: row.duration_minutes,
    note: row.note,
    recordedAt: row.recorded_at,
    tz: row.tz,
    localDay: row.local_day,
    updatedAt: row.updated_at,
  };
}

export async function listStudyRecords(localDay: string): Promise<StudyRecord[]> {
  if (!LOCAL_DAY.test(localDay)) throw new Error('Invalid study day');
  const { data, error } = await liveRows(getSupabase().from('study_records').select(columns))
    .eq('local_day', localDay)
    .order('recorded_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => toRecord(row));
}

/** Every live topic, newest first, capped. Callers dedupe. This is not today's list. */
export async function listRecentTopics(): Promise<RecentTopicRow[]> {
  const { data, error } = await liveRows(getSupabase().from('study_records').select('topic, recorded_at'))
    .order('recorded_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({ topic: row.topic, recordedAt: row.recorded_at }));
}

export async function upsertStudyRecord(record: StudyRecord): Promise<void> {
  const { data, error: sessionError } = await getSupabase().auth.getSession();
  if (sessionError) throw sessionError;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Not signed in');
  const { error } = await getSupabase().from('study_records').upsert(
    {
      id: record.id,
      user_id: userId,
      topic: record.topic,
      duration_minutes: record.durationMinutes,
      note: record.note,
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

export async function softDeleteStudyRecord(id: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from('study_records')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) {
    if (isRecordDeleted(error)) throw new Error(RECORD_DELETED);
    throw error;
  }
  requireDeletedIds(data);
}
