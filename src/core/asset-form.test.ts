import { expect, test } from '@jest/globals';

import {
  COST_TOTAL_HELPER,
  COST_TOTAL_LABEL,
  accountNameError,
  deletedAccountUndo,
  holdingCostEstimate,
  normalizeSymbol,
  parseAmount,
  symbolError,
} from './asset-form';

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

test('total cost is for every share: 10 shares at 1500 is 150 each and 1500 total', () => {
  expect(COST_TOTAL_LABEL).toBe('总成本（US$）');
  expect(COST_TOTAL_HELPER).toBe('这笔持仓全部股数的总成本');
  expect(holdingCostEstimate(10, 1500)).toEqual({ unitUsd: 150, totalUsd: 1500 });
});
