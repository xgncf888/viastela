import { describe, expect, it } from '@jest/globals';

import {
  computeDailyTimeValueLedger,
  computeExpenseLifeHours,
  computeFocusSessionValue,
  computeHourlyRateBreakdown,
  DEFAULT_TIME_PRICING_CONFIG,
  evaluateBuyTimeDecision,
} from './time-pricing';

describe('time-pricing core engine', () => {
  it('computes 3-tier hourly rate breakdown (nominal, true net, and compound focus)', () => {
    const breakdown = computeHourlyRateBreakdown({
      ...DEFAULT_TIME_PRICING_CONFIG,
      monthlyNetIncomeCny: 21750,
      workDaysPerMonth: 21.75,
      dailyContractHours: 8,
      dailyOvertimeHours: 1,
      dailyCommuteMinutes: 60, // 1h
      dailyDecompressionMinutes: 0,
      monthlyWorkExpenseCny: 1750,
      focusCompoundMultiplier: 2.0,
    });

    // Nominal: 21750 / (21.75 * 8 = 174h) = 125 CNY/h
    expect(breakdown.nominalMonthlyHours).toBe(174);
    expect(breakdown.nominalHourlyCny).toBe(125);

    // True hours: 21.75 * (8 + 1 + 1) = 217.5h; True net income: 20000
    expect(breakdown.trueMonthlyHours).toBe(217.5);
    expect(breakdown.trueNetMonthlyIncomeCny).toBe(20000);
    expect(breakdown.trueNetHourlyCny).toBeCloseTo(91.95, 1);
    expect(breakdown.focusCompoundHourlyCny).toBeCloseTo(183.91, 1);
    expect(breakdown.hourlyDragCny).toBeGreaterThan(30);
  });

  it('converts expenses into life-energy working hours and workdays', () => {
    const res = computeExpenseLifeHours(1000, 100, 8);
    expect(res.totalHours).toBe(10);
    expect(res.wholeHours).toBe(10);
    expect(res.remainingMinutes).toBe(0);
    expect(res.workDaysEquivalent).toBe(1.3);
    expect(res.labelZh).toContain('10 小时');
  });

  it('evaluates Buy-Time vs Save-Money (+EV) decisions accurately', () => {
    const positive = evaluateBuyTimeDecision({
      costCny: 38,
      savedMinutes: 45, // 0.75h
      trueNetHourlyCny: 100, // 0.75h = 75 CNY saved value
      useCompoundRate: false,
    });
    expect(positive.isPositiveEv).toBe(true);
    expect(positive.timeValueSavedCny).toBe(75);
    expect(positive.netEvCny).toBe(37);
    expect(positive.verdictZh).toContain('+EV');

    const negative = evaluateBuyTimeDecision({
      costCny: 120,
      savedMinutes: 30, // 0.5h
      trueNetHourlyCny: 100, // 0.5h = 50 CNY saved value
      useCompoundRate: false,
    });
    expect(negative.isPositiveEv).toBe(false);
    expect(negative.netEvCny).toBe(-70);
    expect(negative.verdictZh).toContain('-EV');
  });

  it('computes live focus session value and daily 24H time-value ledger', () => {
    const breakdown = computeHourlyRateBreakdown({
      ...DEFAULT_TIME_PRICING_CONFIG,
      monthlyNetIncomeCny: 17400,
      workDaysPerMonth: 21.75,
      dailyContractHours: 8,
      dailyOvertimeHours: 0,
      dailyCommuteMinutes: 0,
      dailyDecompressionMinutes: 0,
      monthlyWorkExpenseCny: 0,
      focusCompoundMultiplier: 2.0,
    });
    // True Net = 100/h, Compound = 200/h
    const session = computeFocusSessionValue(1800, 'study', breakdown); // 0.5h study
    expect(session.valueCny).toBe(100);

    const daily = computeDailyTimeValueLedger(
      [
        {
          id: 'tb-1',
          localDay: '2026-04-20',
          startMinute: 540,
          endMinute: 600,
          durationMinutes: 60,
          category: 'study',
          title: 'Architecture Study',
          goalId: null,
          note: null,
          recordedAt: '2026-04-20T09:00:00.000Z',
        },
      ],
      breakdown,
      900, // 15m active study timer = 0.25h * 200 = 50 CNY
      'study',
    );
    expect(daily.studyMinutes).toBe(60);
    expect(daily.liveTimerValueCny).toBe(50);
    expect(daily.totalValueCreatedCny).toBe(250);
  });
});
