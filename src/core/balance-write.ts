export type BalanceCurrency = 'USD' | 'CNY' | 'SGD' | 'HKD';

/**
 * USD balance rows always store `usd_rate = 1` so a later timeline `after_usd` is not null.
 * Other currencies keep the observed FX snapshot, or null when the client does not have one.
 * The rate is units of that currency per 1 USD.
 */
export function balanceUsdRate(currency: string, observedRate: number | null | undefined): number | null {
  if (currency === 'USD') return 1;
  if (observedRate == null || !Number.isFinite(observedRate) || observedRate <= 0) return null;
  return observedRate;
}

export type BalanceInsert = {
  id: string;
  account_id: string;
  amount: number;
  usd_rate: number | null;
  recorded_at: string;
  tz: string;
  local_day: string;
};

/** The row the client inserts into `account_balances`. */
export function buildBalanceInsert(input: {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  observedRate: number | null;
  recordedAt: string;
  tz: string;
  localDay: string;
}): BalanceInsert {
  return {
    id: input.id,
    account_id: input.accountId,
    amount: input.amount,
    usd_rate: balanceUsdRate(input.currency, input.observedRate),
    recorded_at: input.recordedAt,
    tz: input.tz,
    local_day: input.localDay,
  };
}
