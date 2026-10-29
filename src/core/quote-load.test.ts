import { expect, test } from '@jest/globals';

import { classifyQuoteFailure, planQuoteLoad } from './quote-load';

const live = { total_usd: 40, mark: 'live' };
const cached = { total_usd: 11, mark: 'cached' };

test('a live quotes payload is what gets stored', () => {
  expect(planQuoteLoad({ failure: null, live, cached })).toEqual({
    book: live,
    degraded: false,
    persist: true,
  });
});

test.each(['quote_unavailable', 'fx_unavailable', 'network', 'timeout'] as const)(
  '%s keeps the previous cache, marks it expired, and does not write',
  (failure) => {
    expect(planQuoteLoad({ failure, live: null, cached })).toEqual({
      book: cached,
      degraded: true,
      persist: false,
    });
    expect(planQuoteLoad({ failure, live: null, cached: null })).toEqual({
      book: null,
      degraded: true,
      persist: false,
    });
  },
);

test('classifies a 502 with no cache, fx_unavailable, and a network failure', () => {
  expect(classifyQuoteFailure({ network: false, status: 502, body: { error: 'quote_unavailable' } })).toBe(
    'quote_unavailable',
  );
  expect(classifyQuoteFailure({ network: false, status: 502, body: null })).toBe('quote_unavailable');
  expect(classifyQuoteFailure({ network: false, status: 502, body: { error: 'fx_unavailable' } })).toBe(
    'fx_unavailable',
  );
  expect(classifyQuoteFailure({ network: true, status: null, body: null })).toBe('network');
});
