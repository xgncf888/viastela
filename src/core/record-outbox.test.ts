import { describe, expect, it } from '@jest/globals';

import {
  EMPTY_OUTBOX,
  parseOutboxJson,
  removeOutboxItem,
  upsertOutboxItem,
} from './record-outbox';

describe('record-outbox', () => {
  it('returns empty outbox for null or malformed JSON', () => {
    expect(parseOutboxJson(null)).toEqual(EMPTY_OUTBOX);
    expect(parseOutboxJson('not-json')).toEqual(EMPTY_OUTBOX);
    expect(parseOutboxJson('123')).toEqual(EMPTY_OUTBOX);
  });

  it('parses valid weight, training, and study items and drops invalid entries', () => {
    const raw = JSON.stringify({
      weights: [
        {
          id: 'w-1',
          weightKg: 73.5,
          recordedAt: '2026-10-30T08:00:00.000Z',
          tz: 'Asia/Singapore',
          localDay: '2026-10-30',
          updatedAt: '2026-10-30T08:00:00.000Z',
        },
        { id: 'bad', weightKg: -5 },
      ],
      trainingSets: [
        {
          id: 't-1',
          exercise: '深蹲',
          reps: 8,
          weightKg: 60,
          bandLevel: null,
          recordedAt: '2026-10-30T09:00:00.000Z',
          tz: 'Asia/Singapore',
          localDay: '2026-10-30',
          updatedAt: '2026-10-30T09:00:00.000Z',
        },
      ],
      studyRecords: [
        {
          id: 's-1',
          topic: 'AI Infra',
          durationMinutes: 45,
          note: 'KV Cache',
          recordedAt: '2026-10-30T10:00:00.000Z',
          tz: 'Asia/Singapore',
          localDay: '2026-10-30',
          updatedAt: '2026-10-30T10:00:00.000Z',
        },
      ],
    });

    const parsed = parseOutboxJson(raw);
    expect(parsed.weights).toHaveLength(1);
    expect(parsed.weights[0]?.id).toBe('w-1');
    expect(parsed.trainingSets).toHaveLength(1);
    expect(parsed.trainingSets[0]?.exercise).toBe('深蹲');
    expect(parsed.studyRecords).toHaveLength(1);
    expect(parsed.studyRecords[0]?.topic).toBe('AI Infra');
  });

  it('upserts and removes items by id idempotently', () => {
    const w1 = {
      id: 'w-1',
      weightKg: 73.5,
      recordedAt: '2026-10-30T08:00:00.000Z',
      tz: 'UTC',
      localDay: '2026-10-30',
      updatedAt: '2026-10-30T08:00:00.000Z',
    };
    const w1Updated = { ...w1, weightKg: 74.0 };
    const list = upsertOutboxItem([], w1);
    expect(list).toEqual([w1]);
    const replaced = upsertOutboxItem(list, w1Updated);
    expect(replaced).toEqual([w1Updated]);
    expect(removeOutboxItem(replaced, 'w-1')).toEqual([]);
  });
});
