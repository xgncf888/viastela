import { buildBalanceInsert } from '@/core/balance-write';
import { requireDeletedIds } from '@/core/weight-write';

import { getSupabase } from './client';
import { liveRows } from './live-rows';

export type AssetCurrency = 'USD' | 'CNY' | 'SGD' | 'HKD';

export type AssetAccountRow = {
  id: string;
  name: string;
  currency: AssetCurrency;
  deletedAt: string | null;
};

export type AccountBalanceRow = {
  id: string;
  accountId: string;
  amount: number;
  usdRate: number | null;
  recordedAt: string;
  tz: string;
  localDay: string;
  deletedAt: string | null;
};

export type HoldingRow = {
  id: string;
  accountId: string;
  symbol: string;
  quantity: number;
  costBasisUsd: number | null;
  deletedAt: string | null;
};

export type GoalRow = {
  id: string;
  targetUsd: number;
  targetDate: string | null;
};

export type AssumptionsRow = {
  id: string;
  startUsd: number;
  startMonth: string;
  monthlyNetUsd: number;
  returnRates: [number, number, number];
  mainRateIndex: number;
};

export type SnapshotRow = {
  localDay: string;
  totalUsd: number;
  cashUsd: number;
  securitiesUsd: number;
};

export type AssetEventRow = {
  id: string;
  kind: string;
  symbol: string | null;
  occurredAt: string;
};

const CURRENCIES: readonly AssetCurrency[] = ['USD', 'CNY', 'SGD', 'HKD'];

function isCurrency(value: string): value is AssetCurrency {
  return (CURRENCIES as readonly string[]).includes(value);
}

function asNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Not signed in');
  return userId;
}

export async function listAssetAccounts(): Promise<AssetAccountRow[]> {
  const { data, error } = await liveRows(
    getSupabase().from('asset_accounts').select('id, name, currency, deleted_at'),
  ).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    if (!isCurrency(row.currency)) return [];
    return [{ id: row.id, name: row.name, currency: row.currency, deletedAt: row.deleted_at }];
  });
}

export async function listAccountBalances(): Promise<AccountBalanceRow[]> {
  const { data, error } = await liveRows(
    getSupabase().from('account_balances').select('id, account_id, amount, usd_rate, recorded_at, tz, local_day, deleted_at'),
  ).order('recorded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const amount = asNumber(row.amount);
    if (amount === null) return [];
    return [
      {
        id: row.id,
        accountId: row.account_id,
        amount,
        usdRate: asNumber(row.usd_rate),
        recordedAt: row.recorded_at,
        tz: row.tz,
        localDay: row.local_day,
        deletedAt: row.deleted_at,
      },
    ];
  });
}

export async function listHoldings(): Promise<HoldingRow[]> {
  const { data, error } = await liveRows(
    getSupabase().from('holdings').select('id, account_id, symbol, quantity, cost_basis_usd, deleted_at'),
  ).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const quantity = asNumber(row.quantity);
    if (quantity === null) return [];
    return [
      {
        id: row.id,
        accountId: row.account_id,
        symbol: row.symbol,
        quantity,
        costBasisUsd: asNumber(row.cost_basis_usd),
        deletedAt: row.deleted_at,
      },
    ];
  });
}

export async function listGoal(): Promise<GoalRow | null> {
  const { data, error } = await liveRows(
    getSupabase().from('net_worth_goals').select('id, target_usd, target_date'),
  )
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const targetUsd = asNumber(data.target_usd);
  if (targetUsd === null) return null;
  return { id: data.id, targetUsd, targetDate: data.target_date };
}

export async function listAssumptions(): Promise<AssumptionsRow | null> {
  const { data, error } = await liveRows(
    getSupabase()
      .from('projection_assumptions')
      .select('id, start_usd, start_month, monthly_net_usd, return_rates, main_rate_index'),
  )
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const startUsd = asNumber(data.start_usd);
  const monthly = asNumber(data.monthly_net_usd);
  const rates = data.return_rates.map((rate) => asNumber(rate));
  if (startUsd === null || monthly === null || rates.length !== 3 || rates.some((rate) => rate === null)) return null;
  const [first, second, third] = rates as [number, number, number];
  return {
    id: data.id,
    startUsd,
    startMonth: data.start_month,
    monthlyNetUsd: monthly,
    returnRates: [first, second, third],
    mainRateIndex: data.main_rate_index,
  };
}

export async function listSnapshots(): Promise<SnapshotRow[]> {
  const { data, error } = await getSupabase()
    .from('net_worth_snapshots')
    .select('local_day, total_usd, cash_usd, securities_usd')
    .order('local_day', { ascending: true });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const totalUsd = asNumber(row.total_usd);
    const cashUsd = asNumber(row.cash_usd);
    const securitiesUsd = asNumber(row.securities_usd);
    if (totalUsd === null || cashUsd === null || securitiesUsd === null) return [];
    return [{ localDay: row.local_day, totalUsd, cashUsd, securitiesUsd }];
  });
}

export async function listAssetEvents(): Promise<AssetEventRow[]> {
  const { data, error } = await getSupabase()
    .from('asset_events')
    .select('id, kind, symbol, occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    symbol: row.symbol,
    occurredAt: row.occurred_at,
  }));
}

export async function insertAccount(input: { id: string; name: string; currency: AssetCurrency }): Promise<void> {
  const userId = await requireUserId();
  const { error } = await getSupabase().from('asset_accounts').insert({
    id: input.id,
    user_id: userId,
    name: input.name.trim(),
    currency: input.currency,
  });
  if (error) throw error;
}

export async function insertBalance(input: {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  observedRate: number | null;
  recordedAt: string;
  tz: string;
  localDay: string;
}): Promise<void> {
  const userId = await requireUserId();
  const row = buildBalanceInsert(input);
  const { error } = await getSupabase().from('account_balances').insert({ ...row, user_id: userId });
  if (error) throw error;
}

export async function insertHolding(input: {
  id: string;
  accountId: string;
  symbol: string;
  quantity: number;
  costBasisUsd: number | null;
}): Promise<void> {
  const userId = await requireUserId();
  const { error } = await getSupabase().from('holdings').insert({
    id: input.id,
    user_id: userId,
    account_id: input.accountId,
    symbol: input.symbol,
    quantity: input.quantity,
    cost_basis_usd: input.costBasisUsd,
  });
  if (error) throw error;
}

/** Quantity and cost only. Symbol and account stay as they were stored. */
export async function updateHolding(id: string, input: { quantity: number; costBasisUsd: number | null }): Promise<void> {
  const { error } = await getSupabase()
    .from('holdings')
    .update({ quantity: input.quantity, cost_basis_usd: input.costBasisUsd })
    .eq('id', id);
  if (error) throw error;
}

export async function softDeleteHolding(id: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from('holdings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  requireDeletedIds(data);
}

export async function softDeleteAccount(id: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from('asset_accounts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  requireDeletedIds(data);
}

export async function saveAssumptions(input: {
  id: string;
  startUsd: number;
  startMonth: string;
  monthlyNetUsd: number;
  returnRates: [number, number, number];
  mainRateIndex: number;
}): Promise<void> {
  const userId = await requireUserId();
  const { error } = await getSupabase().from('projection_assumptions').upsert(
    {
      id: input.id,
      user_id: userId,
      start_usd: input.startUsd,
      start_month: input.startMonth,
      monthly_net_usd: input.monthlyNetUsd,
      monthly_income_usd: null,
      monthly_expense_usd: null,
      return_rates: [...input.returnRates],
      main_rate_index: input.mainRateIndex,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function saveGoal(input: { id: string; targetUsd: number; targetDate: string | null }): Promise<void> {
  const userId = await requireUserId();
  const { error } = await getSupabase().from('net_worth_goals').upsert(
    {
      id: input.id,
      user_id: userId,
      target_usd: input.targetUsd,
      target_date: input.targetDate,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}
