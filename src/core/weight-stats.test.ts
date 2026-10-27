import { describe, expect, it } from '@jest/globals';

import {
  earliestPerDay,
  notesForDay,
  sevenDayAverage,
  sevenDayAverageView,
  summarizeWindow,
  weightListWindow,
  type WeightRecord,
} from './weight-stats';

function record(id: string, localDay: string, recordedAt: string, weightKg: number): WeightRecord {
  return { id, localDay, recordedAt, weightKg, tz: 'Asia/Singapore', updatedAt: recordedAt };
}

const fourDays = [
  record('a', '2026-10-18', '2026-10-18T00:30:00.000Z', 68),
  record('a2', '2026-10-18', '2026-10-18T12:00:00.000Z', 90),
  record('b', '2026-10-20', '2026-10-20T00:30:00.000Z', 70),
  record('c', '2026-10-22', '2026-10-22T00:30:00.000Z', 72),
  record('d', '2026-10-24', '2026-10-24T00:30:00.000Z', 74),
];

describe('seven day average', () => {
  it('uses the earliest record of each local day once four days exist', () => {
    expect(sevenDayAverage(fourDays, '2026-10-24')).toBe(71);
    expect(sevenDayAverageView(fourDays, '2026-10-24')).toEqual({ status: 'value', kilograms: 71 });
    const summary = summarizeWindow(fourDays, '2026-10-24');
    const day = summary.find((item) => item.localDay === '2026-10-18');
    expect(day?.primary?.id).toBe('a');
    expect(day?.notes.map((item) => item.id)).toEqual(['a2']);
    expect(notesForDay(fourDays, '2026-10-18').map((item) => item.id)).toEqual(['a2']);
    expect(summary.filter((item) => item.primary === null)).toHaveLength(3);
  });

  it('reports insufficient data when fewer than 4 days have records', () => {
    const threeDays = fourDays.filter((item) => item.localDay !== '2026-10-18');
    expect(sevenDayAverageView(threeDays, '2026-10-24')).toEqual({ status: 'insufficient' });
    expect(sevenDayAverage(threeDays, '2026-10-24')).toBeNull();
    expect(earliestPerDay(threeDays)).toHaveLength(3);
  });

  it('ignores rows outside the seven day window', () => {
    const records = [record('old', '2026-10-01', '2026-10-01T00:00:00.000Z', 99), ...fourDays];
    expect(sevenDayAverage(records, '2026-10-24')).toBe(71);
    expect(weightListWindow('2026-10-24')).toEqual({ fromDay: '2026-10-18', toDay: '2026-10-24' });
  });

  it('returns insufficient data when the window has no rows', () => {
    expect(sevenDayAverageView([], '2026-10-24')).toEqual({ status: 'insufficient' });
    expect(sevenDayAverage([], '2026-10-24')).toBeNull();
  });
});
