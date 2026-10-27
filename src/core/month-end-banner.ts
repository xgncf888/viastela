export const MONTH_END_BANNER_COPY = {
  message: '这个月还没更新资产余额',
  update: '去更新',
  dismiss: '关闭',
} as const;

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isWithinLastThreeDays(year: number, month: number, day: number): boolean {
  const last = lastDayOfMonth(year, month);
  return day >= last - 2 && day <= last;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const last = lastDayOfMonth(year, month);
  const mm = String(month).padStart(2, '0');
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(last).padStart(2, '0')}`,
  };
}

/** Null means the balance read failed. The banner stays hidden rather than nagging on a bad read. */
export function shouldShowMonthEndBanner(input: {
  year: number;
  month: number;
  day: number;
  balanceUpdated: boolean | null;
  dismissedMonth: string | null;
}): boolean {
  if (input.balanceUpdated !== false) return false;
  if (input.dismissedMonth === monthKey(input.year, input.month)) return false;
  return isWithinLastThreeDays(input.year, input.month, input.day);
}
