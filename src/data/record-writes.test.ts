import { afterEach, beforeEach, expect, test } from '@jest/globals';

import { enterLocalMode, NOT_SIGNED_IN, signOut } from './auth';
import { localListStudyRecords, localListTrainingSets, localListWeightRecords } from './local-db';
import { createMemoryLocalStore, setLocalStoreForTests } from './local-store';
import { upsertStudyRecord } from './study';
import { upsertTrainingSet } from './training';
import { upsertWeightRecord } from './weights';

const weight = {
  id: 'w-unsigned',
  weightKg: 72.4,
  recordedAt: '2026-11-24T08:00:00.000Z',
  tz: 'UTC',
  localDay: '2026-11-24',
  updatedAt: '2026-11-24T08:00:00.000Z',
};

const training = {
  id: 't-unsigned',
  exercise: '深蹲',
  reps: 8,
  weightKg: 40,
  bandLevel: null,
  recordedAt: '2026-11-24T08:00:00.000Z',
  tz: 'UTC',
  localDay: '2026-11-24',
  updatedAt: '2026-11-24T08:00:00.000Z',
};

const study = {
  id: 's-unsigned',
  topic: '分布式',
  durationMinutes: 30,
  note: null,
  recordedAt: '2026-11-24T08:00:00.000Z',
  tz: 'UTC',
  localDay: '2026-11-24',
  updatedAt: '2026-11-24T08:00:00.000Z',
};

const window = { fromDay: '2026-11-01', toDay: '2026-11-30' };

beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => (store.has(key) ? (store.get(key) ?? null) : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
  setLocalStoreForTests(createMemoryLocalStore());
});

afterEach(async () => {
  await signOut().catch(() => {});
  setLocalStoreForTests(null);
});

test('weight, training, and study writes without a session stay out of the local store', async () => {
  await expect(upsertWeightRecord(weight)).rejects.toThrow(NOT_SIGNED_IN);
  await expect(upsertTrainingSet(training)).rejects.toThrow(NOT_SIGNED_IN);
  await expect(upsertStudyRecord(study)).rejects.toThrow(NOT_SIGNED_IN);
  expect(await localListWeightRecords(window)).toEqual([]);
  expect(await localListTrainingSets('2026-11-24')).toEqual([]);
  expect(await localListStudyRecords('2026-11-24')).toEqual([]);
});

test('local mode writes weight, training, and study into the local store', async () => {
  enterLocalMode();
  await upsertWeightRecord(weight);
  await upsertTrainingSet(training);
  await upsertStudyRecord(study);
  expect(await localListWeightRecords(window)).toHaveLength(1);
  expect(await localListTrainingSets('2026-11-24')).toHaveLength(1);
  expect(await localListStudyRecords('2026-11-24')).toHaveLength(1);
});
