export type TimeBlockCategory = 'study' | 'fitness' | 'deep-work' | 'life' | 'rest';

export type TimeBlockItem = {
  id: string;
  localDay: string;
  startMinute: number; // 0 .. 1439
  endMinute: number; // 1 .. 1440
  durationMinutes: number;
  category: TimeBlockCategory;
  title: string;
  goalId: string | null;
  note: string | null;
  recordedAt: string;
};

export type MasteryGoal = {
  id: string;
  title: string;
  category: TimeBlockCategory;
  targetHours: number; // Default 10000 (10,000-Hour Rule)
  dailyTargetMinutes: number; // e.g. 60 or 120 minutes/day for check-in
  priorHours: number; // Historical accumulated hours before using the app
  createdAt: string;
};

export type ActiveTimerSession = {
  isRunning: boolean;
  startedAtMs: number | null;
  accumulatedSeconds: number;
  category: TimeBlockCategory;
  title: string;
  goalId: string | null;
};

export type HourSliceSegment = {
  startMinInHour: number; // 0 .. 59
  endMinInHour: number; // 1 .. 60
  block: TimeBlockItem;
};

export type HourRowModel = {
  hour: number; // 0 .. 23
  label: string; // "00:00" .. "23:00"
  occupiedMinutes: number;
  segments: HourSliceSegment[];
};

export type MasteryTier = {
  level: string;
  title: string;
  nextHours: number;
  progressPct: number;
};

export const TIME_BLOCK_CATEGORIES: readonly {
  id: TimeBlockCategory;
  label: string;
  shortLabel: string;
  tone: 'owner' | 'exec' | 'rev' | 'pod' | 'neutral';
}[] = [
  { id: 'study', label: '深度学习 / 10000h', shortLabel: '学习', tone: 'owner' },
  { id: 'fitness', label: '健身训练 / 体能', shortLabel: '健身', tone: 'exec' },
  { id: 'deep-work', label: '核心创造 / 研发', shortLabel: '创造', tone: 'rev' },
  { id: 'life', label: '日常节律 / 阅读', shortLabel: '日常', tone: 'pod' },
  { id: 'rest', label: '睡眠恢复 / 冥想', shortLabel: '恢复', tone: 'neutral' },
] as const;

export const DEFAULT_MASTERY_GOALS: readonly MasteryGoal[] = [
  {
    id: 'goal-ai-infra',
    title: 'AI Infra 与系统架构',
    category: 'study',
    targetHours: 10000,
    dailyTargetMinutes: 90,
    priorHours: 1240,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'goal-strength-athletics',
    title: '力量举与体能重塑',
    category: 'fitness',
    targetHours: 10000,
    dailyTargetMinutes: 45,
    priorHours: 680,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'goal-quant-investing',
    title: '宏观量化与深度研究',
    category: 'deep-work',
    targetHours: 10000,
    dailyTargetMinutes: 60,
    priorHours: 890,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
] as const;

export function formatMinuteOfDay(minute: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(minute)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseClockToMinute(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const h = Number.parseInt(match[1] ?? '', 10);
  const m = Number.parseInt(match[2] ?? '', 10);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 24 || m < 0 || m >= 60) {
    return null;
  }
  if (h === 24 && m > 0) return null;
  return h * 60 + m;
}

export function formatTimerClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Splits a full 24-hour day (1,440 minutes) into 24 hourly rows (`00:00` .. `23:00`),
 * slicing any cross-hour time blocks cleanly into exact minute segments (`0..60`) within each hour.
 */
export function build24HourMatrix(blocks: readonly TimeBlockItem[]): HourRowModel[] {
  const sorted = [...blocks].sort((a, b) => a.startMinute - b.startMinute);
  const rows: HourRowModel[] = [];

  for (let hour = 0; hour < 24; hour += 1) {
    const hourStart = hour * 60;
    const hourEnd = (hour + 1) * 60;
    const segments: HourSliceSegment[] = [];

    for (const block of sorted) {
      const overlapStart = Math.max(hourStart, block.startMinute);
      const overlapEnd = Math.min(hourEnd, block.endMinute);
      if (overlapEnd > overlapStart) {
        segments.push({
          startMinInHour: overlapStart - hourStart,
          endMinInHour: overlapEnd - hourStart,
          block,
        });
      }
    }

    const occupiedMinutes = Math.min(
      60,
      segments.reduce((sum, seg) => sum + (seg.endMinInHour - seg.startMinInHour), 0),
    );

    rows.push({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      occupiedMinutes,
      segments,
    });
  }

  return rows;
}

/**
 * Computes 10,000-Hour Mastery tier, total hours, and progress percentage.
 */
export function computeMasteryProgress(
  goal: MasteryGoal,
  allBlocks: readonly TimeBlockItem[],
  todayKey: string,
): {
  totalHours: number;
  loggedMinutesTotal: number;
  todayMinutes: number;
  checkedInToday: boolean;
  streakDays: number;
  tier: MasteryTier;
} {
  const goalBlocks = allBlocks.filter(
    (b) => b.goalId === goal.id || (b.goalId === null && b.category === goal.category && b.title === goal.title),
  );
  const loggedMinutesTotal = goalBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  const totalHours = Number((goal.priorHours + loggedMinutesTotal / 60).toFixed(1));
  const todayMinutes = goalBlocks
    .filter((b) => b.localDay === todayKey)
    .reduce((sum, b) => sum + b.durationMinutes, 0);
  const checkedInToday = todayMinutes >= goal.dailyTargetMinutes;

  const activeDays = new Set(goalBlocks.map((b) => b.localDay));
  const streakDays = activeDays.size + (goal.priorHours > 0 ? Math.min(30, Math.floor(goal.priorHours / 20)) : 0);

  const target = Math.max(100, goal.targetHours || 10000);
  const progressPct = Math.min(100, Number(((totalHours / target) * 100).toFixed(2)));

  let level = 'Lv.1 启程学徒';
  let nextHours = 100;
  if (totalHours >= 10000) {
    level = 'Lv.6 万时大师 (Master)';
    nextHours = 10000;
  } else if (totalHours >= 5000) {
    level = 'Lv.5 领域专家 (5000h+)';
    nextHours = 10000;
  } else if (totalHours >= 2500) {
    level = 'Lv.4 资深精进 (2500h+)';
    nextHours = 5000;
  } else if (totalHours >= 1000) {
    level = 'Lv.3 千时突破 (1000h+)';
    nextHours = 2500;
  } else if (totalHours >= 100) {
    level = 'Lv.2 百时筑基 (100h+)';
    nextHours = 1000;
  }

  return {
    totalHours,
    loggedMinutesTotal,
    todayMinutes,
    checkedInToday,
    streakDays,
    tier: {
      level,
      title: goal.title,
      nextHours,
      progressPct,
    },
  };
}
