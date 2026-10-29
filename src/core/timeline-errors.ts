export const PARENT_DELETED_MESSAGE = '这个账户已经删除了';
export const ACCOUNT_HAS_HOLDINGS_MESSAGE = '先移除这个账户里的持仓';
export const IMMUTABLE_COLUMN_MESSAGE = '代码和账户不能修改，请删除后重新添加';
export const RECORD_DELETED_MESSAGE = '这条记录已在其他设备删除';
export const SAVE_FAILED_MESSAGE = '保存失败，请重试';
export const FUTURE_DAY_MESSAGE = '不能选择未来的日期';
export const JOURNAL_BODY_MESSAGE = '正文需要 1 到 2000 字';
export const JOURNAL_MOOD_MESSAGE = '心情只能从 1 到 5 里选';
export const JOURNAL_TAGS_MESSAGE = '标签最多 5 个，每个 1 到 20 字';

export type TimelineSaveKind =
  | 'duplicate-symbol'
  | 'parent-deleted'
  | 'account-has-holdings'
  | 'immutable-column'
  | 'record-deleted'
  | 'journal-constraint'
  | 'other';

export type TimelineSaveNotice = {
  kind: TimelineSaveKind;
  message: string;
  /** Close the sheet and reload. The row is already gone. */
  refresh: boolean;
};

/** §8 copy, plus journal check failures (23514) from the entry-day and tag triggers. */
export function timelineSaveNotice(error: unknown, symbol?: string): TimelineSaveNotice {
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
  if (code === '23514') {
    return { kind: 'journal-constraint', message: journalConstraintCopy(message), refresh: false };
  }
  return { kind: 'other', message: SAVE_FAILED_MESSAGE, refresh: false };
}

function journalConstraintCopy(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('after today')) return FUTURE_DAY_MESSAGE;
  if (text.includes('tag')) return JOURNAL_TAGS_MESSAGE;
  if (text.includes('mood')) return JOURNAL_MOOD_MESSAGE;
  if (text.includes('body')) return JOURNAL_BODY_MESSAGE;
  return SAVE_FAILED_MESSAGE;
}

function readCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function readMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (!error || typeof error !== 'object' || !('message' in error)) return '';
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}
