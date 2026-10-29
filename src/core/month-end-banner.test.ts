import { describe, expect, it } from '@jest/globals';

import {
  isWithinLastThreeDays,
  lastDayOfMonth,
  monthBounds,
  MONTH_END_BANNER_COPY,
  shouldShowMonthEndBanner,
} from './month-end-banner';

describe('month-end balance banner', () => {
  it('uses the last three civil days, including February in leap and common years', () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2024, 2)).toBe(29);
    expect(lastDayOfMonth(2025, 2)).toBe(28);
    expect(isWithinLastThreeDays(2026, 10, 28)).toBe(false);
    expect(isWithinLastThreeDays(2026, 10, 29)).toBe(true);
    expect(isWithinLastThreeDays(2026, 10, 31)).toBe(true);
    expect(isWithinLastThreeDays(2026, 2, 25)).toBe(false);
    expect(isWithinLastThreeDays(2026, 2, 26)).toBe(true);
    expect(isWithinLastThreeDays(2024, 2, 26)).toBe(false);
    expect(isWithinLastThreeDays(2024, 2, 27)).toBe(true);
    expect(isWithinLastThreeDays(2024, 2, 29)).toBe(true);
    expect(monthBounds(2024, 2)).toEqual({ start: '2024-02-01', end: '2024-02-29' });
  });

  it('shows the card only when this month has no balance update and it was not dismissed', () => {
    const due = { year: 2026, month: 10, day: 31, balanceUpdated: false, dismissedMonth: null };
    expect(shouldShowMonthEndBanner(due)).toBe(true);
    expect(shouldShowMonthEndBanner({ ...due, day: 28 })).toBe(false);
    expect(shouldShowMonthEndBanner({ ...due, balanceUpdated: true })).toBe(false);
    expect(shouldShowMonthEndBanner({ ...due, balanceUpdated: null })).toBe(false);
    expect(shouldShowMonthEndBanner({ ...due, dismissedMonth: '2026-10' })).toBe(false);
    expect(shouldShowMonthEndBanner({ ...due, dismissedMonth: '2026-09' })).toBe(true);
    expect(MONTH_END_BANNER_COPY.message).toBe('这个月还没更新资产余额');
    expect(MONTH_END_BANNER_COPY.update).toBe('去更新');
    expect(MONTH_END_BANNER_COPY.dismiss).toBe('关闭');
    expect(MONTH_END_BANNER_COPY.dismissName).toBe('关闭月底提醒');
  });
});
