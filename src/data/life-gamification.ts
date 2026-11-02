import {
  DEFAULT_PLEDGE_VAULT,
  DEFAULT_TIME_CAPSULES,
  type PledgeVaultState,
  type TimeCapsuleItem,
} from '@/core/life-gamification';

const PLEDGE_VAULT_KEY = 'viastela.pledge_vault.v1';
const TIME_CAPSULES_KEY = 'viastela.time_capsules.v1';

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeLifeGamificationStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readPledgeVault(): PledgeVaultState {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_PLEDGE_VAULT;
    const raw = localStorage.getItem(PLEDGE_VAULT_KEY);
    if (!raw) return DEFAULT_PLEDGE_VAULT;
    const parsed = JSON.parse(raw) as Partial<PledgeVaultState>;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PLEDGE_VAULT;
    return {
      config: {
        ...DEFAULT_PLEDGE_VAULT.config,
        ...(parsed.config ?? {}),
      },
      wishBalanceCny:
        typeof parsed.wishBalanceCny === 'number'
          ? parsed.wishBalanceCny
          : DEFAULT_PLEDGE_VAULT.wishBalanceCny,
      penaltyDcaPoolCny:
        typeof parsed.penaltyDcaPoolCny === 'number'
          ? parsed.penaltyDcaPoolCny
          : DEFAULT_PLEDGE_VAULT.penaltyDcaPoolCny,
      wishes: Array.isArray(parsed.wishes) ? parsed.wishes : DEFAULT_PLEDGE_VAULT.wishes,
      ledger: Array.isArray(parsed.ledger) ? parsed.ledger : DEFAULT_PLEDGE_VAULT.ledger,
    };
  } catch {
    return DEFAULT_PLEDGE_VAULT;
  }
}

export function writePledgeVault(state: PledgeVaultState): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PLEDGE_VAULT_KEY, JSON.stringify(state));
    }
    emitChange();
  } catch {
    // Ignore storage error
  }
}

export function recordPledgeReward(reason: string, localDay: string, customAmountCny?: number): PledgeVaultState {
  const cur = readPledgeVault();
  const amount = customAmountCny ?? cur.config.checkInRewardCny;
  const nextWishBalance = cur.wishBalanceCny + amount;

  // Auto-allocate reward to the first unredeemed wish item that hasn't reached targetCny
  let remainingToAllocate = amount;
  const nextWishes = cur.wishes.map((w) => {
    if (w.redeemed || remainingToAllocate <= 0 || w.allocatedCny >= w.targetCny) return w;
    const gap = w.targetCny - w.allocatedCny;
    const add = Math.min(gap, remainingToAllocate);
    remainingToAllocate -= add;
    return {
      ...w,
      allocatedCny: w.allocatedCny + add,
    };
  });

  const nextState: PledgeVaultState = {
    ...cur,
    wishBalanceCny: nextWishBalance,
    wishes: nextWishes,
    ledger: [
      {
        id: `pledge-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        localDay,
        kind: 'reward',
        amountCny: amount,
        reason,
        createdAt: new Date().toISOString(),
      },
      ...cur.ledger.slice(0, 29),
    ],
  };
  writePledgeVault(nextState);
  return nextState;
}

export function recordPledgePenalty(reason: string, localDay: string, customAmountCny?: number): PledgeVaultState {
  const cur = readPledgeVault();
  const amount = customAmountCny ?? cur.config.missedPenaltyCny;
  const nextState: PledgeVaultState = {
    ...cur,
    penaltyDcaPoolCny: cur.penaltyDcaPoolCny + amount,
    ledger: [
      {
        id: `pledge-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        localDay,
        kind: 'penalty',
        amountCny: amount,
        reason,
        createdAt: new Date().toISOString(),
      },
      ...cur.ledger.slice(0, 29),
    ],
  };
  writePledgeVault(nextState);
  return nextState;
}

export function addWishVaultItem(input: {
  title: string;
  targetCny: number;
  linkedLabel?: string;
}): PledgeVaultState {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) return readPledgeVault();
  const cur = readPledgeVault();
  const nextState: PledgeVaultState = {
    ...cur,
    wishes: [
      {
        id: `wish-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: cleanTitle,
        targetCny: Math.max(50, Math.round(input.targetCny || 500)),
        allocatedCny: 0,
        linkedLabel: input.linkedLabel?.trim() || '自律心愿奖励',
        redeemed: false,
        createdAt: new Date().toISOString(),
      },
      ...cur.wishes,
    ],
  };
  writePledgeVault(nextState);
  return nextState;
}

export function redeemWishVaultItem(wishId: string, localDay: string): PledgeVaultState {
  const cur = readPledgeVault();
  const target = cur.wishes.find((w) => w.id === wishId);
  if (!target || target.redeemed) return cur;

  const nextState: PledgeVaultState = {
    ...cur,
    wishes: cur.wishes.map((w) => (w.id === wishId ? { ...w, redeemed: true } : w)),
    ledger: [
      {
        id: `pledge-${Date.now()}`,
        localDay,
        kind: 'redeem',
        amountCny: target.allocatedCny,
        reason: `解锁兑换心愿：${target.title}`,
        createdAt: new Date().toISOString(),
      },
      ...cur.ledger.slice(0, 29),
    ],
  };
  writePledgeVault(nextState);
  return nextState;
}

export function readTimeCapsules(): TimeCapsuleItem[] {
  try {
    if (typeof localStorage === 'undefined') return [...DEFAULT_TIME_CAPSULES];
    const raw = localStorage.getItem(TIME_CAPSULES_KEY);
    if (!raw) return [...DEFAULT_TIME_CAPSULES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_TIME_CAPSULES];
    return parsed as TimeCapsuleItem[];
  } catch {
    return [...DEFAULT_TIME_CAPSULES];
  }
}

export function writeTimeCapsules(items: readonly TimeCapsuleItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TIME_CAPSULES_KEY, JSON.stringify(items));
    }
    emitChange();
  } catch {
    // Ignore storage error
  }
}

export function addTimeCapsule(input: {
  title: string;
  recipientLabel?: string;
  message: string;
  createdDay: string;
  unlockDay: string;
}): TimeCapsuleItem[] {
  const cleanTitle = input.title.trim();
  const cleanMsg = input.message.trim();
  if (!cleanTitle || !cleanMsg || !/^\d{4}-\d{2}-\d{2}$/.test(input.unlockDay.trim())) {
    return readTimeCapsules();
  }
  const item: TimeCapsuleItem = {
    id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    title: cleanTitle,
    recipientLabel: input.recipientLabel?.trim() || '写给未来的自己',
    message: cleanMsg,
    createdDay: input.createdDay,
    unlockDay: input.unlockDay.trim(),
    openedAt: null,
  };
  const next = [item, ...readTimeCapsules()];
  writeTimeCapsules(next);
  return next;
}

export function removeTimeCapsule(id: string): TimeCapsuleItem[] {
  const next = readTimeCapsules().filter((c) => c.id !== id);
  writeTimeCapsules(next);
  return next;
}

export async function pushNativeMenuBarTitle(title: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;
    const isAppProtocol = window.location?.protocol === 'app:';
    if (!isAppProtocol) return false;
    const res = await fetch(
      `app://localhost/__menubar__/update?title=${encodeURIComponent(title)}`,
    );
    return res.ok;
  } catch {
    return false;
  }
}
