import { expect, test } from '@jest/globals';

import { accountNameError, deletedAccountUndo, normalizeSymbol, parseAmount, symbolError } from './asset-form';

test('symbols are uppercased and rejected when the shape is wrong', () => {
  expect(normalizeSymbol(' aaa ')).toBe('AAA');
  expect(symbolError('AAA')).toBeNull();
  expect(symbolError('BRK.B')).toBeNull();
  expect(symbolError('A1')).toBe('代码只能是大写字母和点，例如 AAPL、BRK.B');
});

test('account names, amounts, and the delete undo line', () => {
  expect(accountNameError('  ')).toBe('名称需要 1 到 40 个字');
  expect(accountNameError('现金')).toBeNull();
  expect(parseAmount('-4')).toBe(-4);
  expect(parseAmount('1,500')).toBe(1500);
  expect(parseAmount('abc')).toBeNull();
  expect(deletedAccountUndo('现金')).toBe('已删除 现金，它的余额不再计入总资产');
});
