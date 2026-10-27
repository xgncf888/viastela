import { expect, test } from '@jest/globals';

import { balanceUsdRate, buildBalanceInsert } from './balance-write';

test('a USD balance row always writes usd_rate 1', () => {
  expect(balanceUsdRate('USD', null)).toBe(1);
  expect(balanceUsdRate('USD', undefined)).toBe(1);
  const row = buildBalanceInsert({
    id: 'balance-1',
    accountId: 'account-1',
    amount: 12,
    currency: 'USD',
    observedRate: null,
    recordedAt: '2026-01-15T00:00:00.000Z',
    tz: 'Asia/Singapore',
    localDay: '2026-01-15',
  });
  expect(row.usd_rate).toBe(1);
  expect(row.amount).toBe(12);
});

test('a non-USD balance keeps a positive FX snapshot and otherwise stays null', () => {
  expect(balanceUsdRate('CNY', null)).toBeNull();
  expect(balanceUsdRate('CNY', 2)).toBe(2);
  expect(balanceUsdRate('SGD', 0)).toBeNull();
  expect(balanceUsdRate('HKD', -1)).toBeNull();
  expect(
    buildBalanceInsert({
      id: 'balance-2',
      accountId: 'account-2',
      amount: 6,
      currency: 'CNY',
      observedRate: null,
      recordedAt: '2026-01-15T00:00:00.000Z',
      tz: 'UTC',
      localDay: '2026-01-15',
    }).usd_rate,
  ).toBeNull();
});
