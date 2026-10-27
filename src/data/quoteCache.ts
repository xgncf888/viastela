/**
 * Offline quote cache for a later dashboard.
 *
 * An entry is one item from the `quotes` Edge Function response:
 * `{ symbol, price, currency, as_of, status }` where `status` is `fresh`,
 * `stale`, or `unavailable`.
 *
 * Rows are partitioned by `user_id`. A read or write for one user must not
 * return or replace another user's quotes. Sign-out and account deletion
 * call `clearQuoteCache(userId)` so the next person on the device cannot see
 * the previous prices. `clearQuoteCache()` with no id drops every partition,
 * for a full local wipe.
 *
 * This file is only the signature. There is no store yet. Each call rejects
 * with "not implemented"; the device cache lands in a later change. Callers
 * should await these, because that store will be asynchronous.
 */

export type QuoteCacheStatus = 'fresh' | 'stale' | 'unavailable';

export type CachedQuote = {
  symbol: string;
  price: number;
  currency: string;
  as_of: string;
  status: QuoteCacheStatus;
};

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
