import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { createMemoryLocalStore, setLocalStoreForTests } from './local-store';
import {
  clearRecordOutbox,
  readRecordOutbox,
  removeOutboxStudyRecord,
  removeOutboxTrainingSet,
  removeOutboxWeight,
  saveOutboxStudyRecord,
  saveOutboxTrainingSet,
  saveOutboxWeight,
} from './record-outbox';

describe('data/record-outbox', () => {
  beforeEach(() => {
    setLocalStoreForTests(createMemoryLocalStore());
  });

  afterEach(() => {
    setLocalStoreForTests(null);
  });

  it('isolates outbox entries by userId and cleans up on clearRecordOutbox', async () => {
    const weight = {
      id: 'w-1',
      weightKg: 74.2,
      recordedAt: '2026-10-31T08:00:00.000Z',
      tz: 'Asia/Singapore',
      localDay: '2026-10-31',
      updatedAt: '2026-10-31T08:00:00.000Z',
    };
    const set = {
      id: 't-1',
      exercise: '哑铃卧推',
      reps: 10,
      weightKg: 30,
      bandLevel: null,
      recordedAt: '2026-10-31T08:10:00.000Z',
      tz: 'Asia/Singapore',
      localDay: '2026-10-31',
      updatedAt: '2026-10-31T08:10:00.000Z',
    };
    const study = {
      id: 's-1',
      topic: 'System Design',
      durationMinutes: 30,
      note: null,
      recordedAt: '2026-10-31T08:30:00.000Z',
      tz: 'Asia/Singapore',
      localDay: '2026-10-31',
      updatedAt: '2026-10-31T08:30:00.000Z',
    };

    await saveOutboxWeight('user-a', weight);
    await saveOutboxTrainingSet('user-a', set);
    await saveOutboxStudyRecord('user-b', study);

    const outboxA = await readRecordOutbox('user-a');
    expect(outboxA.weights).toEqual([weight]);
    expect(outboxA.trainingSets).toEqual([set]);
    expect(outboxA.studyRecords).toEqual([]);

    const outboxB = await readRecordOutbox('user-b');
    expect(outboxB.studyRecords).toEqual([study]);

    await removeOutboxWeight('user-a', 'w-1');
    await removeOutboxTrainingSet('user-a', 't-1');
    expect(await readRecordOutbox('user-a')).toEqual({
      weights: [],
      trainingSets: [],
      studyRecords: [],
    });

    await clearRecordOutbox('user-b');
    expect((await readRecordOutbox('user-b')).studyRecords).toEqual([]);

    await saveOutboxStudyRecord('user-c', study);
    await removeOutboxStudyRecord('user-c', 's-1');
    expect((await readRecordOutbox('user-c')).studyRecords).toEqual([]);
  });
});
