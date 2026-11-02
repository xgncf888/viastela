import {
  type BookkeepingState,
  DEFAULT_BOOKKEEPING_STATE,
  type LedgerAccountId,
  type LedgerCategoryId,
  type LedgerEntryKind,
  type LedgerTransaction,
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
function createTxId(): string {
  txSequence += 1;
  return `tx-${Date.now()}-${txSequence}`;
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

export function addLedgerTransaction(input: {
  kind: LedgerEntryKind;
  amountCny: number;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
  note: string;
  localDay: string;
}): { state: BookkeepingState; added: LedgerTransaction } {
  const cur = readBookkeepingState();
  const cleanAmount = Math.max(0.01, Math.round(input.amountCny * 100) / 100);
  const added: LedgerTransaction = {
    id: createTxId(),
    kind: input.kind,
    amountCny: cleanAmount,
    categoryId: input.categoryId,
    accountId: input.accountId,
    note: input.note.trim() || '日常收支',
    localDay: input.localDay,
    createdAt: new Date().toISOString(),
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
