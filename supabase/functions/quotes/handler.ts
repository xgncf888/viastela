import { isAllowedDeleteOrigin, parseAllowedOrigins } from '../../../src/core/delete-account-origin.ts';
import { DEFAULT_DAY_SWITCH, isDaySwitch } from '../../../src/core/local-day.ts';
import { liveCashBalances, valuate } from './pricing.ts';
import type { FxProvider, QuoteProvider } from './providers.ts';
import {
  CASH_CURRENCIES,
  MAX_SYMBOLS,
  SYMBOL_PATTERN,
  type AssetAccount,
  type CashBalance,
  type CashCurrency,
  type FxCacheRow,
  type HoldingRow,
  type QuoteCacheRow,
  type QuoteLogEvent,
  type QuoteSource,
  type SnapshotWrite,
} from './types.ts';

const allowHeaders = 'authorization, x-client-info, apikey, content-type';
const allowMethods = 'POST, OPTIONS';

export type QuotesDependencies = {
  now: () => Date;
  allowedOrigins: readonly string[];
  source: QuoteSource;
  getUser: (jwt: string) => Promise<{ id: string } | null>;
  daySwitch: (userId: string) => Promise<string>;
  portfolio: (userId: string) => Promise<{
    holdings: HoldingRow[];
    balances: CashBalance[];
    accounts: AssetAccount[];
  }>;
  quoteProvider: QuoteProvider | null;
  fxProvider: FxProvider;
  readQuoteCache: (symbols: string[]) => Promise<QuoteCacheRow[]>;
  writeQuoteCache: (rows: QuoteCacheRow[]) => Promise<void>;
  readFxCache: (base: string, quotes: string[], day: string) => Promise<FxCacheRow[]>;
  writeFxCache: (rows: FxCacheRow[]) => Promise<void>;
  upsertSnapshot: (row: SnapshotWrite) => Promise<void>;
  log: (event: QuoteLogEvent) => void;
};

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1];
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
}

export function quotesCorsHeaders(
  origin: string | null,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const headers: Record<string, string> = { vary: 'Origin' };
  if (origin && isAllowedDeleteOrigin(origin, allowedOrigins)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-headers'] = allowHeaders;
    headers['access-control-allow-methods'] = allowMethods;
  }
  return headers;
}

export function unavailableQuotesResponse(request: Request, allowedOrigins: readonly string[] = []): Response {
  return json({ error: 'unavailable' }, 500, request, allowedOrigins);
}

export async function handleQuotes(request: Request, dependencies: QuotesDependencies): Promise<Response> {
  const allowedOrigins = dependencies.allowedOrigins;
  const origin = request.headers.get('Origin');
  const permitted = !origin || isAllowedDeleteOrigin(origin, allowedOrigins);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: permitted ? 204 : 403,
      headers: quotesCorsHeaders(origin, allowedOrigins),
    });
  }
  if (!permitted) return fail(request, dependencies, 403, 'origin_not_allowed', 'origin_not_allowed');
  if (request.method !== 'POST') return fail(request, dependencies, 405, 'method_not_allowed', 'method_not_allowed');

  const jwt = bearerToken(request.headers.get('Authorization'));
  if (!jwt) return fail(request, dependencies, 401, 'unauthorized', 'unauthorized');

  let user: { id: string } | null;
  try {
    user = await dependencies.getUser(jwt);
  } catch {
    return fail(request, dependencies, 401, 'unauthorized', 'unauthorized');
  }
  if (!user?.id) return fail(request, dependencies, 401, 'unauthorized', 'unauthorized');

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail(request, dependencies, 400, 'invalid_json', 'invalid_json');
  }
  const parsed = parsePayload(payload);
  if (!parsed.ok) return fail(request, dependencies, 400, parsed.error, parsed.error);
  if (parsed.symbols && parsed.symbols.length > MAX_SYMBOLS) {
    return fail(request, dependencies, 400, 'too_many_symbols', 'too_many_symbols');
  }

  let book: { holdings: HoldingRow[]; balances: CashBalance[]; accounts: AssetAccount[] };
  let daySwitch: string;
  try {
    book = await dependencies.portfolio(user.id);
    const rawSwitch = await dependencies.daySwitch(user.id);
    daySwitch = isDaySwitch(rawSwitch) ? rawSwitch.trim() : DEFAULT_DAY_SWITCH;
  } catch {
    return fail(request, dependencies, 500, 'unavailable', 'portfolio_failed');
  }

  const balances = liveCashBalances(book.balances, book.accounts);
  const holdings = book.holdings.filter((holding) => SYMBOL_PATTERN.test(holding.symbol));
  if (dependencies.source === 'finnhub') {
    const held = new Set(holdings.map((holding) => holding.symbol));
    if (held.size > MAX_SYMBOLS) {
      return fail(request, dependencies, 400, 'too_many_symbols', 'too_many_symbols');
    }
  }

  const timeZone = resolveTimeZone(parsed.timeZone, balances);
  let valuation;
  try {
    valuation = await valuate({
      now: dependencies.now(),
      timeZone,
      daySwitch,
      userId: user.id,
      source: dependencies.source,
      holdings,
      balances,
      accounts: book.accounts,
      requested: parsed.symbols,
      quoteProvider: dependencies.quoteProvider,
      fxProvider: dependencies.fxProvider,
      readQuoteCache: dependencies.readQuoteCache,
      writeQuoteCache: dependencies.writeQuoteCache,
      readFxCache: dependencies.readFxCache,
      writeFxCache: dependencies.writeFxCache,
    });
  } catch {
    return fail(request, dependencies, 502, 'quote_unavailable', 'quote_failed');
  }
  if (!valuation.ok) {
    return fail(request, dependencies, 502, valuation.error, 'quote_failed', dependencies.source);
  }

  if (valuation.snapshot) {
    try {
      if (valuation.snapshot.userId !== user.id) {
        return fail(request, dependencies, 500, 'unavailable', 'snapshot_failed');
      }
      await dependencies.upsertSnapshot(valuation.snapshot);
    } catch {
      return fail(request, dependencies, 500, 'unavailable', 'snapshot_failed');
    }
  }

  dependencies.log({
    event: 'quoted',
    status: 200,
    source: dependencies.source,
    snapshot: valuation.body.snapshot,
  });
  return json(valuation.body, 200, request, allowedOrigins);
}

export { parseAllowedOrigins };

type Parsed =
  | { ok: true; symbols: string[] | null; timeZone: string | undefined }
  | { ok: false; error: 'invalid_json' | 'invalid_symbol' };

function parsePayload(payload: unknown): Parsed {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, error: 'invalid_json' };
  const body = payload as Record<string, unknown>;
  let symbols: string[] | null = null;
  if (body.symbols !== undefined) {
    if (!Array.isArray(body.symbols)) return { ok: false, error: 'invalid_symbol' };
    const next: string[] = [];
    for (const symbol of body.symbols) {
      if (typeof symbol !== 'string' || !SYMBOL_PATTERN.test(symbol)) return { ok: false, error: 'invalid_symbol' };
      if (!next.includes(symbol)) next.push(symbol);
    }
    symbols = next;
  }
  const timeZone = typeof body.tz === 'string' ? body.tz : undefined;
  return { ok: true, symbols, timeZone };
}

function resolveTimeZone(requested: string | undefined, balances: readonly CashBalance[]): string {
  const fromBalance = [...balances].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0]?.tz;
  const candidate = requested?.trim() || fromBalance || 'UTC';
  return validTimeZone(candidate) ?? validTimeZone(fromBalance) ?? 'UTC';
}

function validTimeZone(value: string | undefined): string | null {
  if (!value) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return null;
  }
}

function fail(
  request: Request,
  dependencies: QuotesDependencies,
  status: number,
  error: string,
  event: string,
  source?: QuoteSource,
): Response {
  dependencies.log({ event, status, source });
  return json({ error }, status, request, dependencies.allowedOrigins);
}

function json(
  body: Record<string, unknown> | { error: string },
  status: number,
  request: Request,
  allowedOrigins: readonly string[],
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...quotesCorsHeaders(request.headers.get('Origin'), allowedOrigins),
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

export function isCashCurrency(value: string): value is CashCurrency {
  return (CASH_CURRENCIES as readonly string[]).includes(value);
}
