import { describe, expect, it } from '@jest/globals';

import { exponentialMovingAverage, weightTrendEma } from './ema';
import type { WeightRecord } from './weight-stats';

function record(id: string, localDay: string, recordedAt: string, weightKg: number): WeightRecord {
  return { id, localDay, recordedAt, weightKg, tz: 'Asia/Singapore', updatedAt: recordedAt };
}

describe('exponential moving average', () => {
  it('seeds with the first sample and then blends by alpha', () => {
    expect(exponentialMovingAverage([10, 20, 30], 0.5)).toEqual([10, 15, 22.5]);
  });

  it('returns the samples themselves when alpha is 1', () => {
    expect(exponentialMovingAverage([70, 71, 69], 1)).toEqual([70, 71, 69]);
  });

  it('returns an empty series for no samples', () => {
    expect(exponentialMovingAverage([], 0.5)).toEqual([]);
  });

  it('rejects an alpha outside (0, 1]', () => {
    expect(() => exponentialMovingAverage([1], 0)).toThrow(/alpha/);
    expect(() => exponentialMovingAverage([1], 1.1)).toThrow(/alpha/);
  });
});

describe('weight trend ema', () => {
  it('uses the earliest weigh-in of a day and skips empty days without resetting', () => {
    const records = [
      record('early', '2026-10-18', '2026-10-18T00:30:00.000Z', 10),
      record('note', '2026-10-18', '2026-10-18T12:00:00.000Z', 99),
      record('later', '2026-10-20', '2026-10-20T00:30:00.000Z', 20),
    ];
    const series = weightTrendEma(records, '2026-10-24', 0.5);
    expect(series.find((point) => point.localDay === '2026-10-18')?.ema).toBe(10);
    expect(series.find((point) => point.localDay === '2026-10-19')?.ema).toBeNull();
    expect(series.find((point) => point.localDay === '2026-10-20')?.ema).toBe(15);
    expect(series.filter((point) => point.ema === null)).toHaveLength(5);
  });
});
