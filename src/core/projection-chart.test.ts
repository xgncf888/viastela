import { expect, test } from '@jest/globals';

import { projectNetWorth } from './projection';
import { projectionChart } from './projection-chart';

test('draws three lines and names the selected rate in the screen reader label', () => {
  const shared = {
    startUsd: 10,
    startMonth: '2026-01',
    monthlyNetUsd: 2,
    targetUsd: 20,
    maxMonths: 2,
  };
  const lines = [
    projectNetWorth({ ...shared, annualRate: 0.03 }),
    projectNetWorth({ ...shared, annualRate: 0.05 }),
    projectNetWorth({ ...shared, annualRate: 0.07 }),
  ] as const;
  const chart = projectionChart({
    lines,
    rates: [0.03, 0.05, 0.07],
    mainRateIndex: 2,
    actual: [],
    targetUsd: 20,
    snapshot: 'skipped',
  });
  expect(chart.accessibilityLabel).toBe('实际、3%、5%、7%、目标，预计达标月份');
  expect(chart.series.map((series) => series.label)).toEqual(['目标', '3%', '7%', '5%']);
  expect(chart.series.find((series) => series.label === '5%')?.tone).toBe('moss');
  expect(chart.series.every((series) => series.points.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1))).toBe(true);
  expect(chart.note).toBe('接入真实行情后开始记录实际走势');
});

test('no goal draws the three rate lines and no target line', () => {
  const shared = {
    startUsd: 10,
    startMonth: '2026-01',
    monthlyNetUsd: 2,
    targetUsd: null,
    maxMonths: 2,
  };
  const lines = [
    projectNetWorth({ ...shared, annualRate: 0.03 }),
    projectNetWorth({ ...shared, annualRate: 0.05 }),
    projectNetWorth({ ...shared, annualRate: 0.07 }),
  ] as const;
  const chart = projectionChart({
    lines,
    rates: [0.03, 0.05, 0.07],
    mainRateIndex: 2,
    actual: [],
    targetUsd: null,
    snapshot: 'skipped',
  });
  expect(chart.series.map((series) => series.label)).toEqual(['3%', '7%', '5%']);
  expect(chart.series.some((series) => series.id === 'target')).toBe(false);
  expect(chart.accessibilityLabel).toBe('实际、3%、5%、7%');
  expect(chart.accessibilityLabel).not.toContain('目标');
  expect(chart.accessibilityLabel).not.toContain('预计');
});
