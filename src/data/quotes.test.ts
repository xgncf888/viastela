import { expect, test } from '@jest/globals';

import { adaptQuotesResponse, describeQuoteError } from './quotes';

const response = {
  quotes: [
    {
      symbol: 'AAA',
      price: 11,
      currency: 'USD',
      as_of: '2026-01-15T00:30:00.000Z',
      status: 'fresh',
      source: 'finnhub',
    },
    {
      symbol: 'BBB',
      price: null,
      currency: 'USD',
      as_of: '2026-01-15T00:30:00.000Z',
      status: 'unavailable',
      source: 'finnhub',
    },
  ],
  rates: [{ base: 'USD', quote: 'CNY', rate: 2, as_of: '2026-01-15' }],
  source: 'finnhub',
  total_usd: 40,
  cash_usd: 20,
  securities_usd: 20,
  unpriced: 1,
  stale: false,
  snapshot: 'skipped',
};

test('adapts the quotes function body and keeps total_usd', () => {
  const book = adaptQuotesResponse(response);
  expect(book?.total_usd).toBe(40);
  expect(book?.quotes[0]?.price).toBe(11);
  expect(book?.quotes[1]?.price).toBeNull();
  expect(book?.snapshot).toBe('skipped');
  expect(book?.unpriced).toBe(1);
});

test('a quote that disagrees with its status does not replace the cache shape', () => {
  expect(
    adaptQuotesResponse({
      ...response,
      quotes: [{ ...response.quotes[0], status: 'unavailable', price: 11 }],
    }),
  ).toBeNull();
});

test('reads fx_unavailable from a 502 body', async () => {
  const body = JSON.stringify({ error: 'fx_unavailable' });
  const described = await describeQuoteError(
    { context: new Response(body, { status: 502, headers: { 'content-type': 'application/json' } }) },
    null,
  );
  expect(described.status).toBe(502);
  expect(described.body).toEqual({ error: 'fx_unavailable' });
  expect(described.network).toBe(false);
});
