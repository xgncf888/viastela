import { expect, test } from '@jest/globals';

import { dashboardTotalUsd, splitLiveAssets, type SummaryAccount, type SummaryQuote } from './asset-summary';

const cash: SummaryAccount = { id: 'cash', currency: 'USD', deletedAt: null };
const closed: SummaryAccount = { id: 'closed', currency: 'USD', deletedAt: '2026-01-02T00:00:00.000Z' };

test('a deleted account balance is left out of the split', () => {
  const split = splitLiveAssets({
    accounts: [cash, closed],
    balances: [
      { accountId: 'cash', amount: 20, recordedAt: '2026-01-02T00:00:00.000Z', deletedAt: null },
      { accountId: 'closed', amount: 80, recordedAt: '2026-01-03T00:00:00.000Z', deletedAt: null },
      { accountId: 'cash', amount: 5, recordedAt: '2026-01-01T00:00:00.000Z', deletedAt: null },
    ],
    holdings: [],
    quotes: [],
  });
  expect(split.cashUsd).toBe(20);
  expect(split.partsUsd).toBe(20);
});

test('unavailable and null prices are excluded even when a cost basis is present', () => {
  const quote = (status: SummaryQuote['status'], price: number | null, source: SummaryQuote['source']): SummaryQuote => ({
    symbol: 'AAA',
    status,
    price,
    source,
  });
  const holding = {
    accountId: 'cash',
    symbol: 'AAA',
    quantity: 2,
    costBasisUsd: 9,
    deletedAt: null,
  };
  const unavailable = splitLiveAssets({
    accounts: [cash],
    balances: [],
    holdings: [holding],
    quotes: [quote('unavailable', null, 'finnhub')],
  });
  expect(unavailable.securitiesUsd).toBe(0);
  expect(unavailable.unpricedHoldings).toBe(1);

  const missing = splitLiveAssets({
    accounts: [cash],
    balances: [],
    holdings: [holding],
    quotes: [quote('fresh', null, 'cost_basis')],
  });
  expect(missing.securitiesUsd).toBe(0);

  const priced = splitLiveAssets({
    accounts: [cash],
    balances: [],
    holdings: [holding],
    quotes: [quote('fresh', 4, 'cost_basis')],
  });
  expect(priced.securitiesUsd).toBe(8);
  expect(priced.unpricedHoldings).toBe(0);
});

test('a non-USD balance uses USD per unit, so 1000 SGD at 1.25 per USD is 800', () => {
  const split = splitLiveAssets({
    accounts: [{ id: 'sgd', currency: 'SGD', deletedAt: null }],
    balances: [{ accountId: 'sgd', amount: 1000, recordedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }],
    holdings: [],
    quotes: [],
    fxPerUsd: { SGD: 1.25 },
  });
  expect(split.cashUsd).toBe(800);
});

test('the dashboard total is the server total_usd, not the client split', () => {
  const split = splitLiveAssets({
    accounts: [cash],
    balances: [{ accountId: 'cash', amount: 99, recordedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }],
    holdings: [],
    quotes: [],
  });
  expect(split.partsUsd).toBe(99);
  expect(dashboardTotalUsd({ total_usd: 40 })).toBe(40);
  expect(dashboardTotalUsd(null)).toBeNull();
});
