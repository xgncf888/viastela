import { describe, expect, it } from '@jest/globals';

import {
  formatTrainingLoad,
  parseTrainingDraft,
  trainingSaveToast,
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
      parseTrainingDraft({ exercise: ' 卧推 ', reps: '8', mode: 'weight', weight: '40', bandLevel: '红' }),
    ).toEqual({ ok: true, exercise: '卧推', reps: 8, weightKg: 40, bandLevel: null });
    expect(
      parseTrainingDraft({ exercise: '引体向上', reps: '6', mode: 'band', weight: '40', bandLevel: '红' }),
    ).toEqual({ ok: true, exercise: '引体向上', reps: 6, weightKg: null, bandLevel: '红' });
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
    expect(formatTrainingLoad(earlier)).toBe('40.0 kg');
    expect(formatTrainingLoad({ weightKg: null, bandLevel: '红' })).toBe('弹力带 红');
  });

  it('names the set in the save toast', () => {
    expect(trainingSaveToast('卧推', new Date('2026-10-27T08:00:00.000Z'), 'UTC', '04:00')).toBe('已记下 卧推');
    expect(trainingSaveToast('卧推', new Date('2026-10-27T03:00:00.000Z'), 'UTC', '04:00')).toBe(
      '已记入 10月26日 · 卧推',
    );
  });
});
