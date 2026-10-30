export type TimelineLoadFlags = {
  /** Page has a finished read. Later reads must not drop back to the skeleton. */
  ready: boolean;
  /** First read failed. The shared failure row replaces the skeleton. */
  failed: boolean;
  /** A later read failed. The rows stay, and the refresh line reports it. */
  refreshError: boolean;
};

export type TimelineRefreshPhase = 'idle' | 'refreshing' | 'failed';

/**
 * How a timeline read settles.
 * A thrown read is `ok: false`, including HTTP 500. The first read then uses the
 * shared failure row. A filter change, a saved log, or any other refresh keeps
 * `ready` so the title, filters, and rows stay up.
 */
export function nextTimelineLoad(hadContent: boolean, ok: boolean): TimelineLoadFlags {
  if (ok) return { ready: true, failed: false, refreshError: false };
  if (hadContent) return { ready: true, failed: false, refreshError: true };
  return { ready: false, failed: true, refreshError: false };
}

/** Refresh line only after the first read has produced a page. Pending wins over a stale failure. */
export function timelineRefreshPhase(input: {
  hadContent: boolean;
  pending: boolean;
  refreshError: boolean;
}): TimelineRefreshPhase {
  if (!input.hadContent) return 'idle';
  if (input.pending) return 'refreshing';
  if (input.refreshError) return 'failed';
  return 'idle';
}
