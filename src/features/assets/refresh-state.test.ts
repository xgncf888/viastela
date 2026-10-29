import { expect, test } from '@jest/globals';

import { quoteLineStatus, refreshOutcome } from './refresh-state';

test('a background refresh error keeps the page and shows the failure line', () => {
  expect(refreshOutcome(true, false)).toEqual({ failed: false, refreshError: true });
  expect(refreshOutcome(false, false)).toEqual({ failed: true, refreshError: false });
  expect(refreshOutcome(true, true)).toEqual({ failed: false, refreshError: false });
});

test('a direct error and a quote failure both use the failure line once refresh settles', () => {
  expect(quoteLineStatus({ refreshing: true, quoteFailed: false, refreshError: true })).toBe('refreshing');
  expect(quoteLineStatus({ refreshing: false, quoteFailed: false, refreshError: true })).toBe('failed');
  expect(quoteLineStatus({ refreshing: false, quoteFailed: true, refreshError: false })).toBe('failed');
  expect(quoteLineStatus({ refreshing: false, quoteFailed: false, refreshError: false })).toBe('idle');
});
