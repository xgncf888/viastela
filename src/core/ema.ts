import { lastNLocalDays } from './local-day';
import { earliestPerDay, TREND_WINDOW_DAYS, type WeightRecord } from './weight-stats';

/** Smoothing used by the weight trend chart. The headline average is separate. */
export const DEFAULT_WEIGHT_EMA_ALPHA = 0.1;

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
 * Chart series for the trend window. Each point is that day's earliest weigh-in.
 * A day with no row is left out. The gap is not filled, and it does not reset the running average.
 */
export function weightTrendEma(
  records: readonly WeightRecord[],
  endDay: string,
  alpha: number = DEFAULT_WEIGHT_EMA_ALPHA,
): { localDay: string; ema: number }[] {
  const window = new Set(lastNLocalDays(endDay, TREND_WINDOW_DAYS));
  const samples = earliestPerDay(records.filter((record) => window.has(record.localDay)));
  const values = exponentialMovingAverage(
    samples.map((sample) => sample.weightKg),
    alpha,
  );
  return samples.map((sample, index) => {
    const ema = values[index];
    if (ema === undefined) throw new Error('EMA series is shorter than the sampled days');
    return { localDay: sample.localDay, ema };
  });
}
