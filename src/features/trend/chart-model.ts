import { weightTrendEma } from '@/core/ema';
import { daysBetween } from '@/core/local-day';
import { earliestPerDay, TREND_WINDOW_DAYS, weightListWindow, type WeightRecord } from '@/core/weight-stats';
import type { LinePoint } from '@/ui/LineChart';

/**
 * Places the core trend series on the chart.
 * Values come from `weightTrendEma`. This file does not smooth.
 */

export type ChartSeries = {
  points: LinePoint[];
  startDay: string;
  endDay: string;
};

export function chartSeries(records: readonly WeightRecord[], endDay: string): ChartSeries {
  const { fromDay, toDay } = weightListWindow(endDay, TREND_WINDOW_DAYS);
  const span = Math.max(1, daysBetween(fromDay, toDay));
  const raw = new Map(earliestPerDay(records).map((record) => [record.localDay, record.weightKg]));
  const points = weightTrendEma(records, endDay).map((point) => ({
    id: point.localDay,
    position: daysBetween(fromDay, point.localDay) / span,
    raw: raw.get(point.localDay) ?? point.ema,
    trend: point.ema,
  }));
  return { points, startDay: fromDay, endDay: toDay };
}
