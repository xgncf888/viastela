import { describe, expect, test } from '@jest/globals';

import {
  buildLifeHeatmapGrid,
  computeBodyFocusCorrelation,
  computeTimeCapsuleStatus,
  formatMenuBarCapsuleTitle,
  type TimeCapsuleItem,
} from './life-gamification';
import { type TimeBlockItem } from './time-block-tracker';

describe('life-gamification core logic', () => {
  test('seals future time capsules and unlocks due time capsules', () => {
    const futureCap: TimeCapsuleItem = {
      id: 'c1',
      title: '给明年的信',
      recipientLabel: '未来的自己',
      message: '保持热爱',
      createdDay: '2026-11-02',
      unlockDay: '2027-05-20',
      openedAt: null,
    };
    const sealed = computeTimeCapsuleStatus(futureCap, '2026-11-02');
    expect(sealed.isUnlocked).toBe(false);
    expect(sealed.daysUntilUnlock).toBeGreaterThan(100);
    expect(sealed.statusBadge).toContain('封印中');

    const due = computeTimeCapsuleStatus(futureCap, '2027-05-20');
    expect(due.isUnlocked).toBe(true);
    expect(due.daysUntilUnlock).toBe(0);
    expect(due.statusBadge).toContain('已解锁');
  });

  test('builds 365-day style life heatmap grid and computes intensity levels', () => {
    const weightDays = new Set(['2026-11-01', '2026-11-02']);
    const trainingMap = new Map([['2026-11-02', 4]]);
    const studyMap = new Map([
      ['2026-11-01', 45],
      ['2026-11-02', 120],
    ]);
    const habitMap = new Map([['2026-11-02', 3]]);

    const grid = buildLifeHeatmapGrid({
      endDay: '2026-11-02',
      totalDays: 28,
      weightDays,
      trainingCountByDay: trainingMap,
      studyMinutesByDay: studyMap,
      habitCountByDay: habitMap,
    });

    expect(grid.cells).toHaveLength(28);
    expect(grid.activeDaysCount).toBe(2);
    expect(grid.perfectDaysCount).toBe(1);
    const lastCell = grid.cells[grid.cells.length - 1]!;
    expect(lastCell.localDay).toBe('2026-11-02');
    expect(lastCell.level).toBe(4);
  });

  test('computes body x focus correlation and golden focus hour from time blocks', () => {
    const weightDays = new Set(['2026-11-01', '2026-11-02']);
    const trainingMap = new Map([['2026-11-02', 3]]);
    const studyMap = new Map([
      ['2026-11-01', 60],
      ['2026-11-02', 120],
    ]);
    const timeBlocks: TimeBlockItem[] = [
      {
        id: 'tb-1',
        localDay: '2026-11-02',
        startMinute: 9 * 60,
        endMinute: 11 * 60,
        durationMinutes: 120,
        category: 'study',
        title: 'AI 架构研发',
        goalId: 'goal-1',
        note: null,
        recordedAt: '2026-11-02T11:00:00Z',
      },
    ];

    const corr = computeBodyFocusCorrelation({
      endDay: '2026-11-02',
      windowDays: 14,
      weightDays,
      trainingCountByDay: trainingMap,
      studyMinutesByDay: studyMap,
      timeBlocks,
    });

    expect(corr.avgFocusOnTrainingDayMins).toBe(120);
    expect(corr.avgFocusOnRestDayMins).toBe(60);
    expect(corr.trainingFocusBoostPct).toBe(100);
    expect(corr.goldenHourLabel).toBe('09:00–11:00');
  });

  test('formats macOS menu bar capsule status text cleanly', () => {
    const runningText = formatMenuBarCapsuleTitle({
      timerRunning: true,
      timerTitle: 'AI架构论文',
      timerElapsedSeconds: 125,
      nearestMilestoneTitle: '重要纪念日',
      nearestMilestoneDays: 5,
      wishVaultCny: 500,
    });
    expect(runningText).toBe('⏱ AI架构论文 02:05 · 重要纪念日 5d');
  });
});
