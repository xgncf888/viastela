import { classifyQuoteFailure, planQuoteLoad, type QuoteFailureKind } from '@/core/quote-load';
import { QUOTES_TIMEOUT_MS } from '@/lib/timing';

import { getSupabase } from './client';
import {
  cachedQuote,
  readCachedQuoteBook,
  writeCachedQuoteBook,
  type CachedQuoteBook,
  type CachedQuoteDraft,
} from './quoteCache';

export class QuoteRequestError extends Error {
  readonly kind: QuoteFailureKind;

  constructor(kind: QuoteFailureKind) {
    super(kind);
    this.name = 'QuoteRequestError';
    this.kind = kind;
  }
}

/**
 * Maps the `quotes` Edge Function body (commit 83e1ee60).
 * `{ quotes, rates, source, total_usd, cash_usd, securities_usd, unpriced, stale, snapshot }`.
 * Each quote is `{ symbol, price, currency, as_of, status, source }`.
 * Prices are USD. Fresh versus stale is already decided on the server.
 * A body that does not match returns null so the device cache is left alone.
 */
export function adaptQuotesResponse(body: unknown): CachedQuoteBook | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const row = body as Record<string, unknown>;
  if (row.source !== 'finnhub' && row.source !== 'cost_basis') return null;
  if (row.snapshot !== 'written' && row.snapshot !== 'skipped') return null;
  if (typeof row.stale !== 'boolean') return null;
  if (!isMoney(row.total_usd) || !isMoney(row.cash_usd) || !isMoney(row.securities_usd)) return null;
  if (typeof row.unpriced !== 'number' || !Number.isInteger(row.unpriced) || row.unpriced < 0) return null;
  if (!Array.isArray(row.quotes) || !Array.isArray(row.rates)) return null;
  const quotes = [];
  for (const quote of row.quotes) {
    const draft = quoteDraft(quote);
    if (!draft) return null;
    try {
      quotes.push(cachedQuote(draft));
    } catch {
      return null;
    }
  }
  const rates = [];
  for (const rate of row.rates) {
    if (!rate || typeof rate !== 'object') return null;
    const item = rate as Record<string, unknown>;
    if (typeof item.base !== 'string' || typeof item.quote !== 'string' || typeof item.as_of !== 'string') return null;
    if (typeof item.rate !== 'number' || !Number.isFinite(item.rate) || item.rate <= 0) return null;
    rates.push({ base: item.base, quote: item.quote, rate: item.rate, as_of: item.as_of });
  }
  return {
    quotes,
    rates,
    source: row.source,
    total_usd: row.total_usd,
    cash_usd: row.cash_usd,
    securities_usd: row.securities_usd,
    unpriced: row.unpriced,
    stale: row.stale,
    snapshot: row.snapshot,
  };
}

export async function describeQuoteError(
  error: unknown,
  data: unknown,
): Promise<{ network: boolean; status: number | null; body: unknown }> {
  const context = error && typeof error === 'object' && 'context' in error ? (error as { context?: unknown }).context : undefined;
  const status = context instanceof Response ? context.status : null;
  if (data && typeof data === 'object' && 'error' in data) {
    return { network: false, status, body: data };
  }
  if (context instanceof Response) {
    let body: unknown = null;
    try {
      body = await context.clone().json();
    } catch {
      body = null;
    }
    return { network: false, status: context.status, body };
  }
  return { network: true, status: null, body: null };
}

export type QuoteInvokeResult = { data: unknown; error: unknown };

type QuoteInvoke = (tz: string, signal: AbortSignal | undefined) => Promise<QuoteInvokeResult>;

let quoteInvokeOverride: QuoteInvoke | null = null;

/** Tests replace the Edge Function call. Production uses `functions.invoke`. */
export function setQuoteInvokeForTests(invoke: QuoteInvoke | null): void {
  quoteInvokeOverride = invoke;
}

/** Timeout and abort are the same outcome as quotes being unavailable. */
export function isQuoteTimeout(error: unknown, seen = new Set<unknown>()): boolean {
  if (!error || typeof error !== 'object') return false;
  if (seen.has(error)) return false;
  seen.add(error);
  const name = 'name' in error ? (error as { name?: unknown }).name : undefined;
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  if ('context' in error && isQuoteTimeout((error as { context?: unknown }).context, seen)) return true;
  if ('cause' in error && isQuoteTimeout((error as { cause?: unknown }).cause, seen)) return true;
  return false;
}

/**
 * Passes `AbortSignal.timeout` when the runtime and `functions.invoke` support
 * `signal`. Otherwise the call races a timer so it cannot spin forever.
 */
export async function settleQuoteInvoke(
  ms: number,
  run: QuoteInvoke,
  tz: string,
  useSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function',
): Promise<QuoteInvokeResult> {
  if (useSignal) return run(tz, AbortSignal.timeout(ms));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(tz, undefined),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function invokeQuotes(tz: string): Promise<QuoteInvokeResult> {
  const run: QuoteInvoke = (zone, signal) => {
    if (quoteInvokeOverride) return quoteInvokeOverride(zone, signal);
    const options: { body: { tz: string }; signal?: AbortSignal } = { body: { tz: zone } };
    if (signal) options.signal = signal;
    return getSupabase().functions.invoke('quotes', options);
  };
  return settleQuoteInvoke(QUOTES_TIMEOUT_MS, run, tz);
}

/** Asks the quotes function for the caller's book. Does not touch the device cache. */
export async function requestQuotes(tz: string): Promise<CachedQuoteBook> {
  let data: unknown;
  let error: unknown;
  try {
    const result = await invokeQuotes(tz);
    data = result.data;
    error = result.error;
  } catch (caught) {
    throw new QuoteRequestError(isQuoteTimeout(caught) ? 'timeout' : 'network');
  }
  if (isQuoteTimeout(error)) throw new QuoteRequestError('timeout');
  if (error) {
    const described = await describeQuoteError(error, data);
    throw new QuoteRequestError(classifyQuoteFailure(described));
  }
  const book = adaptQuotesResponse(data);
  if (!book) throw new QuoteRequestError('other');
  return book;
}

/**
 * Successful responses replace the device cache.
 * 502 `quote_unavailable`, `fx_unavailable`, and network errors keep the previous book and do not write.
 */
export async function loadQuoteBook(
  userId: string,
  tz: string,
): Promise<{ book: CachedQuoteBook | null; degraded: boolean; failure: QuoteFailureKind | null }> {
  try {
    const live = await requestQuotes(tz);
    const plan = planQuoteLoad({ failure: null, live, cached: null });
    if (plan.persist && plan.book) await writeCachedQuoteBook(userId, plan.book);
    return { book: plan.book, degraded: plan.degraded, failure: null };
  } catch (error) {
    const kind = error instanceof QuoteRequestError ? error.kind : 'network';
    const cached = await readCachedQuoteBook(userId);
    const plan = planQuoteLoad({ failure: kind, live: null, cached });
    return { book: plan.book, degraded: plan.degraded, failure: kind };
  }
}

function quoteDraft(value: unknown): CachedQuoteDraft | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.symbol !== 'string' || typeof row.currency !== 'string' || typeof row.as_of !== 'string') return null;
  if (row.status !== 'fresh' && row.status !== 'stale' && row.status !== 'unavailable') return null;
  if (row.source !== 'finnhub' && row.source !== 'cost_basis') return null;
  if (row.price !== null && (typeof row.price !== 'number' || !Number.isFinite(row.price))) return null;
  return {
    symbol: row.symbol,
    price: row.price,
    currency: row.currency,
    as_of: row.as_of,
    status: row.status,
    source: row.source,
  };
}

function isMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
