import { describe, expect, it } from '@jest/globals';

import { DEFAULT_MAX_MONTHS, monthlyNetUsd, projectNetWorth, projectNetWorthLines, projectionGap } from './projection';

/**
 * Every dollar figure in this file is invented to check the formula.
 * None of it is a real person's income, spending, or net worth.
 *
 * Unrounded reference, independent of the cent loop in projection.ts:
 *   i = (1 + r) ** (1 / 12) - 1
 *   P(0) = start
 *   P(n) = start * (1 + i) ** n + deposit * ((1 + i) ** n - 1) / i    when i ≠ 0
 *   P(n) = start + deposit * n                                         when i = 0
 * The first month with P(n) >= target is
 *   n = ceil( ln((target + deposit / i) / (start + deposit / i)) / ln(1 + i) ).
 */

const PLAN = {
  startUsd: 20_000,
  startMonth: '2026-01',
  monthlyNetUsd: 500,
  targetUsd: 50_000,
} as const;

function unroundedBalance(start: number, deposit: number, annualRate: number, monthIndex: number): number {
  if (monthIndex === 0) return start;
  const monthlyRate = (1 + annualRate) ** (1 / 12) - 1;
  if (monthlyRate === 0) return start + deposit * monthIndex;
  const growth = (1 + monthlyRate) ** monthIndex;
  return start * growth + (deposit * (growth - 1)) / monthlyRate;
}

describe('three return lines', () => {
  /**
   * Made-up path: open at $20,000 in 2026-01, save $500 at each month end,
   * aim at $50,000. Solving the formula above:
   *   3% → 51.29786174778915 → month 52 → 2030-05
   *   5% → 46.92259408307622 → month 47 → 2029-12
   *   7% → 43.32192815462140 → month 44 → 2029-09
   * Month 0 is 2026-01. The month before each crossing is still short by
   * hundreds of dollars, so rounding to the cent cannot move the month.
   */
  it('reaches the made-up target on the month the float formula names', () => {
    const [low, mid, high] = projectNetWorthLines(PLAN, [0.03, 0.05, 0.07]);

    expect(low.goal).toEqual({ status: 'reached', month: '2030-05', monthIndex: 52 });
    expect(mid.goal).toEqual({ status: 'reached', month: '2029-12', monthIndex: 47 });
    expect(high.goal).toEqual({ status: 'reached', month: '2029-09', monthIndex: 44 });

    expect(low.points[51]?.netWorthUsd).toBeLessThan(PLAN.targetUsd);
    expect(low.points[52]?.netWorthUsd).toBeGreaterThanOrEqual(PLAN.targetUsd);
    expect(mid.points[46]?.netWorthUsd).toBeLessThan(PLAN.targetUsd);
    expect(mid.points[47]?.netWorthUsd).toBeGreaterThanOrEqual(PLAN.targetUsd);
    expect(high.points[43]?.netWorthUsd).toBeLessThan(PLAN.targetUsd);
    expect(high.points[44]?.netWorthUsd).toBeGreaterThanOrEqual(PLAN.targetUsd);

    expect(low.points).toHaveLength(DEFAULT_MAX_MONTHS + 1);
    expect(low.points[0]).toEqual({ month: '2026-01', netWorthUsd: 20_000 });
  });

  it('rejects a return_rates list that is not a triple', () => {
    expect(() => projectNetWorthLines(PLAN, [0.03, 0.05])).toThrow(/return_rates/);
  });
});

describe('cent precision against the unrounded formula', () => {
  /**
   * Same made-up $20,000 start and $500 deposit. The reference is the
   * unrounded recurrence above, not the cent-rounded series. Across 3%, 5%,
   * and 7%, every month in the first year stays within $0.01, and every
   * month through year 30 (360 months) stays within $1.
   */
  it('stays within $0.01 for 12 months and $1 for 360 months', () => {
    for (const annualRate of [0.03, 0.05, 0.07] as const) {
      const projection = projectNetWorth({ ...PLAN, annualRate });
      let firstYear = 0;
      let thirtyYears = 0;
      for (let monthIndex = 1; monthIndex <= 360; monthIndex += 1) {
        const actual = projection.points[monthIndex]?.netWorthUsd;
        if (actual === undefined) throw new Error(`missing month ${monthIndex}`);
        const error = Math.abs(
          actual - unroundedBalance(PLAN.startUsd, PLAN.monthlyNetUsd, annualRate, monthIndex),
        );
        if (monthIndex <= 12) firstYear = Math.max(firstYear, error);
        thirtyYears = Math.max(thirtyYears, error);
      }
      expect(firstYear).toBeLessThanOrEqual(0.01);
      expect(thirtyYears).toBeLessThanOrEqual(1);
    }
  });

  it('rounds interest to the cent before adding the month-end deposit', () => {
    const startCents = 1_000_000;
    const depositCents = 50_000;
    const monthlyRate = 1.07 ** (1 / 12) - 1;
    const expectedCents = Math.round(startCents * (1 + monthlyRate)) + depositCents;
    const projection = projectNetWorth({
      startUsd: 10_000,
      startMonth: '2026-01-01',
      monthlyNetUsd: 500,
      annualRate: 0.07,
      targetUsd: 1_000_000,
      maxMonths: 1,
    });
    expect(projection.points[0]).toEqual({ month: '2026-01', netWorthUsd: 10_000 });
    expect(projection.points[1]).toEqual({ month: '2026-02', netWorthUsd: expectedCents / 100 });
  });
});

describe('projection boundaries', () => {
  it('with a zero rate, grows only by the deposit', () => {
    // P(n) = 8000 + 250 * n. P(7) = 9750, P(8) = 10000. 2026-01 plus 8 months is 2026-09.
    const projection = projectNetWorth({
      startUsd: 8_000,
      startMonth: '2026-01',
      monthlyNetUsd: 250,
      annualRate: 0,
      targetUsd: 10_000,
      maxMonths: 12,
    });
    expect(projection.goal).toEqual({ status: 'reached', month: '2026-09', monthIndex: 8 });
    expect(projection.points[8]?.netWorthUsd).toBe(10_000);
    expect(projection.points[7]?.netWorthUsd).toBe(9_750);
  });

  it('with a zero deposit, grows only by interest', () => {
    // P(n) = 10000 * 1.05 ** (n / 12). n = 12 * ln(2) / ln(1.05) = 170.480…
    // so the first month at $20,000 is 171, which is 2040-04.
    const projection = projectNetWorth({
      startUsd: 10_000,
      startMonth: '2026-01',
      monthlyNetUsd: 0,
      annualRate: 0.05,
      targetUsd: 20_000,
    });
    expect(projection.goal).toEqual({ status: 'reached', month: '2040-04', monthIndex: 171 });
    expect(projection.points[170]?.netWorthUsd).toBeLessThan(20_000);
    expect(projection.points[171]?.netWorthUsd).toBeGreaterThanOrEqual(20_000);
  });

  it('lets a negative deposit pull the balance down through zero', () => {
    // P(n) = 2000 - 100 * n. The $3,000 target is the wrong direction.
    const projection = projectNetWorth({
      startUsd: 2_000,
      startMonth: '2026-01',
      monthlyNetUsd: -100,
      annualRate: 0,
      targetUsd: 3_000,
      maxMonths: 25,
    });
    expect(projection.goal).toBeNull();
    expect(projection.points[20]?.netWorthUsd).toBe(0);
    expect(projection.points[21]?.netWorthUsd).toBe(-100);
    expect(projection.points[25]?.netWorthUsd).toBe(-500);
  });

  it('reports already reached when the opening balance meets the target', () => {
    const equal = projectNetWorth({
      startUsd: 12_000,
      startMonth: '2026-01',
      monthlyNetUsd: 100,
      annualRate: 0.04,
      targetUsd: 12_000,
      maxMonths: 3,
    });
    expect(equal.goal).toEqual({ status: 'already', month: '2026-01', monthIndex: 0 });

    const above = projectNetWorth({
      startUsd: 12_000,
      startMonth: '2026-01',
      monthlyNetUsd: 100,
      annualRate: 0.04,
      targetUsd: 9_000,
      maxMonths: 1,
    });
    expect(above.goal).toEqual({ status: 'already', month: '2026-01', monthIndex: 0 });
  });

  it('returns null when 600 months is still short', () => {
    // Rate 0: P(600) = 1000 + 1 * 600 = 1600, which is still under 1601.
    const projection = projectNetWorth({
      startUsd: 1_000,
      startMonth: '2026-01',
      monthlyNetUsd: 1,
      annualRate: 0,
      targetUsd: 1_601,
    });
    expect(projection.goal).toBeNull();
    expect(projection.points).toHaveLength(DEFAULT_MAX_MONTHS + 1);
    expect(projection.points[DEFAULT_MAX_MONTHS]?.netWorthUsd).toBe(1_600);
  });

  it('turns income and expense into the monthly net deposit', () => {
    expect(monthlyNetUsd(4_300, 1_850)).toBe(2_450);
    expect(monthlyNetUsd(1_850, 4_300)).toBe(-2_450);
  });

  it('accepts the ends of the rate range and rejects anything outside it', () => {
    expect(() =>
      projectNetWorth({
        startUsd: 1_000,
        startMonth: '2026-01',
        monthlyNetUsd: 0,
        annualRate: 0.5,
        targetUsd: 2_000,
        maxMonths: 1,
      }),
    ).not.toThrow();
    const declining = projectNetWorth({
      startUsd: 1_000,
      startMonth: '2026-01',
      monthlyNetUsd: 0,
      annualRate: -0.2,
      targetUsd: 2_000,
      maxMonths: 2,
    });
    expect(declining.goal).toBeNull();
    expect(declining.points[1]?.netWorthUsd).toBeLessThan(1_000);
    expect(declining.points[2]?.netWorthUsd).toBeLessThan(declining.points[1]?.netWorthUsd ?? 0);
    expect(() =>
      projectNetWorth({
        startUsd: 1_000,
        startMonth: '2026-01',
        monthlyNetUsd: 0,
        annualRate: 0.5001,
        targetUsd: 2_000,
        maxMonths: 1,
      }),
    ).toThrow(/Annual rate/);
  });
});

describe('ahead or behind the selected line', () => {
  const line = projectNetWorth({
    startUsd: 10_000,
    startMonth: '2026-01',
    monthlyNetUsd: 500,
    annualRate: 0,
    targetUsd: 100_000,
    maxMonths: 2,
  });

  it('interpolates by civil days and divides the dollar gap by the monthly net', () => {
    // 2026-01-01 is $10,000 and 2026-02-01 is $10,500. 2026-01-16 is 15 of January's 31 days.
    const expected = 10_000 + (15 / 31) * 500;
    const gap = projectionGap({ actualUsd: 12_000, onDay: '2026-01-16', line, monthlyNetUsd: 500 });
    expect(gap.deltaUsd).toBeCloseTo(12_000 - expected, 8);
    expect(gap.months).toBeCloseTo((12_000 - expected) / 500, 8);

    const onThePoint = projectionGap({ actualUsd: 10_000, onDay: '2026-02-01', line, monthlyNetUsd: 500 });
    expect(onThePoint).toEqual({ deltaUsd: -500, months: -1 });
  });

  it('counts a leap day in February', () => {
    // 2024-02-01 is $1,000 and 2024-03-01 is $1,290. The 15th is 14 of 29 days.
    const leapLine = projectNetWorth({
      startUsd: 1_000,
      startMonth: '2024-02',
      monthlyNetUsd: 290,
      annualRate: 0,
      targetUsd: 9_000,
      maxMonths: 1,
    });
    const gap = projectionGap({ actualUsd: 1_140, onDay: '2024-02-15', line: leapLine, monthlyNetUsd: 290 });
    expect(gap.deltaUsd).toBeCloseTo(0, 8);
    expect(gap.months).toBeCloseTo(0, 8);
  });

  it('returns null months when the monthly net is zero or negative', () => {
    const ahead = projectionGap({ actualUsd: 11_000, onDay: '2026-01-01', line, monthlyNetUsd: 0 });
    expect(ahead.deltaUsd).toBe(1_000);
    expect(ahead.months).toBeNull();

    const behind = projectionGap({ actualUsd: 9_000, onDay: '2026-01-01', line, monthlyNetUsd: -200 });
    expect(behind.deltaUsd).toBe(-1_000);
    expect(behind.months).toBeNull();
  });
});
