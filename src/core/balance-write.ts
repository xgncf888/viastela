export type BalanceCurrency = 'USD' | 'CNY' | 'SGD' | 'HKD';

/**
 * Value stored in `account_balances.usd_rate`: USD per 1 unit of the account currency.
 * The timeline computes `after_usd = amount * usd_rate`.
 *
 * `unitsPerUsd` is the quotes `rates` convention (units of the account currency per 1 USD).
 * A quote of 1.25 SGD per USD is stored as `1 / 1.25`. USD is always 1, so `after_usd` is not null.
 * A missing, non-finite, zero, or negative quote stays null.
 */
export function balanceUsdRate(currency: string, unitsPerUsd: number | null | undefined): number | null {
  if (currency === 'USD') return 1;
  if (unitsPerUsd == null || !Number.isFinite(unitsPerUsd) || unitsPerUsd <= 0) return null;
  return 1 / unitsPerUsd;
}

/** Timeline dollars. `usdRate` is USD per 1 unit of the account currency. */
export function balanceAfterUsd(amount: number, usdRate: number | null): number | null {
  if (!Number.isFinite(amount) || usdRate === null || !Number.isFinite(usdRate)) return null;
  return amount * usdRate;
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
  /** Quotes convention: units of `currency` per 1 USD. Not the stored column. */
  unitsPerUsd: number | null;
  recordedAt: string;
  tz: string;
  localDay: string;
}): BalanceInsert {
  return {
    id: input.id,
    account_id: input.accountId,
    amount: input.amount,
    usd_rate: balanceUsdRate(input.currency, input.unitsPerUsd),
    recorded_at: input.recordedAt,
    tz: input.tz,
    local_day: input.localDay,
  };
}
