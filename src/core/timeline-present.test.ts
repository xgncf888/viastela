import { describe, expect, it } from '@jest/globals';

import { groupTimeline, presentTimeline, type TimelineAccount, type TimelineSource } from './timeline-present';

const ACCOUNTS: TimelineAccount[] = [
  { id: 'cash', name: '现金', currency: 'USD' },
  { id: 'sgd', name: '新币', currency: 'SGD' },
];

function source(partial: Partial<TimelineSource> & Pick<TimelineSource, 'id' | 'kind'>): TimelineSource {
  return {
    occurredAt: '2026-10-01T01:00:00.000Z',
    dayKey: '2026-10-01',
    refId: null,
    payload: {},
    ...partial,
  };
}

describe('timeline presentation', () => {
  it('converts with the row rate and treats a null USD rate as one to one', () => {
    const items = presentTimeline(
      [
        source({
          id: 'first',
          kind: 'balance_recorded',
          refId: 'cash',
          payload: { after_amount: 10, usd_rate: null, after_usd: null },
        }),
        source({
          id: 'next',
          kind: 'balance_recorded',
          refId: 'cash',
          occurredAt: '2026-10-01T02:00:00.000Z',
          payload: { before_amount: 10, after_amount: 12.5, usd_rate: null, before_usd: null, after_usd: null },
        }),
        source({
          id: 'sgd',
          kind: 'balance_recorded',
          refId: 'sgd',
          payload: { before_amount: 100, after_amount: 200, usd_rate: 0.75, before_usd: 70, after_usd: 150 },
        }),
      ],
      ACCOUNTS,
      'Asia/Singapore',
    );
    expect(items.find((item) => item.id === 'first')?.detail).toBe('首次记录 US$10.00');
    expect(items.find((item) => item.id === 'next')?.detail).toBe('US$10.00 → US$12.50（+US$2.50）');
    expect(items.find((item) => item.id === 'sgd')?.detail).toBe('US$70.00 → US$150.00（+US$80.00）');
    expect(items.find((item) => item.id === 'first')?.title).toBe('更新了 现金 余额');
  });

  it('does not render a balance whose account is already gone', () => {
    const items = presentTimeline(
      [
        source({
          id: 'live',
          kind: 'balance_recorded',
          refId: 'cash',
          payload: { after_amount: 10, usd_rate: null },
        }),
        source({
          id: 'gone',
          kind: 'balance_recorded',
          refId: 'deleted-account',
          payload: { after_amount: 99999, usd_rate: null, after_usd: 99999 },
        }),
      ],
      ACCOUNTS,
      'UTC',
    );
    expect(items.map((item) => item.id)).toEqual(['live']);
    expect(JSON.stringify(items)).not.toContain('99999');
    expect(JSON.stringify(items)).not.toContain('已注销');
  });

  it('keeps holding add and remove, and puts quantity only in the detail', () => {
    const items = presentTimeline(
      [
        source({
          id: 'added',
          kind: 'holding_added',
          payload: { symbol: 'AAPL', after_quantity: 10 },
        }),
        source({
          id: 'changed',
          kind: 'holding_changed',
          payload: { symbol: 'AAPL', before_quantity: 10, after_quantity: 15 },
        }),
        source({
          id: 'cost',
          kind: 'holding_changed',
          payload: { symbol: 'AAPL', before_quantity: 10, after_quantity: 10, before_usd: 1, after_usd: 2 },
        }),
        source({
          id: 'removed',
          kind: 'holding_removed',
          payload: { symbol: 'AAPL', before_quantity: 15 },
        }),
      ],
      ACCOUNTS,
      'UTC',
    );
    expect(items.map((item) => item.title)).toEqual([
      '新增持仓 AAPL',
      '调整了 AAPL 持仓',
      '调整了 AAPL 持仓',
      '移除了持仓 AAPL',
    ]);
    expect(items.find((item) => item.id === 'changed')?.detail).toBe('10 → 15 股');
    expect(items.find((item) => item.id === 'cost')?.detail).toBe('调整了成本价');
    for (const item of items) expect(item.title).not.toMatch(/\d/);
    expect(items.map((item) => item.id)).toEqual(['added', 'changed', 'cost', 'removed']);
  });

  it('groups a backfilled journal with that day, not the day it was typed', () => {
    const items = presentTimeline(
      [
        source({
          id: 'note',
          kind: 'journal',
          dayKey: '2026-10-01',
          occurredAt: '2026-10-27T12:00:00.000Z',
          payload: { body: '补记的一天\n第二行', mood: 3, tags: ['旅行'] },
        }),
      ],
      [],
      'Asia/Singapore',
    );
    const groups = groupTimeline(items, '2026-10-27');
    expect(groups).toHaveLength(1);
    expect(groups[0].dayKey).toBe('2026-10-01');
    expect(groups[0].label).toBe('10月1日 周四');
    expect(items[0].title).toBe('补记的一天');
    expect(items[0].detail).toBe('一般 · 旅行');
    expect(items[0].maskDetail).toBe(false);
    expect(items[0].time).toBe('20:00');
  });
});
