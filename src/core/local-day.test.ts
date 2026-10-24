import { describe, expect, it } from '@jest/globals';

import {
  civilLocalDay,
  computeLocalDay,
  headerAccountingLabel,
  saveToastMessage,
  zonedCivilTime,
} from './local-day';
import { sevenDayAverage, summarizeWindow, type WeightRecord } from './weight-stats';

const SHANGHAI = 'Asia/Shanghai';

function record(partial: Pick<WeightRecord, 'id' | 'weightKg' | 'recordedAt' | 'localDay'> & { tz?: string }): WeightRecord {
  return {
    tz: partial.tz ?? SHANGHAI,
    updatedAt: partial.recordedAt,
    ...partial,
  };
}

describe('local day boundaries at the default 04:00 switch', () => {
  it('counts 01:30 toward the previous local day', () => {
    const instant = new Date('2026-10-23T17:30:00.000Z');
    expect(zonedCivilTime(instant, SHANGHAI)).toMatchObject({ year: 2026, month: 10, day: 24, hour: 1, minute: 30 });
    expect(computeLocalDay(instant, SHANGHAI, '04:00')).toBe('2026-10-23');
    expect(headerAccountingLabel(instant, SHANGHAI, '04:00')).toBe('已记入 10月23日');
    expect(saveToastMessage(instant, SHANGHAI, '04:00')).toBe('已记入 10月23日');
  });

  it('counts 03:59 toward the previous local day', () => {
    const instant = new Date('2026-10-23T19:59:00.000Z');
    expect(zonedCivilTime(instant, SHANGHAI)).toMatchObject({ hour: 3, minute: 59, day: 24 });
    expect(computeLocalDay(instant, SHANGHAI, '04:00')).toBe('2026-10-23');
    expect(saveToastMessage(instant, SHANGHAI, '04:00')).toBe('已记入 10月23日');
  });

  it('counts 04:00 toward the new local day', () => {
    const instant = new Date('2026-10-23T20:00:00.000Z');
    expect(zonedCivilTime(instant, SHANGHAI)).toMatchObject({ hour: 4, minute: 0, day: 24 });
    expect(computeLocalDay(instant, SHANGHAI, '04:00')).toBe('2026-10-24');
    expect(headerAccountingLabel(instant, SHANGHAI, '04:00')).toBeNull();
    expect(saveToastMessage(instant, SHANGHAI, '04:00')).toBe('已记录');
  });

  it('crosses a month boundary when the weigh-in is before the switch', () => {
    const instant = new Date('2026-02-28T17:30:00.000Z');
    expect(civilLocalDay(instant, SHANGHAI)).toBe('2026-03-01');
    expect(computeLocalDay(instant, SHANGHAI, '04:00')).toBe('2026-02-28');
  });
});

describe('day-switch changes', () => {
  it('does not rewrite stored local days or the average', () => {
    const early = new Date('2026-10-23T21:00:00.000Z');
    const later = new Date('2026-10-24T04:00:00.000Z');
    const written = [
      record({
        id: 'morning',
        weightKg: 80,
        recordedAt: early.toISOString(),
        localDay: computeLocalDay(early, SHANGHAI, '04:00'),
      }),
      record({
        id: 'noon',
        weightKg: 70,
        recordedAt: later.toISOString(),
        localDay: computeLocalDay(later, SHANGHAI, '04:00'),
      }),
    ];

    expect(written.map((item) => item.localDay)).toEqual(['2026-10-24', '2026-10-24']);
    const average = sevenDayAverage(written, '2026-10-24');
    expect(average).toBe(80);

    const ifRecomputed = written.map((item) => computeLocalDay(new Date(item.recordedAt), SHANGHAI, '06:00'));
    expect(ifRecomputed).toEqual(['2026-10-23', '2026-10-24']);
    expect(written.map((item) => item.localDay)).toEqual(['2026-10-24', '2026-10-24']);
    expect(sevenDayAverage(written, '2026-10-24')).toBe(average);
  });
});

describe('timezone switch', () => {
  it('keeps the Singapore local day after the user moves to Tokyo', () => {
    const instant = new Date('2026-10-23T19:30:00.000Z');
    const singaporeDay = computeLocalDay(instant, 'Asia/Singapore', '04:00');
    const tokyoDay = computeLocalDay(instant, 'Asia/Tokyo', '04:00');

    expect(zonedCivilTime(instant, 'Asia/Singapore')).toMatchObject({ day: 24, hour: 3, minute: 30 });
    expect(zonedCivilTime(instant, 'Asia/Tokyo')).toMatchObject({ day: 24, hour: 4, minute: 30 });
    expect(singaporeDay).toBe('2026-10-23');
    expect(tokyoDay).toBe('2026-10-24');

    const stored = record({
      id: 'sg',
      weightKg: 71,
      recordedAt: instant.toISOString(),
      tz: 'Asia/Singapore',
      localDay: singaporeDay,
    });
    const userIsNowIn = 'Asia/Tokyo';
    expect(userIsNowIn).not.toBe(stored.tz);
    expect(stored.localDay).toBe(singaporeDay);
    expect(stored.localDay).not.toBe(tokyoDay);
    const summary = summarizeWindow([stored], '2026-10-24');
    expect(summary.find((day) => day.localDay === '2026-10-23')?.primary?.weightKg).toBe(71);
    expect(summary.find((day) => day.localDay === '2026-10-24')?.primary).toBeNull();
    expect(sevenDayAverage([stored], '2026-10-23')).toBe(71);
  });
});
