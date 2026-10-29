import { afterEach, beforeEach, expect, test } from '@jest/globals';

import { createMemoryLocalStore, setLocalStoreForTests } from './local-store';
import {
  cachedQuote,
  clearQuoteCache,
  quoteCacheKey,
  readCachedQuoteBook,
  readCachedQuotes,
  writeCachedQuoteBook,
  writeCachedQuotes,
  type CachedQuote,
  type CachedQuoteBook,
} from './quoteCache';

const store = createMemoryLocalStore();

beforeEach(() => {
  setLocalStoreForTests(store);
});

afterEach(async () => {
  await clearQuoteCache();
});

function sample(symbol: string, price: number): CachedQuote {
  return cachedQuote({
    symbol,
    price,
    currency: 'USD',
    as_of: '2026-01-01T00:00:00.000Z',
    status: 'fresh',
    source: 'finnhub',
  });
}

function book(total: number, quotes: CachedQuote[]): CachedQuoteBook {
  return {
    quotes,
    rates: [],
    source: 'finnhub',
    total_usd: total,
    cash_usd: total,
    securities_usd: 0,
    unpriced: 0,
    stale: false,
    snapshot: 'written',
  };
}

test('quote cache requires a user id when one is passed', async () => {
  await expect(readCachedQuotes('  ')).rejects.toThrow(/userId/);
  await expect(clearQuoteCache('')).rejects.toThrow(/userId/);
});

test('an unavailable quote has a null price', () => {
  type UnavailablePrice = Extract<CachedQuote, { status: 'unavailable' }>['price'];
  const priceIsNull: [UnavailablePrice] extends [null] ? true : false = true;
  expect(priceIsNull).toBe(true);

  const quote = cachedQuote({
    symbol: 'EXAMPLE',
    price: null,
    currency: 'USD',
    as_of: '2026-01-15T00:00:00.000Z',
    status: 'unavailable',
    source: 'cost_basis',
  });
  expect(quote.status).toBe('unavailable');
  expect(quote.price).toBeNull();
  expect(quote.source).toBe('cost_basis');

  expect(() =>
    cachedQuote({
      symbol: 'EXAMPLE',
      price: 9,
      currency: 'USD',
      as_of: '2026-01-15T00:00:00.000Z',
      status: 'unavailable',
      source: 'finnhub',
    }),
  ).toThrow(/null/);
});

test('user B cannot read user A cache, including after A signs out', async () => {
  const quote = sample('AAA', 11);
  await writeCachedQuoteBook('user-a', book(11, [quote]));
  expect(quoteCacheKey('user-a')).toContain('user-a');
  expect(quoteCacheKey('user-a')).not.toBe(quoteCacheKey('user-b'));
  await expect(readCachedQuotes('user-b')).resolves.toEqual([]);
  await expect(readCachedQuoteBook('user-b')).resolves.toBeNull();
  expect((await readCachedQuoteBook('user-a'))?.total_usd).toBe(11);

  await clearQuoteCache('user-a');
  await expect(readCachedQuotes('user-a')).resolves.toEqual([]);
  await writeCachedQuotes('user-b', [sample('BBB', 4)]);
  await clearQuoteCache('user-a');
  expect((await readCachedQuotes('user-b')).map((item) => item.symbol)).toEqual(['BBB']);
});
