import {
  type ActiveTimerSession,
  DEFAULT_MASTERY_GOALS,
  type MasteryGoal,
  type TimeBlockCategory,
  type TimeBlockItem,
} from '@/core/time-block-tracker';

const BLOCKS_KEY = 'viastela.timeblocks.v1';
const GOALS_KEY = 'viastela.mastery_goals.v1';
const TIMER_KEY = 'viastela.active_timer.v1';

const DEFAULT_TIMER: ActiveTimerSession = {
  isRunning: false,
  startedAtMs: null,
  accumulatedSeconds: 0,
  category: 'study',
  title: 'AI Infra 与系统架构',
  goalId: 'goal-ai-infra',
};

export function readTimeBlocks(): TimeBlockItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(BLOCKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is TimeBlockItem =>
        Boolean(b && typeof b === 'object' && typeof b.id === 'string' && typeof b.localDay === 'string'),
    );
  } catch {
    return [];
  }
}

export function writeTimeBlocks(blocks: readonly TimeBlockItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks));
    }
  } catch {
    // Ignore storage error
  }
}

export function addTimeBlock(input: {
  localDay: string;
  startMinute: number;
  endMinute: number;
  category: TimeBlockCategory;
  title: string;
  goalId: string | null;
  note?: string | null;
}): TimeBlockItem[] {
  const start = Math.max(0, Math.min(1439, Math.round(input.startMinute)));
  const end = Math.max(start + 1, Math.min(1440, Math.round(input.endMinute)));
  const item: TimeBlockItem = {
    id: `tb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    localDay: input.localDay,
    startMinute: start,
    endMinute: end,
    durationMinutes: end - start,
    category: input.category,
    title: input.title.trim() || '专注时间块',
    goalId: input.goalId,
    note: input.note?.trim() || null,
    recordedAt: new Date().toISOString(),
  };
  const next = [...readTimeBlocks(), item];
  writeTimeBlocks(next);
  return next;
}

export function removeTimeBlock(id: string): TimeBlockItem[] {
  const next = readTimeBlocks().filter((b) => b.id !== id);
  writeTimeBlocks(next);
  return next;
}

export function readMasteryGoals(): MasteryGoal[] {
  try {
    if (typeof localStorage === 'undefined') return [...DEFAULT_MASTERY_GOALS];
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return [...DEFAULT_MASTERY_GOALS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_MASTERY_GOALS];
    return parsed as MasteryGoal[];
  } catch {
    return [...DEFAULT_MASTERY_GOALS];
  }
}

export function writeMasteryGoals(goals: readonly MasteryGoal[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    }
  } catch {
    // Ignore storage error
  }
}

export function addMasteryGoal(input: {
  title: string;
  category: TimeBlockCategory;
  targetHours?: number;
  dailyTargetMinutes?: number;
  priorHours?: number;
}): MasteryGoal[] {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) return readMasteryGoals();
  const nextGoal: MasteryGoal = {
    id: `goal-${Date.now()}`,
    title: cleanTitle,
    category: input.category,
    targetHours: Math.max(10, input.targetHours ?? 10000),
    dailyTargetMinutes: Math.max(5, input.dailyTargetMinutes ?? 60),
    priorHours: Math.max(0, input.priorHours ?? 0),
    createdAt: new Date().toISOString(),
  };
  const next = [...readMasteryGoals(), nextGoal];
  writeMasteryGoals(next);
  return next;
}

export function removeMasteryGoal(id: string): MasteryGoal[] {
  const next = readMasteryGoals().filter((g) => g.id !== id);
  writeMasteryGoals(next);
  return next;
}

export function readActiveTimer(): ActiveTimerSession {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_TIMER;
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return DEFAULT_TIMER;
    const parsed = JSON.parse(raw) as Partial<ActiveTimerSession>;
    return {
      ...DEFAULT_TIMER,
      ...parsed,
    };
  } catch {
    return DEFAULT_TIMER;
  }
}

export function writeActiveTimer(session: ActiveTimerSession): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TIMER_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage error
  }
}
