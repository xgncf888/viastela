export type QuoteLineStatus = 'idle' | 'refreshing' | 'failed';

/**
 * A background refresh that throws keeps the cached screen and raises the
 * failure line. A first load that throws stays on the error card.
 */
export function refreshOutcome(
  background: boolean,
  ok: boolean,
): { failed: boolean; refreshError: boolean } {
  if (ok) return { failed: false, refreshError: false };
  if (background) return { failed: false, refreshError: true };
  return { failed: true, refreshError: false };
}

/**
 * Status line for a quotes refresh.
 * A non-2xx failure, a thrown background refresh, and a 200 body with `stale: true`
 * (the server fell back to its cache) all use the failure line. The stale flag is
 * the field #16 returns; prices in that body stay on screen.
 */
export function quoteLineStatus(input: {
  refreshing: boolean;
  quoteFailed: boolean;
  refreshError: boolean;
  stale: boolean;
}): QuoteLineStatus {
  if (input.refreshing) return 'refreshing';
  if (input.refreshError || input.quoteFailed || input.stale) return 'failed';
  return 'idle';
}
