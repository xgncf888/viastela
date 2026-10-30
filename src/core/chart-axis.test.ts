import { expect, test } from '@jest/globals';

import { formatChartTick, moneyAxis, niceAxis, weightAxis } from './chart-axis';

const NICE = [1, 2, 2.5, 5];

test('a nice axis uses 3 to 5 ticks and a step from {1, 2, 2.5, 5} × 10ⁿ', () => {
  const axis = niceAxis(72, 80, { minStep: 0.5 });
  expect(axis.values).toEqual([72, 74, 76, 78, 80]);
  expect(axis.step).toBe(2);
  expect(isNiceStep(axis.step)).toBe(true);
  expect(axis.values.length).toBeGreaterThanOrEqual(3);
  expect(axis.values.length).toBeLessThanOrEqual(5);
});

test('weight ticks stay on a 0.5 kg step and center a tight span on the median', () => {
  const wide = weightAxis([72, 74.5, 76, 79.2]);
  expect(wide.map((tick) => tick.value)).toEqual([72, 74, 76, 78, 80]);
  expect(wide.every((tick) => tick.label.includes('kg') || tick.label.includes('US$'))).toBe(false);
  for (const tick of wide) expect(tick.label).toBe(formatChartTick(tick.value, 'plain'));

  const tight = weightAxis([72.9, 73.1, 73.4]);
  expect(tight.map((tick) => tick.value)).toEqual([72.5, 73, 73.5, 74]);
  expect(tight.every((tick) => Math.abs(tick.value / 0.5 - Math.round(tick.value / 0.5)) < 1e-9)).toBe(true);
});

test('money ticks start at 0 when every value is positive, and mark 0 when one is negative', () => {
  const rising = moneyAxis([12_000, 340_000]);
  expect(rising.map((tick) => tick.label)).toEqual(['0', '100k', '200k', '300k', '400k']);
  expect(rising[0].value).toBe(0);
  expect(rising.some((tick) => tick.zero)).toBe(false);

  const compact = moneyAxis([0, 600_000]);
  expect(compact.map((tick) => tick.label)).toEqual(['0', '200k', '400k', '600k']);

  const crossed = moneyAxis([-20_000, 80_000]);
  const zero = crossed.find((tick) => tick.value === 0);
  expect(zero?.zero).toBe(true);
  expect(zero?.label).toBe('0');
  expect(crossed[0].value).toBeLessThanOrEqual(-20_000);
  expect(crossed[crossed.length - 1].value).toBeGreaterThanOrEqual(80_000);
});

test('compact tick text matches the chart examples and leaves the unit off', () => {
  expect(formatChartTick(0, 'compact')).toBe('0');
  expect(formatChartTick(200_000, 'compact')).toBe('200k');
  expect(formatChartTick(400_000, 'compact')).toBe('400k');
  expect(formatChartTick(1_000_000, 'compact')).toBe('1M');
  expect(formatChartTick(1_200_000, 'compact')).toBe('1.2M');
  expect(formatChartTick(72.5, 'plain')).toBe('72.5');
  expect(formatChartTick(72, 'plain')).toBe('72');
});

function isNiceStep(step: number): boolean {
  const exp = Math.floor(Math.log10(step));
  const mantissa = step / 10 ** exp;
  return NICE.some((item) => Math.abs(item - mantissa) < 1e-9);
}
