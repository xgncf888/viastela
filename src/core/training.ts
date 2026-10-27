import { headerAccountingLabel } from './local-day';
import { parseWeightKg } from './weight-input';

export const BAND_LEVELS = ['黄', '红', '绿', '蓝', '黑'] as const;

export type BandLevel = (typeof BAND_LEVELS)[number];

export type TrainingMode = 'weight' | 'band';

export type TrainingField = 'exercise' | 'reps' | 'weight' | 'band';

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

export function formatTrainingLoad(set: Pick<TrainingSet, 'weightKg' | 'bandLevel'>): string {
  if (set.weightKg != null) return `${set.weightKg.toFixed(1)} kg`;
  return `弹力带 ${set.bandLevel ?? ''}`;
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

export function trainingSaveToast(exercise: string, instant: Date, timeZone: string, daySwitch: string): string {
  const accounting = headerAccountingLabel(instant, timeZone, daySwitch);
  return accounting ? `${accounting} · ${exercise}` : `已记下 ${exercise}`;
}
