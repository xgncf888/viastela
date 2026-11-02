import { describe, expect, it } from '@jest/globals';

import {
  build24HourMatrix,
  build60MinuteLoupeCells,
  computeMasteryProgress,
  computeMinuteFromPointerRatio,
  DEFAULT_MASTERY_GOALS,
  formatMinuteOfDay,
  formatTimerClock,
  normalizeDragMinuteRange,
  nudgeMinuteRange,
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

  it('computes 1-minute and snapped minutes from pointer ratios and normalizes drag ranges', () => {
    // 09:00 + 23/60 => 09:23 (563)
    expect(computeMinuteFromPointerRatio(9, 23 / 60, 1)).toBe(9 * 60 + 23);
    // 5-minute snap: 23 rounds to 25 => 09:25
    expect(computeMinuteFromPointerRatio(9, 23 / 60, 5)).toBe(9 * 60 + 25);
    // Reverse drag (dragging right-to-left) normalizes cleanly
    const reversed = normalizeDragMinuteRange(10 * 60 + 42, 9 * 60 + 13, 1);
    expect(reversed).toEqual({
      startMinute: 9 * 60 + 13,
      endMinute: 10 * 60 + 42,
      durationMinutes: 89,
    });
    // Zero-length tap expands to 1-minute minimum span
    const singleMin = normalizeDragMinuteRange(540, 540, 1);
    expect(singleMin).toEqual({
      startMinute: 540,
      endMinute: 541,
      durationMinutes: 1,
    });
  });

  it('nudges start, end, and whole range with 1-minute mobile steppers', () => {
    const startNudged = nudgeMinuteRange(540, 600, 'start', -7);
    expect(startNudged).toEqual({
      startMinute: 533,
      endMinute: 600,
      durationMinutes: 67,
    });
    const endNudged = nudgeMinuteRange(533, 600, 'end', 12);
    expect(endNudged).toEqual({
      startMinute: 533,
      endMinute: 612,
      durationMinutes: 79,
    });
    const shifted = nudgeMinuteRange(533, 612, 'both', 15);
    expect(shifted).toEqual({
      startMinute: 548,
      endMinute: 627,
      durationMinutes: 79,
    });
  });

  it('builds 60 individual 1-minute loupe cells for an hour with selection markers', () => {
    const cells = build60MinuteLoupeCells(9, [], {
      startMinute: 9 * 60 + 7,
      endMinute: 9 * 60 + 43,
    });
    expect(cells).toHaveLength(60);
    expect(cells[7]?.clockLabel).toBe('09:07');
    expect(cells[7]?.isSelected).toBe(true);
    expect(cells[7]?.isSelectionStart).toBe(true);
    expect(cells[42]?.clockLabel).toBe('09:42');
    expect(cells[42]?.isSelected).toBe(true);
    expect(cells[42]?.isSelectionEnd).toBe(true);
    expect(cells[43]?.isSelected).toBe(false);
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
