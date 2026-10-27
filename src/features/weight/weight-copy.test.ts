import { describe, expect, it } from '@jest/globals';

import type { WeightRecord } from '@/core/weight-stats';
import {
  FIRST_RECORD_TITLE,
  LOADING_TEXT,
  averageCaption,
  excludePending,
  labelsForDay,
  todayReadout,
} from '@/features/weight/weight-copy';

function record(id: string, localDay: string, weightKg: number, hour: number): WeightRecord {
  return {
    id,
    weightKg,
    recordedAt: `${localDay}T${String(hour).padStart(2, '0')}:00:00.000Z`,
    tz: 'UTC',
    localDay,
    updatedAt: `${localDay}T${String(hour).padStart(2, '0')}:00:00.000Z`,
  };
}

describe('today loading', () => {
  it('shows only 读取中 while loading and never 先记第一笔', () => {
    const view = todayReadout(false, 0, true);
    const text = view.loading ?? view.firstRecord ?? '';
    expect(text).toBe('读取中');
    expect(text).toBe(LOADING_TEXT);
    expect(text).not.toContain(FIRST_RECORD_TITLE);
    expect(text).not.toContain('先记第一笔');
    expect(view.firstRecord).toBeNull();
  });
});

describe('seven day headline', () => {
  it('says 数据不足 when 2 of the last 7 days have a record', () => {
    const records = [record('a', '2026-10-26', 70.2, 8), record('b', '2026-10-27', 70.4, 8)];
    const caption = averageCaption(records, '2026-10-27');
    expect(caption.headline).toBe('数据不足');
    expect(caption.detail).toContain('近 7 天有 2 天记录');
    expect(caption.detail).toBe('近 7 天有 2 天记录，满 4 天后显示均重');
  });

  it('labels a same-day second entry 复测', () => {
    const records = [record('a', '2026-10-27', 70.4, 8), record('b', '2026-10-27', 70.9, 12)];
    expect(labelsForDay(records, '2026-10-27')).toEqual(['晨重', '复测']);
  });

  it('drops a pending delete before numbering and the 7-day average', () => {
    const records = [
      record('a', '2026-10-24', 70, 8),
      record('b', '2026-10-25', 70, 8),
      record('c', '2026-10-26', 70, 8),
      record('d', '2026-10-27', 70, 8),
      record('e', '2026-10-27', 90, 12),
    ];
    const withoutMorning = excludePending(records, new Set(['d']));
    expect(labelsForDay(withoutMorning, '2026-10-27')).toEqual(['晨重']);
    expect(averageCaption(withoutMorning, '2026-10-27').headline).toBe('75.0');
    const withoutToday = excludePending(records, new Set(['d', 'e']));
    expect(averageCaption(withoutToday, '2026-10-27').headline).toBe('数据不足');
    expect(averageCaption(records, '2026-10-27').headline).toBe('70.0');
  });
});
