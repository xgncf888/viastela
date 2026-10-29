import { expect, test } from '@jest/globals';

import { nextTimelineLoad, timelineRefreshPhase } from './timeline-load';

test('a first load that throws, including HTTP 500, stays on the failure row', () => {
  expect(nextTimelineLoad(false, false)).toEqual({ ready: false, failed: true, refreshError: false });
  expect(timelineRefreshPhase({ hadContent: false, pending: false, refreshError: false })).toBe('idle');
});

test('a retry after that failure is another first load, so it can time out again', () => {
  const failed = nextTimelineLoad(false, false);
  expect(failed.ready).toBe(false);
  expect(timelineRefreshPhase({ hadContent: failed.ready, pending: true, refreshError: false })).toBe('idle');
  expect(nextTimelineLoad(false, true)).toEqual({ ready: true, failed: false, refreshError: false });
});

test('a filter change, a saved log, or a background refresh error keeps the page', () => {
  expect(nextTimelineLoad(true, false)).toEqual({ ready: true, failed: false, refreshError: true });
  expect(timelineRefreshPhase({ hadContent: true, pending: true, refreshError: false })).toBe('refreshing');
  expect(timelineRefreshPhase({ hadContent: true, pending: true, refreshError: true })).toBe('refreshing');
  expect(timelineRefreshPhase({ hadContent: true, pending: false, refreshError: true })).toBe('failed');
  expect(nextTimelineLoad(true, true)).toEqual({ ready: true, failed: false, refreshError: false });
  expect(timelineRefreshPhase({ hadContent: true, pending: false, refreshError: false })).toBe('idle');
});
