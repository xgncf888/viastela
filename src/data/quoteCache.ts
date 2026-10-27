/**
 * Offline quote cache for a later dashboard.
 *
 * An entry is one item from the `quotes` Edge Function response:
 * `{ symbol, price, currency, as_of, status, source }`. `status` is `fresh`,
 * `stale`, or `unavailable`. `price` is a number for `fresh` and `stale`, and
 * null for `unavailable`. `source` is `finnhub` or `cost_basis`.
 *
 * Rows are partitioned by `user_id`. A read or write for one user must not
 * return or replace another user's quotes. Sign-out and account deletion
 * call `clearQuoteCache(userId)` so the next person on the device cannot see
 * the previous prices. `clearQuoteCache()` with no id drops every partition,
 * for a full local wipe.
 *
 * There is no store yet. Read, write, and clear reject with "not implemented";
 * the device cache lands in a later change. Callers should await those three,
 * because that store will be asynchronous. `cachedQuote` only checks the shape.
 */

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

/** That user's cached quotes, or a rejection until the store exists. Never another user's rows. */
export async function readCachedQuotes(userId: string): Promise<readonly CachedQuote[]> {
  requireUserId(userId);
  throw new Error('not implemented');
}

/** Replace that user's quote list. Does not merge, and does not touch other users. */
export async function writeCachedQuotes(userId: string, quotes: readonly CachedQuote[]): Promise<void> {
  requireUserId(userId);
  if (!Array.isArray(quotes)) throw new Error('quotes must be a list');
  throw new Error('not implemented');
}

/**
 * Drop one user's quotes, or every user's quotes when `userId` is omitted.
 * Sign-out and account deletion pass that user's id.
 */
export async function clearQuoteCache(userId?: string): Promise<void> {
  if (userId !== undefined) requireUserId(userId);
  throw new Error('not implemented');
}

function requireUserId(userId: string): void {
  if (userId.trim().length === 0) throw new Error('userId is required');
}
