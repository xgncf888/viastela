import { expect, test } from '@jest/globals';

import { formatMoney, formatShares } from './money-format';

test('formats invented amounts with a currency prefix and two decimals', () => {
  expect(formatMoney(12, 'USD')).toBe('US$12.00');
  expect(formatMoney(1500, 'USD')).toBe('US$1,500.00');
  expect(formatMoney(-4, 'SGD')).toBe('-S$4.00');
  expect(formatMoney(8, 'HKD')).toBe('HK$8.00');
  expect(formatMoney(3, 'CNY')).toBe('¥3.00');
});

test('formats share counts without trailing zeros', () => {
  expect(formatShares(10)).toBe('10');
  expect(formatShares(1.5)).toBe('1.5');
  expect(formatShares(1.25)).toBe('1.25');
});
