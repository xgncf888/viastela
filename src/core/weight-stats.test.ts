import { describe, expect, it } from '@jest/globals';

import { sevenDayAverage, summarizeWindow, type WeightRecord } from './weight-stats';

function record(id: string, localDay: string, recordedAt: string, weightKg: number): WeightRecord {
  return { id, localDay, recordedAt, weightKg, tz: 'Asia/Shanghai', updatedAt: recordedAt };
}

describe('seven day average', () => {
  it('uses the earliest record of each local day and skips empty days', () => {
    const records = [
      record('a', '2026-10-22', '2026-10-22T00:30:00.000Z', 70),
      record('b', '2026-10-22', '2026-10-22T12:00:00.000Z', 75),
      record('c', '2026-10-24', '2026-10-24T01:00:00.000Z', 72),
    ];
    expect(sevenDayAverage(records, '2026-10-24')).toBe(71);
    const summary = summarizeWindow(records, '2026-10-24');
    const day = summary.find((item) => item.localDay === '2026-10-22');
    expect(day?.primary?.id).toBe('a');
    expect(day?.notes.map((item) => item.id)).toEqual(['b']);
    expect(summary.filter((item) => item.primary === null)).toHaveLength(5);
  });

  it('ignores rows outside the seven day window', () => {
    const records = [
      record('old', '2026-10-01', '2026-10-01T00:00:00.000Z', 99),
      record('new', '2026-10-24', '2026-10-24T00:00:00.000Z', 70),
    ];
    expect(sevenDayAverage(records, '2026-10-24')).toBe(70);
  });

  it('returns null when the window has no rows', () => {
    expect(sevenDayAverage([], '2026-10-24')).toBeNull();
  });
});
