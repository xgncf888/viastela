import { describe, expect, it } from '@jest/globals';

import {
  addLedgerTransaction,
  importBatchCsvTransactions,
  updateLedgerTransaction,
  updateRecurringLedgerRule,
} from '../data/bookkeeping';
import {
  computeAccountBalances,
  computeCategoryBreakdown,
  computeCoupleSettlement,
  computeMonthlyBookkeepingSummary,
  computeMonthlyFinancialHealth,
  computeMultiLedgerPoolBreakdown,
  computeWealthGoalTrajectory,
  DEFAULT_BOOKKEEPING_STATE,
  evaluateAmountExpression,
  filterTransactionsByLedgerScope,
  materializeDueRecurringRules,
  mergePartnerBookkeepingState,
  parseAutoLogUrlParams,
  parseBatchCsvTransactions,
  parseQuickBookkeepingInput,
  shiftYearMonth,
} from './bookkeeping';
import { syncOkrWithLiveMetrics } from './life-milestones-okr';

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

  it('aggregates multi-ledger fund pools and filters by individual ledger or pooled scope', () => {
    const pool = computeMultiLedgerPoolBreakdown(DEFAULT_BOOKKEEPING_STATE, '2026-11');
    // 3 default ledgers: 6000 + 3000 + 2000 = 11000 pooled budget
    expect(pool.items.length).toBe(3);
    expect(pool.pooledMonthlyBudgetCny).toBe(11000);
    expect(pool.pooledMonthExpenseCny).toBe(337);

    const books = DEFAULT_BOOKKEEPING_STATE.ledgerBooks ?? [];
    const travelOnly = filterTransactionsByLedgerScope(
      DEFAULT_BOOKKEEPING_STATE.transactions,
      books,
      'ledger-travel',
    );
    expect(travelOnly.length).toBe(1);
    expect(travelOnly[0]?.amountCny).toBe(38);
  });

  it('shifts year-months cleanly and supports inline editing of transactions and recurring rules', () => {
    expect(shiftYearMonth('2026-11', -1)).toBe('2026-10');
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');

    const octSummary = computeMonthlyBookkeepingSummary(
      DEFAULT_BOOKKEEPING_STATE,
      '2026-11-03',
      'pool',
      '2026-10',
    );
    expect(octSummary.yearMonth).toBe('2026-10');
    expect(octSummary.totalExpenseCny).toBe(0);

    const { added } = addLedgerTransaction({
      kind: 'expense',
      amountCny: 38,
      categoryId: 'dining',
      accountId: 'wechat',
      note: '测试午餐',
      localDay: '2026-11-03',
      owner: 'me',
      ledgerId: 'ledger-daily',
    });
    const afterEditTx = updateLedgerTransaction(added.id, {
      amountCny: 35,
      note: '更正午餐',
      accountId: 'alipay',
      ledgerId: 'ledger-travel',
    });
    const updatedTx = afterEditTx.transactions.find((t) => t.id === added.id);
    expect(updatedTx?.amountCny).toBe(35);
    expect(updatedTx?.note).toBe('更正午餐');
    expect(updatedTx?.accountId).toBe('alipay');
    expect(updatedTx?.ledgerId).toBe('ledger-travel');

    const afterEditRule = updateRecurringLedgerRule('rec-my-salary', {
      amountCny: 30000,
      dayOfMonth: 5,
    });
    const updatedRule = afterEditRule.recurringRules.find((r) => r.id === 'rec-my-salary');
    expect(updatedRule?.amountCny).toBe(30000);
    expect(updatedRule?.dayOfMonth).toBe(5);
  });

  it('supports internal account transfers, couple settlement, batch CSV import, financial health, and OKR wealth auto-link', () => {
    const beforeBalances = computeAccountBalances(DEFAULT_BOOKKEEPING_STATE.transactions);
    const bankBefore = beforeBalances.find((b) => b.account.id === 'bank')!.balanceCny;
    const wechatBefore = beforeBalances.find((b) => b.account.id === 'wechat')!.balanceCny;

    const txWithTransfer = [
      {
        id: 'tx-transfer-1',
        kind: 'transfer' as const,
        amountCny: 1000,
        categoryId: 'transfer' as const,
        accountId: 'bank' as const,
        toAccountId: 'wechat' as const,
        note: '银行卡充值微信零钱',
        localDay: '2026-11-03',
        createdAt: '2026-11-03T16:00:00.000Z',
      },
      ...DEFAULT_BOOKKEEPING_STATE.transactions,
    ];
    const afterBalances = computeAccountBalances(txWithTransfer);
    expect(afterBalances.find((b) => b.account.id === 'bank')!.balanceCny).toBe(bankBefore - 1000);
    expect(afterBalances.find((b) => b.account.id === 'wechat')!.balanceCny).toBe(wechatBefore + 1000);

    // Couple settlement (equal vs income ratio)
    const settlementRatio = computeCoupleSettlement(DEFAULT_BOOKKEEPING_STATE, '2026-11', 'income_ratio');
    expect(settlementRatio.totalPoolExpenseCny).toBe(337);
    expect(settlementRatio.myShareRatio).toBeGreaterThan(0.5);
    expect(settlementRatio.direction).toBe('partner_to_me');

    const settlementEqual = computeCoupleSettlement(DEFAULT_BOOKKEEPING_STATE, '2026-11', 'equal');
    expect(settlementEqual.myShareRatio).toBe(0.5);
    expect(settlementEqual.myTargetShareCny).toBe(168.5);

    // Monthly Financial Health check
    const health = computeMonthlyFinancialHealth(DEFAULT_BOOKKEEPING_STATE, '2026-11');
    expect(health.savingsRatePct).toBeGreaterThan(80);
    expect(['S', 'A']).toContain(health.grade);

    // Batch CSV parser & importer
    const parsedCsv = parseBatchCsvTransactions(
      'Date,Ledger,Type,Owner,Category,Account,Amount(CNY),Note\n2026-11-03,日常家庭账本,expense,我,咖啡茶饮,微信支付,-26.00,Peets手冲咖啡',
      '2026-11-03',
    );
    expect(parsedCsv.length).toBe(1);
    expect(parsedCsv[0]?.amountCny).toBe(26);
    expect(parsedCsv[0]?.categoryId).toBe('coffee');

    const { importedCount } = importBatchCsvTransactions(
      '2026-11-03,日常家庭账本,expense,我,咖啡茶饮,微信支付,-26.00,Peets手冲咖啡',
      '2026-11-03',
    );
    expect(importedCount).toBe(1);

    // OKR wealth auto-link
    const syncedOkr = syncOkrWithLiveMetrics(
      [
        {
          id: 'obj-w',
          period: '2026 Q4',
          title: '家庭净储蓄突破50w',
          category: 'wealth',
          confidence: 9,
          createdAt: '2026-11-01',
          keyResults: [
            {
              id: 'kr-w1',
              title: '当前净储蓄',
              startValue: 300000,
              currentValue: 300000,
              targetValue: 500000,
              unit: '¥',
              stepDelta: 10000,
              autoLink: 'saved_wealth_cny',
              lastCheckInDay: null,
            },
          ],
        },
      ],
      { savedWealthCny: 360000, monthlySavingsCny: 48463 },
    );
    expect(syncedOkr[0]?.keyResults[0]?.currentValue).toBe(360000);
  });
});
