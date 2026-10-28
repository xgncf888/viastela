import { formatMoney } from './money-format';
import { projectionGap, type NetWorthProjection } from './projection';

/** Product copy. `{rate}` is the selected line, not a fixed 3. */
export const UNREACHABLE_GOAL_TEMPLATE = '按 {rate}% 年化，50 年内达不到目标';

export function unreachableGoalCopy(ratePercent: number): string {
  return UNREACHABLE_GOAL_TEMPLATE.replace('{rate}', String(ratePercent));
}

/** 0.05 → 5. Avoids binary noise such as 0.07 * 100. */
export function annualRatePercent(rate: number): number {
  return Math.round(rate * 1000) / 10;
}

export function selectedAnnualRate(rates: readonly number[], mainRateIndex: number): number {
  const selected = rates[mainRateIndex - 1];
  if (selected !== undefined && Number.isFinite(selected)) return selected;
  return rates[0] ?? 0.03;
}

export type ProjectionSentence =
  | { kind: 'no-goal' }
  | { kind: 'already' }
  | { kind: 'unreachable'; text: string }
  | {
      kind: 'forecast';
      ratePercent: number;
      monthLabel: string;
      targetText: string;
      ahead: boolean;
      gapText: string;
      /** 「约 n 个月存入」, or null when monthly net is not positive. */
      monthsLabel: string | null;
    };

/**
 * Selected-line summary. No stored goal returns `{ kind: 'no-goal' }` and
 * nothing about a gap, a month count, or a reach date.
 */
export function projectionSummary(
  input: Omit<Parameters<typeof projectionConclusion>[0], 'targetUsd'> & { targetUsd: number | null },
): ProjectionSentence {
  if (input.targetUsd === null) return { kind: 'no-goal' };
  return projectionConclusion({ ...input, targetUsd: input.targetUsd });
}

/**
 * Conclusion for the selected line. The day is clamped into the line before
 * `projectionGap`, so a date outside the range does not throw.
 */
export function projectionConclusion(input: {
  rates: readonly number[];
  mainRateIndex: number;
  line: NetWorthProjection;
  actualUsd: number;
  onDay: string;
  monthlyNetUsd: number;
  targetUsd: number;
}): ProjectionSentence {
  const ratePercent = annualRatePercent(selectedAnnualRate(input.rates, input.mainRateIndex));
  if (!input.line.goal) {
    return { kind: 'unreachable', text: unreachableGoalCopy(ratePercent) };
  }
  if (input.line.goal.status === 'already') return { kind: 'already' };

  const gap = gapWithinLine(input.line, input.onDay, input.actualUsd, input.monthlyNetUsd);
  const ahead = (gap?.deltaUsd ?? 0) >= 0;
  const gapAmount = Math.abs(gap?.deltaUsd ?? 0);
  const months = gap?.months ?? null;
  return {
    kind: 'forecast',
    ratePercent,
    monthLabel: formatYearMonth(input.line.goal.month),
    targetText: formatMoney(input.targetUsd, 'USD'),
    ahead,
    gapText: formatMoney(gapAmount, 'USD'),
    monthsLabel: months === null ? null : `约 ${Math.round(Math.abs(months))} 个月存入`,
  };
}

export function formatYearMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  return `${match[1]} 年 ${Number(match[2])} 月`;
}

/** Inclusive clamp onto the line's first and last month-start. Invalid days clamp to the start. */
export function clampProjectionDay(line: NetWorthProjection, onDay: string): string | null {
  const first = line.points[0];
  const last = line.points[line.points.length - 1];
  if (!first || !last) return null;
  const start = `${first.month}-01`;
  const end = `${last.month}-01`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(onDay)) return start;
  if (onDay < start) return start;
  if (onDay > end) return end;
  return onDay;
}

function gapWithinLine(
  line: NetWorthProjection,
  onDay: string,
  actualUsd: number,
  monthlyNetUsd: number,
): { deltaUsd: number; months: number | null } | null {
  const day = clampProjectionDay(line, onDay);
  if (!day) return null;
  try {
    return projectionGap({ actualUsd, onDay: day, line, monthlyNetUsd });
  } catch {
    return null;
  }
}
