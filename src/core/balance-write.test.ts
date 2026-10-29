import { expect, test } from '@jest/globals';

import { balanceAfterUsd, balanceUsdRate, buildBalanceInsert } from './balance-write';

test('a USD balance row always writes usd_rate 1', () => {
  expect(balanceUsdRate('USD', null)).toBe(1);
  expect(balanceUsdRate('USD', undefined)).toBe(1);
  const row = buildBalanceInsert({
    id: 'balance-1',
    accountId: 'account-1',
    amount: 12,
    currency: 'USD',
    unitsPerUsd: null,
    recordedAt: '2026-01-15T00:00:00.000Z',
    tz: 'Asia/Singapore',
    localDay: '2026-01-15',
  });
  expect(row.usd_rate).toBe(1);
  expect(row.amount).toBe(12);
});

test('a non-USD balance stores USD per unit, and stays null without a positive quote', () => {
  expect(balanceUsdRate('CNY', null)).toBeNull();
  expect(balanceUsdRate('CNY', undefined)).toBeNull();
  expect(balanceUsdRate('SGD', 0)).toBeNull();
  expect(balanceUsdRate('HKD', -1)).toBeNull();
  expect(balanceUsdRate('CNY', 2)).toBe(0.5);
  expect(
    buildBalanceInsert({
      id: 'balance-2',
      accountId: 'account-2',
      amount: 6,
      currency: 'CNY',
      unitsPerUsd: null,
      recordedAt: '2026-01-15T00:00:00.000Z',
      tz: 'UTC',
      localDay: '2026-01-15',
    }).usd_rate,
  ).toBeNull();
});

test('SGD 1.25 per USD is stored as 0.8, so 1000 SGD is 800 USD', () => {
  expect(balanceUsdRate('SGD', 1.25)).toBe(0.8);
  const row = buildBalanceInsert({
    id: 'balance-sgd',
    accountId: 'account-sgd',
    amount: 1000,
    currency: 'SGD',
    unitsPerUsd: 1.25,
    recordedAt: '2026-01-15T00:00:00.000Z',
    tz: 'Asia/Singapore',
    localDay: '2026-01-15',
  });
  expect(row.usd_rate).toBe(0.8);
  expect(balanceAfterUsd(row.amount, row.usd_rate)).toBe(800);
});
