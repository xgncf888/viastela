import { expect, test } from '@jest/globals';

import {
  COST_BASIS_LABEL,
  QUOTE_MISS_REASON,
  QUOTE_REFRESH_FAILED,
  TOTAL_UNAVAILABLE_TITLE,
  STALE_LABEL,
  UNAVAILABLE_LABEL,
  actualSeriesNote,
  cachedQuoteAsOf,
  quoteFailurePresentation,
  quoteSetStatus,
  quoteStatusLabel,
  unpricedHoldingsMessage,
} from './quote-label';

const AS_OF = '2026-01-15T00:30:00.000Z';

test('cost_basis with a price says 按成本价估算 and never a clock time', () => {
  for (const status of ['fresh', 'stale'] as const) {
    const label = quoteStatusLabel({
      source: 'cost_basis',
      status,
      asOf: AS_OF,
      timeZone: 'Asia/Singapore',
    });
    expect(label.text).toBe(COST_BASIS_LABEL);
    expect(label.text).not.toContain('价格更新于');
  }
});

test('unavailable is 暂无价格 even when a cost basis exists on the holding', () => {
  const label = quoteStatusLabel({
    source: 'cost_basis',
    status: 'unavailable',
    asOf: AS_OF,
    timeZone: 'Asia/Singapore',
    possiblyExpired: true,
  });
  expect(label).toEqual({ text: UNAVAILABLE_LABEL, tone: 'plain' });
  expect(
    quoteStatusLabel({
      source: 'finnhub',
      status: 'unavailable',
      asOf: AS_OF,
      timeZone: 'UTC',
    }).text,
  ).toBe(UNAVAILABLE_LABEL);
});

test('finnhub fresh uses the user timezone, and stale or a failed refresh says 价格可能过期', () => {
  expect(
    quoteStatusLabel({
      source: 'finnhub',
      status: 'fresh',
      asOf: AS_OF,
      timeZone: 'Asia/Singapore',
    }),
  ).toEqual({ text: '价格更新于 08:30', tone: 'muted' });
  expect(
    quoteStatusLabel({
      source: 'finnhub',
      status: 'stale',
      asOf: AS_OF,
      timeZone: 'UTC',
    }).text,
  ).toBe(STALE_LABEL);
  expect(
    quoteStatusLabel({
      source: 'finnhub',
      status: 'fresh',
      asOf: AS_OF,
      timeZone: 'UTC',
      possiblyExpired: true,
    }).text,
  ).toBe(STALE_LABEL);
});

test('unpriced count and a skipped snapshot use the design copy', () => {
  expect(unpricedHoldingsMessage(0)).toBeNull();
  expect(unpricedHoldingsMessage(2)).toBe('有 2 个持仓没有价格，未计入总资产');
  expect(actualSeriesNote({ snapshot: 'skipped', actualPoints: 1 })).toBe('接入真实行情后开始记录实际走势');
  expect(actualSeriesNote({ snapshot: 'skipped', actualPoints: 2 })).toBeNull();
  expect(actualSeriesNote({ snapshot: 'written', actualPoints: 0 })).toBe('下个月开始显示实际走势');
});

test('a failed refresh uses the cache time, or the same miss copy for a timeout and a hard failure', () => {
  expect(
    quoteFailurePresentation({
      failed: true,
      hasCache: true,
      cachedAsOf: AS_OF,
      timeZone: 'Asia/Singapore',
    }),
  ).toEqual({
    failedLabel: QUOTE_REFRESH_FAILED,
    cacheLabel: '行情更新于 08:30',
    missLine: null,
    missReason: null,
  });
  const missed = {
    failedLabel: QUOTE_REFRESH_FAILED,
    cacheLabel: null,
    missLine: TOTAL_UNAVAILABLE_TITLE,
    missReason: QUOTE_MISS_REASON,
  };
  expect(quoteFailurePresentation({ failed: true, hasCache: false, cachedAsOf: null, timeZone: 'UTC' })).toEqual(missed);
  expect(quoteFailurePresentation({ failed: false, hasCache: false, cachedAsOf: null, timeZone: 'UTC' }).failedLabel).toBeNull();
  expect(
    cachedQuoteAsOf([
      { asOf: '2026-01-15T01:30:00.000Z', status: 'fresh' },
      { asOf: AS_OF, status: 'fresh' },
      { asOf: '2026-01-14T00:00:00.000Z', status: 'unavailable' },
    ]),
  ).toBe(AS_OF);
});

test('the quote set uses the oldest fresh clock, any stale row, or cost basis', () => {
  const fresh = (asOf: string) => ({ source: 'finnhub' as const, status: 'fresh' as const, asOf });
  expect(
    quoteSetStatus({
      quotes: [fresh('2026-01-15T01:30:00.000Z'), fresh('2026-01-15T00:30:00.000Z')],
      timeZone: 'Asia/Singapore',
    }),
  ).toEqual({ text: '价格更新于 08:30', tone: 'muted' });
  expect(
    quoteSetStatus({
      quotes: [fresh(AS_OF), { source: 'finnhub', status: 'stale', asOf: AS_OF }],
      timeZone: 'UTC',
    }),
  ).toEqual({ text: '价格可能过期', tone: 'warning' });
  expect(
    quoteSetStatus({
      quotes: [{ source: 'cost_basis', status: 'fresh', asOf: AS_OF }],
      timeZone: 'UTC',
    }),
  ).toEqual({ text: '按成本价估算', tone: 'warning' });
  expect(quoteSetStatus({ quotes: [], timeZone: 'UTC' })).toBeNull();
});
