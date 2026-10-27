import { expect, test } from '@jest/globals';

import { assetSaveNotice } from './asset-errors';

test('maps asset write errors to the design copy', () => {
  expect(assetSaveNotice({ code: '23505', message: 'duplicate' }, 'AAA')).toEqual({
    kind: 'duplicate-symbol',
    message: '这个账户里已经有 AAA 了',
    refresh: false,
  });
  expect(assetSaveNotice({ code: 'P0001', message: 'parent deleted' }).message).toBe('这个账户已经删除了');
  expect(assetSaveNotice({ code: 'P0001', message: 'parent deleted' }).refresh).toBe(true);
  expect(assetSaveNotice({ code: 'P0001', message: 'account has holdings' }).message).toBe('先移除这个账户里的持仓');
  expect(assetSaveNotice({ code: 'P0001', message: 'immutable column' }).message).toBe(
    '代码和账户不能修改，请删除后重新添加',
  );
  expect(assetSaveNotice({ code: 'P0001', message: 'record deleted' }).message).toBe('这条记录已在其他设备删除');
  expect(assetSaveNotice({ code: 'P0001', message: 'something else' }).message).toBe('保存失败，请重试');
  expect(assetSaveNotice(new Error('network')).message).toBe('保存失败，请重试');
});
