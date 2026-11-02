import { describe, expect, test } from '@jest/globals';

import {
  computeHabitStreak,
  computeKrProgressPct,
  computeMilestoneStatus,
  computeObjectiveProgressPct,
  diffDaysBetween,
  type HabitItem,
  type LifeMilestone,
  type OkrObjective,
  sortMilestonesByUrgency,
  syncOkrWithLiveMetrics,
} from './life-milestones-okr';

describe('life-milestones-okr core logic', () => {
  test('computes recurring annual anniversary countdown and elapsed days', () => {
    const milestone: LifeMilestone = {
      id: 'ms-1',
      title: '恋爱纪念日',
      targetDate: '2024-05-20',
      category: 'love',
      recurringAnnual: true,
      prepNote: '预订晚餐',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const statusBefore = computeMilestoneStatus(milestone, '2026-05-15');
    expect(statusBefore.daysUntilNext).toBe(5);
    expect(statusBefore.anniversaryYears).toBe(2);
    expect(statusBefore.urgency).toBe('imminent');
    expect(statusBefore.badgeText).toBe('还有 5 天');

    const statusOnDay = computeMilestoneStatus(milestone, '2026-05-20');
    expect(statusOnDay.daysUntilNext).toBe(0);
    expect(statusOnDay.urgency).toBe('today');
    expect(statusOnDay.badgeText).toContain('2 周年');
  });

  test('computes one-off countdown and next integer milestone for past events', () => {
    const futureEvent: LifeMilestone = {
      id: 'ms-future',
      title: '马拉松比赛日',
      targetDate: '2026-11-10',
      category: 'countdown',
      recurringAnnual: false,
      prepNote: null,
      createdAt: '2026-11-01T00:00:00.000Z',
    };
    const fStatus = computeMilestoneStatus(futureEvent, '2026-11-02');
    expect(fStatus.daysUntilNext).toBe(8);
    expect(fStatus.badgeText).toBe('倒计时 8 天');

    const pastEvent: LifeMilestone = {
      id: 'ms-past',
      title: '戒糖挑战起始日',
      targetDate: '2026-08-01',
      category: 'life',
      recurringAnnual: false,
      prepNote: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    };
    const pStatus = computeMilestoneStatus(pastEvent, '2026-11-02');
    expect(pStatus.elapsedDays).toBe(diffDaysBetween('2026-08-01', '2026-11-02'));
    expect(pStatus.nextIntegerMilestone?.milestoneDays).toBe(99);
  });

  test('sorts milestones by urgency', () => {
    const list: LifeMilestone[] = [
      {
        id: 'far',
        title: '远期目标',
        targetDate: '2026-12-31',
        category: 'countdown',
        recurringAnnual: false,
        prepNote: null,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'near',
        title: '近期生日',
        targetDate: '1998-11-05',
        category: 'birthday',
        recurringAnnual: true,
        prepNote: null,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];
    const sorted = sortMilestonesByUrgency(list, '2026-11-02');
    expect(sorted[0]?.item.id).toBe('near');
  });

  test('computes OKR key result and objective completion for increasing and decreasing targets', () => {
    const obj: OkrObjective = {
      id: 'o1',
      period: '2026 Q4',
      title: '减脂与训练',
      category: 'health',
      confidence: 8,
      createdAt: '2026-10-01T00:00:00Z',
      keyResults: [
        {
          id: 'kr-weight',
          title: '体重下降',
          startValue: 75,
          currentValue: 71.5,
          targetValue: 68,
          unit: 'kg',
          stepDelta: -0.5,
          autoLink: 'weight_kg',
          lastCheckInDay: null,
        },
        {
          id: 'kr-sets',
          title: '训练组数',
          startValue: 0,
          currentValue: 75,
          targetValue: 100,
          unit: '组',
          stepDelta: 5,
          autoLink: 'workout_sets',
          lastCheckInDay: null,
        },
      ],
    };

    expect(computeKrProgressPct(obj.keyResults[0]!)).toBe(50);
    expect(computeKrProgressPct(obj.keyResults[1]!)).toBe(75);
    expect(computeObjectiveProgressPct(obj)).toBe(63);

    const synced = syncOkrWithLiveMetrics([obj], {
      latestWeightKg: 68.0,
      totalWorkoutSets: 90,
    });
    expect(computeKrProgressPct(synced[0]!.keyResults[0]!)).toBe(100);
    expect(computeKrProgressPct(synced[0]!.keyResults[1]!)).toBe(90);
  });

  test('computes habit streak and 7-day completion flags', () => {
    const habit: HabitItem = {
      id: 'h1',
      title: '晨重打卡',
      category: 'health',
      weeklyTargetDays: 7,
      completedDays: ['2026-10-31', '2026-11-01', '2026-11-02'],
    };
    const stats = computeHabitStreak(habit, '2026-11-02');
    expect(stats.completedToday).toBe(true);
    expect(stats.streakDays).toBe(3);
    expect(stats.last7DaysCount).toBe(3);
    expect(stats.last7DaysFlags).toHaveLength(7);
  });
});
