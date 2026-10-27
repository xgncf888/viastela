import { isDue, type DueSubscription, type ReminderKind } from './due.ts';
import {
  constantTimeEqual,
  handleReminders,
  publicLog,
  REMINDERS_CRON_HEADER,
  type DeliveryClaim,
  type ReminderLog,
} from './handler.ts';
import { bytesToBase64Url, sendWebPush } from './push.ts';

function eq(actual: unknown, expected: unknown, message?: string): void {
  if (Object.is(actual, expected)) return;
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  const prefix = message ? `${message}: ` : '';
  throw new Error(`${prefix}${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}

const SECRET = 'invented-cron-secret';
const ENDPOINT = 'https://push.example.test/device/secret-endpoint';
const P256 = 'p256dh-secret-value';
const AUTH = 'auth-secret-value';

function subscription(overrides: Partial<DueSubscription> = {}): DueSubscription {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    endpoint: ENDPOINT,
    p256dh: P256,
    auth: AUTH,
    tz: 'Asia/Singapore',
    monthEndTime: '21:30:00',
    monthEndEnabled: false,
    trainingTime: '08:00:00',
    trainingDays: [1, 2, 3, 4, 5, 6, 7],
    trainingEnabled: false,
    deletedAt: null,
    ...overrides,
  };
}

class Ledger {
  rows: DeliveryClaim[] = [];
  claim(input: DeliveryClaim): Promise<boolean> {
    const exists = this.rows.some(
      (row) =>
        row.subscriptionId === input.subscriptionId && row.kind === input.kind && row.localDay === input.localDay,
    );
    if (exists) return Promise.resolve(false);
    this.rows.push(input);
    return Promise.resolve(true);
  }
}

function post(body: unknown = {}, secret: string | null = SECRET): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (secret !== null) headers.set(REMINDERS_CRON_HEADER, secret);
  return new Request('https://example.test/functions/v1/reminders', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

type Run = {
  sent: ReminderKind[];
  deleted: string[];
  logs: ReminderLog[];
  ledger: Ledger;
  status: number;
  body: { ok?: boolean; sent?: number; error?: string };
  loads: number;
};

async function runAt(
  rows: DueSubscription[],
  now: Date,
  options?: {
    secret?: string | null;
    headerSecret?: string | null;
    status?: number;
    body?: unknown;
    method?: string;
    claim?: (claim: DeliveryClaim) => Promise<boolean>;
    failLoad?: boolean;
  },
): Promise<Run> {
  const sent: ReminderKind[] = [];
  const deleted: string[] = [];
  const logs: ReminderLog[] = [];
  const ledger = new Ledger();
  let loads = 0;
  const headerSecret = options?.headerSecret === undefined ? options?.secret ?? SECRET : options.headerSecret;
  const request =
    options?.method === 'GET'
      ? new Request('https://example.test/functions/v1/reminders', { method: 'GET' })
      : post(options?.body ?? { user_id: '00000000-0000-4000-8000-000000000099' }, headerSecret);
  const response = await handleReminders(request, {
    cronSecret: options?.secret === undefined ? SECRET : (options.secret ?? ''),
    now: () => now,
    log: (event) => logs.push(event),
    loadSubscriptions: () => {
      loads += 1;
      if (options?.failLoad) return Promise.reject(new Error('load_failed'));
      return Promise.resolve(rows);
    },
    claimDelivery: (claim) => (options?.claim ? options.claim(claim) : ledger.claim(claim)),
    softDelete: (id) => {
      deleted.push(id);
      const row = rows.find((item) => item.id === id);
      if (row) row.deletedAt = now.toISOString();
      return Promise.resolve();
    },
    sendPush: (message) => {
      sent.push(message.payload.kind);
      return Promise.resolve({ status: options?.status ?? 201 });
    },
  });
  return { sent, deleted, logs, ledger, status: response.status, body: await response.json(), loads };
}

const flagCases: { training: boolean; monthEnd: boolean; deleted: boolean; expect: ReminderKind[] }[] = [
  { training: true, monthEnd: true, deleted: false, expect: ['training', 'month_end'] },
  { training: true, monthEnd: false, deleted: false, expect: ['training'] },
  { training: false, monthEnd: true, deleted: false, expect: ['month_end'] },
  { training: false, monthEnd: false, deleted: false, expect: [] },
  { training: true, monthEnd: true, deleted: true, expect: [] },
  { training: true, monthEnd: false, deleted: true, expect: [] },
  { training: false, monthEnd: true, deleted: true, expect: [] },
  { training: false, monthEnd: false, deleted: true, expect: [] },
];

const bothDue = new Date('2026-02-28T13:30:00.000Z');

for (const item of flagCases) {
  const label = `training ${item.training} month-end ${item.monthEnd} deleted ${item.deleted}`;
  Deno.test(`gate 1: ${label}`, async () => {
    const result = await runAt(
      [
        subscription({
          trainingEnabled: item.training,
          monthEndEnabled: item.monthEnd,
          deletedAt: item.deleted ? '2026-02-01T00:00:00.000Z' : null,
        }),
      ],
      bothDue,
    );
    eq(result.sent, item.expect, label);
    eq(result.loads, 1);
  });
}

Deno.test('gate 2: Singapore training crosses midnight and the 08:00 clock', () => {
  const row = subscription({ tz: 'Asia/Singapore', trainingEnabled: true, trainingDays: [2], trainingTime: '08:00' });
  eq(isDue(row, 'training', new Date('2026-10-26T23:59:00.000Z')), false);
  eq(isDue(row, 'training', new Date('2026-10-27T00:00:00.000Z')), true);
  eq(isDue(row, 'training', new Date('2026-10-27T15:59:00.000Z')), true);
  eq(isDue(row, 'training', new Date('2026-10-27T16:00:00.000Z')), false);
});

Deno.test('gate 2: New York training crosses midnight and the 08:00 clock', () => {
  const row = subscription({ tz: 'America/New_York', trainingEnabled: true, trainingDays: [2], trainingTime: '08:00' });
  eq(isDue(row, 'training', new Date('2026-10-27T11:59:00.000Z')), false);
  eq(isDue(row, 'training', new Date('2026-10-27T12:00:00.000Z')), true);
  eq(isDue(row, 'training', new Date('2026-10-28T03:59:00.000Z')), true);
  eq(isDue(row, 'training', new Date('2026-10-28T04:00:00.000Z')), false);
});

Deno.test('gate 2: month end in Singapore includes February and leap day', () => {
  const row = subscription({ tz: 'Asia/Singapore', monthEndEnabled: true, monthEndTime: '21:30' });
  eq(isDue(row, 'month_end', new Date('2026-02-28T13:29:00.000Z')), false);
  eq(isDue(row, 'month_end', new Date('2026-02-28T13:30:00.000Z')), true);
  eq(isDue(row, 'month_end', new Date('2026-02-28T15:59:00.000Z')), true);
  eq(isDue(row, 'month_end', new Date('2026-02-28T16:00:00.000Z')), false);
  eq(isDue(row, 'month_end', new Date('2025-02-28T13:30:00.000Z')), true);
  eq(isDue(row, 'month_end', new Date('2024-02-28T13:30:00.000Z')), false);
  eq(isDue(row, 'month_end', new Date('2024-02-29T13:30:00.000Z')), true);
  eq(isDue(row, 'month_end', new Date('2024-02-29T16:00:00.000Z')), false);
});

Deno.test('gate 2: month end in New York crosses midnight, including leap day', () => {
  const row = subscription({ tz: 'America/New_York', monthEndEnabled: true, monthEndTime: '21:30' });
  eq(isDue(row, 'month_end', new Date('2026-03-01T02:29:00.000Z')), false);
  eq(isDue(row, 'month_end', new Date('2026-03-01T02:30:00.000Z')), true);
  eq(isDue(row, 'month_end', new Date('2026-03-01T04:59:00.000Z')), true);
  eq(isDue(row, 'month_end', new Date('2026-03-01T05:00:00.000Z')), false);
  eq(isDue(row, 'month_end', new Date('2024-02-29T02:30:00.000Z')), false);
  eq(isDue(row, 'month_end', new Date('2024-03-01T02:30:00.000Z')), true);
});

Deno.test('gate 2: an empty weekday list does not send, and each zone uses its own clock', async () => {
  const emptyDays = subscription({ trainingEnabled: true, trainingDays: [], tz: 'Asia/Singapore' });
  eq(isDue(emptyDays, 'training', new Date('2026-10-27T00:00:00.000Z')), false);
  const instant = new Date('2026-03-01T04:30:00.000Z');
  const result = await runAt(
    [
      subscription({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tz: 'Asia/Singapore',
        monthEndEnabled: true,
        endpoint: 'https://push.example.test/sg',
      }),
      subscription({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        tz: 'America/New_York',
        monthEndEnabled: true,
        endpoint: 'https://push.example.test/ny',
      }),
    ],
    instant,
  );
  eq(result.sent, ['month_end']);
  eq(result.ledger.rows.map((row) => row.localDay), ['2026-02-28']);
  eq(result.ledger.rows[0]?.subscriptionId, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
});

Deno.test('gate 3: a second run inserts nothing and sends nothing', async () => {
  const ledger = new Ledger();
  const row = subscription({ trainingEnabled: true, tz: 'Asia/Singapore', trainingDays: [2] });
  const now = new Date('2026-10-27T01:00:00.000Z');
  const first = await handleReminders(post(), {
    cronSecret: SECRET,
    now: () => now,
    log: () => undefined,
    loadSubscriptions: async () => [row],
    claimDelivery: (claim) => ledger.claim(claim),
    softDelete: async () => undefined,
    sendPush: async () => ({ status: 201 }),
  });
  const secondSends: string[] = [];
  const second = await handleReminders(post(), {
    cronSecret: SECRET,
    now: () => now,
    log: () => undefined,
    loadSubscriptions: async () => [row],
    claimDelivery: (claim) => ledger.claim(claim),
    softDelete: async () => undefined,
    sendPush: async (message) => {
      secondSends.push(message.payload.kind);
      return { status: 201 };
    },
  });
  eq((await first.json()).sent, 1);
  eq((await second.json()).sent, 0);
  eq(secondSends, []);
  eq(ledger.rows.length, 1);
  eq(ledger.rows[0]?.localDay, '2026-10-27');
});

Deno.test('gate 4: 404 and 410 soft-delete the row and send nothing further', async () => {
  for (const status of [404, 410]) {
    const row = subscription({
      id: `33333333-3333-4333-8333-33333333333${status === 404 ? '1' : '2'}`,
      trainingEnabled: true,
      monthEndEnabled: true,
    });
    const result = await runAt([row], bothDue, { status });
    eq(result.sent, ['training'], String(status));
    eq(result.deleted, [row.id]);
    eq(row.deletedAt !== null, true);
    const again = await runAt([row], bothDue, { status });
    eq(again.sent, []);
  }
});

Deno.test('gate 5: anonymous and wrong secrets do not scan, and a body user id is ignored', async () => {
  const missing = await runAt([subscription({ trainingEnabled: true })], bothDue, { headerSecret: null });
  eq(missing.status, 401);
  eq(missing.loads, 0);
  eq(missing.sent, []);

  const wrong = await runAt([subscription({ trainingEnabled: true })], bothDue, { headerSecret: 'other-secret' });
  eq(wrong.status, 401);
  eq(wrong.loads, 0);

  const unset = await runAt([subscription({ trainingEnabled: true })], bothDue, { secret: null });
  eq(unset.status, 500);
  eq(unset.loads, 0);

  const both = await runAt(
    [
      subscription({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', trainingEnabled: true }),
      subscription({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', trainingEnabled: true, endpoint: 'https://push.example.test/other' }),
    ],
    bothDue,
    { body: { user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
  );
  eq(both.sent, ['training', 'training']);
  eq(both.loads, 1);

  const get = await runAt([subscription({ trainingEnabled: true })], bothDue, { method: 'GET' });
  eq(get.status, 405);
  eq(get.loads, 0);
});

Deno.test('gate 5: logs omit the endpoint, keys, and the cron secret', async () => {
  const result = await runAt([subscription({ trainingEnabled: true, monthEndEnabled: true })], bothDue, { status: 410 });
  const text = JSON.stringify(result.logs.map((event) => JSON.parse(publicLog(event))));
  eq(text.includes(ENDPOINT), false);
  eq(text.includes(P256), false);
  eq(text.includes(AUTH), false);
  eq(text.includes(SECRET), false);
  eq(text.includes('service_role'), false);
  const leaked = publicLog({ event: 'done', sent: 1, endpoint: ENDPOINT } as ReminderLog & { endpoint: string });
  eq(leaked.includes(ENDPOINT), false);
  eq(constantTimeEqual(SECRET, SECRET), true);
  eq(constantTimeEqual(SECRET, 'invented-cron-secreT'), false);
  eq(constantTimeEqual(SECRET, ''), false);
  eq(constantTimeEqual('short', 'a-much-longer-secret'), false);
});

Deno.test('a failed claim does not send', async () => {
  const result = await runAt([subscription({ trainingEnabled: true })], bothDue, {
    claim: () => Promise.reject(new Error('claim_failed')),
  });
  eq(result.sent, []);
  eq(result.body.sent, 0);
  eq(result.logs.some((event) => event.event === 'claim_failed'), true);
});

Deno.test('index reads secret names from env and claims with on conflict do nothing', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
  eq(source.includes("Deno.env.get('REMINDERS_CRON_SECRET')"), true);
  eq(source.includes("Deno.env.get('VAPID_PRIVATE_KEY')"), true);
  eq(source.includes("Deno.env.get('VAPID_PUBLIC_KEY')"), true);
  eq(source.includes("Deno.env.get('VAPID_SUBJECT')"), true);
  eq(source.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')"), true);
  eq(source.includes('ignoreDuplicates: true'), true);
  eq(source.includes('reminder_deliveries'), true);
  eq(source.includes('on conflict (subscription_id, kind, local_day) do nothing'), true);
  eq(source.includes('user_id'), false);
  eq(source.includes('eyJ'), false);
  eq(source.includes('console.log(publicLog(event))'), true);
});

Deno.test('the fake push service receives aes128gcm and nothing is logged', async () => {
  const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const vapidPublic = new Uint8Array(await crypto.subtle.exportKey('raw', vapid.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', vapid.privateKey);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((item) => String(item)).join(' '));
  };
  try {
    let encoding = '';
    let authorization = '';
    const result = await sendWebPush(
      {
        endpoint: 'https://push.example.test/device/1',
        p256dh: bytesToBase64Url(uaPublic),
        auth: bytesToBase64Url(auth),
        payload: { title: '训练日提醒', body: '今天该训练了', url: '/', kind: 'training' },
      },
      {
        publicKey: bytesToBase64Url(vapidPublic),
        privateKey: privateJwk.d ?? '',
        subject: 'mailto:reminders@example.com',
      },
      (input, init) => {
        const headers = new Headers(init?.headers);
        encoding = headers.get('Content-Encoding') ?? '';
        authorization = headers.get('Authorization') ?? '';
        eq(String(input).includes('secret-endpoint'), false);
        return Promise.resolve(new Response(null, { status: 201 }));
      },
    );
    eq(result.status, 201);
    eq(encoding, 'aes128gcm');
    eq(authorization.startsWith('vapid t='), true);
    eq(authorization.includes(privateJwk.d ?? 'missing-private'), false);
    eq(logs, []);
  } finally {
    console.log = original;
  }
});
