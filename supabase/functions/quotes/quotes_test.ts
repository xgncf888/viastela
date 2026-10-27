import { handleQuotes, type QuotesDependencies } from './handler.ts';
import {
  FakeFxProvider,
  FakeQuoteProvider,
  FINNHUB_CONCURRENCY,
  FINNHUB_PER_MINUTE,
  FinnhubQuoteProvider,
  type FxProvider,
  type QuoteProvider,
} from './providers.ts';
import type {
  CashBalance,
  FxCacheRow,
  HoldingRow,
  QuoteCacheRow,
  QuoteLine,
  QuoteLogEvent,
  QuoteSource,
  QuotesResponse,
  SnapshotWrite,
} from './types.ts';

function eq(actual: unknown, expected: unknown, message?: string): void {
  if (Object.is(actual, expected)) return;
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  const prefix = message ? `${message}: ` : '';
  throw new Error(`${prefix}${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}

function ok(value: unknown, message?: string): void {
  if (!value) throw new Error(message ?? 'expected a truthy value');
}

const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const jwtSecret = new TextEncoder().encode('quotes-test-hmac-secret-32b-min');
const otherSecret = new TextEncoder().encode('other-test-hmac-secret-32b-minimum');
const clockStart = '2026-10-27T08:00:00.000Z';

type StoredHolding = HoldingRow & { userId: string };
type StoredBalance = CashBalance & { userId: string };

class Desk {
  holdings: StoredHolding[] = [];
  balances: StoredBalance[] = [];
  quotes: QuoteCacheRow[] = [];
  fx: FxCacheRow[] = [];
  snapshots: SnapshotWrite[] = [];
  portfolioUsers: string[] = [];
  daySwitch = '04:00';
  logs: QuoteLogEvent[] = [];
  quoteWrites = 0;

  deps(options: {
    source: QuoteSource;
    quotes: QuoteProvider | null;
    fx: FxProvider;
    getUser: (jwt: string) => Promise<{ id: string } | null>;
    now: () => Date;
  }): QuotesDependencies {
    return {
      now: options.now,
      allowedOrigins: [],
      source: options.source,
      getUser: options.getUser,
      daySwitch: async () => this.daySwitch,
      portfolio: async (userId) => {
        this.portfolioUsers.push(userId);
        return {
          holdings: this.holdings
            .filter((row) => row.userId === userId)
            .map(({ symbol, quantity, costBasisUsd }) => ({ symbol, quantity, costBasisUsd })),
          balances: this.balances
            .filter((row) => row.userId === userId)
            .map(({ accountId, currency, amount, recordedAt, tz }) => ({
              accountId,
              currency,
              amount,
              recordedAt,
              tz,
            })),
        };
      },
      quoteProvider: options.quotes,
      fxProvider: options.fx,
      readQuoteCache: async (symbols) => this.quotes.filter((row) => symbols.includes(row.symbol)),
      writeQuoteCache: async (rows) => {
        this.quoteWrites += 1;
        for (const row of rows) {
          this.quotes = this.quotes.filter((existing) => existing.symbol !== row.symbol);
          this.quotes.push(row);
        }
      },
      readFxCache: async (base, quotes, day) => this.fx.filter(
        (row) => row.base === base && row.asOf === day && quotes.includes(row.quote),
      ),
      writeFxCache: async (rows) => {
        for (const row of rows) {
          this.fx = this.fx.filter((existing) => !(
            existing.base === row.base && existing.quote === row.quote && existing.asOf === row.asOf
          ));
          this.fx.push(row);
        }
      },
      upsertSnapshot: async (row) => {
        const index = this.snapshots.findIndex(
          (existing) => existing.userId === row.userId && existing.localDay === row.localDay,
        );
        if (index >= 0) this.snapshots[index] = row;
        else this.snapshots.push(row);
      },
      log: (event) => {
        this.logs.push(event);
      },
    };
  }
}

function post(token: string | null, body: unknown, extra: Record<string, string> = {}): Request {
  const headers = new Headers({ 'content-type': 'application/json', ...extra });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return new Request('https://example.test/quotes', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function rawKey(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function encodeB64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeB64Url(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function signJwt(payload: Record<string, unknown>, secret: Uint8Array = jwtSecret): Promise<string> {
  const header = encodeB64Url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = encodeB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', rawKey(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, rawKey(new TextEncoder().encode(`${header}.${body}`))),
  );
  return `${header}.${body}.${encodeB64Url(signature)}`;
}

async function verifyJwt(token: string): Promise<{ id: string } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerPart, bodyPart, signaturePart] = parts;
    if (!headerPart || !bodyPart || !signaturePart) return null;
    const header = JSON.parse(new TextDecoder().decode(decodeB64Url(headerPart))) as { alg?: string };
    if (header.alg !== 'HS256') return null;
    const key = await crypto.subtle.importKey('raw', rawKey(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signatureOk = await crypto.subtle.verify(
      'HMAC',
      key,
      rawKey(decodeB64Url(signaturePart)),
      rawKey(new TextEncoder().encode(`${headerPart}.${bodyPart}`)),
    );
    if (!signatureOk) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeB64Url(bodyPart))) as { sub?: unknown; exp?: unknown };
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return { id: payload.sub };
  } catch {
    return null;
  }
}

function tamper(token: string): string {
  const chars = token.split('');
  const last = chars.length - 1;
  chars[last] = chars[last] === 'a' ? 'b' : 'a';
  return chars.join('');
}

function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 600;
}

async function tokenFor(userId: string): Promise<string> {
  return await signJwt({ sub: userId, exp: futureExp() });
}

async function bodyOf(response: Response): Promise<QuotesResponse> {
  return await response.json() as QuotesResponse;
}

function assertLine(
  quote: QuoteLine,
  expected: { price: number | null; status: QuoteLine['status']; source: QuoteLine['source'] },
): void {
  eq(Object.keys(quote).sort(), ['as_of', 'currency', 'price', 'source', 'status', 'symbol']);
  eq(quote.price, expected.price);
  eq(quote.status, expected.status);
  eq(quote.source, expected.source);
  if (expected.status === 'unavailable') eq(quote.price, null);
  else eq(typeof quote.price, 'number');
  eq(quote.source === 'finnhub' || quote.source === 'cost_basis', true);
}

function assertNoFake(body: QuotesResponse): void {
  ok(body.source === 'finnhub' || body.source === 'cost_basis');
  eq(JSON.stringify(body).includes('fake'), false);
}

function sliceFn(source: string, signature: string): string {
  const start = source.indexOf(signature);
  ok(start >= 0, signature);
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\n(?:async )?function /);
  return next >= 0 ? source.slice(start, start + signature.length + next) : source.slice(start);
}

Deno.test('gate 1: missing, expired, and tampered JWTs are 401 and do not call providers', async () => {
  const quotes = new FakeQuoteProvider({ AAA: 6 }, () => clockStart);
  const fx = new FakeFxProvider({ CNY: 4 }, '2026-10-27');
  const desk = new Desk();
  desk.holdings.push({ userId: userA, symbol: 'AAA', quantity: '2', costBasisUsd: '10' });
  const build = () => desk.deps({
    source: 'finnhub',
    quotes,
    fx,
    getUser: verifyJwt,
    now: () => new Date(clockStart),
  });

  const missing = await handleQuotes(post(null, { user_id: userA, symbols: ['AAA'] }), build());
  eq(missing.status, 401);

  const blank = await handleQuotes(post(null, { symbols: ['AAA'] }, { Authorization: 'Bearer ' }), build());
  eq(blank.status, 401);

  const expiredToken = await signJwt({ sub: userA, exp: Math.floor(Date.now() / 1000) - 60 });
  const expired = await handleQuotes(post(expiredToken, { symbols: ['AAA'] }), build());
  eq(expired.status, 401);

  const tampered = await handleQuotes(post(tamper(await tokenFor(userA)), { symbols: ['AAA'] }), build());
  eq(tampered.status, 401);

  const wrongKey = await signJwt({ sub: userA, exp: futureExp() }, otherSecret);
  const forged = await handleQuotes(post(wrongKey, { symbols: ['AAA'] }), build());
  eq(forged.status, 401);

  eq(quotes.calls, 0);
  eq(fx.calls, 0);
  eq(desk.portfolioUsers, []);
  eq(desk.snapshots.length, 0);
});

Deno.test('gate 2: a symbol only A holds is unavailable to B', async () => {
  const quotes = new FakeQuoteProvider({ AAA: 6 }, () => clockStart);
  const fx = new FakeFxProvider({}, '2026-10-27');
  const desk = new Desk();
  const seed: SnapshotWrite = {
    userId: userA,
    localDay: '2026-10-27',
    tz: 'Asia/Singapore',
    totalUsd: 3,
    cashUsd: 1,
    securitiesUsd: 2,
    asOf: '2026-10-27T01:00:00.000Z',
  };
  desk.holdings.push({ userId: userA, symbol: 'AAA', quantity: '2', costBasisUsd: '10' });
  desk.quotes.push({ symbol: 'AAA', price: 6, currency: 'USD', asOf: clockStart });
  desk.snapshots.push({ ...seed });

  const response = await handleQuotes(
    post(await tokenFor(userB), { symbols: ['AAA'], user_id: userA, tz: 'Asia/Singapore' }),
    desk.deps({
      source: 'finnhub',
      quotes,
      fx,
      getUser: verifyJwt,
      now: () => new Date(clockStart),
    }),
  );
  eq(response.status, 200);
  const body = await bodyOf(response);
  eq(body.quotes.length, 1);
  eq(body.quotes[0]?.symbol, 'AAA');
  assertLine(body.quotes[0] as QuoteLine, { price: null, status: 'unavailable', source: 'finnhub' });
  assertNoFake(body);
  eq(quotes.calls, 0);
  eq(quotes.seen, []);
  eq(desk.quotes[0]?.price, 6);
  eq(desk.portfolioUsers, [userB]);
  eq(desk.snapshots, [seed]);
});

Deno.test("gate 3: body user_id is ignored and A's snapshot stays unchanged", async () => {
  const quotes = new FakeQuoteProvider({ BBB: 7 }, () => clockStart);
  const fx = new FakeFxProvider({}, '2026-10-27');
  const desk = new Desk();
  const seed: SnapshotWrite = {
    userId: userA,
    localDay: '2026-10-27',
    tz: 'Asia/Singapore',
    totalUsd: 3,
    cashUsd: 1,
    securitiesUsd: 2,
    asOf: '2026-10-27T01:00:00.000Z',
  };
  desk.snapshots.push({ ...seed });
  desk.holdings.push({ userId: userA, symbol: 'AAA', quantity: '4', costBasisUsd: '80' });
  desk.balances.push({
    userId: userB,
    accountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01',
    currency: 'USD',
    amount: '8',
    recordedAt: clockStart,
    tz: 'Asia/Singapore',
  });

  const response = await handleQuotes(
    post(await tokenFor(userB), {
      user_id: userA,
      userId: userA,
      local_day: '1999-01-01',
      symbols: ['BBB'],
      tz: 'Asia/Singapore',
      note: 'position-secret-2468',
    }),
    desk.deps({
      source: 'finnhub',
      quotes,
      fx,
      getUser: verifyJwt,
      now: () => new Date(clockStart),
    }),
  );
  eq(response.status, 200);
  const body = await bodyOf(response);
  eq(body.snapshot, 'written');
  eq(body.cash_usd, 8);
  eq(body.securities_usd, 0);
  assertNoFake(body);
  eq(desk.portfolioUsers, [userB]);
  eq(desk.snapshots.find((row) => row.userId === userA), seed);
  eq(desk.snapshots.filter((row) => row.userId === userA).length, 1);
  eq(desk.snapshots.some((row) => row.localDay === '1999-01-01'), false);
  const written = desk.snapshots.find((row) => row.userId === userB);
  eq(written?.localDay, '2026-10-27');
  eq(written?.totalUsd, 8);
  eq(quotes.seen.some((batch) => batch.includes('AAA')), false);
});

Deno.test('gate 4: fake provider, cache hit, and stale fallback', async () => {
  let now = new Date(clockStart);
  const quotes = new FakeQuoteProvider({ AAA: 6 }, () => now.toISOString());
  const fx = new FakeFxProvider({}, '2026-10-27');
  const desk = new Desk();
  desk.holdings.push({ userId: userA, symbol: 'AAA', quantity: '2', costBasisUsd: '10' });
  const deps = () => desk.deps({
    source: 'finnhub',
    quotes,
    fx,
    getUser: verifyJwt,
    now: () => now,
  });
  const token = await tokenFor(userA);

  const first = await handleQuotes(post(token, { symbols: ['AAA'], tz: 'UTC' }), deps());
  eq(first.status, 200);
  const fresh = await bodyOf(first);
  eq(quotes.calls, 1);
  eq(quotes.seen, [['AAA']]);
  assertLine(fresh.quotes[0] as QuoteLine, { price: 6, status: 'fresh', source: 'finnhub' });
  eq(fresh.source, 'finnhub');
  eq(fresh.snapshot, 'written');
  eq(fresh.securities_usd, 12);
  eq(fresh.stale, false);
  assertNoFake(fresh);
  eq(desk.snapshots.length, 1);
  eq(desk.quotes[0]?.price, 6);

  now = new Date(now.getTime() + 60_000);
  const second = await handleQuotes(post(token, { symbols: ['AAA'], tz: 'UTC' }), deps());
  const cached = await bodyOf(second);
  eq(quotes.calls, 1);
  assertLine(cached.quotes[0] as QuoteLine, { price: 6, status: 'fresh', source: 'finnhub' });
  eq(cached.snapshot, 'written');
  eq(desk.snapshots.length, 1);

  now = new Date(now.getTime() + 20 * 60_000);
  quotes.fail = true;
  const third = await handleQuotes(post(token, { symbols: ['AAA'], tz: 'UTC' }), deps());
  eq(third.status, 200);
  const stale = await bodyOf(third);
  eq(quotes.calls, 2);
  assertLine(stale.quotes[0] as QuoteLine, { price: 6, status: 'stale', source: 'finnhub' });
  eq(stale.stale, true);
  eq(stale.source, 'finnhub');
  eq(stale.snapshot, 'written');
  eq(desk.snapshots.length, 1);
  assertNoFake(stale);

  const empty = new Desk();
  empty.holdings.push({ userId: userA, symbol: 'AAA', quantity: '2', costBasisUsd: '10' });
  const failing = new FakeQuoteProvider({ AAA: 6 }, () => now.toISOString());
  failing.fail = true;
  const missed = await handleQuotes(
    post(token, { symbols: ['AAA'], tz: 'UTC' }),
    empty.deps({
      source: 'finnhub',
      quotes: failing,
      fx,
      getUser: verifyJwt,
      now: () => now,
    }),
  );
  eq(missed.status, 502);
  eq(failing.calls, 1);
  eq(empty.snapshots.length, 0);
  const error = await missed.json() as { error: string };
  eq(error.error, 'quote_unavailable');
  eq(JSON.stringify(error).includes('AAA'), false);
});

Deno.test('gate 5: cost basis holdings write zero snapshot rows', async () => {
  const quotes = new FakeQuoteProvider({ AAA: 6 }, () => clockStart);
  const fx = new FakeFxProvider({}, '2026-10-27');
  const desk = new Desk();
  desk.holdings.push({ userId: userA, symbol: 'AAA', quantity: '4', costBasisUsd: '80' });
  desk.holdings.push({ userId: userA, symbol: 'BBB', quantity: '2', costBasisUsd: null });
  desk.balances.push({
    userId: userA,
    accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
    currency: 'USD',
    amount: '8',
    recordedAt: clockStart,
    tz: 'UTC',
  });

  const response = await handleQuotes(
    post(await tokenFor(userA), { tz: 'UTC' }),
    desk.deps({
      source: 'cost_basis',
      quotes,
      fx,
      getUser: verifyJwt,
      now: () => new Date(clockStart),
    }),
  );
  eq(response.status, 200);
  const body = await bodyOf(response);
  eq(body.source, 'cost_basis');
  eq(body.snapshot, 'skipped');
  eq(desk.snapshots.length, 0);
  eq(quotes.calls, 0);
  eq(desk.quoteWrites, 0);
  eq(body.unpriced, 1);
  eq(body.securities_usd, 80);
  eq(body.cash_usd, 8);
  eq(body.total_usd, 88);
  const priced = body.quotes.find((quote) => quote.symbol === 'AAA');
  const missing = body.quotes.find((quote) => quote.symbol === 'BBB');
  assertLine(priced as QuoteLine, { price: 20, status: 'fresh', source: 'cost_basis' });
  assertLine(missing as QuoteLine, { price: null, status: 'unavailable', source: 'cost_basis' });
  assertNoFake(body);
});

Deno.test('cash only writes one snapshot row', async () => {
  const quotes = new FakeQuoteProvider({}, () => clockStart);
  const fx = new FakeFxProvider({ CNY: 4 }, '2026-10-27');
  const desk = new Desk();
  desk.balances.push({
    userId: userB,
    accountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02',
    currency: 'USD',
    amount: '8',
    recordedAt: clockStart,
    tz: 'Asia/Singapore',
  });
  const deps = desk.deps({
    source: 'cost_basis',
    quotes,
    fx,
    getUser: verifyJwt,
    now: () => new Date(clockStart),
  });
  const response = await handleQuotes(
    post(await tokenFor(userB), { tz: 'Asia/Singapore' }),
    deps,
  );
  eq(response.status, 200);
  const body = await bodyOf(response);
  eq(body.snapshot, 'written');
  eq(body.source, 'cost_basis');
  eq(body.quotes, []);
  eq(body.cash_usd, 8);
  eq(body.securities_usd, 0);
  eq(body.total_usd, 8);
  eq(body.unpriced, 0);
  eq(desk.snapshots.length, 1);
  eq(desk.snapshots[0]?.userId, userB);
  eq(desk.snapshots[0]?.localDay, '2026-10-27');
  eq(desk.snapshots[0]?.cashUsd, 8);
  eq(quotes.calls, 0);
  eq(fx.calls, 0);
  assertNoFake(body);
});

Deno.test('fx rates are cached for the utc day', async () => {
  const quotes = new FakeQuoteProvider({}, () => clockStart);
  const fx = new FakeFxProvider({ CNY: 4 }, '2026-10-26');
  const desk = new Desk();
  desk.balances.push({
    userId: userA,
    accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
    currency: 'CNY',
    amount: '8',
    recordedAt: clockStart,
    tz: 'UTC',
  });
  const deps = () => desk.deps({
    source: 'cost_basis',
    quotes,
    fx,
    getUser: verifyJwt,
    now: () => new Date(clockStart),
  });
  const token = await tokenFor(userA);
  const first = await bodyOf(await handleQuotes(post(token, { tz: 'UTC' }), deps()));
  eq(first.cash_usd, 2);
  eq(first.snapshot, 'written');
  eq(fx.calls, 1);
  eq(desk.snapshots.length, 1);
  const second = await bodyOf(await handleQuotes(post(token, { tz: 'UTC' }), deps()));
  eq(second.cash_usd, 2);
  eq(fx.calls, 1);
  eq(desk.snapshots.length, 1);
});

Deno.test('an unavailable holding skips the snapshot', async () => {
  const quotes = new FakeQuoteProvider({ AAA: 6 }, () => clockStart);
  const fx = new FakeFxProvider({}, '2026-10-27');
  const desk = new Desk();
  desk.holdings.push({ userId: userA, symbol: 'AAA', quantity: '2', costBasisUsd: '10' });
  desk.holdings.push({ userId: userA, symbol: 'BBB', quantity: '2', costBasisUsd: '10' });
  const response = await handleQuotes(
    post(await tokenFor(userA), { tz: 'UTC' }),
    desk.deps({
      source: 'finnhub',
      quotes,
      fx,
      getUser: verifyJwt,
      now: () => new Date(clockStart),
    }),
  );
  const body = await bodyOf(response);
  eq(response.status, 200);
  assertLine(body.quotes.find((quote) => quote.symbol === 'AAA') as QuoteLine, { price: 6, status: 'fresh', source: 'finnhub' });
  assertLine(body.quotes.find((quote) => quote.symbol === 'BBB') as QuoteLine, { price: null, status: 'unavailable', source: 'finnhub' });
  eq(body.snapshot, 'skipped');
  eq(body.unpriced, 1);
  eq(desk.snapshots.length, 0);
  eq(body.source, 'finnhub');
});

Deno.test('gate 6: logs omit the provider key and the holdings', async () => {
  const apiKey = 'fnk_test_918273';
  const headerSecret = 'hdr_test_564738';
  const note = 'position-secret-2468';
  const seenUrls: string[] = [];
  const provider = new FinnhubQuoteProvider(apiKey, (input) => {
    seenUrls.push(String(input));
    return Promise.resolve(new Response(JSON.stringify({ c: 4, t: 1_700_000_000 }), { status: 200 }));
  });
  const fx = new FakeFxProvider({}, '2026-10-27');
  const desk = new Desk();
  desk.holdings.push({ userId: userA, symbol: 'ZX.Y', quantity: '17.25', costBasisUsd: '33.5' });
  const lines: string[] = [];
  const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
  const originals = methods.map((method) => console[method]);
  for (const method of methods) {
    console[method] = (...args: unknown[]) => {
      lines.push(args.map((arg) => String(arg)).join(' '));
    };
  }
  try {
    const response = await handleQuotes(
      post(await tokenFor(userA), {
        symbols: ['ZX.Y'],
        user_id: userB,
        note,
        apiKey,
        tz: 'UTC',
      }, { 'x-quote-key': headerSecret }),
      desk.deps({
        source: 'finnhub',
        quotes: provider,
        fx,
        getUser: verifyJwt,
        now: () => new Date(clockStart),
      }),
    );
    eq(response.status, 200);
    const body = await bodyOf(response);
    eq(body.source, 'finnhub');
    assertLine(body.quotes[0] as QuoteLine, { price: 4, status: 'fresh', source: 'finnhub' });
    eq(body.quotes[0]?.symbol, 'ZX.Y');
    assertNoFake(body);
    eq(JSON.stringify(body).includes(apiKey), false);
    eq(JSON.stringify(body).includes(headerSecret), false);
    eq(JSON.stringify(body).includes(note), false);
    eq(JSON.stringify(body).includes('33.5'), false);
  } finally {
    methods.forEach((method, index) => {
      console[method] = originals[index];
    });
  }
  const logs = `${JSON.stringify(desk.logs)}\n${lines.join('\n')}`;
  for (const secret of [apiKey, headerSecret, note, '17.25', '33.5', 'ZX.Y', 'Bearer']) {
    eq(logs.includes(secret), false, secret);
  }
  eq(seenUrls.length, 1);
  eq(seenUrls[0]?.includes(apiKey), true);
  eq(desk.logs.some((event) => event.event === 'quoted'), true);
});

Deno.test('invalid symbols are 400 and more than 30 symbols do not call the provider', async () => {
  const quotes = new FakeQuoteProvider({ A: 1 }, () => clockStart);
  const fx = new FakeFxProvider({}, '2026-10-27');
  const desk = new Desk();
  const deps = () => desk.deps({
    source: 'finnhub',
    quotes,
    fx,
    getUser: verifyJwt,
    now: () => new Date(clockStart),
  });
  const token = await tokenFor(userA);
  const invalid = await handleQuotes(post(token, { symbols: ['aapl'] }), deps());
  eq(invalid.status, 400);
  const tooMany = Array.from({ length: 31 }, (_, index) => (
    index < 26 ? String.fromCharCode(65 + index) : `A${String.fromCharCode(65 + index - 26)}`
  ));
  const oversized = await handleQuotes(post(token, { symbols: tooMany }), deps());
  eq(oversized.status, 400);
  eq(quotes.calls, 0);
  eq(desk.snapshots.length, 0);
});

Deno.test('finnhub stays at or under 60 calls per minute and limits concurrency', async () => {
  let clock = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const fetches: number[] = [];
  const provider = new FinnhubQuoteProvider('fnk_test_918273', async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    fetches.push(clock);
    await Promise.resolve();
    inFlight -= 1;
    return new Response(JSON.stringify({ c: 4, t: 1_700_000_000 }), { status: 200 });
  }, {
    now: () => clock,
    wait: (ms) => {
      clock += ms;
      return Promise.resolve();
    },
  });
  const symbols = Array.from({ length: FINNHUB_PER_MINUTE + 1 }, (_, index) => (
    index < 26 ? String.fromCharCode(65 + index) : `A${String.fromCharCode(65 + (index - 26))}`
  ));
  const priced = await provider.getQuotes(symbols);
  eq(priced.length, FINNHUB_PER_MINUTE + 1);
  eq(fetches.filter((at) => at < 60_000).length <= FINNHUB_PER_MINUTE, true);
  ok(maxInFlight > 1);
  ok(maxInFlight <= FINNHUB_CONCURRENCY);
  eq(priced.some((quote) => quote.currency === 'USD' && quote.price === 4), true);
});

Deno.test('service role client is only used for quote and fx caches', async () => {
  const indexSource = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
  const configSource = await Deno.readTextFile(new URL('../../config.toml', import.meta.url));
  const quotesConfig = configSource.split('[functions.quotes]')[1]?.split('\n[')[0] ?? '';
  eq(quotesConfig.includes('verify_jwt = true'), true);

  eq(indexSource.includes('FINNHUB_API_KEY'), true);
  eq(indexSource.includes('SUPABASE_SERVICE_ROLE_KEY'), true);
  eq(indexSource.includes('FakeQuoteProvider'), false);
  eq(indexSource.includes('eyJ'), false);
  eq(indexSource.includes("from('holdings')"), true);
  eq(indexSource.includes("from('quote_cache')"), true);
  eq(indexSource.includes("from('fx_rates')"), true);
  eq(indexSource.includes("from('net_worth_snapshots')"), true);

  const portfolio = indexSource.split('portfolio(userId)')[1]?.split('readQuoteCache(symbols)')[0] ?? '';
  eq(portfolio.includes('userClient'), true);
  eq(portfolio.includes('cacheClient'), false);

  const caches = indexSource.split('readQuoteCache(symbols)')[1]?.split('upsertSnapshot(row)')[0] ?? '';
  eq(caches.includes('cacheClient'), true);
  eq(caches.includes('userClient'), false);
  eq(caches.includes("from('holdings')"), false);

  const snapshotCall = indexSource.split('upsertSnapshot(row)')[1]?.split('});')[0] ?? '';
  eq(snapshotCall.includes('userClient'), true);
  eq(snapshotCall.includes('cacheClient'), false);

  const load = sliceFn(indexSource, 'async function loadPortfolio');
  eq(load.includes("from('holdings')"), true);
  eq(load.includes("from('account_balances')"), true);
  eq(load.includes('quote_cache'), false);
  const writeCache = sliceFn(indexSource, 'async function writeQuoteCache');
  eq(writeCache.includes("from('quote_cache')"), true);
  eq(writeCache.includes('holdings'), false);
  const writeSnapshot = sliceFn(indexSource, 'async function upsertSnapshot');
  eq(writeSnapshot.includes("from('net_worth_snapshots')"), true);
  eq(writeSnapshot.includes('quote_cache'), false);
  eq(writeSnapshot.includes('fx_rates'), false);
});
