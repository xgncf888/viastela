/**
 * Offline quote cache for the asset dashboard.
 *
 * An entry is one item from the `quotes` Edge Function response
 * (commit 83e1ee60): `{ symbol, price, currency, as_of, status, source }`.
 * `status` is `fresh`, `stale`, or `unavailable`. `price` is a number for
 * `fresh` and `stale`, and null for `unavailable`. `source` is `finnhub` or
 * `cost_basis`. Equity prices are USD. The server marks fresh versus stale
 * from `quote_cache.as_of` inside 15 minutes. This store does not recompute that.
 *
 * The device also keeps the response totals (`total_usd` and the rest) so an
 * offline dashboard can show the last server total. The storage key includes
 * `user_id`. A read or write for one user must not return or replace another
 * user's quotes. Sign-out and account deletion call `clearQuoteCache(userId)`.
 * `clearQuoteCache()` with no id drops every partition.
 */

import { localStore } from './local-store';

export type QuoteCacheStatus = 'fresh' | 'stale' | 'unavailable';

/** Where the cached figure came from. Market print, or the holding's own cost basis. */
export type QuoteCacheSource = 'finnhub' | 'cost_basis';

type CachedQuoteBase = {
  symbol: string;
  currency: string;
  /** When this figure was observed, as an ISO timestamp. */
  as_of: string;
  /**
   * `finnhub` is a market price from Finnhub.
   * `cost_basis` is the holding's cost basis, not a live market print.
   */
  source: QuoteCacheSource;
};

/**
 * `price` is the cached dollars-per-unit figure. A `fresh` or `stale` entry
 * has a number. `unavailable` has `price: null` because the feed had no
 * price to store.
 */
export type CachedQuote =
  | (CachedQuoteBase & { price: number; status: 'fresh' | 'stale' })
  | (CachedQuoteBase & { price: null; status: 'unavailable' });

export type CachedQuoteDraft = {
  symbol: string;
  price: number | null;
  currency: string;
  as_of: string;
  status: QuoteCacheStatus;
  source: QuoteCacheSource;
};

export type CachedFxRate = {
  base: string;
  quote: string;
  rate: number;
  as_of: string;
};

/**
 * Last successful `quotes` response for one user.
 * `total_usd` is the server total. The client does not replace it with its own sum.
 */
export type CachedQuoteBook = {
  quotes: CachedQuote[];
  rates: CachedFxRate[];
  source: QuoteCacheSource;
  total_usd: number;
  cash_usd: number;
  securities_usd: number;
  unpriced: number;
  stale: boolean;
  snapshot: 'written' | 'skipped';
};

const PREFIX = 'viastela.quote-cache.v1.';

export function quoteCacheKey(userId: string): string {
  requireUserId(userId);
  return `${PREFIX}${userId}`;
}

/** Rejects an `unavailable` quote that still carries a price, and a priced status with a null price. */
export function cachedQuote(draft: CachedQuoteDraft): CachedQuote {
  if (draft.status === 'unavailable') {
    if (draft.price !== null) throw new Error('unavailable quote price must be null');
    return {
      symbol: draft.symbol,
      price: null,
      currency: draft.currency,
      as_of: draft.as_of,
      status: 'unavailable',
      source: draft.source,
    };
  }
  if (draft.price === null) throw new Error('quote price is required when status is fresh or stale');
  return {
    symbol: draft.symbol,
    price: draft.price,
    currency: draft.currency,
    as_of: draft.as_of,
    status: draft.status,
    source: draft.source,
  };
}

/** That user's cached quotes. Never another user's rows. */
export async function readCachedQuotes(userId: string): Promise<readonly CachedQuote[]> {
  const stored = await readStored(userId);
  return stored?.quotes ?? [];
}

/** That user's last quotes response, or null when only a quote list was stored. */
export async function readCachedQuoteBook(userId: string): Promise<CachedQuoteBook | null> {
  const stored = await readStored(userId);
  if (!stored?.book) return null;
  return { ...stored.book, quotes: stored.quotes };
}

/** Replace that user's quote list. Does not merge quotes, and does not touch other users. */
export async function writeCachedQuotes(userId: string, quotes: readonly CachedQuote[]): Promise<void> {
  requireUserId(userId);
  if (!Array.isArray(quotes)) throw new Error('quotes must be a list');
  const next = quotes.map((quote) => cachedQuote(quote));
  const existing = await readStored(userId);
  await writeStored(userId, { quotes: next, book: existing?.book ?? null });
}

/** Replace that user's last quotes response, including `total_usd`. */
export async function writeCachedQuoteBook(userId: string, book: CachedQuoteBook): Promise<void> {
  requireUserId(userId);
  const quotes = book.quotes.map((quote) => cachedQuote(quote));
  await writeStored(userId, {
    quotes,
    book: {
      rates: book.rates,
      source: book.source,
      total_usd: book.total_usd,
      cash_usd: book.cash_usd,
      securities_usd: book.securities_usd,
      unpriced: book.unpriced,
      stale: book.stale,
      snapshot: book.snapshot,
    },
  });
}

/**
 * Drop one user's quotes, or every user's quotes when `userId` is omitted.
 * Sign-out and account deletion pass that user's id.
 */
export async function clearQuoteCache(userId?: string): Promise<void> {
  const store = await localStore();
  if (userId === undefined) {
    const keys = await store.getAllKeys();
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX)).map((key) => store.removeItem(key)));
    return;
  }
  requireUserId(userId);
  await store.removeItem(quoteCacheKey(userId));
}

type StoredBook = Omit<CachedQuoteBook, 'quotes'>;

type Stored = {
  quotes: CachedQuote[];
  book: StoredBook | null;
};

async function readStored(userId: string): Promise<Stored | null> {
  requireUserId(userId);
  const raw = await (await localStore()).getItem(quoteCacheKey(userId));
  if (!raw) return null;
  try {
    return parseStored(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function writeStored(userId: string, stored: Stored): Promise<void> {
  await (await localStore()).setItem(quoteCacheKey(userId), JSON.stringify({ ...stored.book, quotes: stored.quotes }));
}

function parseStored(value: unknown): Stored | null {
  if (Array.isArray(value)) {
    return { quotes: value.map(parseStoredQuote).filter((quote): quote is CachedQuote => quote !== null), book: null };
  }
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  const quotes = Array.isArray(body.quotes)
    ? body.quotes.map(parseStoredQuote).filter((quote): quote is CachedQuote => quote !== null)
    : [];
  return { quotes, book: parseBook(body) };
}

function parseStoredQuote(value: unknown): CachedQuote | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.symbol !== 'string' || typeof row.currency !== 'string' || typeof row.as_of !== 'string') return null;
  if (row.status !== 'fresh' && row.status !== 'stale' && row.status !== 'unavailable') return null;
  if (row.source !== 'finnhub' && row.source !== 'cost_basis') return null;
  if (row.price !== null && typeof row.price !== 'number') return null;
  try {
    return cachedQuote({
      symbol: row.symbol,
      price: row.price,
      currency: row.currency,
      as_of: row.as_of,
      status: row.status,
      source: row.source,
    });
  } catch {
    return null;
  }
}

function parseBook(body: Record<string, unknown>): StoredBook | null {
  if (body.source !== 'finnhub' && body.source !== 'cost_basis') return null;
  if (body.snapshot !== 'written' && body.snapshot !== 'skipped') return null;
  if (typeof body.stale !== 'boolean') return null;
  if (!isMoney(body.total_usd) || !isMoney(body.cash_usd) || !isMoney(body.securities_usd)) return null;
  if (typeof body.unpriced !== 'number' || !Number.isInteger(body.unpriced) || body.unpriced < 0) return null;
  if (!Array.isArray(body.rates)) return null;
  const rates: CachedFxRate[] = [];
  for (const rate of body.rates) {
    if (!rate || typeof rate !== 'object') continue;
    const row = rate as Record<string, unknown>;
    if (typeof row.base !== 'string' || typeof row.quote !== 'string' || typeof row.as_of !== 'string') continue;
    if (typeof row.rate !== 'number' || !Number.isFinite(row.rate) || row.rate <= 0) continue;
    rates.push({ base: row.base, quote: row.quote, rate: row.rate, as_of: row.as_of });
  }
  return {
    rates,
    source: body.source,
    total_usd: body.total_usd,
    cash_usd: body.cash_usd,
    securities_usd: body.securities_usd,
    unpriced: body.unpriced,
    stale: body.stale,
    snapshot: body.snapshot,
  };
}

function isMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function requireUserId(userId: string): void {
  if (userId.trim().length === 0) throw new Error('userId is required');
}
