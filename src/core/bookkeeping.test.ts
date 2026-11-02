import { describe, expect, it } from '@jest/globals';

import {
  computeCategoryBreakdown,
  computeMonthlyBookkeepingSummary,
  DEFAULT_BOOKKEEPING_STATE,
  evaluateAmountExpression,
  parseQuickBookkeepingInput,
} from './bookkeeping';

describe('bookkeeping core engine', () => {
  it('evaluates plain numbers and inline addition/subtraction expressions', () => {
    expect(evaluateAmountExpression('36.5')).toBe(36.5);
    expect(evaluateAmountExpression('35+18')).toBe(53);
    expect(evaluateAmountExpression('100-22.5')).toBe(77.5);
    expect(evaluateAmountExpression('abc')).toBeNull();
  });

  it('parses natural language expense and income inputs with category & account detection', () => {
    const coffee = parseQuickBookkeepingInput('瑞幸冰美式 18 微信');
    expect(coffee).toEqual({
      kind: 'expense',
      amountCny: 18,
      categoryId: 'coffee',
      accountId: 'wechat',
      note: '瑞幸冰美式',
    });

    const grocery = parseQuickBookkeepingInput('盒马买菜 88.5 支付宝');
    expect(grocery?.kind).toBe('expense');
    expect(grocery?.categoryId).toBe('shopping');
    expect(grocery?.accountId).toBe('alipay');
    expect(grocery?.amountCny).toBe(88.5);

    const salary = parseQuickBookkeepingInput('发工资 +28000 招行');
    expect(salary?.kind).toBe('income');
    expect(salary?.categoryId).toBe('salary');
    expect(salary?.accountId).toBe('bank');
    expect(salary?.amountCny).toBe(28000);
  });

  it('computes monthly budget burn-rate, daily safe-to-spend, and category breakdown', () => {
    const summary = computeMonthlyBookkeepingSummary(DEFAULT_BOOKKEEPING_STATE, '2026-11-03');
    expect(summary.yearMonth).toBe('2026-11');
    expect(summary.totalExpenseCny).toBe(337);
    expect(summary.totalIncomeCny).toBe(26800);
    expect(summary.todayExpenseCny).toBe(56);
    expect(summary.daysLeftInMonth).toBe(28);
    expect(summary.dailySafeToSpendCny).toBeGreaterThan(150);

    const breakdown = computeCategoryBreakdown(
      DEFAULT_BOOKKEEPING_STATE.transactions,
      '2026-11',
      'expense',
    );
    expect(breakdown.length).toBeGreaterThan(0);
    expect(breakdown[0]?.category.id).toBe('shopping');
  });
});
