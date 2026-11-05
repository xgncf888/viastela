import {
  type ActiveTimerSession,
  DEFAULT_MASTERY_GOALS,
  type MasteryGoal,
  type TimeBlockCategory,
  type TimeBlockItem,
} from '@/core/time-block-tracker';

import { createPersistedStore } from './persisted-store';

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

const timeBlocksStore = createPersistedStore<TimeBlockItem[]>({
  key: BLOCKS_KEY,
  getDefault: () => [],
  normalize: (parsed) => {
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is TimeBlockItem =>
        Boolean(b && typeof b === 'object' && typeof b.id === 'string' && typeof b.localDay === 'string'),
    );
  },
});

const CLEAN_MASTERY_GOALS: MasteryGoal[] = DEFAULT_MASTERY_GOALS.map((g) => ({
  ...g,
  priorHours: 0,
}));

const masteryGoalsStore = createPersistedStore<MasteryGoal[]>({
  key: GOALS_KEY,
  getDefault: () => [...CLEAN_MASTERY_GOALS],
  normalize: (parsed) => {
    if (!Array.isArray(parsed) || parsed.length === 0) return [...CLEAN_MASTERY_GOALS];
    return parsed as MasteryGoal[];
  },
});

const activeTimerStore = createPersistedStore<ActiveTimerSession>({
  key: TIMER_KEY,
  getDefault: () => DEFAULT_TIMER,
  normalize: (parsed) => {
    if (!parsed || typeof parsed !== 'object') return DEFAULT_TIMER;
    return {
      ...DEFAULT_TIMER,
      ...(parsed as Partial<ActiveTimerSession>),
    };
  },
});

export function readTimeBlocks(): TimeBlockItem[] {
  return timeBlocksStore.read();
}

export function writeTimeBlocks(blocks: readonly TimeBlockItem[]): void {
  timeBlocksStore.write([...blocks]);
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

export function incrementOrAddTimeBlock(input: {
  localDay: string;
  deltaMinutes: number;
  category: TimeBlockCategory;
  title: string;
  goalId: string | null;
}): TimeBlockItem[] {
  const delta = Math.max(1, Math.round(input.deltaMinutes));
  const current = readTimeBlocks();
  const cleanTitle = input.title.trim() || '专注时间块';
  const existingIdx = current.findIndex(
    (b) => b.localDay === input.localDay && b.category === input.category && b.title === cleanTitle,
  );
  if (existingIdx >= 0) {
    const target = current[existingIdx]!;
    const nextDuration = Math.min(720, target.durationMinutes + delta);
    const nextEnd = Math.min(1440, target.startMinute + nextDuration);
    const nextStart = Math.max(0, nextEnd - nextDuration);
    const updated: TimeBlockItem = {
      ...target,
      startMinute: nextStart,
      endMinute: nextEnd,
      durationMinutes: nextDuration,
      recordedAt: new Date().toISOString(),
    };
    const next = [...current];
    next[existingIdx] = updated;
    writeTimeBlocks(next);
    return next;
  }
  const now = new Date();
  const nowMin = Math.max(15, Math.min(1440, now.getHours() * 60 + now.getMinutes()));
  const startMin = Math.max(0, nowMin - delta);
  return addTimeBlock({
    localDay: input.localDay,
    startMinute: startMin,
    endMinute: Math.max(startMin + 1, nowMin),
    category: input.category,
    title: cleanTitle,
    goalId: input.goalId,
  });
}

export function readMasteryGoals(): MasteryGoal[] {
  return masteryGoalsStore.read();
}

export function writeMasteryGoals(goals: readonly MasteryGoal[]): void {
  masteryGoalsStore.write([...goals]);
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
  return activeTimerStore.read();
}

export function writeActiveTimer(session: ActiveTimerSession): void {
  activeTimerStore.write(session);
}
