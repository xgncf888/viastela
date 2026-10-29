import { createId } from '@/core/id';
import {
  clockFace,
  DEFAULT_MONTH_END_TIME,
  DEFAULT_TRAINING_TIME,
  normalizeTrainingDays,
  postgresTime,
  type ReminderDraft,
} from '@/core/reminder-settings';
import { isRecordDeleted, RECORD_DELETED, requireDeletedIds } from '@/core/weight-write';

import { getSupabase } from './client';
import { liveRows } from './live-rows';

const columns =
  'id, endpoint, p256dh, auth, tz, month_end_time, month_end_enabled, training_time, training_days, training_enabled';

type PushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  tz: string;
  month_end_time: string;
  month_end_enabled: boolean;
  training_time: string;
  training_days: number[] | null;
  training_enabled: boolean;
};

function toDraft(row: PushRow): ReminderDraft {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    tz: row.tz,
    trainingEnabled: row.training_enabled,
    monthEndEnabled: row.month_end_enabled,
    trainingDays: normalizeTrainingDays(row.training_days ?? []),
    trainingTime: clockFace(row.training_time) ?? DEFAULT_TRAINING_TIME,
    monthEndTime: clockFace(row.month_end_time) ?? DEFAULT_MONTH_END_TIME,
  };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Not signed in');
  return userId;
}

export async function listPushSubscriptions(): Promise<ReminderDraft[]> {
  const { data, error } = await liveRows(getSupabase().from('push_subscriptions').select(columns)).order(
    'updated_at',
    { ascending: false },
  );
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map((row) => toDraft(row));
}

export function newSubscriptionId(): string {
  return createId();
}

/** Insert or update this browser's row. A soft-deleted id is not reused. */
export async function upsertPushSubscription(draft: ReminderDraft): Promise<void> {
  if (!draft.id || !draft.endpoint || !draft.p256dh || !draft.auth) {
    throw new Error('Missing push subscription');
  }
  const trainingTime = postgresTime(draft.trainingTime);
  const monthEndTime = postgresTime(draft.monthEndTime);
  if (!trainingTime || !monthEndTime) throw new Error('Invalid reminder time');
  const userId = await currentUserId();
  const { error } = await getSupabase()
    .from('push_subscriptions')
    .upsert(
      {
        id: draft.id,
        user_id: userId,
        endpoint: draft.endpoint,
        p256dh: draft.p256dh,
        auth: draft.auth,
        tz: draft.tz,
        month_end_time: monthEndTime,
        month_end_enabled: draft.monthEndEnabled,
        training_time: trainingTime,
        training_days: normalizeTrainingDays(draft.trainingDays),
        training_enabled: draft.trainingEnabled,
      },
      { onConflict: 'id' },
    );
  if (error) {
    if (isRecordDeleted(error)) throw new Error(RECORD_DELETED);
    throw error;
  }
}

/** Plain update. A deleted id raises P0001 and is not rewritten. Zero rows is a failed delete. */
export async function softDeletePushSubscription(id: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from('push_subscriptions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) {
    if (isRecordDeleted(error)) throw new Error(RECORD_DELETED);
    throw error;
  }
  requireDeletedIds(data);
}
