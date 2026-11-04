import { expect, test } from '@jest/globals';

import { computeCrossModuleCorrelations } from './correlation-insights';

test('computeCrossModuleCorrelations calculates workout-weight delta, focus-spending coupling, and synergy score', () => {
  const result = computeCrossModuleCorrelations({
    endDay: '2026-11-04',
    windowDays: 7,
    weights: [
      {
        id: 'w1',
        weightKg: 73.0,
        recordedAt: '2026-11-02T08:00:00.000Z',
        tz: 'Asia/Singapore',
        localDay: '2026-11-02',
        updatedAt: '2026-11-02T08:00:00.000Z',
      },
      {
        id: 'w2',
        weightKg: 72.6,
        recordedAt: '2026-11-03T08:00:00.000Z',
        tz: 'Asia/Singapore',
        localDay: '2026-11-03',
        updatedAt: '2026-11-03T08:00:00.000Z',
      },
    ],
    trainingSets: [
      {
        id: 't1',
        exercise: '卧推',
        reps: 10,
        weightKg: 60,
        bandLevel: null,
        recordedAt: '2026-11-02T18:00:00.000Z',
        tz: 'Asia/Singapore',
        localDay: '2026-11-02',
        updatedAt: '2026-11-02T18:00:00.000Z',
      },
    ],
    studyRecords: [
      {
        id: 's1',
        topic: 'DDIA',
        durationMinutes: 60,
        note: null,
        recordedAt: '2026-11-02T20:00:00.000Z',
        tz: 'Asia/Singapore',
        localDay: '2026-11-02',
        updatedAt: '2026-11-02T20:00:00.000Z',
      },
    ],
    transactions: [
      {
        id: 'tx1',
        kind: 'expense',
        amountCny: 25,
        categoryId: 'coffee',
        accountId: 'wechat',
        note: '手冲咖啡',
        localDay: '2026-11-02',
        createdAt: '2026-11-02T10:00:00.000Z',
        owner: 'me',
      },
      {
        id: 'tx2',
        kind: 'expense',
        amountCny: 120,
        categoryId: 'shopping',
        accountId: 'alipay',
        note: '冲动购物',
        localDay: '2026-11-03',
        createdAt: '2026-11-03T15:00:00.000Z',
        owner: 'me',
      },
    ],
  });

  expect(result.cards).toHaveLength(3);
  expect(result.cards[0]?.metricBadge).toBe('-0.40 kg');
  expect(result.cards[1]?.titleZh).toContain('¥25');
  expect(result.synergyScore).toBeGreaterThan(0);
});
