import { expect, test } from '@jest/globals';

import { theme } from './theme';
import { HIDDEN_AMOUNT_LABEL, maskedAmountMetrics } from './masked-amount';

test('a variant keeps one slot width for short and long amounts', () => {
  const shortAmount = maskedAmountMetrics('US$1.00', 'body');
  const longAmount = maskedAmountMetrics('US$100000.00', 'body');
  const display = maskedAmountMetrics('US$1.00', 'display');

  expect(HIDDEN_AMOUNT_LABEL).toBe('已隐藏金额');
  expect(shortAmount.fontVariant).toEqual(['tabular-nums']);
  expect(longAmount.fontVariant).toEqual(['tabular-nums']);
  expect(shortAmount.minWidth).toBe(longAmount.minWidth);
  expect(shortAmount.minWidth).toBe(8 * theme.font.md * 0.62);
  expect(display.minWidth).toBeGreaterThan(shortAmount.minWidth);
  expect(display.minWidth / shortAmount.minWidth).toBeCloseTo(theme.font.display / theme.font.md);
  expect(display.minWidth).toBe(maskedAmountMetrics('US$100000.00', 'display').minWidth);
});
