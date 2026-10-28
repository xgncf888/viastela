import { expect, test } from '@jest/globals';

import { QUOTES_TIMEOUT_MS, REQUEST_TIMEOUT_MS, SKELETON_DELAY_MS } from '@/lib/timing';

test('request budgets live in src/lib/timing', () => {
  expect(REQUEST_TIMEOUT_MS).toBe(8000);
  expect(QUOTES_TIMEOUT_MS).toBe(REQUEST_TIMEOUT_MS);
  expect(SKELETON_DELAY_MS).toBe(1000);
});
