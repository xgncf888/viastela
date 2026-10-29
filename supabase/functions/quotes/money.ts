/** Fixed-point helpers for numeric(20,4) money and numeric(20,6) quantities. */

const MONEY_SCALE = 4;
const QUANTITY_SCALE = 6;

export function parseScaled(value: string | number, scale: number): bigint | null {
  const text = typeof value === 'number' ? String(value) : value.trim();
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) return null;
  const negative = text.startsWith('-');
  const unsigned = text.replace(/^[+-]/, '');
  const [whole, fraction = ''] = unsigned.split('.');
  const digits = (fraction + '0'.repeat(scale)).slice(0, scale);
  const roundUp = fraction.length > scale && fraction[scale] >= '5';
  let minor = BigInt(whole) * 10n ** BigInt(scale) + BigInt(digits || '0');
  if (roundUp) minor += 1n;
  return negative ? -minor : minor;
}

export function formatScaled(minor: bigint, scale: number): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const base = 10n ** BigInt(scale);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(scale, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function scaledToNumber(minor: bigint, scale: number): number {
  return Number(formatScaled(minor, scale));
}

export function parseMoney(value: string | number): bigint | null {
  return parseScaled(value, MONEY_SCALE);
}

export function formatMoney(minor: bigint): string {
  return formatScaled(minor, MONEY_SCALE);
}

export function moneyNumber(minor: bigint): number {
  return scaledToNumber(minor, MONEY_SCALE);
}

const PRICE_SCALE = 6;

/** Unit price at scale 6: cost(20,4) / quantity(20,6). */
export function unitPriceMinor(costMinor: bigint, quantityMinor: bigint): bigint | null {
  if (quantityMinor <= 0n) return null;
  return (costMinor * 10n ** BigInt(PRICE_SCALE + (PRICE_SCALE - MONEY_SCALE))) / quantityMinor;
}

/** price(scale 6) * quantity(scale 6) → money(scale 4). */
export function positionValueMinor(priceMinor: bigint, quantityMinor: bigint): bigint {
  return (priceMinor * quantityMinor) / 10n ** BigInt(PRICE_SCALE + PRICE_SCALE - MONEY_SCALE);
}

export function parsePrice(value: number): bigint | null {
  if (!Number.isFinite(value) || value < 0) return null;
  return parseScaled(value, PRICE_SCALE);
}

export function priceNumber(minor: bigint): number {
  return scaledToNumber(minor, PRICE_SCALE);
}

/** USD value of an amount in a currency quoted as units per 1 USD. */
export function convertToUsdMinor(amountMinor: bigint, rate: number): bigint | null {
  const rateMinor = parseScaled(rate, 10);
  if (rateMinor === null || rateMinor <= 0n) return null;
  return (amountMinor * 10n ** 10n) / rateMinor;
}

export function parseQuantity(value: string | number): bigint | null {
  const minor = parseScaled(value, QUANTITY_SCALE);
  if (minor === null || minor <= 0n) return null;
  return minor;
}

export const quantityScale = QUANTITY_SCALE;
export const moneyScale = MONEY_SCALE;
