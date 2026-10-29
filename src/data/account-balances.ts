import { getSupabase } from './client';
import { liveRows } from './live-rows';

const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when a live balance falls in the civil month.
 * Null means the read failed, so the caller hides the month-end banner.
 */
export async function balanceUpdatedThisMonth(start: string, end: string): Promise<boolean | null> {
  if (!LOCAL_DAY.test(start) || !LOCAL_DAY.test(end) || start > end) return null;
  const { data, error } = await liveRows(getSupabase().from('account_balances').select('id'))
    .gte('local_day', start)
    .lte('local_day', end)
    .limit(1);
  if (error) return null;
  if (!Array.isArray(data)) return null;
  return data.length > 0;
}
