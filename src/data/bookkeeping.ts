import {
  type BookkeepingState,
  type CoupleTeamProfile,
  DEFAULT_BOOKKEEPING_STATE,
  DEFAULT_COUPLE_PROFILE,
  DEFAULT_RECURRING_RULES,
  DEFAULT_WEALTH_PLAN,
  type LedgerAccountId,
  type LedgerCategoryId,
  type LedgerEntryKind,
  type LedgerOwnerId,
  type LedgerTransaction,
  materializeDueRecurringRules,
  mergePartnerBookkeepingState,
  type RecurringLedgerRule,
  type WealthPlanConfig,
} from '@/core/bookkeeping';

const BOOKKEEPING_STORAGE_KEY = 'viastela.bookkeeping.v1';

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeBookkeepingStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let txSequence = 0;
function createTxId(prefix = 'tx'): string {
  txSequence += 1;
  return `${prefix}-${Date.now()}-${txSequence}`;
}

export function readBookkeepingState(): BookkeepingState {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_BOOKKEEPING_STATE;
    const raw = localStorage.getItem(BOOKKEEPING_STORAGE_KEY);
    if (!raw) return DEFAULT_BOOKKEEPING_STATE;
    const parsed = JSON.parse(raw) as Partial<BookkeepingState>;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_BOOKKEEPING_STATE;
    return {
      monthlyBudgetCny:
        typeof parsed.monthlyBudgetCny === 'number' && parsed.monthlyBudgetCny >= 100
          ? parsed.monthlyBudgetCny
          : DEFAULT_BOOKKEEPING_STATE.monthlyBudgetCny,
      currencySymbol:
        typeof parsed.currencySymbol === 'string' && parsed.currencySymbol.trim()
          ? parsed.currencySymbol
          : '¥',
      transactions: Array.isArray(parsed.transactions)
        ? parsed.transactions
        : DEFAULT_BOOKKEEPING_STATE.transactions,
      recurringRules: Array.isArray(parsed.recurringRules)
        ? parsed.recurringRules
        : [...DEFAULT_RECURRING_RULES],
      wealthPlan: {
        ...DEFAULT_WEALTH_PLAN,
        ...(parsed.wealthPlan ?? {}),
      },
      coupleProfile: {
        ...DEFAULT_COUPLE_PROFILE,
        ...(parsed.coupleProfile ?? {}),
      },
    };
  } catch {
    return DEFAULT_BOOKKEEPING_STATE;
  }
}

export function writeBookkeepingState(state: BookkeepingState): BookkeepingState {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BOOKKEEPING_STORAGE_KEY, JSON.stringify(state));
    }
    emitChange();
  } catch {
    // Ignore storage error
  }
  return state;
}

export function ensureRecurringRulesApplied(todayLocalDay: string): {
  state: BookkeepingState;
  materializedCount: number;
} {
  const cur = readBookkeepingState();
  const res = materializeDueRecurringRules(cur, todayLocalDay);
  if (res.materializedCount > 0) {
    writeBookkeepingState(res.state);
  }
  return res;
}

export function addLedgerTransaction(input: {
  kind: LedgerEntryKind;
  amountCny: number;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
  note: string;
  localDay: string;
  owner?: LedgerOwnerId;
}): { state: BookkeepingState; added: LedgerTransaction } {
  const cur = readBookkeepingState();
  const cleanAmount = Math.max(0.01, Math.round(input.amountCny * 100) / 100);
  const added: LedgerTransaction = {
    id: createTxId('tx'),
    kind: input.kind,
    amountCny: cleanAmount,
    categoryId: input.categoryId,
    accountId: input.accountId,
    note: input.note.trim() || '日常收支',
    localDay: input.localDay,
    createdAt: new Date().toISOString(),
    owner: input.owner ?? 'me',
  };
  const next: BookkeepingState = {
    ...cur,
    transactions: [added, ...cur.transactions],
  };
  writeBookkeepingState(next);
  return { state: next, added };
}

export function removeLedgerTransaction(id: string): BookkeepingState {
  const cur = readBookkeepingState();
  const next: BookkeepingState = {
    ...cur,
    transactions: cur.transactions.filter((tx) => tx.id !== id),
  };
  return writeBookkeepingState(next);
}

export function updateMonthlyBudgetCny(budgetCny: number): BookkeepingState {
  const cur = readBookkeepingState();
  const next: BookkeepingState = {
    ...cur,
    monthlyBudgetCny: Math.max(100, Math.round(budgetCny)),
  };
  return writeBookkeepingState(next);
}

export function updateWealthPlanConfig(patch: Partial<WealthPlanConfig>): BookkeepingState {
  const cur = readBookkeepingState();
  const next: BookkeepingState = {
    ...cur,
    wealthPlan: {
      ...cur.wealthPlan,
      ...patch,
    },
  };
  return writeBookkeepingState(next);
}

export function updateCoupleTeamProfile(patch: Partial<CoupleTeamProfile>): BookkeepingState {
  const cur = readBookkeepingState();
  const next: BookkeepingState = {
    ...cur,
    coupleProfile: {
      ...cur.coupleProfile,
      ...patch,
    },
  };
  return writeBookkeepingState(next);
}

export function addRecurringLedgerRule(input: {
  title: string;
  kind: LedgerEntryKind;
  amountCny: number;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
  dayOfMonth: number;
  owner: LedgerOwnerId;
}): BookkeepingState {
  const cur = readBookkeepingState();
  const rule: RecurringLedgerRule = {
    id: createTxId('rec'),
    title: input.title.trim() || '周期收支',
    kind: input.kind,
    amountCny: Math.max(1, Math.round(input.amountCny)),
    categoryId: input.categoryId,
    accountId: input.accountId,
    dayOfMonth: Math.max(1, Math.min(28, Math.round(input.dayOfMonth || 1))),
    owner: input.owner,
    enabled: true,
    lastAppliedYearMonth: null,
  };
  const next: BookkeepingState = {
    ...cur,
    recurringRules: [rule, ...cur.recurringRules],
  };
  return writeBookkeepingState(next);
}

export function toggleRecurringLedgerRule(id: string): BookkeepingState {
  const cur = readBookkeepingState();
  const next: BookkeepingState = {
    ...cur,
    recurringRules: cur.recurringRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
  };
  return writeBookkeepingState(next);
}

export function removeRecurringLedgerRule(id: string): BookkeepingState {
  const cur = readBookkeepingState();
  const next: BookkeepingState = {
    ...cur,
    recurringRules: cur.recurringRules.filter((r) => r.id !== id),
  };
  return writeBookkeepingState(next);
}

export function importPartnerBookkeepingJson(rawJson: string): {
  state: BookkeepingState;
  addedTxCount: number;
} {
  const cur = readBookkeepingState();
  const parsed = JSON.parse(rawJson) as Partial<BookkeepingState> & {
    sanctuary?: { bookkeeping?: Partial<BookkeepingState> };
  };
  const incoming = parsed.sanctuary?.bookkeeping ?? parsed;
  const { merged, addedTxCount } = mergePartnerBookkeepingState(cur, incoming);
  writeBookkeepingState(merged);
  return { state: merged, addedTxCount };
}
