import { expect, test } from '@jest/globals';

import { moneyAxis, projectionMoneyAxis, tickValueDomain } from './chart-axis';
import { projectNetWorth, projectNetWorthLines } from './projection';
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
  expect(chart.series.map((series) => series.label)).toEqual(['3%', '5%', '7%', '目标']);
  expect(chart.series.map((series) => series.tone)).toEqual(['muted', 'accent', 'muted', 'target']);
  expect(chart.series.map((series) => series.style)).toEqual(['dashed', 'solid', 'dashed', 'dotted']);
  expect(chart.selectedSeriesId).toBe('rate-1');
  expect(chart.series.find((series) => series.id === 'target')).toMatchObject({
    tone: 'target',
    style: 'dotted',
  });
  expect(chart.series.some((series) => (series.tone as string) === 'line' || (series.tone as string) === 'moss')).toBe(false);
  expect(chart.series.find((series) => series.label === '5%')?.tone).toBe('accent');
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
  expect(chart.series.map((series) => series.label)).toEqual(['3%', '5%', '7%']);
  expect(chart.series.map((series) => series.tone)).toEqual(['muted', 'accent', 'muted']);
  expect(chart.series.some((series) => (series.tone as string) === 'line' || (series.tone as string) === 'moss')).toBe(false);
  expect(chart.series.some((series) => series.id === 'target')).toBe(false);
  expect(chart.accessibilityLabel).toBe('实际、3%、5%、7%');
  expect(chart.accessibilityLabel).not.toContain('目标');
  expect(chart.accessibilityLabel).not.toContain('预计');
});

test('y positions use the money axis domain and never the line tone', () => {
  expect(tickValueDomain(moneyAxis([10, 20]))).toEqual({ min: 0, max: 20 });
  expect(moneyAxis([10, 20]).map((tick) => tick.value)).toEqual([0, 5, 10, 15, 20]);

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
  const actual = [{ month: '2026-01', totalUsd: -40 }];
  const chart = projectionChart({
    lines,
    rates: [0.03, 0.05, 0.07],
    mainRateIndex: 2,
    actual,
    targetUsd: 20,
    snapshot: 'skipped',
  });
  const values = [
    20,
    ...lines.flatMap((line) => line.points.map((point) => point.netWorthUsd)),
    -40,
  ];
  const domain = tickValueDomain(projectionMoneyAxis(values));
  if (!domain) throw new Error('money axis domain missing');
  const yOf = (value: number) => (value - domain.min) / (domain.max - domain.min);
  const selected = lines[1];
  const selectedSeries = chart.series.find((series) => series.label === '5%');
  expect(domain.min).toBeLessThan(0);
  expect(domain.max).toBeGreaterThanOrEqual(20);
  expect(selectedSeries?.points[0]?.y).toBeCloseTo(yOf(selected.points[0].netWorthUsd));
  expect(chart.series.find((series) => series.id === 'target')?.points[0]?.y).toBeCloseTo(yOf(20));
  expect(chart.series.find((series) => series.id === 'target')).toMatchObject({ tone: 'target', style: 'dotted' });
  expect(chart.series.some((series) => (series.tone as string) === 'line')).toBe(false);

  const positive = projectionChart({
    lines,
    rates: [0.03, 0.05, 0.07],
    mainRateIndex: 2,
    actual: [],
    targetUsd: 20,
    snapshot: 'skipped',
  });
  const positiveValues = [20, ...lines.flatMap((line) => line.points.map((point) => point.netWorthUsd))];
  const positiveDomain = tickValueDomain(projectionMoneyAxis(positiveValues));
  if (!positiveDomain) throw new Error('money axis domain missing');
  const dataMin = Math.min(...positiveValues);
  expect(positiveDomain.min).toBe(0);
  expect(dataMin).toBeGreaterThan(0);
  const lowest = Math.min(...(positive.series.find((series) => series.label === '5%')?.points.map((point) => point.y) ?? []));
  expect(lowest).toBeCloseTo((dataMin - positiveDomain.min) / (positiveDomain.max - positiveDomain.min));
  expect(lowest).toBeGreaterThan(0);
  expect(positive.ticks.map((tick) => tick.value)).toEqual(moneyAxis(positiveValues).map((tick) => tick.value));
});

test('legend order is the rates, then the target, and history is ink', () => {
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
    actual: [
      { month: '2026-01', totalUsd: 10 },
      { month: '2026-02', totalUsd: 12 },
    ],
    targetUsd: 20,
    snapshot: 'written',
  });
  expect(chart.series.map((series) => series.label)).toEqual(['实际', '3%', '5%', '7%', '目标']);
  expect(chart.series.find((series) => series.id === 'actual')).toMatchObject({ tone: 'ink', style: 'solid' });
  expect(chart.series.find((series) => series.id === 'actual')?.layer).toBeGreaterThan(
    chart.series.find((series) => series.label === '5%')?.layer ?? 0,
  );
  expect(chart.series.find((series) => series.id === 'target')?.layer).toBeLessThan(
    chart.series.find((series) => series.label === '3%')?.layer ?? 0,
  );
});

test('a 50-year window lifts the target and the curve starts off the axis', () => {
  const lines = projectNetWorthLines(
    {
      startUsd: 20_000,
      startMonth: '2026-01',
      monthlyNetUsd: 500,
      targetUsd: 800_000,
    },
    [0.03, 0.05, 0.07],
  );
  const values = [800_000, ...lines.flatMap((line) => line.points.map((point) => point.netWorthUsd))];
  const unpadded = moneyAxis(values).map((tick) => tick.value);
  const chart = projectionChart({
    lines,
    rates: [0.03, 0.05, 0.07],
    mainRateIndex: 2,
    actual: [],
    targetUsd: 800_000,
    snapshot: null,
  });
  expect(unpadded).toEqual([0, 1_000_000, 2_000_000, 3_000_000, 4_000_000]);
  expect(chart.ticks.map((tick) => tick.value)).toEqual([-2_000_000, 0, 2_000_000, 4_000_000]);
  const start = chart.series.find((series) => series.label === '5%')?.points[0]?.y ?? 0;
  const target = chart.series.find((series) => series.id === 'target')?.points[0]?.y ?? 0;
  expect(start).toBeGreaterThan(0.2);
  expect(target).toBeGreaterThan(start);
  expect(target).toBeLessThan(0.7);
});
