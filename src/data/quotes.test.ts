import { afterEach, expect, jest, test } from '@jest/globals';

import { QUOTES_TIMEOUT_MS } from '@/lib/timing';

import { createMemoryLocalStore, setLocalStoreForTests } from './local-store';
import { readCachedQuoteBook, writeCachedQuoteBook, type CachedQuoteBook } from './quoteCache';
import { adaptQuotesResponse, describeQuoteError, loadQuoteBook, setQuoteInvokeForTests, settleQuoteInvoke } from './quotes';

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

const userId = 'user-1';
const cachedBook: CachedQuoteBook = {
  quotes: [
    {
      symbol: 'AAA',
      price: 11,
      currency: 'USD',
      as_of: '2026-01-15T00:30:00.000Z',
      status: 'fresh',
      source: 'finnhub',
    },
  ],
  rates: [],
  source: 'finnhub',
  total_usd: 12345,
  cash_usd: 0,
  securities_usd: 0,
  unpriced: 0,
  stale: false,
  snapshot: 'skipped',
};

afterEach(() => {
  setQuoteInvokeForTests(null);
  setLocalStoreForTests(null);
  jest.useRealTimers();
});

test('a hung quotes call aborts at QUOTES_TIMEOUT_MS and keeps the cached book', async () => {
  setLocalStoreForTests(createMemoryLocalStore());
  await writeCachedQuoteBook(userId, cachedBook);
  const timeout = jest.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), 20);
    return controller.signal;
  });
  setQuoteInvokeForTests(
    (_tz, signal) =>
      new Promise((_resolve, reject) => {
        if (!signal) {
          reject(new Error('missing signal'));
          return;
        }
        signal.addEventListener('abort', () => reject(signal.reason));
      }),
  );
  try {
    const result = await loadQuoteBook(userId, 'UTC');
    expect(timeout).toHaveBeenCalledWith(QUOTES_TIMEOUT_MS);
    expect(result.failure).toBe('timeout');
    expect(result.degraded).toBe(true);
    expect(result.book?.total_usd).toBe(12345);
    expect((await readCachedQuoteBook(userId))?.total_usd).toBe(12345);
  } finally {
    timeout.mockRestore();
  }
});

test('without AbortSignal.timeout the quotes call still stops and keeps the cache', async () => {
  jest.useFakeTimers();
  setLocalStoreForTests(createMemoryLocalStore());
  await writeCachedQuoteBook(userId, cachedBook);
  let settled = false;
  const pending = settleQuoteInvoke(QUOTES_TIMEOUT_MS, () => new Promise(() => {}), 'UTC', false).then(
    () => {
      settled = true;
    },
    (error: unknown) => error,
  );
  await jest.advanceTimersByTimeAsync(QUOTES_TIMEOUT_MS - 1);
  expect(settled).toBe(false);
  await jest.advanceTimersByTimeAsync(1);
  const error = await pending;
  expect(error).toMatchObject({ name: 'TimeoutError' });
  jest.useRealTimers();
  setQuoteInvokeForTests(async () => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  });
  const loaded = await loadQuoteBook(userId, 'UTC');
  expect(loaded.failure).toBe('timeout');
  expect((await readCachedQuoteBook(userId))?.quotes[0]?.price).toBe(11);
});

test('a 200 body with stale true keeps the cached prices', async () => {
  setLocalStoreForTests(createMemoryLocalStore());
  const asOf = '2026-01-15T00:30:00.000Z';
  setQuoteInvokeForTests(async () => ({
    data: {
      ...response,
      stale: true,
      total_usd: 80,
      cash_usd: 0,
      securities_usd: 80,
      quotes: [{ ...response.quotes[0], price: 80, status: 'stale', as_of: asOf }],
    },
    error: null,
  }));
  const result = await loadQuoteBook(userId, 'Asia/Singapore');
  expect(result.failure).toBeNull();
  expect(result.book?.stale).toBe(true);
  expect(result.book?.total_usd).toBe(80);
  expect(result.book?.quotes[0]?.price).toBe(80);
  expect(result.book?.quotes[0]?.as_of).toBe(asOf);
  expect(result.book?.quotes[0]?.status).toBe('stale');
});

test('a quotes http failure keeps the cached book and does not write over it', async () => {
  setLocalStoreForTests(createMemoryLocalStore());
  await writeCachedQuoteBook(userId, cachedBook);
  setQuoteInvokeForTests(async () => ({
    data: null,
    error: { context: new Response(JSON.stringify({ error: 'nope' }), { status: 500 }) },
  }));
  const result = await loadQuoteBook(userId, 'UTC');
  expect(result.failure).toBe('other');
  expect(result.book?.total_usd).toBe(12345);
  expect(result.degraded).toBe(true);
  expect((await readCachedQuoteBook(userId))?.total_usd).toBe(12345);
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
