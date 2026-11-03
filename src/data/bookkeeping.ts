import { isPlaceholderLocalSupabaseUrl, isSupabaseConfigured } from '@/config/env';
import {
  type BookkeepingState,
  type CoupleChatMessage,
  type CoupleTeamProfile,
  DEFAULT_BOOKKEEPING_STATE,
  DEFAULT_COUPLE_CHAT_MESSAGES,
  DEFAULT_COUPLE_PROFILE,
  DEFAULT_LEDGER_BOOKS,
  DEFAULT_RECURRING_RULES,
  DEFAULT_WEALTH_PLAN,
  getLedgerBookMeta,
  getLedgerCategoryMeta,
  type LedgerAccountId,
  type LedgerBook,
  type LedgerBookId,
  type LedgerCategoryId,
  type LedgerEntryKind,
  type LedgerOwnerId,
  type LedgerTransaction,
  materializeDueRecurringRules,
  mergePartnerBookkeepingState,
  QUICK_LEDGER_PRESETS,
  type QuickLedgerPreset,
  type RecurringLedgerRule,
  type WealthPlanConfig,
} from '@/core/bookkeeping';

import { getSupabase } from './client';

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

function normalizeQuickPresets(raw: unknown): QuickLedgerPreset[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...QUICK_LEDGER_PRESETS];
  }
  return raw.map((item) => {
    const p = item as QuickLedgerPreset;
    if (p.id === 'preset-transit' && typeof p.isFixedPrice === 'undefined') {
      return {
        ...p,
        amountCny: 3,
        isFixedPrice: true,
        ledgerId: p.ledgerId ?? 'ledger-daily',
      };
    }
    return {
      ...p,
      isFixedPrice: Boolean(p.isFixedPrice),
      ledgerId: p.ledgerId ?? 'ledger-daily',
    };
  });
}

function normalizeLedgerBooks(raw: unknown): LedgerBook[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_LEDGER_BOOKS];
  }
  return raw.map((item) => {
    const b = item as LedgerBook;
    return {
      id: b.id || 'ledger-daily',
      icon: b.icon || '账',
      zh: b.zh || '家庭账本',
      en: b.en || b.zh || 'Ledger',
      monthlyBudgetCny:
        typeof b.monthlyBudgetCny === 'number' && b.monthlyBudgetCny >= 100
          ? b.monthlyBudgetCny
          : 3000,
      includeInPool: typeof b.includeInPool === 'boolean' ? b.includeInPool : true,
      color: b.color || '#f5b942',
    };
  });
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
        ? parsed.transactions.map((tx) => ({
            ...tx,
            ledgerId: tx.ledgerId ?? 'ledger-daily',
          }))
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
      quickPresets: normalizeQuickPresets(parsed.quickPresets),
      ledgerBooks: normalizeLedgerBooks(parsed.ledgerBooks),
      chatMessages:
        Array.isArray(parsed.chatMessages) && parsed.chatMessages.length > 0
          ? parsed.chatMessages
          : [...DEFAULT_COUPLE_CHAT_MESSAGES],
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

/**
 * Broadcasts real-time state updates across tabs/windows (via BroadcastChannel)
 * and across paired devices (via Supabase Realtime Broadcast when configured).
 */
let activeBroadcastChannel: BroadcastChannel | null = null;
let activeRoomKey = '';

export function connectCoupleRealtimeRoom(
  roomCode: string,
  onReceiveRemotePatch: (incoming: Partial<BookkeepingState>) => void,
): () => void {
  const cleanRoom = (roomCode || 'LOVE-88').trim().toUpperCase();
  const disposers: (() => void)[] = [];

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(`viastela_couple_${cleanRoom}`);
      activeBroadcastChannel = bc;
      activeRoomKey = cleanRoom;
      bc.onmessage = (ev: MessageEvent) => {
        if (ev?.data && typeof ev.data === 'object') {
          onReceiveRemotePatch(ev.data as Partial<BookkeepingState>);
        }
      };
      disposers.push(() => {
        try {
          bc.close();
        } catch {
          // Ignore close error
        }
      });
    } catch {
      // Ignore BroadcastChannel unsupported error
    }
  }

  if (isSupabaseConfigured() && !isPlaceholderLocalSupabaseUrl()) {
    try {
      const sb = getSupabase();
      const channel = sb.channel(`couple_ledger_${cleanRoom}`);
      channel
        .on('broadcast', { event: 'couple_sync' }, (payload: { payload?: Partial<BookkeepingState> }) => {
          if (payload?.payload) {
            onReceiveRemotePatch(payload.payload);
          }
        })
        .subscribe();
      disposers.push(() => {
        void sb.removeChannel(channel);
      });
    } catch {
      // Ignore Supabase realtime connection fallback
    }
  }

  return () => {
    disposers.forEach((fn) => fn());
  };
}

function broadcastStateToPartner(state: BookkeepingState): void {
  if (!state.coupleProfile.autoSyncEnabled) return;
  const payload: Partial<BookkeepingState> = {
    transactions: state.transactions.slice(0, 30),
    chatMessages: (state.chatMessages ?? []).slice(-30),
    ledgerBooks: state.ledgerBooks,
  };
  try {
    if (
      activeBroadcastChannel &&
      activeRoomKey === (state.coupleProfile.roomCode || 'LOVE-88').trim().toUpperCase()
    ) {
      activeBroadcastChannel.postMessage(payload);
    }
  } catch {
    // Ignore broadcast error
  }
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
  ledgerId?: LedgerBookId;
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
    ledgerId: input.ledgerId ?? 'ledger-daily',
  };
  const next: BookkeepingState = {
    ...cur,
    transactions: [added, ...cur.transactions],
  };
  writeBookkeepingState(next);
  broadcastStateToPartner(next);
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

export function updateMonthlyBudgetCny(budgetCny: number, ledgerId?: LedgerBookId): BookkeepingState {
  const cur = readBookkeepingState();
  const cleanBudget = Math.max(100, Math.round(budgetCny));
  const books = cur.ledgerBooks ?? [...DEFAULT_LEDGER_BOOKS];
  const nextBooks = ledgerId
    ? books.map((b) => (b.id === ledgerId ? { ...b, monthlyBudgetCny: cleanBudget } : b))
    : books.map((b, idx) => (idx === 0 ? { ...b, monthlyBudgetCny: cleanBudget } : b));
  const pooledSum = nextBooks
    .filter((b) => b.includeInPool)
    .reduce((sum, b) => sum + b.monthlyBudgetCny, 0);
  const next: BookkeepingState = {
    ...cur,
    monthlyBudgetCny: ledgerId ? Math.max(100, pooledSum || cleanBudget) : cleanBudget,
    ledgerBooks: nextBooks,
  };
  return writeBookkeepingState(next);
}

export function saveLedgerBook(input: {
  id?: string;
  icon?: string;
  zh: string;
  en?: string;
  monthlyBudgetCny: number;
  includeInPool: boolean;
  color?: string;
}): BookkeepingState {
  const cur = readBookkeepingState();
  const books = cur.ledgerBooks ?? [...DEFAULT_LEDGER_BOOKS];
  const cleanZh = input.zh.trim() || '新建专账';
  const cleanIcon = (input.icon?.trim() || cleanZh.slice(0, 1) || '账').slice(0, 1);
  const cleanBudget = Math.max(100, Math.round(input.monthlyBudgetCny || 3000));
  const bookObj: LedgerBook = {
    id: input.id ?? createTxId('ledger'),
    icon: cleanIcon,
    zh: cleanZh,
    en: input.en?.trim() || cleanZh,
    monthlyBudgetCny: cleanBudget,
    includeInPool: input.includeInPool,
    color: input.color || '#a855f7',
  };
  const exists = books.some((b) => b.id === bookObj.id);
  const nextBooks = exists
    ? books.map((b) => (b.id === bookObj.id ? bookObj : b))
    : [...books, bookObj];

  return writeBookkeepingState({
    ...cur,
    ledgerBooks: nextBooks,
  });
}

export function toggleLedgerBookPoolInclusion(ledgerId: LedgerBookId): BookkeepingState {
  const cur = readBookkeepingState();
  const books = cur.ledgerBooks ?? [...DEFAULT_LEDGER_BOOKS];
  const nextBooks = books.map((b) =>
    b.id === ledgerId ? { ...b, includeInPool: !b.includeInPool } : b,
  );
  return writeBookkeepingState({
    ...cur,
    ledgerBooks: nextBooks,
  });
}

export function removeLedgerBook(ledgerId: LedgerBookId): BookkeepingState {
  if (ledgerId === 'ledger-daily') return readBookkeepingState();
  const cur = readBookkeepingState();
  const books = cur.ledgerBooks ?? [...DEFAULT_LEDGER_BOOKS];
  const nextBooks = books.filter((b) => b.id !== ledgerId);
  const nextTx = cur.transactions.map((tx) =>
    tx.ledgerId === ledgerId ? { ...tx, ledgerId: 'ledger-daily' } : tx,
  );
  return writeBookkeepingState({
    ...cur,
    ledgerBooks: nextBooks,
    transactions: nextTx,
  });
}

export function sendCoupleChatMessage(input: {
  sender?: 'me' | 'partner' | 'system';
  text: string;
  linkedTx?: CoupleChatMessage['linkedTx'];
}): BookkeepingState {
  const cur = readBookkeepingState();
  const cleanText = input.text.trim();
  if (!cleanText) return cur;
  const sender = input.sender ?? 'me';
  const senderName =
    sender === 'partner'
      ? cur.coupleProfile.partnerName || '老婆'
      : sender === 'system'
        ? '系统'
        : cur.coupleProfile.myName || '我';
  const msg: CoupleChatMessage = {
    id: createTxId('chat'),
    sender,
    senderName,
    text: cleanText,
    createdAt: new Date().toISOString(),
    linkedTx: input.linkedTx,
  };
  const list = cur.chatMessages ?? [...DEFAULT_COUPLE_CHAT_MESSAGES];
  const next: BookkeepingState = {
    ...cur,
    chatMessages: [...list, msg],
  };
  writeBookkeepingState(next);
  broadcastStateToPartner(next);
  return next;
}

export function bindCoupleFriendAndRoom(input: {
  partnerFriendCode: string;
  roomCode: string;
  partnerName?: string;
}): BookkeepingState {
  const cur = readBookkeepingState();
  const cleanFriend = input.partnerFriendCode.trim().toUpperCase() || 'VS-6612';
  const cleanRoom = input.roomCode.trim().toUpperCase() || 'LOVE-88';
  const partnerName = input.partnerName?.trim() || cur.coupleProfile.partnerName || '老婆';
  const sysMsg: CoupleChatMessage = {
    id: createTxId('chat-sys'),
    sender: 'system',
    senderName: '系统',
    text: `已与好友「${partnerName} (${cleanFriend})」在房间 #${cleanRoom} 完成绑定，多账本与资金合池已开启实时联机同步。`,
    createdAt: new Date().toISOString(),
  };
  const next: BookkeepingState = {
    ...cur,
    coupleProfile: {
      ...cur.coupleProfile,
      partnerName,
      partnerFriendCode: cleanFriend,
      roomCode: cleanRoom,
      friendBound: true,
      coupleMode: true,
    },
    chatMessages: [...(cur.chatMessages ?? [...DEFAULT_COUPLE_CHAT_MESSAGES]), sysMsg],
  };
  return writeBookkeepingState(next);
}

export function simulatePartnerLiveSyncEvent(todayLocalDay: string): {
  state: BookkeepingState;
  addedTx: LedgerTransaction;
  addedChat: CoupleChatMessage;
} {
  const cur = readBookkeepingState();
  const partnerName = cur.coupleProfile.partnerName || '老婆';
  const books = cur.ledgerBooks ?? [...DEFAULT_LEDGER_BOOKS];
  const targetBook = getLedgerBookMeta('ledger-travel', books);

  const addedTx: LedgerTransaction = {
    id: createTxId('tx-partner'),
    kind: 'expense',
    amountCny: 68,
    categoryId: 'coffee',
    accountId: 'wechat',
    note: '双人精品手冲咖啡与可露丽',
    localDay: todayLocalDay,
    createdAt: new Date().toISOString(),
    owner: 'partner',
    ledgerId: targetBook.id,
  };

  const addedChat: CoupleChatMessage = {
    id: createTxId('chat-partner'),
    sender: 'partner',
    senderName: partnerName,
    text: `刚买了双人手冲咖啡和甜点 ¥68，记在「${targetBook.zh}」里啦，合池总览已经自动同步更新。`,
    createdAt: new Date().toISOString(),
    linkedTx: {
      txId: addedTx.id,
      note: addedTx.note,
      amountCny: addedTx.amountCny,
      kind: 'expense',
      ledgerTitle: targetBook.zh,
    },
  };

  const next: BookkeepingState = {
    ...cur,
    transactions: [addedTx, ...cur.transactions],
    chatMessages: [...(cur.chatMessages ?? [...DEFAULT_COUPLE_CHAT_MESSAGES]), addedChat],
  };
  writeBookkeepingState(next);
  broadcastStateToPartner(next);
  return { state: next, addedTx, addedChat };
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

export function saveQuickLedgerPreset(input: {
  id?: string;
  zh: string;
  en?: string;
  amountCny: number;
  isFixedPrice: boolean;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
  owner: LedgerOwnerId;
  ledgerId?: LedgerBookId;
}): BookkeepingState {
  const cur = readBookkeepingState();
  const list = cur.quickPresets ?? [...QUICK_LEDGER_PRESETS];
  const catMeta = getLedgerCategoryMeta(input.categoryId);
  const cleanZh = input.zh.trim() || catMeta.zh;
  const cleanEn = input.en?.trim() || cleanZh;
  const cleanAmount = Math.max(0.1, Math.round(input.amountCny * 100) / 100);

  const presetObj: QuickLedgerPreset = {
    id: input.id ?? createTxId('preset'),
    icon: catMeta.icon,
    zh: cleanZh,
    en: cleanEn,
    amountCny: cleanAmount,
    isFixedPrice: input.isFixedPrice,
    categoryId: input.categoryId,
    accountId: input.accountId,
    owner: input.owner,
    ledgerId: input.ledgerId ?? 'ledger-daily',
  };

  const exists = list.some((p) => p.id === presetObj.id);
  const nextPresets = exists
    ? list.map((p) => (p.id === presetObj.id ? presetObj : p))
    : [...list, presetObj];

  return writeBookkeepingState({
    ...cur,
    quickPresets: nextPresets,
  });
}

export function removeQuickLedgerPreset(id: string): BookkeepingState {
  const cur = readBookkeepingState();
  const list = cur.quickPresets ?? [...QUICK_LEDGER_PRESETS];
  return writeBookkeepingState({
    ...cur,
    quickPresets: list.filter((p) => p.id !== id),
  });
}

export function addRecurringLedgerRule(input: {
  title: string;
  kind: LedgerEntryKind;
  amountCny: number;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
  dayOfMonth: number;
  owner: LedgerOwnerId;
  ledgerId?: LedgerBookId;
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
    ledgerId: input.ledgerId ?? 'ledger-daily',
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
  addedChatCount: number;
} {
  const cur = readBookkeepingState();
  const parsed = JSON.parse(rawJson) as Partial<BookkeepingState> & {
    sanctuary?: { bookkeeping?: Partial<BookkeepingState> };
  };
  const incoming = parsed.sanctuary?.bookkeeping ?? parsed;
  const { merged, addedTxCount, addedChatCount } = mergePartnerBookkeepingState(cur, incoming);
  writeBookkeepingState(merged);
  return { state: merged, addedTxCount, addedChatCount };
}
