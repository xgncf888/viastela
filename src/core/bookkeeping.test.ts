import { describe, expect, it } from '@jest/globals';

import {
  computeCategoryBreakdown,
  computeMonthlyBookkeepingSummary,
  computeWealthGoalTrajectory,
  DEFAULT_BOOKKEEPING_STATE,
  evaluateAmountExpression,
  materializeDueRecurringRules,
  mergePartnerBookkeepingState,
  parseAutoLogUrlParams,
  parseQuickBookkeepingInput,
} from './bookkeeping';

describe('bookkeeping core engine', () => {
  it('evaluates plain numbers and inline addition/subtraction expressions', () => {
    expect(evaluateAmountExpression('36.5')).toBe(36.5);
    expect(evaluateAmountExpression('35+18')).toBe(53);
    expect(evaluateAmountExpression('100-22.5')).toBe(77.5);
    expect(evaluateAmountExpression('abc')).toBeNull();
  });

  it('parses natural language expense, income, and partner attribution', () => {
    const coffee = parseQuickBookkeepingInput('瑞幸冰美式 18 微信');
    expect(coffee).toEqual({
      kind: 'expense',
      amountCny: 18,
      categoryId: 'coffee',
      accountId: 'wechat',
      owner: 'me',
      note: '瑞幸冰美式',
    });

    const wifeTea = parseQuickBookkeepingInput('老婆买喜茶 24 微信');
    expect(wifeTea?.owner).toBe('partner');
    expect(wifeTea?.categoryId).toBe('coffee');
    expect(wifeTea?.amountCny).toBe(24);

    const grocery = parseQuickBookkeepingInput('双人盒马买菜 88.5 支付宝');
    expect(grocery?.kind).toBe('expense');
    expect(grocery?.categoryId).toBe('shopping');
    expect(grocery?.accountId).toBe('alipay');
    expect(grocery?.owner).toBe('shared');
    expect(grocery?.amountCny).toBe(88.5);
  });

  it('parses iOS Shortcuts URL query parameters for automatic bookkeeping', () => {
    const fromAutoLog = parseAutoLogUrlParams('?autoLog=瑞幸生椰拿铁+18+微信');
    expect(fromAutoLog?.categoryId).toBe('coffee');
    expect(fromAutoLog?.amountCny).toBe(18);
    expect(fromAutoLog?.accountId).toBe('wechat');

    const fromFields = parseAutoLogUrlParams('?amount=52&merchant=美团晚餐&account=alipay&owner=partner');
    expect(fromFields?.categoryId).toBe('dining');
    expect(fromFields?.amountCny).toBe(52);
    expect(fromFields?.accountId).toBe('alipay');
    expect(fromFields?.owner).toBe('partner');
  });

  it('materializes due recurring monthly rules without duplicating existing entries', () => {
    const res1 = materializeDueRecurringRules(DEFAULT_BOOKKEEPING_STATE, '2026-11-06');
    // Day 5 mortgage rule ('rec-housing-mortgage') should materialize on 2026-11-06
    expect(res1.materializedCount).toBe(1);
    expect(res1.state.transactions[0]?.recurringRuleId).toBe('rec-housing-mortgage');

    // Calling again on the same month should materialize 0
    const res2 = materializeDueRecurringRules(res1.state, '2026-11-07');
    expect(res2.materializedCount).toBe(0);
  });

  it('computes salary x investment ratio -> target wealth compound trajectory curve', () => {
    const traj = computeWealthGoalTrajectory({
      wealthPlan: {
        currentSavedCny: 360000,
        targetWealthCny: 1500000,
        investRatePct: 50,
        annualReturnPct: 8,
      },
      recurringRules: DEFAULT_BOOKKEEPING_STATE.recurringRules,
      currentYearMonth: '2026-11',
    });

    // Combined recurring salary = 26800 + 22000 = 48800, 50% invest = 24400/mo
    expect(traj.monthlyIncomeCny).toBe(48800);
    expect(traj.monthlyInvestCny).toBe(24400);
    expect(traj.monthsToGoal).toBeGreaterThan(12);
    expect(traj.monthsToGoal).toBeLessThan(60);
    expect(traj.points.length).toBe(16);
    expect(traj.milestones.length).toBe(4);
  });

  it('non-destructively merges partner transactions without overwriting local entries', () => {
    const incoming = {
      transactions: [
        {
          id: 'tx-partner-new-99',
          kind: 'expense' as const,
          amountCny: 66,
          categoryId: 'dining' as const,
          accountId: 'wechat' as const,
          note: '老婆和闺蜜下午茶',
          localDay: '2026-11-03',
          createdAt: '2026-11-03T15:00:00.000Z',
        },
      ],
    };
    const { merged, addedTxCount } = mergePartnerBookkeepingState(DEFAULT_BOOKKEEPING_STATE, incoming);
    expect(addedTxCount).toBe(1);
    expect(merged.transactions.some((t) => t.id === 'tx-partner-new-99' && t.owner === 'partner')).toBe(true);
  });

  it('computes monthly budget burn-rate, daily safe-to-spend, and category breakdown', () => {
    const summary = computeMonthlyBookkeepingSummary(DEFAULT_BOOKKEEPING_STATE, '2026-11-03');
    expect(summary.yearMonth).toBe('2026-11');
    expect(summary.totalExpenseCny).toBe(337);
    expect(summary.totalIncomeCny).toBe(48800);
    expect(summary.byOwner.partnerIncomeCny).toBe(22000);

    const breakdown = computeCategoryBreakdown(
      DEFAULT_BOOKKEEPING_STATE.transactions,
      '2026-11',
      'expense',
    );
    expect(breakdown.length).toBeGreaterThan(0);
    expect(breakdown[0]?.category.id).toBe('shopping');
  });

  it('pre-configures Subway as a fixed ¥3 1-tap shortcut while keeping variable items in prompt mode', () => {
    const presets = DEFAULT_BOOKKEEPING_STATE.quickPresets ?? [];
    const subway = presets.find((p) => p.id === 'preset-transit');
    expect(subway).toBeDefined();
    expect(subway?.amountCny).toBe(3);
    expect(subway?.isFixedPrice).toBe(true);

    const lunch = presets.find((p) => p.id === 'preset-lunch');
    expect(lunch?.isFixedPrice).toBe(false);
  });
});
