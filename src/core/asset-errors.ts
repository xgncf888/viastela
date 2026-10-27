export const PARENT_DELETED_MESSAGE = '这个账户已经删除了';
export const ACCOUNT_HAS_HOLDINGS_MESSAGE = '先移除这个账户里的持仓';
export const IMMUTABLE_COLUMN_MESSAGE = '代码和账户不能修改，请删除后重新添加';
export const RECORD_DELETED_MESSAGE = '这条记录已在其他设备删除';
export const SAVE_FAILED_MESSAGE = '保存失败，请重试';

export type AssetSaveKind =
  | 'duplicate-symbol'
  | 'parent-deleted'
  | 'account-has-holdings'
  | 'immutable-column'
  | 'record-deleted'
  | 'other';

export type AssetSaveNotice = {
  kind: AssetSaveKind;
  message: string;
  /** Close the sheet and reload. Parent and record deletes are already gone. */
  refresh: boolean;
};

export function assetSaveNotice(error: unknown, symbol?: string): AssetSaveNotice {
  const code = readCode(error);
  const message = readMessage(error);
  if (code === '23505') {
    const name = symbol && symbol.trim().length > 0 ? symbol.trim() : '该代码';
    return { kind: 'duplicate-symbol', message: `这个账户里已经有 ${name} 了`, refresh: false };
  }
  if (code === 'P0001' && message === 'parent deleted') {
    return { kind: 'parent-deleted', message: PARENT_DELETED_MESSAGE, refresh: true };
  }
  if (code === 'P0001' && message === 'account has holdings') {
    return { kind: 'account-has-holdings', message: ACCOUNT_HAS_HOLDINGS_MESSAGE, refresh: false };
  }
  if (code === 'P0001' && message === 'immutable column') {
    return { kind: 'immutable-column', message: IMMUTABLE_COLUMN_MESSAGE, refresh: false };
  }
  if (code === 'P0001' && message === 'record deleted') {
    return { kind: 'record-deleted', message: RECORD_DELETED_MESSAGE, refresh: true };
  }
  return { kind: 'other', message: SAVE_FAILED_MESSAGE, refresh: false };
}

function readCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function readMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) return '';
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}
