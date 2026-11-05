import {
  DEFAULT_PLEDGE_VAULT,
  DEFAULT_SANCTUARY_STAGE_STATE,
  DEFAULT_TIME_CAPSULES,
  type PledgeVaultState,
  type SanctuaryStageState,
  type TimeCapsuleItem,
} from '@/core/life-gamification';

import { createPersistedStore, createPersistedStoreBus, type PersistedStoreListener } from './persisted-store';

const PLEDGE_VAULT_KEY = 'viastela.pledge_vault.v1';
const TIME_CAPSULES_KEY = 'viastela.time_capsules.v1';
const SANCTUARY_STAGE_KEY = 'viastela.sanctuary_stage.v1';

const gamificationBus = createPersistedStoreBus();

export function subscribeLifeGamificationStore(listener: PersistedStoreListener): () => void {
  return gamificationBus.subscribe(listener);
}

const CLEAN_SANCTUARY_STAGE_STATE: SanctuaryStageState = {
  ...DEFAULT_SANCTUARY_STAGE_STATE,
  bookPage: 1,
  workoutReps: 0,
};

const CLEAN_PLEDGE_VAULT: PledgeVaultState = {
  config: { ...DEFAULT_PLEDGE_VAULT.config },
  wishBalanceCny: 0,
  penaltyDcaPoolCny: 0,
  wishes: DEFAULT_PLEDGE_VAULT.wishes.map((w) => ({ ...w, allocatedCny: 0 })),
  ledger: [],
};

const sanctuaryStageStore = createPersistedStore<SanctuaryStageState>({
  key: SANCTUARY_STAGE_KEY,
  bus: gamificationBus,
  getDefault: () => ({ ...CLEAN_SANCTUARY_STAGE_STATE }),
  normalize: (raw) => {
    if (!raw || typeof raw !== 'object') return { ...CLEAN_SANCTUARY_STAGE_STATE };
    const parsed = raw as Partial<SanctuaryStageState>;
    const validPose =
      parsed.workoutPose === 'squat' ||
      parsed.workoutPose === 'pushup' ||
      parsed.workoutPose === 'press' ||
      parsed.workoutPose === 'jump'
        ? parsed.workoutPose
        : CLEAN_SANCTUARY_STAGE_STATE.workoutPose;
    return {
      bookTitle:
        typeof parsed.bookTitle === 'string' && parsed.bookTitle.trim()
          ? parsed.bookTitle.trim()
          : CLEAN_SANCTUARY_STAGE_STATE.bookTitle,
      bookPage:
        typeof parsed.bookPage === 'number' && Number.isFinite(parsed.bookPage) && parsed.bookPage >= 1
          ? Math.round(parsed.bookPage)
          : CLEAN_SANCTUARY_STAGE_STATE.bookPage,
      bookTotalPages:
        typeof parsed.bookTotalPages === 'number' &&
        Number.isFinite(parsed.bookTotalPages) &&
        parsed.bookTotalPages >= 10
          ? Math.round(parsed.bookTotalPages)
          : CLEAN_SANCTUARY_STAGE_STATE.bookTotalPages,
      workoutPose: validPose,
      workoutReps:
        typeof parsed.workoutReps === 'number' &&
        Number.isFinite(parsed.workoutReps) &&
        parsed.workoutReps >= 0
          ? Math.round(parsed.workoutReps)
          : CLEAN_SANCTUARY_STAGE_STATE.workoutReps,
      wishTitle:
        typeof parsed.wishTitle === 'string' && parsed.wishTitle.trim()
          ? parsed.wishTitle.trim()
          : CLEAN_SANCTUARY_STAGE_STATE.wishTitle,
      wishTargetCny:
        typeof parsed.wishTargetCny === 'number' &&
        Number.isFinite(parsed.wishTargetCny) &&
        parsed.wishTargetCny >= 25
          ? Math.round(parsed.wishTargetCny)
          : CLEAN_SANCTUARY_STAGE_STATE.wishTargetCny,
    };
  },
});

const pledgeVaultStore = createPersistedStore<PledgeVaultState>({
  key: PLEDGE_VAULT_KEY,
  bus: gamificationBus,
  getDefault: () => CLEAN_PLEDGE_VAULT,
  normalize: (raw) => {
    if (!raw || typeof raw !== 'object') return CLEAN_PLEDGE_VAULT;
    const parsed = raw as Partial<PledgeVaultState>;
    const cleanLedger = Array.isArray(parsed.ledger)
      ? parsed.ledger.filter((entry) => entry && entry.id !== 'pledge-init-1')
      : [];
    return {
      config: {
        ...CLEAN_PLEDGE_VAULT.config,
        ...(parsed.config ?? {}),
      },
      wishBalanceCny:
        typeof parsed.wishBalanceCny === 'number'
          ? parsed.wishBalanceCny
          : CLEAN_PLEDGE_VAULT.wishBalanceCny,
      penaltyDcaPoolCny:
        typeof parsed.penaltyDcaPoolCny === 'number'
          ? parsed.penaltyDcaPoolCny
          : CLEAN_PLEDGE_VAULT.penaltyDcaPoolCny,
      wishes: Array.isArray(parsed.wishes) ? parsed.wishes : CLEAN_PLEDGE_VAULT.wishes,
      ledger: cleanLedger,
    };
  },
});

const timeCapsulesStore = createPersistedStore<TimeCapsuleItem[]>({
  key: TIME_CAPSULES_KEY,
  bus: gamificationBus,
  getDefault: () => [...DEFAULT_TIME_CAPSULES],
  normalize: (parsed) => {
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_TIME_CAPSULES];
    return parsed as TimeCapsuleItem[];
  },
});

export function readSanctuaryStageState(): SanctuaryStageState {
  return sanctuaryStageStore.read();
}

export function writeSanctuaryStageState(state: SanctuaryStageState): SanctuaryStageState {
  return sanctuaryStageStore.write(state);
}

export function updateSanctuaryStageState(
  patch: Partial<SanctuaryStageState>,
): SanctuaryStageState {
  const cur = readSanctuaryStageState();
  const next: SanctuaryStageState = {
    ...cur,
    ...patch,
    bookPage: Math.max(1, Math.round(patch.bookPage ?? cur.bookPage)),
    bookTotalPages: Math.max(10, Math.round(patch.bookTotalPages ?? cur.bookTotalPages)),
    workoutReps: Math.max(0, Math.round(patch.workoutReps ?? cur.workoutReps)),
    wishTargetCny: Math.max(25, Math.round(patch.wishTargetCny ?? cur.wishTargetCny)),
  };
  return writeSanctuaryStageState(next);
}

export function readPledgeVault(): PledgeVaultState {
  return pledgeVaultStore.read();
}

export function writePledgeVault(state: PledgeVaultState): void {
  pledgeVaultStore.write(state);
}

export function recordPledgeReward(reason: string, localDay: string, customAmountCny?: number): PledgeVaultState {
  const cur = readPledgeVault();
  const amount = customAmountCny ?? cur.config.checkInRewardCny;
  const nextWishBalance = Math.max(0, cur.wishBalanceCny + amount);

  let remainingToAllocate = Math.max(0, amount);
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
        kind: amount >= 0 ? 'reward' : 'redeem',
        amountCny: Math.abs(amount),
        reason,
        createdAt: new Date().toISOString(),
      },
      ...cur.ledger.slice(0, 29),
    ],
  };
  writePledgeVault(nextState);
  return nextState;
}

export function redeemCustomStageWish(
  wishTitle: string,
  targetCny: number,
  localDay: string,
): PledgeVaultState {
  const cur = readPledgeVault();
  const cost = Math.max(25, Math.round(targetCny));
  if (cur.wishBalanceCny < cost) return cur;
  const nextState: PledgeVaultState = {
    ...cur,
    wishBalanceCny: Math.max(0, cur.wishBalanceCny - cost),
    ledger: [
      {
        id: `pledge-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        localDay,
        kind: 'redeem',
        amountCny: cost,
        reason: `🎉 兑换心愿奖励：${wishTitle}`,
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
  return timeCapsulesStore.read();
}

export function writeTimeCapsules(items: readonly TimeCapsuleItem[]): void {
  timeCapsulesStore.write([...items]);
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
