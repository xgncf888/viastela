import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

import type { Database } from '../../../src/data/database.types.ts';
import { handleQuotes, isCashCurrency, parseAllowedOrigins, unavailableQuotesResponse } from './handler.ts';
import { FinnhubQuoteProvider, FrankfurterFxProvider } from './providers.ts';
import type {
  AssetAccount,
  CashBalance,
  CashCurrency,
  FxCacheRow,
  HoldingRow,
  QuoteCacheRow,
  QuoteLogEvent,
  SnapshotWrite,
} from './types.ts';

/**
 * Quotes for the signed-in caller.
 *
 * Holdings, balances, the day switch, and net-worth snapshots use the caller
 * JWT, so RLS applies. `quote_cache` and `fx_rates` have no policies; only
 * the platform-injected service role key reads and writes those two tables.
 *
 * This file is the only one that reads FINNHUB_API_KEY, QUOTES_ALLOWED_ORIGINS,
 * and SUPABASE_SERVICE_ROLE_KEY. None of those values are logged.
 *
 * Table columns come from `src/data/database.types.ts`. `quote_cache` is
 * `(symbol, price, as_of)`. `as_of` is the fetch time used for the 15-minute
 * window. The table has no currency column; cached equity prices are USD.
 */

const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};

Deno.serve((request) => {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return unavailableQuotesResponse(request, parseAllowedOrigins(Deno.env.get('QUOTES_ALLOWED_ORIGINS')));
  }

  const allowedOrigins = parseAllowedOrigins(Deno.env.get('QUOTES_ALLOWED_ORIGINS'));
  const apiKey = Deno.env.get('FINNHUB_API_KEY');
  const source = apiKey ? 'finnhub' as const : 'cost_basis' as const;
  const quoteProvider = apiKey ? new FinnhubQuoteProvider(apiKey) : null;

  return handleQuotes(request, {
    now: () => new Date(),
    allowedOrigins,
    source,
    quoteProvider,
    fxProvider: new FrankfurterFxProvider(),
    log,
    async getUser(jwt) {
      const client = userClient(url, anonKey, jwt);
      const { data, error } = await client.auth.getUser(jwt);
      if (error || !data.user?.id) return null;
      return { id: data.user.id };
    },
    daySwitch(userId) {
      const jwt = bearer(request);
      if (!jwt) throw new Error('portfolio failed');
      return readDaySwitch(userClient(url, anonKey, jwt), userId);
    },
    portfolio(userId) {
      const jwt = bearer(request);
      if (!jwt) throw new Error('portfolio failed');
      return loadPortfolio(userClient(url, anonKey, jwt), userId);
    },
    readQuoteCache(symbols) {
      return readQuoteCache(cacheClient(url, serviceKey), symbols);
    },
    writeQuoteCache(rows) {
      return writeQuoteCache(cacheClient(url, serviceKey), rows);
    },
    readFxCache(base, quotes, day) {
      return readFxCache(cacheClient(url, serviceKey), base, quotes, day);
    },
    writeFxCache(rows) {
      return writeFxCache(cacheClient(url, serviceKey), rows);
    },
    upsertSnapshot(row) {
      const jwt = bearer(request);
      if (!jwt) throw new Error('snapshot failed');
      return upsertSnapshot(userClient(url, anonKey, jwt), row);
    },
  });
});

function log(event: QuoteLogEvent): void {
  console.info(JSON.stringify({
    event: event.event,
    status: event.status,
    source: event.source,
    snapshot: event.snapshot,
  }));
}

function bearer(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

function userClient(url: string, anonKey: string, jwt: string): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: authOptions,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

function cacheClient(url: string, serviceKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, serviceKey, { auth: authOptions });
}

async function readDaySwitch(client: SupabaseClient<Database>, userId: string): Promise<string> {
  const { data, error } = await client.from('profiles').select('day_switch').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('portfolio failed');
  const row = data && typeof data === 'object' ? (data as { day_switch?: unknown }) : null;
  return typeof row?.day_switch === 'string' ? row.day_switch : '04:00';
}

async function loadPortfolio(client: SupabaseClient<Database>, userId: string): Promise<{
  holdings: HoldingRow[];
  balances: CashBalance[];
  accounts: AssetAccount[];
}> {
  const [holdingsResult, balancesResult, accountsResult] = await Promise.all([
    client.from('holdings').select('symbol, quantity, cost_basis_usd').eq('user_id', userId).is('deleted_at', null),
    client
      .from('account_balances')
      .select('account_id, amount, recorded_at, tz, deleted_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false }),
    client.from('asset_accounts').select('id, currency, deleted_at').eq('user_id', userId),
  ]);
  if (holdingsResult.error || balancesResult.error || accountsResult.error) {
    throw new Error('portfolio failed');
  }

  const accounts: AssetAccount[] = [];
  const currencies = new Map<string, CashCurrency>();
  for (const row of records(accountsResult.data)) {
    const id = text(row.id);
    if (!id) continue;
    const deletedAt = text(row.deleted_at);
    accounts.push({ id, deletedAt });
    const currency = text(row.currency);
    if (currency && isCashCurrency(currency)) currencies.set(id, currency);
  }

  const holdings: HoldingRow[] = [];
  for (const row of records(holdingsResult.data)) {
    const symbol = text(row.symbol);
    const quantity = decimal(row.quantity);
    if (!symbol || !quantity) continue;
    holdings.push({
      symbol,
      quantity,
      costBasisUsd: row.cost_basis_usd === null || row.cost_basis_usd === undefined
        ? null
        : decimal(row.cost_basis_usd),
    });
  }

  const balances: CashBalance[] = [];
  for (const row of records(balancesResult.data)) {
    const accountId = text(row.account_id);
    const amount = decimal(row.amount);
    const recordedAt = text(row.recorded_at);
    const tz = text(row.tz) ?? 'UTC';
    const currency = accountId ? currencies.get(accountId) : undefined;
    if (!accountId || !amount || !recordedAt || !currency) continue;
    balances.push({
      accountId,
      currency,
      amount,
      recordedAt,
      tz,
      deletedAt: text(row.deleted_at),
    });
  }
  return { holdings, balances, accounts };
}

async function readQuoteCache(client: SupabaseClient<Database>, symbols: string[]): Promise<QuoteCacheRow[]> {
  if (symbols.length === 0) return [];
  const { data, error } = await client
    .from('quote_cache')
    .select('symbol, price, as_of')
    .in('symbol', symbols);
  if (error) throw new Error('quote cache failed');
  const rows: QuoteCacheRow[] = [];
  for (const row of records(data)) {
    const symbol = text(row.symbol);
    const price = number(row.price);
    const asOf = text(row.as_of);
    if (!symbol || price === null || price < 0 || !asOf) continue;
    rows.push({ symbol, price, currency: 'USD', asOf });
  }
  return rows;
}

async function writeQuoteCache(client: SupabaseClient<Database>, rows: QuoteCacheRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await client.from('quote_cache').upsert(
    rows.map((row) => ({
      symbol: row.symbol,
      price: row.price,
      as_of: row.asOf,
    })),
    { onConflict: 'symbol' },
  );
  if (error) throw new Error('quote cache failed');
}

async function readFxCache(
  client: SupabaseClient<Database>,
  base: string,
  quotes: string[],
  day: string,
): Promise<FxCacheRow[]> {
  if (quotes.length === 0) return [];
  const { data, error } = await client
    .from('fx_rates')
    .select('base, quote, rate, as_of')
    .eq('base', base)
    .eq('as_of', fxInstant(day))
    .in('quote', quotes);
  if (error) throw new Error('fx cache failed');
  const rows: FxCacheRow[] = [];
  for (const row of records(data)) {
    const quote = text(row.quote);
    const rate = number(row.rate);
    const asOf = text(row.as_of);
    const rowBase = text(row.base);
    if (!quote || rate === null || rate <= 0 || !asOf || !rowBase) continue;
    rows.push({ base: rowBase, quote, rate, asOf: asOf.slice(0, 10) });
  }
  return rows;
}

async function writeFxCache(client: SupabaseClient<Database>, rows: FxCacheRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await client.from('fx_rates').upsert(
    rows.map((row) => ({
      base: row.base,
      quote: row.quote,
      rate: row.rate,
      as_of: fxInstant(row.asOf),
    })),
    { onConflict: 'base,quote,as_of' },
  );
  if (error) throw new Error('fx cache failed');
}

async function upsertSnapshot(client: SupabaseClient<Database>, row: SnapshotWrite): Promise<void> {
  const { error } = await client.from('net_worth_snapshots').upsert(
    {
      user_id: row.userId,
      local_day: row.localDay,
      tz: row.tz,
      total_usd: row.totalUsd,
      cash_usd: row.cashUsd,
      securities_usd: row.securitiesUsd,
      as_of: row.asOf,
    },
    { onConflict: 'user_id,local_day' },
  );
  if (error) throw new Error('snapshot failed');
}

/** Midnight UTC for a calendar day stored in a timestamptz column. */
function fxInstant(day: string): string {
  return day.includes('T') ? day : `${day}T00:00:00.000Z`;
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function decimal(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
