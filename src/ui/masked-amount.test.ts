import { expect, test } from '@jest/globals';

import { theme } from './theme';
import { maskedAmountMetrics } from './masked-amount';

test('minWidth scales with the text variant and matches for masked and unmasked', () => {
  const text = 'US$100.00';
  const body = maskedAmountMetrics(text, 'body');
  const display = maskedAmountMetrics(text, 'display');
  const bodyAgain = maskedAmountMetrics(text, 'body');

  expect(body.fontVariant).toEqual(['tabular-nums']);
  expect(display.fontVariant).toEqual(['tabular-nums']);
  expect(display.minWidth).toBeGreaterThan(body.minWidth);
  expect(display.minWidth / body.minWidth).toBeCloseTo(theme.font.display / theme.font.md);
  expect(body.minWidth).toBe(text.length * theme.font.md * 0.62);
  expect(display.minWidth).toBe(text.length * theme.font.display * 0.62);
  expect(bodyAgain.minWidth).toBe(body.minWidth);
  expect(bodyAgain.fontVariant).toEqual(body.fontVariant);
});
