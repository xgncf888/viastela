import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

import type { DueSubscription } from './due.ts';
import { handleReminders, publicLog, unavailableRemindersResponse } from './handler.ts';
import { sendWebPush } from './push.ts';

type PushSubscriptionRecord = {
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
  deleted_at: string | null;
};

function asDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((day): day is number => Number.isInteger(day));
}

function mapRow(row: PushSubscriptionRecord): DueSubscription {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    tz: row.tz,
    monthEndTime: row.month_end_time,
    monthEndEnabled: row.month_end_enabled === true,
    trainingTime: row.training_time,
    trainingDays: asDays(row.training_days),
    trainingEnabled: row.training_enabled === true,
    deletedAt: row.deleted_at,
  };
}

/**
 * Cron entry. Keys and the service role come from the function env and are
 * never logged. `reminder_deliveries` is service-role only.
 *
 * insert into public.reminder_deliveries (subscription_id, kind, local_day, sent_at)
 * values ($1, $2, $3, now())
 * on conflict (subscription_id, kind, local_day) do nothing
 * returning subscription_id;
 */
Deno.serve(async (request) => {
  const cronSecret = Deno.env.get('REMINDERS_CRON_SECRET') ?? '';
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate || !vapidSubject || !cronSecret) {
    return unavailableRemindersResponse();
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return handleReminders(request, {
    cronSecret,
    now: () => new Date(),
    log: (event) => {
      console.log(publicLog(event));
    },
    async loadSubscriptions() {
      const { data, error } = await admin
        .from('push_subscriptions')
        .select(
          'id, endpoint, p256dh, auth, tz, month_end_time, month_end_enabled, training_time, training_days, training_enabled, deleted_at',
        )
        .is('deleted_at', null);
      if (error || !Array.isArray(data)) throw new Error('load_failed');
      return data.map((row) => mapRow(row as PushSubscriptionRecord));
    },
    async claimDelivery(claim) {
      const { data, error } = await admin
        .from('reminder_deliveries')
        .upsert(
          {
            subscription_id: claim.subscriptionId,
            kind: claim.kind,
            local_day: claim.localDay,
            sent_at: new Date().toISOString(),
          },
          { onConflict: 'subscription_id,kind,local_day', ignoreDuplicates: true },
        )
        .select('subscription_id');
      if (error || !Array.isArray(data)) throw new Error('claim_failed');
      return data.length > 0;
    },
    async softDelete(id: string) {
      const { error } = await admin
        .from('push_subscriptions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .is('deleted_at', null);
      if (error) throw new Error('delete_failed');
    },
    sendPush(message) {
      return sendWebPush(message, {
        publicKey: vapidPublic,
        privateKey: vapidPrivate,
        subject: vapidSubject,
      });
    },
  });
});
