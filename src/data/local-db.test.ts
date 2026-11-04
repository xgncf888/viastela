import { afterEach, beforeEach, expect, test } from '@jest/globals';

import {
  clearLocalDb,
  localBalanceUpdatedThisMonth,
  localGetDaySwitch,
  localInsertAccount,
  localInsertBalance,
  localLatestWeightRecord,
  localListAccountBalances,
  localListAssetAccounts,
  localListRecentExercises,
  localListRecentTopics,
  localListStudyRecords,
  localListTrainingSets,
  localListWeightRecords,
  localSaveJournal,
  localSelectTimeline,
  localSoftDeleteStudyRecord,
  localSoftDeleteTrainingSet,
  localSoftDeleteWeightRecord,
  localUpdateDaySwitch,
  localUpsertStudyRecord,
  localUpsertTrainingSet,
  localUpsertWeightRecord,
} from './local-db';
import { createMemoryLocalStore, setLocalStoreForTests } from './local-store';

beforeEach(() => {
  setLocalStoreForTests(createMemoryLocalStore());
});

afterEach(async () => {
  await clearLocalDb();
  setLocalStoreForTests(null);
});

test('local-db stores and soft-deletes weights, training sets, and study records', async () => {
  expect(await localGetDaySwitch()).toBe('04:00');
  await localUpdateDaySwitch('05:30');
  expect(await localGetDaySwitch()).toBe('05:30');

  await localUpsertWeightRecord({
    id: 'w-1',
    weightKg: 71.8,
    recordedAt: '2026-11-04T08:00:00.000Z',
    tz: 'Asia/Singapore',
    localDay: '2026-11-04',
    updatedAt: '2026-11-04T08:00:00.000Z',
  });
  expect(await localListWeightRecords({ fromDay: '2026-11-01', toDay: '2026-11-04' })).toHaveLength(1);
  expect((await localLatestWeightRecord())?.weightKg).toBe(71.8);
  await localSoftDeleteWeightRecord('w-1');
  expect(await localListWeightRecords({ fromDay: '2026-11-01', toDay: '2026-11-04' })).toEqual([]);

  await localUpsertTrainingSet({
    id: 't-1',
    exercise: '引体向上',
    reps: 12,
    weightKg: null,
    bandLevel: null,
    recordedAt: '2026-11-04T09:00:00.000Z',
    tz: 'Asia/Singapore',
    localDay: '2026-11-04',
    updatedAt: '2026-11-04T09:00:00.000Z',
  });
  expect(await localListTrainingSets('2026-11-04')).toHaveLength(1);
  expect((await localListRecentExercises())[0]?.exercise).toBe('引体向上');
  await localSoftDeleteTrainingSet('t-1');
  expect(await localListTrainingSets('2026-11-04')).toEqual([]);

  await localUpsertStudyRecord({
    id: 's-1',
    topic: 'Distributed Systems',
    durationMinutes: 60,
    note: 'Raft consensus',
    recordedAt: '2026-11-04T10:00:00.000Z',
    tz: 'Asia/Singapore',
    localDay: '2026-11-04',
    updatedAt: '2026-11-04T10:00:00.000Z',
  });
  expect(await localListStudyRecords('2026-11-04')).toHaveLength(1);
  expect((await localListRecentTopics())[0]?.topic).toBe('Distributed Systems');
  await localSoftDeleteStudyRecord('s-1');
  expect(await localListStudyRecords('2026-11-04')).toEqual([]);
});

test('local-db supports journals, asset accounts, balances, and timeline queries', async () => {
  await localInsertAccount({ id: 'acc-1', name: '招商银行', currency: 'CNY' });
  await localInsertBalance({
    id: 'bal-1',
    accountId: 'acc-1',
    amount: 50000,
    usdRate: 0.14,
    recordedAt: '2026-11-04T09:00:00.000Z',
    tz: 'Asia/Singapore',
    localDay: '2026-11-04',
    deletedAt: null,
  });
  await localSaveJournal({
    id: 'j-1',
    body: '完成架构重构',
    entryDay: '2026-11-04',
    tz: 'Asia/Singapore',
    mood: 5,
    tags: ['架构'],
  });

  expect(await localListAssetAccounts()).toHaveLength(1);
  expect(await localListAccountBalances()).toHaveLength(1);
  expect(await localBalanceUpdatedThisMonth('2026-11-01', '2026-11-30')).toBe(true);
  const timeline = await localSelectTimeline({ localDay: 'present', kind: null });
  expect(timeline.map((item) => item.kind).sort()).toEqual(['balance_recorded', 'journal']);
});
