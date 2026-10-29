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

/** Status line for a quotes refresh. A direct error and a timeout share `failed`. */
export function quoteLineStatus(input: {
  refreshing: boolean;
  quoteFailed: boolean;
  refreshError: boolean;
}): QuoteLineStatus {
  if (input.refreshing) return 'refreshing';
  if (input.refreshError || input.quoteFailed) return 'failed';
  return 'idle';
}
