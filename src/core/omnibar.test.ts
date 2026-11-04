import { expect, test } from '@jest/globals';

import { parseOmnibarCommand } from './omnibar';

test('parseOmnibarCommand parses weight, workout, study, and ledger natural-language commands', () => {
  expect(parseOmnibarCommand('72.4kg')).toMatchObject({
    kind: 'weight',
    weightKg: 72.4,
  });
  expect(parseOmnibarCommand('晨重 71.8')).toMatchObject({
    kind: 'weight',
    weightKg: 71.8,
  });

  expect(parseOmnibarCommand('卧推 60kg 8x4')).toMatchObject({
    kind: 'training',
    exercise: '卧推',
    weightKg: 60,
    reps: 8,
    setsCount: 4,
  });
  expect(parseOmnibarCommand('引体向上 12次')).toMatchObject({
    kind: 'training',
    exercise: '引体向上',
    weightKg: null,
    reps: 12,
    setsCount: 1,
  });

  expect(parseOmnibarCommand('读 DDIA 45m 分布式事务')).toMatchObject({
    kind: 'study',
    topic: 'DDIA',
    durationMinutes: 45,
    note: '分布式事务',
  });

  expect(parseOmnibarCommand('瑞幸冰美式 18 微信')).toMatchObject({
    kind: 'ledger',
    entryKind: 'expense',
    amountCny: 18,
    categoryId: 'coffee',
    accountId: 'wechat',
  });

  expect(parseOmnibarCommand('today')).toBeNull();
});
