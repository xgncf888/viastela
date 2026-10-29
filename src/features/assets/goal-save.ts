import { assetSaveNotice } from '@/core/asset-errors';

export const GOAL_SAVED_TOAST = '目标已更新';

export function claimSave(gate: { current: boolean }): boolean {
  if (gate.current) return false;
  gate.current = true;
  return true;
}

export function releaseSave(gate: { current: boolean }): void {
  gate.current = false;
}

/**
 * Write the goal once. On success, close the sheet, toast, then reload
 * without waiting. On failure, leave the sheet open and return the error.
 */
export async function commitGoalSave(input: {
  write: () => Promise<void>;
  close: () => void;
  toast: (text: string) => void;
  reload: () => Promise<void> | void;
}): Promise<string | null> {
  try {
    await input.write();
  } catch (error) {
    return assetSaveNotice(error).message;
  }
  input.close();
  input.toast(GOAL_SAVED_TOAST);
  void input.reload();
  return null;
}
