export const SYMBOL_PATTERN = /^[A-Z][A-Z.]{0,9}$/;
export const SYMBOL_HINT = '代码只能是大写字母和点，例如 AAPL、BRK.B';
export const HOLDING_CODE_HINT = '要换代码，请删除后重新添加';
export const COST_BASIS_HINT = '不填就无法在取不到价格时估算';
export const COST_TOTAL_LABEL = '总成本（US$）';
export const COST_TOTAL_HELPER = '这笔持仓全部股数的总成本';
export const QUANTITY_COST_HINT = '股数变了，请同时核对总成本';

/** `totalCostUsd` is the whole holding, not a per-share price. */
export function holdingCostEstimate(quantity: number, totalCostUsd: number): { unitUsd: number; totalUsd: number } {
  return { unitUsd: totalCostUsd / quantity, totalUsd: totalCostUsd };
}
export const DELETED_ACCOUNT_UNDO = '已删除 {name}，它的余额不再计入总资产';

export function normalizeSymbol(input: string): string {
  return input.trim().toUpperCase();
}

export function symbolError(symbol: string): string | null {
  if (!SYMBOL_PATTERN.test(symbol)) return SYMBOL_HINT;
  return null;
}

export function accountNameError(name: string): string | null {
  const trimmed = name.trim();
  if ([...trimmed].length < 1 || [...trimmed].length > 40) return '名称需要 1 到 40 个字';
  return null;
}

export function parseAmount(input: string): number | null {
  const text = input.trim().replace(/,/g, '');
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function quantityError(quantity: number | null): string | null {
  if (quantity === null || quantity <= 0) return '股数要大于 0';
  return null;
}

export function deletedAccountUndo(name: string): string {
  return DELETED_ACCOUNT_UNDO.replace('{name}', name);
}
