import { describe, expect, it } from '@jest/globals';

import {
  formatTrainingLoad,
  parseTrainingDraft,
  recentExerciseNames,
  trainingDaySummary,
  trainingFinishToast,
  trainingSetsOnDay,
  type TrainingSet,
} from './training';

function set(id: string, hour: number): TrainingSet {
  return {
    id,
    exercise: '卧推',
    reps: 8,
    weightKg: 40,
    bandLevel: null,
    recordedAt: `2026-10-27T${String(hour).padStart(2, '0')}:00:00.000Z`,
    tz: 'UTC',
    localDay: '2026-10-27',
    updatedAt: `2026-10-27T${String(hour).padStart(2, '0')}:00:00.000Z`,
  };
}

describe('training draft', () => {
  it('accepts kilograms or one band level, not both', () => {
    expect(
      parseTrainingDraft({ exercise: ' 卧推 ', reps: '8', mode: 'weight', weight: '40', bandLevel: 'light' }),
    ).toEqual({ ok: true, exercise: '卧推', reps: 8, weightKg: 40, bandLevel: null });
    expect(
      parseTrainingDraft({ exercise: '引体向上', reps: '6', mode: 'band', weight: '40', bandLevel: 'light' }),
    ).toEqual({ ok: true, exercise: '引体向上', reps: 6, weightKg: null, bandLevel: 'light' });
    expect(parseTrainingDraft({ exercise: '引体向上', reps: '6', mode: 'band', weight: '', bandLevel: '' }).ok).toBe(
      false,
    );
  });

  it('rejects an empty exercise, a zero rep count, and a weight outside the range', () => {
    const exercise = parseTrainingDraft({ exercise: ' ', reps: '8', mode: 'weight', weight: '40', bandLevel: '' });
    const reps = parseTrainingDraft({ exercise: '卧推', reps: '0', mode: 'weight', weight: '40', bandLevel: '' });
    const weight = parseTrainingDraft({ exercise: '卧推', reps: '8', mode: 'weight', weight: '500', bandLevel: '' });
    expect(exercise.ok).toBe(false);
    expect(reps.ok).toBe(false);
    expect(weight.ok).toBe(false);
    if (!exercise.ok) expect(exercise.field).toBe('exercise');
    if (!reps.ok) expect(reps.field).toBe('reps');
    if (!weight.ok) expect(weight.field).toBe('weight');
  });
});

describe('training list', () => {
  it('keeps today in recorded order and formats the load', () => {
    const later = set('b', 9);
    const earlier = set('a', 8);
    const otherDay = { ...set('c', 7), localDay: '2026-10-26' };
    expect(trainingSetsOnDay([later, otherDay, earlier], '2026-10-27').map((item) => item.id)).toEqual(['a', 'b']);
    expect(formatTrainingLoad(earlier)).toBe('40 kg');
    expect(formatTrainingLoad({ weightKg: 40.5, bandLevel: null })).toBe('40.5 kg');
    expect(formatTrainingLoad({ weightKg: null, bandLevel: 'light' })).toBe('弹力带 轻');
    expect(formatTrainingLoad({ weightKg: null, bandLevel: 'extra_heavy' })).toBe('弹力带 加重');
  });

  it('summarises a day as exercise counts in first-seen order', () => {
    const squat = { exercise: '深蹲' };
    const bench = { exercise: '卧推' };
    expect(trainingDaySummary([squat, squat, bench, squat, bench, squat, bench])).toBe('深蹲 4 组 · 卧推 3 组');
  });

  it('keeps the six most recent distinct exercises', () => {
    const rows = [
      { exercise: '卧推', recordedAt: '2026-10-27T06:00:00.000Z' },
      { exercise: '深蹲', recordedAt: '2026-10-27T07:00:00.000Z' },
      { exercise: '深蹲', recordedAt: '2026-10-27T08:00:00.000Z' },
      { exercise: '引体向上', recordedAt: '2026-10-26T08:00:00.000Z' },
      { exercise: '划船', recordedAt: '2026-10-25T08:00:00.000Z' },
      { exercise: '硬拉', recordedAt: '2026-10-24T08:00:00.000Z' },
      { exercise: '推举', recordedAt: '2026-10-23T08:00:00.000Z' },
      { exercise: '弯举', recordedAt: '2026-10-22T08:00:00.000Z' },
    ];
    expect(recentExerciseNames(rows)).toEqual(['深蹲', '卧推', '引体向上', '划船', '硬拉', '推举']);
  });

  it('names the finished exercise and the accounting day', () => {
    expect(trainingFinishToast('深蹲', 4, '2026-10-27')).toBe('已记入 10月27日 · 深蹲 4 组');
  });
});
