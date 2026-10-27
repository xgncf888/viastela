import { formatMonthDay } from './local-day';
import { parseWeightKg } from './weight-input';
import { formatKg } from './weight-stats';

export const BAND_LEVELS = ['light', 'medium', 'heavy', 'extra_heavy'] as const;

export type BandLevel = (typeof BAND_LEVELS)[number];

export const BAND_LABEL: Record<BandLevel, string> = {
  light: '轻',
  medium: '中',
  heavy: '重',
  extra_heavy: '加重',
};

export function bandLabel(level: string | null): string {
  if (level && (BAND_LEVELS as readonly string[]).includes(level)) return BAND_LABEL[level as BandLevel];
  return level ?? '';
}

export type TrainingMode = 'weight' | 'band';

export type TrainingField = 'exercise' | 'reps' | 'weight' | 'band';

export type RecentExerciseRow = {
  exercise: string;
  recordedAt: string;
};

export type TrainingSet = {
  id: string;
  exercise: string;
  reps: number;
  weightKg: number | null;
  bandLevel: string | null;
  recordedAt: string;
  tz: string;
  localDay: string;
  updatedAt: string;
};

export type TrainingDraft =
  | {
      ok: true;
      exercise: string;
      reps: number;
      weightKg: number | null;
      bandLevel: string | null;
    }
  | { ok: false; field: TrainingField; error: string };

export function parseTrainingDraft(input: {
  exercise: string;
  reps: string;
  mode: TrainingMode;
  weight: string;
  bandLevel: string;
}): TrainingDraft {
  const exercise = input.exercise.trim();
  if (exercise.length < 1 || exercise.length > 40) {
    return { ok: false, field: 'exercise', error: '动作请写 1 到 40 个字' };
  }
  if (!/^\d{1,3}$/.test(input.reps.trim())) {
    return { ok: false, field: 'reps', error: '次数要是 1 到 999 的整数' };
  }
  const reps = Number(input.reps.trim());
  if (!Number.isInteger(reps) || reps < 1 || reps > 999) {
    return { ok: false, field: 'reps', error: '次数要是 1 到 999 的整数' };
  }
  if (input.mode === 'weight') {
    const weightKg = parseWeightKg(input.weight);
    if (weightKg === null) {
      return { ok: false, field: 'weight', error: '请输入大于 0、小于 500 的重量' };
    }
    return { ok: true, exercise, reps, weightKg, bandLevel: null };
  }
  const bandLevel = input.bandLevel.trim();
  if (!BAND_LEVELS.includes(bandLevel as BandLevel)) {
    return { ok: false, field: 'band', error: '请选择弹力带' };
  }
  return { ok: true, exercise, reps, weightKg: null, bandLevel };
}

/** Kilograms for a set. `formatKg`, then drop a trailing `.0`, so 40 is `40` and the row reads `40 kg`. */
export function formatTrainingKg(weightKg: number): string {
  const text = formatKg(weightKg);
  return text.endsWith('.0') ? text.slice(0, -2) : text;
}

export function formatTrainingLoad(set: Pick<TrainingSet, 'weightKg' | 'bandLevel'>): string {
  if (set.weightKg != null) return `${formatTrainingKg(set.weightKg)} kg`;
  return `弹力带 ${bandLabel(set.bandLevel)}`;
}

export function trainingSetsOnDay(sets: readonly TrainingSet[], localDay: string): TrainingSet[] {
  return sets
    .filter((set) => set.localDay === localDay)
    .sort((left, right) => {
      const byTime = Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
      if (byTime !== 0) return byTime;
      return left.id.localeCompare(right.id);
    });
}

export function trainingDaySummary(sets: readonly Pick<TrainingSet, 'exercise'>[]): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const set of sets) {
    if (!counts.has(set.exercise)) {
      order.push(set.exercise);
      counts.set(set.exercise, 0);
    }
    counts.set(set.exercise, (counts.get(set.exercise) ?? 0) + 1);
  }
  return order.map((name) => `${name} ${counts.get(name)} 组`).join(' · ');
}

/** Shown when the person has no training history yet. */
export const HOME_EXERCISES = ['哑铃卧推', '单臂划船', '肩推', '深蹲', '弹力带面拉', '俯卧撑'] as const;

/** Recent names when any exist. Otherwise the built-in home exercises. */
export function exerciseChoices(recent: readonly string[]): readonly string[] {
  return recent.length > 0 ? recent : HOME_EXERCISES;
}

export type TrainingFormFields = {
  exercise: string;
  reps: string;
  mode: TrainingMode;
  weight: string;
  bandLevel: string;
};

export const BLANK_TRAINING_FORM: TrainingFormFields = {
  exercise: '',
  reps: '',
  mode: 'weight',
  weight: '',
  bandLevel: '',
};

function sameTrainingLoad(current: TrainingFormFields, baseline: TrainingFormFields): boolean {
  return (
    current.reps.trim() === baseline.reps.trim() &&
    current.mode === baseline.mode &&
    current.weight.trim() === baseline.weight.trim() &&
    current.bandLevel.trim() === baseline.bandLevel.trim()
  );
}

/**
 * Unsaved means a load field changed.
 * A blank form, an exercise with no load, and an unchanged +1 组 prefill are clean.
 */
export function trainingFormHasUnsavedEdits(current: TrainingFormFields, baseline: TrainingFormFields): boolean {
  if (sameTrainingLoad(current, baseline)) {
    const baselineHasLoad =
      baseline.reps.trim() !== '' ||
      baseline.weight.trim() !== '' ||
      baseline.bandLevel.trim() !== '' ||
      baseline.mode !== 'weight';
    if (!baselineHasLoad) return false;
  }
  return current.exercise.trim() !== baseline.exercise.trim() || !sameTrainingLoad(current, baseline);
}

export function recentExerciseNames(rows: readonly RecentExerciseRow[], limit = 6): string[] {
  const ordered = [...rows].sort((left, right) => {
    const byTime = Date.parse(right.recordedAt) - Date.parse(left.recordedAt);
    if (byTime !== 0) return byTime;
    return left.exercise.localeCompare(right.exercise);
  });
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of ordered) {
    const name = row.exercise.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length === limit) break;
  }
  return names;
}

export function trainingFinishToast(exercise: string, count: number, localDay: string): string {
  return `已记入 ${formatMonthDay(localDay)} · ${exercise} ${count} 组`;
}
