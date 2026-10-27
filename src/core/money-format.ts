export type MoneyCurrency = 'USD' | 'SGD' | 'HKD' | 'CNY';

const PREFIX: Record<MoneyCurrency, string> = {
  USD: 'US$',
  SGD: 'S$',
  HKD: 'HK$',
  CNY: '¥',
};

/** USD `US$`, SGD `S$`, HKD `HK$`, CNY `¥`. Thousands separators, 2 decimal places. */
export function formatMoney(amount: number, currency: MoneyCurrency): string {
  if (!Number.isFinite(amount)) throw new Error('Amount must be finite');
  const negative = amount < 0;
  const [whole, fraction] = Math.abs(amount).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${PREFIX[currency]}${grouped}.${fraction}`;
}

/** Up to 6 decimal places, trailing zeros removed. */
export function formatShares(quantity: number): string {
  if (!Number.isFinite(quantity)) throw new Error('Quantity must be finite');
  const negative = quantity < 0;
  const [whole, fraction = ''] = Math.abs(quantity).toFixed(6).split('.');
  const trimmed = fraction.replace(/0+$/, '');
  const body = trimmed.length > 0 ? `${whole}.${trimmed}` : whole;
  return `${negative ? '-' : ''}${body}`;
}
