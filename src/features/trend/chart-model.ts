import { weightTrendEma } from '@/core/ema';
import { earliestPerDay, TREND_WINDOW_DAYS, weightListWindow, type WeightRecord } from '@/core/weight-stats';
import type { LinePoint } from '@/ui/LineChart';

/**
 * Places the core trend series on the chart.
 * Values come from `weightTrendEma`. This file does not smooth.
 */

const DAY_MS = 86_400_000;

export type ChartSeries = {
  points: LinePoint[];
  startDay: string;
  endDay: string;
};

function daysBetween(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const span = Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay);
  return Math.round(span / DAY_MS);
}

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
