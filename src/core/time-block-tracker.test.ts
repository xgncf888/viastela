import { describe, expect, it } from '@jest/globals';

import {
  build24HourMatrix,
  computeMasteryProgress,
  DEFAULT_MASTERY_GOALS,
  formatMinuteOfDay,
  formatTimerClock,
  parseClockToMinute,
  type TimeBlockItem,
} from './time-block-tracker';

describe('time-block-tracker core', () => {
  it('formats and parses clock minutes accurately across 00:00..24:00', () => {
    expect(formatMinuteOfDay(0)).toBe('00:00');
    expect(formatMinuteOfDay(570)).toBe('09:30');
    expect(formatMinuteOfDay(1440)).toBe('24:00');
    expect(parseClockToMinute('09:30')).toBe(570);
    expect(parseClockToMinute('24:00')).toBe(1440);
    expect(parseClockToMinute('25:00')).toBeNull();
    expect(formatTimerClock(3665)).toBe('01:01:05');
  });

  it('slices cross-hour time blocks into 24 exact hourly minute rows', () => {
    const blocks: TimeBlockItem[] = [
      {
        id: 'b-1',
        localDay: '2026-11-02',
        startMinute: 9 * 60 + 30, // 09:30
        endMinute: 11 * 60 + 15, // 11:15 (105 mins across hours 9, 10, 11)
        durationMinutes: 105,
        category: 'study',
        title: 'AI Infra 架构精读',
        goalId: 'goal-ai-infra',
        note: null,
        recordedAt: '2026-11-02T11:15:00.000Z',
      },
    ];
    const matrix = build24HourMatrix(blocks);
    expect(matrix).toHaveLength(24);
    expect(matrix[9]?.occupiedMinutes).toBe(30);
    expect(matrix[9]?.segments[0]?.startMinInHour).toBe(30);
    expect(matrix[9]?.segments[0]?.endMinInHour).toBe(60);
    expect(matrix[10]?.occupiedMinutes).toBe(60);
    expect(matrix[11]?.occupiedMinutes).toBe(15);
  });

  it('computes 10,000-hour mastery progress and daily check-in status', () => {
    const goal = DEFAULT_MASTERY_GOALS[0]!;
    const blocks: TimeBlockItem[] = [
      {
        id: 'b-2',
        localDay: '2026-11-02',
        startMinute: 600,
        endMinute: 720,
        durationMinutes: 120,
        category: 'study',
        title: goal.title,
        goalId: goal.id,
        note: '完成 2 小时深度精进',
        recordedAt: '2026-11-02T12:00:00.000Z',
      },
    ];
    const progress = computeMasteryProgress(goal, blocks, '2026-11-02');
    expect(progress.totalHours).toBe(1242);
    expect(progress.todayMinutes).toBe(120);
    expect(progress.checkedInToday).toBe(true);
    expect(progress.tier.level).toContain('Lv.3');
  });
});
