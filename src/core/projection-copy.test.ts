import { expect, test } from '@jest/globals';

import { projectNetWorth } from './projection';
import { clampProjectionDay, projectionConclusion, projectionSummary, unreachableGoalCopy } from './projection-copy';

const RATES = [0.03, 0.05, 0.07] as const;

test('no goal returns a summary with no gap, target, or reach date', () => {
  const line = projectNetWorth({
    startUsd: 10,
    startMonth: '2026-01',
    monthlyNetUsd: 2,
    annualRate: 0.05,
    targetUsd: null,
    maxMonths: 2,
  });
  expect(line.goal).toBeNull();
  const summary = projectionSummary({
    rates: RATES,
    mainRateIndex: 2,
    line,
    actualUsd: 10,
    onDay: '2026-01-15',
    monthlyNetUsd: 2,
    targetUsd: null,
  });
  expect(summary).toEqual({ kind: 'no-goal' });
  const text = JSON.stringify(summary);
  expect(text).not.toContain('gap');
  expect(text).not.toContain('个月');
  expect(text).not.toContain('目标');
  expect(text).not.toContain('monthLabel');
});

test('5% selected uses 按 5% 年化，50 年内达不到目标', () => {
  expect(unreachableGoalCopy(5)).toBe('按 5% 年化，50 年内达不到目标');
  const line = projectNetWorth({
    startUsd: 1,
    startMonth: '2026-01',
    monthlyNetUsd: 0,
    annualRate: 0.05,
    targetUsd: 100,
  });
  expect(line.goal).toBeNull();
  const sentence = projectionConclusion({
    rates: RATES,
    mainRateIndex: 2,
    line,
    actualUsd: 1,
    onDay: '2026-01-15',
    monthlyNetUsd: 0,
    targetUsd: 100,
  });
  expect(sentence).toEqual({ kind: 'unreachable', text: '按 5% 年化，50 年内达不到目标' });
  expect(sentence.kind === 'unreachable' ? sentence.text : '').not.toContain('600');
  expect(sentence.kind === 'unreachable' ? sentence.text : '').not.toContain('3%');
});

test('a day outside the line is clamped and does not throw', () => {
  const line = projectNetWorth({
    startUsd: 10,
    startMonth: '2026-01',
    monthlyNetUsd: 10,
    annualRate: 0,
    targetUsd: 40,
    maxMonths: 4,
  });
  expect(clampProjectionDay(line, '1999-01-01')).toBe('2026-01-01');
  expect(clampProjectionDay(line, '2099-06-01')).toBe('2026-05-01');
  expect(() =>
    projectionConclusion({
      rates: RATES,
      mainRateIndex: 1,
      line,
      actualUsd: 10,
      onDay: '1999-01-01',
      monthlyNetUsd: 10,
      targetUsd: 40,
    }),
  ).not.toThrow();
});

test('monthly net at or below zero omits the month count', () => {
  const line = projectNetWorth({
    startUsd: 40,
    startMonth: '2026-01',
    monthlyNetUsd: 0,
    annualRate: 0.03,
    targetUsd: 40,
  });
  const sentence = projectionConclusion({
    rates: RATES,
    mainRateIndex: 1,
    line,
    actualUsd: 40,
    onDay: '2026-06-01',
    monthlyNetUsd: 0,
    targetUsd: 40,
  });
  expect(sentence.kind).toBe('already');

  const short = projectNetWorth({
    startUsd: 10,
    startMonth: '2026-01',
    monthlyNetUsd: 10,
    annualRate: 0,
    targetUsd: 30,
    maxMonths: 3,
  });
  const forecast = projectionConclusion({
    rates: RATES,
    mainRateIndex: 1,
    line: short,
    actualUsd: 10,
    onDay: '2026-01-01',
    monthlyNetUsd: -2,
    targetUsd: 30,
  });
  expect(forecast.kind).toBe('forecast');
  if (forecast.kind === 'forecast') {
    expect(forecast.monthsLabel).toBeNull();
    expect(forecast.ratePercent).toBe(3);
    expect(forecast.gapText.startsWith('US$') || forecast.gapText.startsWith('-')).toBe(true);
  }
});
