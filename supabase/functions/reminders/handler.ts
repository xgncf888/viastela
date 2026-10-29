import {
  canSend,
  deliveryLocalDay,
  isDue,
  reminderPayload,
  type DueSubscription,
  type ReminderKind,
  type ReminderPayload,
} from './due.ts';

export const REMINDERS_CRON_HEADER = 'x-reminders-cron-secret';
const KINDS: readonly ReminderKind[] = ['training', 'month_end'];

export type ReminderLog = {
  event: 'unauthorized' | 'unavailable' | 'claim_failed' | 'push_failed' | 'subscription_gone' | 'done';
  kind?: ReminderKind;
  status?: number;
  sent?: number;
  skipped?: number;
  expired?: number;
  failed?: number;
};

export type PushMessage = {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: ReminderPayload;
};

export type DeliveryClaim = {
  subscriptionId: string;
  kind: ReminderKind;
  localDay: string;
};

export type RemindersDependencies = {
  cronSecret: string;
  now: () => Date;
  log: (event: ReminderLog) => void;
  loadSubscriptions: () => Promise<DueSubscription[]>;
  /** True only when `insert ... on conflict do nothing returning` inserted a row. */
  claimDelivery: (claim: DeliveryClaim) => Promise<boolean>;
  softDelete: (subscriptionId: string) => Promise<void>;
  sendPush: (message: PushMessage) => Promise<{ status: number }>;
};

/** Copies the allowlisted fields so a log line cannot carry keys or endpoints. */
export function publicLog(event: ReminderLog): string {
  return JSON.stringify({
    event: event.event,
    kind: event.kind,
    status: event.status,
    sent: event.sent,
    skipped: event.skipped,
    expired: event.expired,
    failed: event.failed,
  });
}

export function constantTimeEqual(left: string, right: string): boolean {
  const encoded = new TextEncoder();
  const a = encoded.encode(left);
  const b = encoded.encode(right);
  if (a.length === 0 || b.length === 0 || a.length > 256 || b.length > 256) return false;
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

export function unavailableRemindersResponse(): Response {
  return json({ error: 'unavailable' }, 500);
}

function json(body: Record<string, string | number | boolean>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function handleReminders(request: Request, dependencies: RemindersDependencies): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  if (!dependencies.cronSecret) {
    dependencies.log({ event: 'unavailable' });
    return unavailableRemindersResponse();
  }
  const provided = request.headers.get(REMINDERS_CRON_HEADER) ?? '';
  if (!constantTimeEqual(provided, dependencies.cronSecret)) {
    dependencies.log({ event: 'unauthorized' });
    return json({ error: 'unauthorized' }, 401);
  }

  // The body is not a user id. Scanning uses the service role and every live row.
  try {
    await request.text();
  } catch {
    // An empty body is a normal cron tick.
  }

  let rows: DueSubscription[];
  try {
    rows = await dependencies.loadSubscriptions();
  } catch {
    dependencies.log({ event: 'unavailable' });
    return unavailableRemindersResponse();
  }

  const now = dependencies.now();
  let sent = 0;
  let skipped = 0;
  let expired = 0;
  let failed = 0;

  for (const row of rows) {
    for (const kind of KINDS) {
      if (!isDue(row, kind, now) || !canSend(row, kind)) {
        skipped += 1;
        continue;
      }
      let localDay: string;
      try {
        localDay = deliveryLocalDay(now, row.tz);
      } catch {
        failed += 1;
        dependencies.log({ event: 'push_failed', kind });
        continue;
      }
      let claimed = false;
      try {
        claimed = await dependencies.claimDelivery({ subscriptionId: row.id, kind, localDay });
      } catch {
        failed += 1;
        dependencies.log({ event: 'claim_failed', kind });
        continue;
      }
      if (!claimed) {
        skipped += 1;
        continue;
      }
      let status: number;
      try {
        const result = await dependencies.sendPush({
          endpoint: row.endpoint,
          p256dh: row.p256dh,
          auth: row.auth,
          payload: reminderPayload(kind),
        });
        status = result.status;
      } catch {
        failed += 1;
        dependencies.log({ event: 'push_failed', kind });
        continue;
      }
      if (status === 404 || status === 410) {
        try {
          await dependencies.softDelete(row.id);
        } catch {
          failed += 1;
          dependencies.log({ event: 'push_failed', kind, status });
          continue;
        }
        row.deletedAt = new Date(now.getTime()).toISOString();
        expired += 1;
        dependencies.log({ event: 'subscription_gone', kind, status });
        break;
      }
      if (status < 200 || status >= 300) {
        failed += 1;
        dependencies.log({ event: 'push_failed', kind, status });
        continue;
      }
      sent += 1;
    }
  }

  dependencies.log({ event: 'done', sent, skipped, expired, failed });
  return json({ ok: true, sent, skipped, expired, failed }, 200);
}
