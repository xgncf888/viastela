export type MilestoneCategory = 'love' | 'birthday' | 'career' | 'countdown' | 'life';

export type LifeMilestone = {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  targetDate: string;
  category: MilestoneCategory;
  /** Whether this repeats every year on MM-DD (e.g. birthday, wedding anniversary) */
  recurringAnnual: boolean;
  /** Optional preparation note, gift plan, or milestone reward */
  prepNote: string | null;
  createdAt: string;
};

export type MilestoneUrgency = 'today' | 'imminent' | 'upcoming' | 'calm';

export type MilestoneComputed = {
  item: LifeMilestone;
  /** Positive if targetDate is in the past (days elapsed since origin date) */
  elapsedDays: number;
  /** Days until the next occurrence (for recurringAnnual) or until targetDate (for one-off) */
  daysUntilNext: number;
  /** Next occurrence date YYYY-MM-DD */
  nextOccurrenceDay: string;
  /** Number of years on next occurrence (for recurringAnnual when origin is in the past) */
  anniversaryYears: number | null;
  /** Next special integer day milestone (e.g., 100, 365, 500, 520, 1000, 1314) for past events */
  nextIntegerMilestone: {
    milestoneDays: number;
    daysRemaining: number;
    milestoneDay: string;
  } | null;
  urgency: MilestoneUrgency;
  badgeText: string;
  subtitleText: string;
};

export type OkrCategory = 'health' | 'career' | 'wealth' | 'growth' | 'life';

export type OkrAutoLink = 'none' | 'study_hours' | 'workout_sets' | 'weight_kg';

export type OkrKeyResult = {
  id: string;
  title: string;
  startValue: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  /** Amount added/subtracted on one-tap check-in */
  stepDelta: number;
  autoLink: OkrAutoLink;
  lastCheckInDay: string | null;
};

export type OkrObjective = {
  id: string;
  period: string;
  title: string;
  category: OkrCategory;
  /** 1-10 confidence score */
  confidence: number;
  keyResults: OkrKeyResult[];
  createdAt: string;
};

export type HabitItem = {
  id: string;
  title: string;
  category: OkrCategory;
  /** Target days per week (1..7) */
  weeklyTargetDays: number;
  /** Sorted unique YYYY-MM-DD strings */
  completedDays: string[];
};

export const MILESTONE_CATEGORY_META: Record<
  MilestoneCategory,
  { label: string; tagTone: 'owner' | 'exec' | 'pod' }
> = {
  love: { label: '纪念日', tagTone: 'exec' },
  birthday: { label: '生日', tagTone: 'owner' },
  career: { label: '事业节点', tagTone: 'exec' },
  countdown: { label: '倒数日', tagTone: 'pod' },
  life: { label: '生活纪事', tagTone: 'owner' },
};

export const OKR_CATEGORY_META: Record<
  OkrCategory,
  { label: string; tagTone: 'owner' | 'exec' | 'pod' }
> = {
  health: { label: '身材与体能', tagTone: 'exec' },
  growth: { label: '认知与技能', tagTone: 'owner' },
  career: { label: '事业与产出', tagTone: 'pod' },
  wealth: { label: '资产与配置', tagTone: 'exec' },
  life: { label: '生活品质', tagTone: 'owner' },
};

const SPECIAL_INTEGER_DAYS = [
  30, 50, 99, 100, 200, 300, 365, 500, 520, 666, 730, 888, 1000, 1095, 1314, 1500, 1825, 2000,
  2500, 3000, 3650, 5000, 10000,
];

export const DEFAULT_LIFE_MILESTONES: readonly LifeMilestone[] = [
  {
    id: 'ms-viastela-journey',
    title: '开启数字化自律与身体管理',
    targetDate: '2026-01-01',
    category: 'life',
    recurringAnnual: true,
    prepNote: '复盘年度体脂、力量与 10000 小时投入进展',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ms-special-anniversary',
    title: '重要纪念日',
    targetDate: '2024-05-20',
    category: 'love',
    recurringAnnual: true,
    prepNote: '提前 7 天准备礼物与餐厅预订',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ms-year-end-sprint',
    title: '2026 年度收官复盘日',
    targetDate: '2026-12-31',
    category: 'countdown',
    recurringAnnual: false,
    prepNote: '完成 Q4 OKR 终审与年度资产净值盘点',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_OKR_OBJECTIVES: readonly OkrObjective[] = [
  {
    id: 'okr-body-recomp',
    period: '2026 Q4',
    title: 'O1 · 打造精益体态与高充沛精力基线',
    category: 'health',
    confidence: 8,
    createdAt: '2026-10-01T00:00:00.000Z',
    keyResults: [
      {
        id: 'kr-weight-target',
        title: 'KR1 · 晨起空腹体重稳定降至目标区间',
        startValue: 74.0,
        currentValue: 71.5,
        targetValue: 68.5,
        unit: 'kg',
        stepDelta: -0.2,
        autoLink: 'weight_kg',
        lastCheckInDay: null,
      },
      {
        id: 'kr-workout-sets',
        title: 'KR2 · 季度力量与有氧有效训练累计组数',
        startValue: 0,
        currentValue: 36,
        targetValue: 180,
        unit: '组',
        stepDelta: 4,
        autoLink: 'workout_sets',
        lastCheckInDay: null,
      },
    ],
  },
  {
    id: 'okr-deep-craft',
    period: '2026 Q4',
    title: 'O2 · AI 架构精进与复利资产体系建设',
    category: 'growth',
    confidence: 9,
    createdAt: '2026-10-01T00:00:00.000Z',
    keyResults: [
      {
        id: 'kr-deep-study',
        title: 'KR1 · 深度架构研发与学习投入时长',
        startValue: 0,
        currentValue: 24,
        targetValue: 120,
        unit: 'h',
        stepDelta: 1,
        autoLink: 'study_hours',
        lastCheckInDay: null,
      },
      {
        id: 'kr-output-notes',
        title: 'KR2 · 完成核心系统拆解与复盘产出',
        startValue: 0,
        currentValue: 5,
        targetValue: 12,
        unit: '篇',
        stepDelta: 1,
        autoLink: 'none',
        lastCheckInDay: null,
      },
    ],
  },
];

export const DEFAULT_HABITS: readonly HabitItem[] = [
  {
    id: 'habit-morning-weigh',
    title: '晨起空腹称重',
    category: 'health',
    weeklyTargetDays: 7,
    completedDays: [],
  },
  {
    id: 'habit-deep-work',
    title: '深度专注 ≥ 60m',
    category: 'growth',
    weeklyTargetDays: 6,
    completedDays: [],
  },
  {
    id: 'habit-training',
    title: '力量或有氧训练',
    category: 'health',
    weeklyTargetDays: 4,
    completedDays: [],
  },
  {
    id: 'habit-clean-diet',
    title: '控糖与高蛋白饮食',
    category: 'health',
    weeklyTargetDays: 6,
    completedDays: [],
  },
];

function parseUtcMidnightMs(localDay: string): number {
  const [y, m, d] = localDay.split('-').map((part) => Number(part));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0;
  return Date.UTC(y!, m! - 1, d!);
}

function formatUtcDay(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function diffDaysBetween(fromDay: string, toDay: string): number {
  const fromMs = parseUtcMidnightMs(fromDay);
  const toMs = parseUtcMidnightMs(toDay);
  return Math.round((toMs - fromMs) / 86_400_000);
}

export function addDaysToLocalDay(localDay: string, deltaDays: number): string {
  const ms = parseUtcMidnightMs(localDay) + deltaDays * 86_400_000;
  return formatUtcDay(ms);
}

function daysInGregorianMonth(year: number, month1To12: number): number {
  return new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
}

export function computeMilestoneStatus(
  milestone: LifeMilestone,
  todayLocalDay: string,
): MilestoneComputed {
  const elapsedDays = diffDaysBetween(milestone.targetDate, todayLocalDay);
  const [origY, origM, origD] = milestone.targetDate.split('-').map((n) => Number(n));
  const [curY] = todayLocalDay.split('-').map((n) => Number(n));

  let nextOccurrenceDay = milestone.targetDate;
  let daysUntilNext = diffDaysBetween(todayLocalDay, milestone.targetDate);
  let anniversaryYears: number | null = null;

  if (milestone.recurringAnnual && Number.isFinite(origM) && Number.isFinite(origD) && Number.isFinite(curY)) {
    const maxDayThisYear = daysInGregorianMonth(curY!, origM!);
    const clampedDThisYear = Math.min(origD!, maxDayThisYear);
    const candidateThisYear = `${curY}-${String(origM).padStart(2, '0')}-${String(clampedDThisYear).padStart(2, '0')}`;
    const diffThisYear = diffDaysBetween(todayLocalDay, candidateThisYear);

    if (diffThisYear >= 0) {
      nextOccurrenceDay = candidateThisYear;
      daysUntilNext = diffThisYear;
      if (Number.isFinite(origY) && curY! >= origY!) {
        anniversaryYears = curY! - origY!;
      }
    } else {
      const nextY = curY! + 1;
      const maxDayNextYear = daysInGregorianMonth(nextY, origM!);
      const clampedDNextYear = Math.min(origD!, maxDayNextYear);
      nextOccurrenceDay = `${nextY}-${String(origM).padStart(2, '0')}-${String(clampedDNextYear).padStart(2, '0')}`;
      daysUntilNext = diffDaysBetween(todayLocalDay, nextOccurrenceDay);
      if (Number.isFinite(origY) && nextY >= origY!) {
        anniversaryYears = nextY - origY!;
      }
    }
  }

  let nextIntegerMilestone: MilestoneComputed['nextIntegerMilestone'] = null;
  if (elapsedDays >= 0) {
    const found = SPECIAL_INTEGER_DAYS.find((d) => d >= elapsedDays);
    if (found !== undefined) {
      nextIntegerMilestone = {
        milestoneDays: found,
        daysRemaining: found - elapsedDays,
        milestoneDay: addDaysToLocalDay(milestone.targetDate, found),
      };
    }
  }

  const effectiveDaysUntil =
    milestone.recurringAnnual || daysUntilNext >= 0
      ? Math.max(0, daysUntilNext)
      : nextIntegerMilestone
        ? nextIntegerMilestone.daysRemaining
        : 999;

  const urgency: MilestoneUrgency =
    effectiveDaysUntil === 0
      ? 'today'
      : effectiveDaysUntil <= 7
        ? 'imminent'
        : effectiveDaysUntil <= 30
          ? 'upcoming'
          : 'calm';

  let badgeText = '';
  let subtitleText = '';

  if (milestone.recurringAnnual) {
    if (daysUntilNext === 0) {
      badgeText = anniversaryYears && anniversaryYears > 0 ? `今日 · ${anniversaryYears} 周年` : '就是今天';
    } else {
      badgeText = `还有 ${daysUntilNext} 天`;
    }
    if (elapsedDays >= 0) {
      const intHint =
        nextIntegerMilestone && nextIntegerMilestone.daysRemaining <= 30
          ? ` · 距 ${nextIntegerMilestone.milestoneDays} 天纪念还有 ${nextIntegerMilestone.daysRemaining} 天`
          : '';
      subtitleText = `已相伴 ${elapsedDays} 天 · 下次 ${nextOccurrenceDay}${
        anniversaryYears && anniversaryYears > 0 ? `（${anniversaryYears} 周年）` : ''
      }${intHint}`;
    } else {
      subtitleText = `目标日 ${milestone.targetDate}`;
    }
  } else {
    if (daysUntilNext > 0) {
      badgeText = `倒计时 ${daysUntilNext} 天`;
      subtitleText = `目标日 ${milestone.targetDate}`;
    } else if (daysUntilNext === 0) {
      badgeText = '今日到期';
      subtitleText = `目标日 ${milestone.targetDate}`;
    } else {
      badgeText = `已累计 ${elapsedDays} 天`;
      subtitleText = nextIntegerMilestone
        ? `起始于 ${milestone.targetDate} · 距 ${nextIntegerMilestone.milestoneDays} 天里程碑还有 ${nextIntegerMilestone.daysRemaining} 天`
        : `起始于 ${milestone.targetDate}`;
    }
  }

  return {
    item: milestone,
    elapsedDays,
    daysUntilNext,
    nextOccurrenceDay,
    anniversaryYears,
    nextIntegerMilestone,
    urgency,
    badgeText,
    subtitleText,
  };
}

export function sortMilestonesByUrgency(
  milestones: readonly LifeMilestone[],
  todayLocalDay: string,
): MilestoneComputed[] {
  return milestones
    .map((m) => computeMilestoneStatus(m, todayLocalDay))
    .sort((a, b) => {
      const aWait = a.daysUntilNext >= 0 ? a.daysUntilNext : (a.nextIntegerMilestone?.daysRemaining ?? 9999);
      const bWait = b.daysUntilNext >= 0 ? b.daysUntilNext : (b.nextIntegerMilestone?.daysRemaining ?? 9999);
      return aWait - bWait;
    });
}

export function computeKrProgressPct(kr: OkrKeyResult): number {
  const span = kr.targetValue - kr.startValue;
  if (Math.abs(span) < 1e-9) {
    return kr.currentValue >= kr.targetValue ? 100 : 0;
  }
  const raw = ((kr.currentValue - kr.startValue) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function computeObjectiveProgressPct(objective: OkrObjective): number {
  if (objective.keyResults.length === 0) return 0;
  const sum = objective.keyResults.reduce((acc, kr) => acc + computeKrProgressPct(kr), 0);
  return Math.round(sum / objective.keyResults.length);
}

export function syncOkrWithLiveMetrics(
  objectives: readonly OkrObjective[],
  live: {
    latestWeightKg?: number | null;
    totalWorkoutSets?: number | null;
    totalStudyHours?: number | null;
  },
): OkrObjective[] {
  return objectives.map((obj) => ({
    ...obj,
    keyResults: obj.keyResults.map((kr) => {
      if (kr.autoLink === 'weight_kg' && typeof live.latestWeightKg === 'number' && live.latestWeightKg > 0) {
        return { ...kr, currentValue: Number(live.latestWeightKg.toFixed(1)) };
      }
      if (
        kr.autoLink === 'workout_sets' &&
        typeof live.totalWorkoutSets === 'number' &&
        live.totalWorkoutSets > kr.currentValue
      ) {
        return { ...kr, currentValue: live.totalWorkoutSets };
      }
      if (
        kr.autoLink === 'study_hours' &&
        typeof live.totalStudyHours === 'number' &&
        live.totalStudyHours > kr.currentValue
      ) {
        return { ...kr, currentValue: Number(live.totalStudyHours.toFixed(1)) };
      }
      return kr;
    }),
  }));
}

export function computeHabitStreak(habit: HabitItem, todayLocalDay: string): {
  streakDays: number;
  completedToday: boolean;
  last7DaysCount: number;
  last7DaysFlags: { localDay: string; completed: boolean }[];
} {
  const set = new Set(habit.completedDays);
  const completedToday = set.has(todayLocalDay);

  let streakDays = 0;
  let cursor = completedToday ? todayLocalDay : addDaysToLocalDay(todayLocalDay, -1);
  while (set.has(cursor)) {
    streakDays += 1;
    cursor = addDaysToLocalDay(cursor, -1);
  }

  const last7DaysFlags = Array.from({ length: 7 }, (_, idx) => {
    const dayKey = addDaysToLocalDay(todayLocalDay, -(6 - idx));
    return {
      localDay: dayKey,
      completed: set.has(dayKey),
    };
  });
  const last7DaysCount = last7DaysFlags.filter((d) => d.completed).length;

  return {
    streakDays,
    completedToday,
    last7DaysCount,
    last7DaysFlags,
  };
}
