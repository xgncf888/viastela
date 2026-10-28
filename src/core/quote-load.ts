export type QuoteFailureKind = 'quote_unavailable' | 'fx_unavailable' | 'network' | 'timeout' | 'other';

/**
 * A failed quotes call keeps the previous device cache and does not write.
 * `quote_unavailable` (502, no provider cache), `fx_unavailable`, a timeout,
 * and network errors all mark that cache as possibly expired. With no cache
 * there is nothing to show. A timeout is the same path as quotes unavailable.
 */
export function planQuoteLoad<T>(input: {
  failure: QuoteFailureKind | null;
  live: T | null;
  cached: T | null;
}): { book: T | null; degraded: boolean; persist: boolean } {
  if (input.failure === null && input.live) {
    return { book: input.live, degraded: false, persist: true };
  }
  const reuse =
    input.failure === 'quote_unavailable' ||
    input.failure === 'fx_unavailable' ||
    input.failure === 'network' ||
    input.failure === 'timeout' ||
    input.failure === 'other';
  if (reuse && input.cached) {
    return { book: input.cached, degraded: true, persist: false };
  }
  return { book: null, degraded: input.failure !== null, persist: false };
}

export function classifyQuoteFailure(input: {
  network: boolean;
  status: number | null;
  body: unknown;
}): QuoteFailureKind {
  if (input.network) return 'network';
  const code = errorCode(input.body);
  if (code === 'fx_unavailable') return 'fx_unavailable';
  if (code === 'quote_unavailable' || input.status === 502) return 'quote_unavailable';
  return 'other';
}

function errorCode(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('error' in body)) return null;
  const code = (body as { error?: unknown }).error;
  return typeof code === 'string' ? code : null;
}
