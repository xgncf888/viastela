import { summarizeWindow, type WeightRecord } from './weight-stats';

/** Smoothing used by the weight trend chart. The headline average is separate. */
export const DEFAULT_WEIGHT_EMA_ALPHA = 0.5;

/**
 * Exponential moving average. The first sample is the seed.
 * Later samples are `alpha * value + (1 - alpha) * previous`.
 */
export function exponentialMovingAverage(values: readonly number[], alpha: number): number[] {
  if (!(alpha > 0 && alpha <= 1)) {
    throw new Error('EMA alpha must be in (0, 1]');
  }
  const series: number[] = [];
  for (const value of values) {
    const previous = series[series.length - 1];
    series.push(previous === undefined ? value : alpha * value + (1 - alpha) * previous);
  }
  return series;
}

/**
 * Chart series for one 7-day window. Each point uses that day's earliest weigh-in.
 * A day with no row has a null point and does not reset the running average.
 */
export function weightTrendEma(
  records: readonly WeightRecord[],
  endDay: string,
  alpha: number = DEFAULT_WEIGHT_EMA_ALPHA,
): { localDay: string; ema: number | null }[] {
  if (!(alpha > 0 && alpha <= 1)) {
    throw new Error('EMA alpha must be in (0, 1]');
  }
  let previous: number | undefined;
  return summarizeWindow(records, endDay).map((day) => {
    if (!day.primary) return { localDay: day.localDay, ema: null };
    const ema = previous === undefined ? day.primary.weightKg : alpha * day.primary.weightKg + (1 - alpha) * previous;
    previous = ema;
    return { localDay: day.localDay, ema };
  });
}
