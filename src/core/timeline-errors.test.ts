import { describe, expect, it } from '@jest/globals';

import { IMMUTABLE_COLUMN_MESSAGE, timelineSaveNotice } from './timeline-errors';

describe('timeline save errors', () => {
  it('maps section 8 database errors and journal 23514 checks', () => {
    expect(timelineSaveNotice({ code: '23505', message: 'duplicate' }, 'AAPL').message).toBe(
      '这个账户里已经有 AAPL 了',
    );
    expect(timelineSaveNotice({ code: 'P0001', message: 'parent deleted' })).toEqual({
      kind: 'parent-deleted',
      message: '这个账户已经删除了',
      refresh: true,
    });
    expect(timelineSaveNotice({ code: 'P0001', message: 'account has holdings' }).message).toBe(
      '先移除这个账户里的持仓',
    );
    expect(timelineSaveNotice({ code: 'P0001', message: 'immutable column' }).message).toBe(IMMUTABLE_COLUMN_MESSAGE);
    expect(IMMUTABLE_COLUMN_MESSAGE).toBe('代码和账户不能修改，请删除后重新添加');
    expect(timelineSaveNotice({ code: 'P0001', message: 'record deleted' })).toMatchObject({
      kind: 'record-deleted',
      message: '这条记录已在其他设备删除',
      refresh: true,
    });
    expect(timelineSaveNotice({ code: 'P0001', message: 'record deleted ' }).message).toBe('保存失败，请重试');
    expect(
      timelineSaveNotice({
        code: '23514',
        message: 'entry_day 2026-10-28 is after today 2026-10-27 in Asia/Singapore',
      }).message,
    ).toBe('不能选择未来的日期');
    expect(timelineSaveNotice({ code: '23514', message: 'journal tags must contain at most 5 values' }).message).toBe(
      '标签最多 5 个，每个 1 到 20 字',
    );
    expect(timelineSaveNotice({ code: '23514', message: 'journal tag length must be 1 to 20' }).message).toBe(
      '标签最多 5 个，每个 1 到 20 字',
    );
    expect(timelineSaveNotice({ code: '23514', message: 'violates check constraint "journal_mood_range"' }).message).toBe(
      '心情只能从 1 到 5 里选',
    );
    expect(timelineSaveNotice({ code: '23514', message: 'violates check constraint "journal_body_present"' }).message).toBe(
      '正文需要 1 到 2000 字',
    );
    expect(timelineSaveNotice({ code: '23514', message: 'journal_tz_present' }).message).toBe('保存失败，请重试');
    expect(timelineSaveNotice(new Error('network')).message).toBe('保存失败，请重试');
  });
});
