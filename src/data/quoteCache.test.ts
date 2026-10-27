import { expect, test } from '@jest/globals';

import { cachedQuote, clearQuoteCache, readCachedQuotes, writeCachedQuotes, type CachedQuote } from './quoteCache';

test('quote cache calls reject until a later change adds storage', async () => {
  const quote = cachedQuote({
    symbol: 'EXAMPLE',
    price: 1,
    currency: 'USD',
    as_of: '2026-01-01T00:00:00.000Z',
    status: 'fresh',
    source: 'finnhub',
  });
  await expect(readCachedQuotes('user-a')).rejects.toThrow('not implemented');
  await expect(writeCachedQuotes('user-a', [quote])).rejects.toThrow('not implemented');
  await expect(clearQuoteCache('user-a')).rejects.toThrow('not implemented');
  await expect(clearQuoteCache()).rejects.toThrow('not implemented');
});

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
      price: 9.5,
      currency: 'USD',
      as_of: '2026-01-15T00:00:00.000Z',
      status: 'unavailable',
      source: 'finnhub',
    }),
  ).toThrow(/null/);
});
