import { describe, expect, it } from '@jest/globals';

import vectors from '../../fixtures/weight-ema.json';
import { DEFAULT_WEIGHT_EMA_ALPHA, exponentialMovingAverage, weightTrendEma } from './ema';
import type { WeightRecord } from './weight-stats';

function record(item: (typeof vectors.records)[number]): WeightRecord {
  return { ...item, tz: 'Asia/Singapore', updatedAt: item.recordedAt };
}

describe('exponential moving average', () => {
  it('seeds with the first sample and then blends by the chart alpha', () => {
    expect(DEFAULT_WEIGHT_EMA_ALPHA).toBe(vectors.alpha);
    expect(exponentialMovingAverage(vectors.blend.values, vectors.alpha)).toEqual(vectors.blend.series);
  });

  it('returns the samples themselves when alpha is 1', () => {
    expect(exponentialMovingAverage([70, 71, 69], 1)).toEqual([70, 71, 69]);
  });

  it('returns an empty series for no samples', () => {
    expect(exponentialMovingAverage([], vectors.alpha)).toEqual([]);
  });

  it('rejects an alpha outside (0, 1]', () => {
    expect(() => exponentialMovingAverage([1], 0)).toThrow(/alpha/);
    expect(() => exponentialMovingAverage([1], 1.1)).toThrow(/alpha/);
  });
});

describe('weight trend ema', () => {
  it('uses the earliest weigh-in and skips days with no record', () => {
    const series = weightTrendEma(vectors.records.map(record), vectors.endDay);
    expect(series).toEqual(vectors.series);
    expect(series.some((point) => point.localDay === '2026-10-19')).toBe(false);
    expect(series.some((point) => point.localDay === '2026-09-26')).toBe(false);
  });
});
