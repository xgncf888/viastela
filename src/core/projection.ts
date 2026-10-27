import { daysBetween } from './local-day';

/** Annual rate is inclusive on both ends. 0.05 means 5% a year. */
export const MIN_ANNUAL_RATE = -0.5;
export const MAX_ANNUAL_RATE = 0.5;

/** Fifty years. Past this the goal is treated as not reached. */
export const DEFAULT_MAX_MONTHS = 600;

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const MONTH_START_PATTERN = /^(\d{4})-(\d{2})-01$/;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ProjectNetWorthInput = {
  startUsd: number;
  /** `YYYY-MM`, or the first civil day `YYYY-MM-01`. Point 0 is this month. */
  startMonth: string;
  /** End-of-month deposit. Negative means the balance is drawn down. */
  monthlyNetUsd: number;
  /** Annual rate in [-0.5, 0.5]. Monthly rate is `(1 + r) ** (1 / 12) - 1`. */
  annualRate: number;
  targetUsd: number;
  /** Months after the start to simulate. Defaults to {@link DEFAULT_MAX_MONTHS}. */
  maxMonths?: number;
};

export type ProjectionPoint = {
  /** `YYYY-MM`. The balance is the one on that month's first civil day. */
  month: string;
  netWorthUsd: number;
};

/**
 * `already` is month 0: the opening balance is already at the target (已达成).
 * `reached` is the first later month whose balance is at or above the target.
 * A horizon that never gets there is `null`, not one of these.
 */
export type ProjectionGoal =
  | { status: 'already'; month: string; monthIndex: 0 }
  | { status: 'reached'; month: string; monthIndex: number };

export type NetWorthProjection = {
  /** Index 0 is the opening balance. Index `n` is `n` months later. */
  points: ProjectionPoint[];
  goal: ProjectionGoal | null;
};

export type ProjectionGap = {
  /** Actual minus the line's expected dollars that day. Positive is ahead. */
  deltaUsd: number;
  /**
   * `deltaUsd / monthlyNetUsd`. Null when monthly net is zero or negative:
   * there is no positive saving rate to turn a dollar gap into months.
   */
  months: number | null;
};

/**
 * Net amount put aside each month: income minus expense, in dollars.
 * The result is rounded to the cent, same as the projection itself.
 */
export function monthlyNetUsd(incomeUsd: number, expenseUsd: number): number {
  return (toCents(incomeUsd) - toCents(expenseUsd)) / 100;
}

/**
 * Month-by-month net worth. Pure: it does not read the clock, the network,
 * or Supabase. Every balance is an integer number of cents.
 *
 * Month 0 is `startUsd` on `startMonth`, with no interest yet. Each later
 * month takes interest on the opening balance first, rounds that balance to
 * the nearest cent (half away from zero), then adds `monthlyNetUsd` at month
 * end. The deposit earns nothing until the following month. A negative
 * deposit, a negative rate, or both may push the balance down, including
 * through zero.
 *
 * `goal` is the first point at or above `targetUsd`. Month 0 uses status
 * `already`. If point `maxMonths` is still short, `goal` is null.
 */
export function projectNetWorth(input: ProjectNetWorthInput): NetWorthProjection {
  const startMonth = normalizeMonth(input.startMonth);
  const maxMonths = input.maxMonths ?? DEFAULT_MAX_MONTHS;
  assertMaxMonths(maxMonths);
  assertAnnualRate(input.annualRate);
  const depositCents = toCents(input.monthlyNetUsd);
  const targetCents = toCents(input.targetUsd);
  const monthlyRate = (1 + input.annualRate) ** (1 / 12) - 1;

  const points: ProjectionPoint[] = [];
  let balanceCents = toCents(input.startUsd);
  let goal: ProjectionGoal | null = null;

  for (let monthIndex = 0; monthIndex <= maxMonths; monthIndex += 1) {
    if (monthIndex > 0) {
      balanceCents = accrueMonth(balanceCents, monthlyRate, depositCents);
    }
    const month = addMonths(startMonth, monthIndex);
    points.push({ month, netWorthUsd: balanceCents / 100 });
    if (goal === null && balanceCents >= targetCents) {
      goal =
        monthIndex === 0
          ? { status: 'already', month, monthIndex }
          : { status: 'reached', month, monthIndex };
    }
  }

  return { points, goal };
}

/**
 * One projection per annual rate. `returnRates` is the `return_rates` triple
 * (exactly three numbers, kept in the order given).
 */
export function projectNetWorthLines(
  input: Omit<ProjectNetWorthInput, 'annualRate'>,
  returnRates: readonly number[],
): [NetWorthProjection, NetWorthProjection, NetWorthProjection] {
  if (returnRates.length !== 3) {
    throw new Error('return_rates must contain exactly 3 annual rates');
  }
  const first = returnRates[0];
  const second = returnRates[1];
  const third = returnRates[2];
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error('return_rates must contain exactly 3 annual rates');
  }
  return [
    projectNetWorth({ ...input, annualRate: first }),
    projectNetWorth({ ...input, annualRate: second }),
    projectNetWorth({ ...input, annualRate: third }),
  ];
}

/**
 * Dollar gap between an actual net worth and the selected projection line.
 *
 * Each point is the balance on the first civil day of its `YYYY-MM`. Point 0
 * is the opening balance, before that month's interest. Every later point is
 * the balance after "interest, round to the cent, then add the deposit".
 *
 * On a month's first day the expected value is that point. On any day between
 * two first-of-month points it is linear in civil days, not in business days
 * and not re-rounded to the cent:
 *
 *   expected = left + (days from left to the day) / (days from left to right) * (right - left)
 *
 * The denominator is the civil length of that month, so February weighs a
 * leap day as one of 29 days. Days outside the first and last points throw.
 * The goal month is chosen from the month points only, not from this blend.
 *
 * `months` is `deltaUsd / monthlyNetUsd`. When `monthlyNetUsd` is zero or
 * negative, `months` is null.
 */
export function projectionGap(input: {
  actualUsd: number;
  /** Civil day `YYYY-MM-DD`. */
  onDay: string;
  line: NetWorthProjection;
  monthlyNetUsd: number;
}): ProjectionGap {
  if (!Number.isFinite(input.actualUsd)) throw new Error('Amount must be finite');
  if (!Number.isFinite(input.monthlyNetUsd)) throw new Error('Amount must be finite');
  const expectedUsd = expectedUsdOnDay(input.line, input.onDay);
  const deltaUsd = input.actualUsd - expectedUsd;
  const months = input.monthlyNetUsd > 0 ? deltaUsd / input.monthlyNetUsd : null;
  return { deltaUsd, months };
}

/** Interest on the opening cents, rounded half away from zero, then the deposit. */
function accrueMonth(balanceCents: number, monthlyRate: number, depositCents: number): number {
  return roundHalfAwayFromZero(balanceCents * (1 + monthlyRate)) + depositCents;
}

function expectedUsdOnDay(line: NetWorthProjection, onDay: string): number {
  assertCivilDay(onDay);
  const first = line.points[0];
  const last = line.points[line.points.length - 1];
  if (!first || !last) throw new Error('Projection has no points');
  const firstDate = monthStart(first.month);
  const lastDate = monthStart(last.month);
  if (onDay < firstDate || onDay > lastDate) throw new Error('Day is outside the projection');

  let index = 0;
  for (let cursor = 1; cursor < line.points.length; cursor += 1) {
    const candidate = line.points[cursor];
    if (!candidate || monthStart(candidate.month) > onDay) break;
    index = cursor;
  }
  const left = line.points[index];
  if (!left) throw new Error('Projection has no points');
  const leftDate = monthStart(left.month);
  if (onDay === leftDate) return left.netWorthUsd;

  const right = line.points[index + 1];
  if (!right) throw new Error('Day is outside the projection');
  const span = daysBetween(leftDate, monthStart(right.month));
  const elapsed = daysBetween(leftDate, onDay);
  if (span <= 0) throw new Error('Projection months are not increasing');
  return left.netWorthUsd + (elapsed / span) * (right.netWorthUsd - left.netWorthUsd);
}

function monthStart(month: string): string {
  return `${month}-01`;
}

function toCents(usd: number): number {
  if (!Number.isFinite(usd)) throw new Error('Amount must be finite');
  const sign = usd < 0 ? -1 : 1;
  // 1e-8 absorbs binary noise such as 1.005 * 100 === 100.49999999999999.
  return sign * Math.round(Math.abs(usd) * 100 + 1e-8);
}

function roundHalfAwayFromZero(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(value));
}

function assertAnnualRate(annualRate: number): void {
  if (!Number.isFinite(annualRate) || annualRate < MIN_ANNUAL_RATE || annualRate > MAX_ANNUAL_RATE) {
    throw new Error('Annual rate must be between -0.5 and 0.5');
  }
}

function assertMaxMonths(maxMonths: number): void {
  if (!Number.isInteger(maxMonths) || maxMonths < 0) {
    throw new Error('maxMonths must be a non-negative integer');
  }
}

function normalizeMonth(value: string): string {
  const dated = MONTH_START_PATTERN.exec(value);
  const monthText = dated ? `${dated[1]}-${dated[2]}` : value;
  const match = MONTH_PATTERN.exec(monthText);
  if (!match) throw new Error('Month must be YYYY-MM or the first day YYYY-MM-01');
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('Month must be YYYY-MM or the first day YYYY-MM-01');
  return `${match[1]}-${match[2]}`;
}

function addMonths(month: string, offset: number): string {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error('Month must be YYYY-MM');
  const absolute = Number(match[1]) * 12 + (Number(match[2]) - 1) + offset;
  const year = Math.floor(absolute / 12);
  const nextMonth = (absolute % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`;
}

function assertCivilDay(value: string): void {
  const match = DAY_PATTERN.exec(value);
  if (!match) throw new Error('Day must be YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) throw new Error('Day must be YYYY-MM-DD');
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new Error('Day must be YYYY-MM-DD');
  }
}
