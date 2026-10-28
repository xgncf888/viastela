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
export const QUOTE_REFRESH_FAILED = '行情更新失败';
export const QUOTE_MISS_LINE = '暂无价格，未计入总资产';
export const QUOTE_MISS_REASON = '行情暂时取不到';
export const TOTAL_UNAVAILABLE_TITLE = '总资产暂时算不出来';

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

export type QuoteFailureCopy = {
  failedLabel: string | null;
  cacheLabel: string | null;
  missLine: string | null;
  missReason: string | null;
};

const QUIET_FAILURE: QuoteFailureCopy = {
  failedLabel: null,
  cacheLabel: null,
  missLine: null,
  missReason: null,
};

/**
 * A failed or timed-out quotes call.
 * A device cache keeps the last prices and says when they were cached.
 * With no cache, the board says the prices are missing and why. Timeouts
 * and other failures share that sentence. Balances are not a substitute.
 */
export function quoteFailurePresentation(input: {
  failed: boolean;
  hasCache: boolean;
  cachedAsOf: string | null;
  timeZone: string;
}): QuoteFailureCopy {
  if (!input.failed) return QUIET_FAILURE;
  if (input.hasCache) {
    return {
      failedLabel: QUOTE_REFRESH_FAILED,
      cacheLabel: input.cachedAsOf ? `行情更新于 ${formatQuoteClock(input.cachedAsOf, input.timeZone)}` : null,
      missLine: null,
      missReason: null,
    };
  }
  return {
    failedLabel: QUOTE_REFRESH_FAILED,
    cacheLabel: null,
    missLine: TOTAL_UNAVAILABLE_TITLE,
    missReason: QUOTE_MISS_REASON,
  };
}

/** Oldest priced quote time, else any quote time. Null when the book has none. */
export function cachedQuoteAsOf(quotes: readonly { asOf: string; status: QuoteLabelStatus }[]): string | null {
  if (quotes.length === 0) return null;
  const priced = quotes.filter((quote) => quote.status !== 'unavailable');
  const pool = priced.length > 0 ? priced : quotes;
  return pool.reduce((left, right) => (left.asOf < right.asOf ? left : right)).asOf;
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
  return `有 ${count} 个持仓没有价格，未计入总资产`;
}

export type QuoteSetQuote = {
  source: QuoteLabelSource;
  status: QuoteLabelStatus;
  asOf: string;
};

/**
 * One status for the whole quote set.
 * Any `cost_basis` row wins, then any stale row, then a fresh Finnhub clock
 * taken from the oldest `as_of`. Unavailable rows are ignored. An empty priced
 * set returns null.
 */
export function quoteSetStatus(input: {
  quotes: readonly QuoteSetQuote[];
  timeZone: string;
  possiblyExpired?: boolean;
}): { text: string; tone: 'muted' | 'warning' } | null {
  const priced = input.quotes.filter((quote) => quote.status !== 'unavailable');
  if (priced.length === 0) return null;
  if (priced.some((quote) => quote.source === 'cost_basis')) {
    return { text: COST_BASIS_LABEL, tone: 'warning' };
  }
  if (input.possiblyExpired || priced.some((quote) => quote.status === 'stale')) {
    return { text: STALE_LABEL, tone: 'warning' };
  }
  const fresh = priced.filter((quote) => quote.source === 'finnhub' && quote.status === 'fresh');
  if (fresh.length !== priced.length) return null;
  const oldest = fresh.reduce((left, right) => (left.asOf < right.asOf ? left : right));
  return { text: `价格更新于 ${formatQuoteClock(oldest.asOf, input.timeZone)}`, tone: 'muted' };
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
