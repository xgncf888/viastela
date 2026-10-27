/**
 * Quote lines match `CachedQuote` in src/data/quoteCache.ts.
 * `price` is a number for fresh and stale, and null for unavailable.
 * `source` is finnhub or cost_basis. The string `fake` is never returned.
 */

export type QuoteStatus = 'fresh' | 'stale' | 'unavailable';

export type QuoteSource = 'finnhub' | 'cost_basis';

export type QuoteLine = {
  symbol: string;
  price: number | null;
  currency: string;
  as_of: string;
  status: QuoteStatus;
  source: QuoteSource;
};

export type FxLine = {
  base: string;
  quote: string;
  rate: number;
  as_of: string;
};

export type SnapshotState = 'written' | 'skipped';

export type QuotesResponse = {
  quotes: QuoteLine[];
  rates: FxLine[];
  source: QuoteSource;
  total_usd: number;
  cash_usd: number;
  securities_usd: number;
  unpriced: number;
  stale: boolean;
  snapshot: SnapshotState;
};

export type HoldingRow = {
  symbol: string;
  quantity: string;
  costBasisUsd: string | null;
};

export type CashCurrency = 'USD' | 'CNY' | 'SGD' | 'HKD';

export type CashBalance = {
  accountId: string;
  currency: CashCurrency;
  amount: string;
  recordedAt: string;
  tz: string;
  deletedAt?: string | null;
};

export type AssetAccount = {
  id: string;
  deletedAt: string | null;
};

export type QuoteCacheRow = {
  symbol: string;
  price: number;
  currency: string;
  /** When this price was fetched, as an ISO timestamp. Drives the 15-minute window. */
  asOf: string;
};

export type FxCacheRow = {
  base: string;
  quote: string;
  rate: number;
  asOf: string;
};

export type SnapshotWrite = {
  userId: string;
  localDay: string;
  tz: string;
  totalUsd: number;
  cashUsd: number;
  securitiesUsd: number;
  asOf: string;
};

export type QuoteLogEvent = {
  event: string;
  status: number;
  source?: QuoteSource;
  snapshot?: SnapshotState;
};

export const SYMBOL_PATTERN = /^[A-Z][A-Z.]{0,9}$/;
export const MAX_SYMBOLS = 30;
export const QUOTE_FRESH_MS = 15 * 60 * 1000;
export const CASH_CURRENCIES = ['USD', 'CNY', 'SGD', 'HKD'] as const;
