import { localStore } from './local-store';

const PREFIX = 'viastela.amount-mask.v1.';

/** Amounts start hidden. `0` is the only stored value that shows them. */
export async function readAmountMasked(userId: string): Promise<boolean> {
  if (userId.trim().length === 0) return true;
  const value = await (await localStore()).getItem(`${PREFIX}${userId}`);
  if (value === '0') return false;
  return true;
}

export async function writeAmountMasked(userId: string, masked: boolean): Promise<void> {
  if (userId.trim().length === 0) throw new Error('userId is required');
  await (await localStore()).setItem(`${PREFIX}${userId}`, masked ? '1' : '0');
}
