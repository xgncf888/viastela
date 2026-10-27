import { zonedCivilTime } from './local-day';

export type QuoteLabelSource = 'finnhub' | 'cost_basis';
export type QuoteLabelStatus = 'fresh' | 'stale' | 'unavailable';

export const COST_BASIS_LABEL = '按成本价估算';
export const UNAVAILABLE_LABEL = '暂无价格';
export const STALE_LABEL = '价格可能过期';
export const OFFLINE_QUOTE_CALLOUT = '离线中，显示的是上次取到的价格';
export const COST_BASIS_CALLOUT = '还没接入真实行情，股票按成本价估算';
export const SNAPSHOT_SKIPPED_NOTE = '接入真实行情后开始记录实际走势';
export const ACTUAL_LINE_LATER_NOTE = '下个月开始显示实际走势';

export type QuoteLabelTone = 'muted' | 'warning' | 'plain';

/**
 * Label for one cached quote.
 * `unavailable` is always 「暂无价格」. The client does not invent a cost-basis price.
 * A server `cost_basis` row that still has a price is 「按成本价估算」, never a clock time.
 */
export function quoteStatusLabel(input: {
  source: QuoteLabelSource;
  status: QuoteLabelStatus;
  asOf: string;
  timeZone: string;
  /** The live fetch failed and this row is the previous device cache. */
  possiblyExpired?: boolean;
}): { text: string; tone: QuoteLabelTone } {
  if (input.status === 'unavailable') {
    return { text: UNAVAILABLE_LABEL, tone: 'plain' };
  }
  if (input.source === 'cost_basis') {
    return { text: COST_BASIS_LABEL, tone: 'warning' };
  }
  if (input.status === 'stale' || input.possiblyExpired) {
    return { text: STALE_LABEL, tone: 'warning' };
  }
  return { text: `价格更新于 ${formatQuoteClock(input.asOf, input.timeZone)}`, tone: 'muted' };
}

export function formatQuoteClock(asOf: string, timeZone: string): string {
  const civil = zonedCivilTime(new Date(asOf), timeZone);
  const hour = String(civil.hour).padStart(2, '0');
  const minute = String(civil.minute).padStart(2, '0');
  return `${hour}:${minute}`;
}

/** Server `unpriced` count. Zero or missing hides the line. */
export function unpricedHoldingsMessage(count: number | null | undefined): string | null {
  if (count == null || !Number.isInteger(count) || count <= 0) return null;
  return `有 ${count} 个持仓没有价格`;
}

/**
 * Fewer than two actual points and a skipped snapshot uses the real-quote note.
 * Existing history (two or more points) stays quiet even if today was skipped.
 */
export function actualSeriesNote(input: {
  snapshot: 'written' | 'skipped' | null;
  actualPoints: number;
}): string | null {
  if (input.actualPoints >= 2) return null;
  if (input.snapshot === 'skipped') return SNAPSHOT_SKIPPED_NOTE;
  return ACTUAL_LINE_LATER_NOTE;
}
