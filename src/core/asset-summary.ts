export type SummaryCurrency = 'USD' | 'CNY' | 'SGD' | 'HKD';

export type SummaryAccount = {
  id: string;
  currency: SummaryCurrency;
  deletedAt: string | null;
};

export type SummaryBalance = {
  accountId: string;
  amount: number;
  recordedAt: string;
  deletedAt: string | null;
};

export type SummaryHolding = {
  accountId: string;
  symbol: string;
  quantity: number;
  /** Present on the row. Never used as a substitute price. */
  costBasisUsd: number | null;
  deletedAt: string | null;
};

export type SummaryQuote = {
  symbol: string;
  price: number | null;
  status: 'fresh' | 'stale' | 'unavailable';
  source: 'finnhub' | 'cost_basis';
};

export type AssetSplit = {
  cashUsd: number;
  securitiesUsd: number;
  /**
   * Sum of the two parts. The dashboard headline is the server `total_usd`,
   * not this number.
   */
  partsUsd: number;
  unpricedHoldings: number;
};

/**
 * Display split for tests and per-row checks.
 * Balances and holdings on a soft-deleted account are left out.
 * A quote with a null price or `unavailable` adds nothing, even if the holding has a cost basis.
 * `fxPerUsd` is units of that currency per 1 USD. USD needs no rate.
 */
export function splitLiveAssets(input: {
  accounts: readonly SummaryAccount[];
  balances: readonly SummaryBalance[];
  holdings: readonly SummaryHolding[];
  quotes: readonly SummaryQuote[];
  fxPerUsd?: Readonly<Record<string, number>>;
}): AssetSplit {
  const live = new Map(input.accounts.filter((account) => account.deletedAt === null).map((account) => [account.id, account]));
  const quotes = new Map(input.quotes.map((quote) => [quote.symbol, quote]));
  let cashCents = 0;
  for (const balance of latestBalances(input.balances, live)) {
    const account = live.get(balance.accountId);
    if (!account) continue;
    const usd = toUsd(balance.amount, account.currency, input.fxPerUsd ?? {});
    if (usd === null) continue;
    cashCents += toCents(usd);
  }
  let securityCents = 0;
  let unpricedHoldings = 0;
  for (const holding of input.holdings) {
    if (holding.deletedAt !== null || !live.has(holding.accountId)) continue;
    const quote = quotes.get(holding.symbol);
    if (!quote || quote.status === 'unavailable' || quote.price === null) {
      unpricedHoldings += 1;
      continue;
    }
    securityCents += toCents(quote.price * holding.quantity);
  }
  const cashUsd = cashCents / 100;
  const securitiesUsd = securityCents / 100;
  return {
    cashUsd,
    securitiesUsd,
    partsUsd: (cashCents + securityCents) / 100,
    unpricedHoldings,
  };
}

/** Headline figure. This is the server total, including the one stored for offline use. */
export function dashboardTotalUsd(book: { total_usd: number } | null): number | null {
  if (!book || !Number.isFinite(book.total_usd)) return null;
  return book.total_usd;
}

function latestBalances(
  balances: readonly SummaryBalance[],
  live: ReadonlyMap<string, SummaryAccount>,
): SummaryBalance[] {
  const latest = new Map<string, SummaryBalance>();
  const ordered = [...balances].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  for (const balance of ordered) {
    if (balance.deletedAt !== null || !live.has(balance.accountId)) continue;
    if (!latest.has(balance.accountId)) latest.set(balance.accountId, balance);
  }
  return [...latest.values()];
}

function toUsd(amount: number, currency: SummaryCurrency, fxPerUsd: Readonly<Record<string, number>>): number | null {
  if (!Number.isFinite(amount)) return null;
  if (currency === 'USD') return amount;
  const rate = fxPerUsd[currency];
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return null;
  return amount / rate;
}

function toCents(amount: number): number {
  const sign = amount < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(amount) * 100 + 1e-8);
}
