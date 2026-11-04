import {
  DEFAULT_HABITS,
  DEFAULT_LIFE_MILESTONES,
  DEFAULT_OKR_OBJECTIVES,
  type HabitItem,
  type LifeMilestone,
  type MilestoneCategory,
  type OkrAutoLink,
  type OkrCategory,
  type OkrObjective,
} from '@/core/life-milestones-okr';

import { createPersistedStore, createPersistedStoreBus, type PersistedStoreListener } from './persisted-store';

const MILESTONES_KEY = 'viastela.life_milestones.v1';
const OKR_KEY = 'viastela.okr_objectives.v1';
const HABITS_KEY = 'viastela.daily_habits.v1';

const lifeOkrBus = createPersistedStoreBus();

export function subscribeLifeOkrStore(listener: PersistedStoreListener): () => void {
  return lifeOkrBus.subscribe(listener);
}

const milestonesStore = createPersistedStore<LifeMilestone[]>({
  key: MILESTONES_KEY,
  bus: lifeOkrBus,
  getDefault: () => [...DEFAULT_LIFE_MILESTONES],
  normalize: (parsed) => {
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_LIFE_MILESTONES];
    return parsed as LifeMilestone[];
  },
});

const okrStore = createPersistedStore<OkrObjective[]>({
  key: OKR_KEY,
  bus: lifeOkrBus,
  getDefault: () => [...DEFAULT_OKR_OBJECTIVES],
  normalize: (parsed) => {
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_OKR_OBJECTIVES];
    return parsed as OkrObjective[];
  },
});

const habitsStore = createPersistedStore<HabitItem[]>({
  key: HABITS_KEY,
  bus: lifeOkrBus,
  getDefault: () => [...DEFAULT_HABITS],
  normalize: (parsed) => {
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_HABITS];
    return parsed as HabitItem[];
  },
});

export function readLifeMilestones(): LifeMilestone[] {
  return milestonesStore.read();
}

export function writeLifeMilestones(items: readonly LifeMilestone[]): void {
  milestonesStore.write([...items]);
}

export function addLifeMilestone(input: {
  title: string;
  targetDate: string;
  category: MilestoneCategory;
  recurringAnnual: boolean;
  prepNote?: string | null;
}): LifeMilestone[] {
  const cleanTitle = input.title.trim();
  if (!cleanTitle || !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate.trim())) {
    return readLifeMilestones();
  }
  const item: LifeMilestone = {
    id: `ms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: cleanTitle,
    targetDate: input.targetDate.trim(),
    category: input.category,
    recurringAnnual: input.recurringAnnual,
    prepNote: input.prepNote?.trim() || null,
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...readLifeMilestones()];
  writeLifeMilestones(next);
  return next;
}

export function removeLifeMilestone(id: string): LifeMilestone[] {
  const next = readLifeMilestones().filter((item) => item.id !== id);
  writeLifeMilestones(next);
  return next;
}

export function readOkrObjectives(): OkrObjective[] {
  return okrStore.read();
}

export function writeOkrObjectives(items: readonly OkrObjective[]): void {
  okrStore.write([...items]);
}

export function checkInKeyResult(
  objectiveId: string,
  krId: string,
  delta: number,
  localDay: string,
): OkrObjective[] {
  const next = readOkrObjectives().map((obj) => {
    if (obj.id !== objectiveId) return obj;
    return {
      ...obj,
      keyResults: obj.keyResults.map((kr) => {
        if (kr.id !== krId) return kr;
        const updatedValue = Number((kr.currentValue + delta).toFixed(2));
        return {
          ...kr,
          currentValue: updatedValue,
          lastCheckInDay: localDay,
        };
      }),
    };
  });
  writeOkrObjectives(next);
  return next;
}

export function addOkrObjective(input: {
  period?: string;
  title: string;
  category: OkrCategory;
  krTitle: string;
  targetValue: number;
  unit: string;
  startValue?: number;
  stepDelta?: number;
  autoLink?: OkrAutoLink;
}): OkrObjective[] {
  const cleanTitle = input.title.trim();
  const cleanKr = input.krTitle.trim();
  if (!cleanTitle || !cleanKr) return readOkrObjectives();

  const startVal = input.startValue ?? 0;
  const targetVal = Number.isFinite(input.targetValue) ? input.targetValue : 100;
  const step =
    input.stepDelta ?? (targetVal < startVal ? -0.5 : Math.max(1, Math.round((targetVal - startVal) / 20)));

  const newObj: OkrObjective = {
    id: `okr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    period: input.period?.trim() || '2026 Q4',
    title: cleanTitle,
    category: input.category,
    confidence: 8,
    createdAt: new Date().toISOString(),
    keyResults: [
      {
        id: `kr-${Date.now()}-1`,
        title: cleanKr,
        startValue: startVal,
        currentValue: startVal,
        targetValue: targetVal,
        unit: input.unit.trim() || '次',
        stepDelta: step,
        autoLink: input.autoLink ?? 'none',
        lastCheckInDay: null,
      },
    ],
  };
  const next = [newObj, ...readOkrObjectives()];
  writeOkrObjectives(next);
  return next;
}

export function addKeyResultToObjective(
  objectiveId: string,
  input: {
    title: string;
    startValue?: number;
    targetValue: number;
    unit: string;
    stepDelta?: number;
    autoLink?: OkrAutoLink;
  },
): OkrObjective[] {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) return readOkrObjectives();
  const startVal = input.startValue ?? 0;
  const targetVal = Number.isFinite(input.targetValue) ? input.targetValue : 10;
  const step = input.stepDelta ?? (targetVal < startVal ? -0.5 : 1);

  const next = readOkrObjectives().map((obj) => {
    if (obj.id !== objectiveId) return obj;
    return {
      ...obj,
      keyResults: [
        ...obj.keyResults,
        {
          id: `kr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          title: cleanTitle,
          startValue: startVal,
          currentValue: startVal,
          targetValue: targetVal,
          unit: input.unit.trim() || '次',
          stepDelta: step,
          autoLink: input.autoLink ?? 'none',
          lastCheckInDay: null,
        },
      ],
    };
  });
  writeOkrObjectives(next);
  return next;
}

export function removeOkrObjective(id: string): OkrObjective[] {
  const next = readOkrObjectives().filter((item) => item.id !== id);
  writeOkrObjectives(next);
  return next;
}

export function readDailyHabits(): HabitItem[] {
  return habitsStore.read();
}

export function writeDailyHabits(items: readonly HabitItem[]): void {
  habitsStore.write([...items]);
}

export function toggleHabitDay(habitId: string, localDay: string): HabitItem[] {
  const next = readDailyHabits().map((habit) => {
    if (habit.id !== habitId) return habit;
    const exists = habit.completedDays.includes(localDay);
    const updatedDays = exists
      ? habit.completedDays.filter((d) => d !== localDay)
      : [...habit.completedDays, localDay].sort();
    return {
      ...habit,
      completedDays: updatedDays,
    };
  });
  writeDailyHabits(next);
  return next;
}

export function addDailyHabit(input: {
  title: string;
  category: OkrCategory;
  weeklyTargetDays?: number;
}): HabitItem[] {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) return readDailyHabits();
  const nextHabit: HabitItem = {
    id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    title: cleanTitle,
    category: input.category,
    weeklyTargetDays: Math.max(1, Math.min(7, input.weeklyTargetDays ?? 7)),
    completedDays: [],
  };
  const next = [...readDailyHabits(), nextHabit];
  writeDailyHabits(next);
  return next;
}
