import { describe, expect, it } from '@jest/globals';

import { computeLocalDay } from './local-day';
import { accountingDayStart, assetPageKeyset, timelineClock, timelineDayKey, timelineDayLabel } from './timeline-day';

const SINGAPORE = 'Asia/Singapore';

describe('timeline day key', () => {
  it('keeps a stored day and computes an asset event from the given switch', () => {
    const at = '2026-10-26T20:30:00.000Z';
    expect(timelineDayKey({ localDay: '2026-10-01', occurredAt: at }, SINGAPORE, '06:00')).toBe('2026-10-01');
    expect(timelineDayKey({ localDay: null, occurredAt: at }, SINGAPORE, '06:00')).toBe('2026-10-26');
    expect(timelineDayKey({ localDay: null, occurredAt: at }, SINGAPORE, '04:00')).toBe('2026-10-27');
    expect(computeLocalDay(new Date(at), SINGAPORE, '06:00')).toBe('2026-10-26');
  });

  it('labels today, yesterday, and a weekday', () => {
    expect(timelineDayLabel('2026-10-27', '2026-10-27')).toBe('今天');
    expect(timelineDayLabel('2026-10-26', '2026-10-27')).toBe('昨天');
    expect(timelineDayLabel('2026-10-25', '2026-10-27')).toBe('10月25日 周日');
  });

  it('pads the clock', () => {
    expect(timelineClock('2026-10-26T20:30:00.000Z', SINGAPORE)).toBe('04:30');
  });

  it('starts an accounting day at the switch, inclusive', () => {
    const start = accountingDayStart('2026-10-27', SINGAPORE, '06:00');
    expect(start.toISOString()).toBe('2026-10-26T22:00:00.000Z');
    expect(computeLocalDay(start, SINGAPORE, '06:00')).toBe('2026-10-27');
    expect(computeLocalDay(new Date(start.getTime() - 1), SINGAPORE, '06:00')).toBe('2026-10-26');
  });

  it('does not keyset asset events by a backfilled journal timestamp alone', () => {
    const cursor = {
      dayKey: '2026-10-01',
      occurredAt: '2026-10-27T12:00:00.000Z',
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    };
    const filter = assetPageKeyset(cursor, SINGAPORE, '06:00');
    const start = accountingDayStart('2026-10-01', SINGAPORE, '06:00').toISOString();
    expect(filter.startsWith(`occurred_at.lt."${start}"`)).toBe(true);
    expect(filter).toContain(`occurred_at.gte."${start}"`);
  });
});
