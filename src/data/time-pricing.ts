import {
  computeHourlyRateBreakdown,
  DEFAULT_TIME_PRICING_CONFIG,
  type HourlyRateBreakdown,
  type TimePricingConfig,
} from '@/core/time-pricing';

import { readBookkeepingState } from './bookkeeping';
import {
  createPersistedStore,
  createPersistedStoreBus,
  type PersistedStoreListener,
} from './persisted-store';

const TIME_PRICING_STORAGE_KEY = 'viastela.time_pricing.v1';

const timePricingBus = createPersistedStoreBus();

export function subscribeTimePricingStore(listener: PersistedStoreListener): () => void {
  return timePricingBus.subscribe(listener);
}

const timePricingStore = createPersistedStore<TimePricingConfig>({
  key: TIME_PRICING_STORAGE_KEY,
  bus: timePricingBus,
  getDefault: () => ({ ...DEFAULT_TIME_PRICING_CONFIG }),
  normalize: (raw) => {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_TIME_PRICING_CONFIG };
    }
    const parsed = raw as Partial<TimePricingConfig>;
    return {
      monthlyNetIncomeCny:
        typeof parsed.monthlyNetIncomeCny === 'number' && Number.isFinite(parsed.monthlyNetIncomeCny)
          ? Math.max(0, parsed.monthlyNetIncomeCny)
          : DEFAULT_TIME_PRICING_CONFIG.monthlyNetIncomeCny,
      partnerMonthlyNetIncomeCny:
        typeof parsed.partnerMonthlyNetIncomeCny === 'number' &&
        Number.isFinite(parsed.partnerMonthlyNetIncomeCny)
          ? Math.max(0, parsed.partnerMonthlyNetIncomeCny)
          : DEFAULT_TIME_PRICING_CONFIG.partnerMonthlyNetIncomeCny,
      includePartnerInPool:
        typeof parsed.includePartnerInPool === 'boolean'
          ? parsed.includePartnerInPool
          : DEFAULT_TIME_PRICING_CONFIG.includePartnerInPool,
      workDaysPerMonth:
        typeof parsed.workDaysPerMonth === 'number' && parsed.workDaysPerMonth >= 1
          ? parsed.workDaysPerMonth
          : DEFAULT_TIME_PRICING_CONFIG.workDaysPerMonth,
      dailyContractHours:
        typeof parsed.dailyContractHours === 'number' && parsed.dailyContractHours >= 0.5
          ? parsed.dailyContractHours
          : DEFAULT_TIME_PRICING_CONFIG.dailyContractHours,
      dailyOvertimeHours:
        typeof parsed.dailyOvertimeHours === 'number' && parsed.dailyOvertimeHours >= 0
          ? parsed.dailyOvertimeHours
          : DEFAULT_TIME_PRICING_CONFIG.dailyOvertimeHours,
      dailyCommuteMinutes:
        typeof parsed.dailyCommuteMinutes === 'number' && parsed.dailyCommuteMinutes >= 0
          ? parsed.dailyCommuteMinutes
          : DEFAULT_TIME_PRICING_CONFIG.dailyCommuteMinutes,
      dailyDecompressionMinutes:
        typeof parsed.dailyDecompressionMinutes === 'number' &&
        parsed.dailyDecompressionMinutes >= 0
          ? parsed.dailyDecompressionMinutes
          : DEFAULT_TIME_PRICING_CONFIG.dailyDecompressionMinutes,
      monthlyWorkExpenseCny:
        typeof parsed.monthlyWorkExpenseCny === 'number' && parsed.monthlyWorkExpenseCny >= 0
          ? parsed.monthlyWorkExpenseCny
          : DEFAULT_TIME_PRICING_CONFIG.monthlyWorkExpenseCny,
      focusCompoundMultiplier:
        typeof parsed.focusCompoundMultiplier === 'number' && parsed.focusCompoundMultiplier >= 1
          ? parsed.focusCompoundMultiplier
          : DEFAULT_TIME_PRICING_CONFIG.focusCompoundMultiplier,
      targetHourlyCny:
        typeof parsed.targetHourlyCny === 'number' && parsed.targetHourlyCny > 0
          ? parsed.targetHourlyCny
          : DEFAULT_TIME_PRICING_CONFIG.targetHourlyCny,
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : DEFAULT_TIME_PRICING_CONFIG.updatedAt,
    };
  },
});

export function readTimePricingConfig(): TimePricingConfig {
  return timePricingStore.read();
}

export function writeTimePricingConfig(patch: Partial<TimePricingConfig>): TimePricingConfig {
  const current = readTimePricingConfig();
  const next: TimePricingConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return timePricingStore.write(next);
}

/**
 * Estimates monthly income & work expenses from the user's Bookkeeping Ledger
 * (recurring salary rules or current month's actual income/commute transactions)
 * so the Time Pricing engine and Bookkeeping Ledger are seamlessly connected.
 */
export function detectBookkeepingIncomeAndWorkCost(): {
  detectedMonthlyIncomeCny: number;
  detectedPartnerIncomeCny: number;
  detectedWorkExpenseCny: number;
  sourceLabelZh: string;
  sourceLabelEn: string;
} {
  const bk = readBookkeepingState();
  let selfSalary = 0;
  let partnerSalary = 0;

  for (const rule of bk.recurringRules || []) {
    if (!rule.enabled || rule.kind !== 'income') continue;
    if (rule.owner === 'partner') {
      partnerSalary += rule.amountCny;
    } else {
      selfSalary += rule.amountCny;
    }
  }

  const nowIsoMonth = new Date().toISOString().slice(0, 7);
  let monthIncomeSelf = 0;
  let monthIncomePartner = 0;
  let monthWorkExpense = 0;

  for (const tx of bk.transactions || []) {
    if (!tx.localDay.startsWith(nowIsoMonth)) continue;
    if (tx.kind === 'income') {
      if (tx.owner === 'partner') {
        monthIncomePartner += tx.amountCny;
      } else {
        monthIncomeSelf += tx.amountCny;
      }
    } else if (tx.kind === 'expense') {
      if (tx.categoryId === 'transit' || tx.categoryId === 'coffee') {
        monthWorkExpense += tx.amountCny;
      }
    }
  }

  const detectedMonthlyIncomeCny = selfSalary > 0 ? selfSalary : monthIncomeSelf;
  const detectedPartnerIncomeCny = partnerSalary > 0 ? partnerSalary : monthIncomePartner;
  const detectedWorkExpenseCny = Math.round(monthWorkExpense);

  let sourceLabelZh = '暂未从记账本检测到月薪流水，可直接输入或一键设置';
  let sourceLabelEn = 'No income found in ledger yet; enter manually or set recurring salary';

  if (selfSalary > 0 || partnerSalary > 0) {
    sourceLabelZh = `已从记账本「固定月薪规则」识别：个人 ¥${detectedMonthlyIncomeCny.toLocaleString()}${
      detectedPartnerIncomeCny > 0 ? ` + 伴侣 ¥${detectedPartnerIncomeCny.toLocaleString()}` : ''
    }`;
    sourceLabelEn = `Detected from Ledger Recurring Salary: ¥${detectedMonthlyIncomeCny.toLocaleString()}`;
  } else if (monthIncomeSelf > 0 || monthIncomePartner > 0) {
    sourceLabelZh = `已从记账本「本月收入流水」识别：¥${detectedMonthlyIncomeCny.toLocaleString()}`;
    sourceLabelEn = `Detected from current month ledger income: ¥${detectedMonthlyIncomeCny.toLocaleString()}`;
  }

  return {
    detectedMonthlyIncomeCny,
    detectedPartnerIncomeCny,
    detectedWorkExpenseCny,
    sourceLabelZh,
    sourceLabelEn,
  };
}

/**
 * Returns the effective TimePricingConfig and breakdown, automatically falling back
 * to the Bookkeeping Ledger's recurring salary / monthly income if the user hasn't
 * manually set `monthlyNetIncomeCny` yet.
 */
export function readEffectiveTimePricing(): {
  config: TimePricingConfig;
  breakdown: HourlyRateBreakdown;
  autoSyncedFromLedger: boolean;
} {
  const stored = readTimePricingConfig();
  if (stored.monthlyNetIncomeCny > 0) {
    return {
      config: stored,
      breakdown: computeHourlyRateBreakdown(stored),
      autoSyncedFromLedger: false,
    };
  }

  const detected = detectBookkeepingIncomeAndWorkCost();
  if (detected.detectedMonthlyIncomeCny > 0 || detected.detectedPartnerIncomeCny > 0) {
    const merged: TimePricingConfig = {
      ...stored,
      monthlyNetIncomeCny:
        detected.detectedMonthlyIncomeCny > 0
          ? detected.detectedMonthlyIncomeCny
          : detected.detectedPartnerIncomeCny,
      partnerMonthlyNetIncomeCny:
        detected.detectedMonthlyIncomeCny > 0 ? detected.detectedPartnerIncomeCny : 0,
      monthlyWorkExpenseCny:
        stored.monthlyWorkExpenseCny > 0
          ? stored.monthlyWorkExpenseCny
          : detected.detectedWorkExpenseCny,
    };
    return {
      config: merged,
      breakdown: computeHourlyRateBreakdown(merged),
      autoSyncedFromLedger: true,
    };
  }

  return {
    config: stored,
    breakdown: computeHourlyRateBreakdown(stored),
    autoSyncedFromLedger: false,
  };
}
