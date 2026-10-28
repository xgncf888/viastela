import { afterEach, beforeEach, expect, test } from '@jest/globals';

import { leaveDeviceSession } from './auth';
import { createMemoryLocalStore, setLocalStoreForTests } from './local-store';
import { clearQuoteCache, readCachedQuotes, writeCachedQuotes, cachedQuote } from './quoteCache';

beforeEach(() => {
  setLocalStoreForTests(createMemoryLocalStore());
});

afterEach(async () => {
  await clearQuoteCache();
  setLocalStoreForTests(null);
});

test('sign-out clears the current user cache even when auth.signOut throws', async () => {
  const quote = cachedQuote({
    symbol: 'AAA',
    price: 11,
    currency: 'USD',
    as_of: '2026-01-01T00:00:00.000Z',
    status: 'fresh',
    source: 'finnhub',
  });
  await writeCachedQuotes('user-a', [quote]);
  await writeCachedQuotes('user-b', [
    cachedQuote({
      symbol: 'BBB',
      price: 4,
      currency: 'USD',
      as_of: '2026-01-01T00:00:00.000Z',
      status: 'fresh',
      source: 'finnhub',
    }),
  ]);
  await expect(
    leaveDeviceSession('user-a', async () => {
      throw new Error('sign-out failed');
    }),
  ).rejects.toThrow('sign-out failed');
  await expect(readCachedQuotes('user-a')).resolves.toEqual([]);
  expect((await readCachedQuotes('user-b')).map((item) => item.symbol)).toEqual(['BBB']);
});
