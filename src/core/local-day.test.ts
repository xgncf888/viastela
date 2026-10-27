import { describe, expect, it } from '@jest/globals';

import vectors from '../../fixtures/local-day.json';
import {
  civilLocalDay,
  computeLocalDay,
  headerAccountingLabel,
  saveToastMessage,
  shiftLocalDay,
  zonedCivilTime,
} from './local-day';
import { earliestPerDay, sevenDayAverageView, summarizeWindow, type WeightRecord } from './weight-stats';

const SINGAPORE = 'Asia/Singapore';

type LocalDayCase = (typeof vectors.cases)[number];

function byId(id: string): LocalDayCase {
  const found = vectors.cases.find((item) => item.id === id);
  if (!found) throw new Error(`missing fixture ${id}`);
  return found;
}

function record(partial: Pick<WeightRecord, 'id' | 'weightKg' | 'recordedAt' | 'localDay'> & { tz?: string }): WeightRecord {
  return {
    tz: partial.tz ?? SINGAPORE,
    updatedAt: partial.recordedAt,
    ...partial,
  };
}

describe('shared local-day vectors', () => {
  it.each(vectors.cases)('$id agrees with the client and stays within a day of the civil date', (item) => {
    const instant = new Date(item.recordedAt);
    expect(civilLocalDay(instant, item.tz)).toBe(item.civilDay);
    expect(computeLocalDay(instant, item.tz, item.daySwitch)).toBe(item.localDay);
    expect([item.civilDay, shiftLocalDay(item.civilDay, -1)]).toContain(item.localDay);
  });
});

describe('local day boundaries at the default 04:00 switch in Singapore', () => {
  it('counts 01:30 toward the previous local day', () => {
    const item = byId('singapore-0130');
    const instant = new Date(item.recordedAt);
    expect(zonedCivilTime(instant, SINGAPORE)).toMatchObject({ year: 2026, month: 10, day: 24, hour: 1, minute: 30 });
    expect(computeLocalDay(instant, SINGAPORE, item.daySwitch)).toBe('2026-10-23');
    expect(headerAccountingLabel(instant, SINGAPORE, '04:00')).toBe('已记入 10月23日');
    expect(saveToastMessage(instant, SINGAPORE, '04:00')).toBe('已记入 10月23日');
  });

  it('counts 03:59 toward the previous local day', () => {
    const instant = new Date(byId('singapore-0359').recordedAt);
    expect(zonedCivilTime(instant, SINGAPORE)).toMatchObject({ hour: 3, minute: 59, day: 24 });
    expect(computeLocalDay(instant, SINGAPORE, '04:00')).toBe('2026-10-23');
    expect(saveToastMessage(instant, SINGAPORE, '04:00')).toBe('已记入 10月23日');
  });

  it('counts 04:00 toward the new local day', () => {
    const instant = new Date(byId('singapore-0400').recordedAt);
    expect(zonedCivilTime(instant, SINGAPORE)).toMatchObject({ hour: 4, minute: 0, day: 24 });
    expect(computeLocalDay(instant, SINGAPORE, '04:00')).toBe('2026-10-24');
    expect(headerAccountingLabel(instant, SINGAPORE, '04:00')).toBeNull();
    expect(saveToastMessage(instant, SINGAPORE, '04:00')).toBe('已记录');
  });

  it('crosses a month boundary when the weigh-in is before the switch', () => {
    const item = byId('singapore-month-boundary');
    const instant = new Date(item.recordedAt);
    expect(civilLocalDay(instant, SINGAPORE)).toBe('2026-03-01');
    expect(computeLocalDay(instant, SINGAPORE, '04:00')).toBe('2026-02-28');
  });
});

describe('day-switch changes', () => {
  it('does not rewrite stored local days', () => {
    const early = new Date('2026-10-23T21:00:00.000Z');
    const later = new Date('2026-10-24T04:00:00.000Z');
    const written = [
      record({
        id: 'morning',
        weightKg: 80,
        recordedAt: early.toISOString(),
        localDay: computeLocalDay(early, SINGAPORE, '04:00'),
      }),
      record({
        id: 'noon',
        weightKg: 70,
        recordedAt: later.toISOString(),
        localDay: computeLocalDay(later, SINGAPORE, '04:00'),
      }),
    ];

    expect(written.map((item) => item.localDay)).toEqual(['2026-10-24', '2026-10-24']);
    expect(earliestPerDay(written)[0]?.weightKg).toBe(80);
    expect(sevenDayAverageView(written, '2026-10-24').status).toBe('insufficient');

    const ifRecomputed = written.map((item) => computeLocalDay(new Date(item.recordedAt), SINGAPORE, '06:00'));
    expect(ifRecomputed).toEqual(['2026-10-23', '2026-10-24']);
    expect(written.map((item) => item.localDay)).toEqual(['2026-10-24', '2026-10-24']);
    expect(sevenDayAverageView(written, '2026-10-24').status).toBe('insufficient');
  });
});

describe('timezone switch', () => {
  it('keeps the Singapore local day after the user moves to Tokyo', () => {
    const instant = new Date(byId('singapore-0330').recordedAt);
    const singaporeDay = computeLocalDay(instant, 'Asia/Singapore', '04:00');
    const tokyoDay = computeLocalDay(instant, 'Asia/Tokyo', '04:00');

    expect(zonedCivilTime(instant, 'Asia/Singapore')).toMatchObject({ day: 24, hour: 3, minute: 30 });
    expect(zonedCivilTime(instant, 'Asia/Tokyo')).toMatchObject({ day: 24, hour: 4, minute: 30 });
    expect(singaporeDay).toBe('2026-10-23');
    expect(tokyoDay).toBe('2026-10-24');
    expect(singaporeDay).toBe(byId('singapore-0330').localDay);
    expect(tokyoDay).toBe(byId('tokyo-0430-same-instant').localDay);

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
    expect(sevenDayAverageView([stored], '2026-10-23').status).toBe('insufficient');
  });
});
