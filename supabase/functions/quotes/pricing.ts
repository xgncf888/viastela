import { computeLocalDay } from '../../../src/core/local-day.ts';
import {
  convertToUsdMinor,
  formatMoney,
  moneyNumber,
  parseMoney,
  parsePrice,
  parseQuantity,
  positionValueMinor,
  priceNumber,
  unitPriceMinor,
} from './money.ts';
import type { FxProvider, QuoteProvider } from './providers.ts';
import {
  QUOTE_FRESH_MS,
  type CashBalance,
  type CashCurrency,
  type FxCacheRow,
  type FxLine,
  type HoldingRow,
  type QuoteCacheRow,
  type QuoteLine,
  type QuoteSource,
  type QuoteStatus,
  type QuotesResponse,
  type SnapshotState,
  type SnapshotWrite,
} from './types.ts';

const FX_BASE = 'USD';

export type ValuationInput = {
  now: Date;
  timeZone: string;
  daySwitch: string;
  userId: string;
  source: QuoteSource;
  holdings: readonly HoldingRow[];
  balances: readonly CashBalance[];
  requested: readonly string[] | null;
  quoteProvider: QuoteProvider | null;
  fxProvider: FxProvider;
  readQuoteCache: (symbols: string[]) => Promise<QuoteCacheRow[]>;
  writeQuoteCache: (rows: QuoteCacheRow[]) => Promise<void>;
  readFxCache: (base: string, quotes: string[], day: string) => Promise<FxCacheRow[]>;
  writeFxCache: (rows: FxCacheRow[]) => Promise<void>;
};

export type Valuation =
  | { ok: true; body: QuotesResponse; snapshot: SnapshotWrite | null }
  | { ok: false; error: 'quote_unavailable' | 'fx_unavailable' };

type Position = {
  symbol: string;
  quantityMinor: bigint;
  costMinor: bigint | null;
};

type Priced = {
  symbol: string;
  priceMinor: bigint | null;
  /** Sum of lot costs when every lot has one. Used for cost-basis totals. */
  costMinor: bigint | null;
  currency: string;
  asOf: string;
  status: QuoteStatus;
  quantityMinor: bigint;
};

/**
 * Write today's snapshot only when every holding has a real Finnhub quote
 * (fresh or stale). Cost-basis estimates and unavailable holdings skip it.
 * No holdings and at least one cash balance still writes. An empty book does not.
 */
export function snapshotAction(
  holdingStatuses: readonly QuoteStatus[],
  source: QuoteSource,
  hasCash: boolean,
): SnapshotState {
  if (holdingStatuses.length === 0) return hasCash ? 'written' : 'skipped';
  if (source !== 'finnhub') return 'skipped';
  const real = holdingStatuses.every((status) => status === 'fresh' || status === 'stale');
  return real ? 'written' : 'skipped';
}

export async function valuate(input: ValuationInput): Promise<Valuation> {
  const positions = aggregate(input.holdings);
  const heldSymbols = new Set(positions.map((position) => position.symbol));
  const priced = await pricePositions(input, positions);
  if (!priced.ok) return priced;

  const fx = await loadFx(input, cashCurrencies(input.balances));
  if (!fx.ok) return fx;

  const cashMinor = valueCash(input.balances, fx.rates);
  if (cashMinor === null) return { ok: false, error: 'fx_unavailable' };
  const securitiesMinor = valueSecurities(priced.rows, input.source);
  const totalMinor = cashMinor + securitiesMinor;
  const holdingStatuses = priced.rows.map((row) => row.status);
  const currenciesKnown = priced.rows.every(
    (row) => row.status === 'unavailable' || row.currency === FX_BASE,
  );
  const state = currenciesKnown
    ? snapshotAction(holdingStatuses, input.source, input.balances.length > 0)
    : 'skipped';
  const asOf = input.now.toISOString();
  const localDay = computeLocalDay(input.now, input.timeZone, input.daySwitch);
  const quotes = responseQuotes(input.requested, heldSymbols, priced.rows, asOf);
  const body: QuotesResponse = {
    quotes,
    rates: fx.lines,
    source: input.source,
    total_usd: moneyNumber(totalMinor),
    cash_usd: moneyNumber(cashMinor),
    securities_usd: moneyNumber(securitiesMinor),
    unpriced: holdingStatuses.filter((status) => status === 'unavailable').length,
    stale: holdingStatuses.some((status) => status === 'stale'),
    snapshot: state,
  };
  const snapshot = state === 'written'
    ? {
      userId: input.userId,
      localDay,
      tz: input.timeZone,
      totalUsd: body.total_usd,
      cashUsd: body.cash_usd,
      securitiesUsd: body.securities_usd,
      asOf,
    }
    : null;
  return { ok: true, body, snapshot };
}

function aggregate(holdings: readonly HoldingRow[]): Position[] {
  const bySymbol = new Map<string, Position>();
  for (const holding of holdings) {
    const quantityMinor = parseQuantity(holding.quantity);
    const current = bySymbol.get(holding.symbol);
    if (!current) {
      bySymbol.set(holding.symbol, {
        symbol: holding.symbol,
        quantityMinor: quantityMinor ?? 0n,
        costMinor: quantityMinor === null ? null : costOf(holding.costBasisUsd),
      });
      continue;
    }
    if (quantityMinor === null || current.quantityMinor <= 0n) {
      current.quantityMinor = 0n;
      current.costMinor = null;
      continue;
    }
    current.quantityMinor += quantityMinor;
    const cost = costOf(holding.costBasisUsd);
    current.costMinor = current.costMinor === null || cost === null ? null : current.costMinor + cost;
  }
  return [...bySymbol.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
}

function costOf(value: string | null): bigint | null {
  if (value === null) return null;
  const minor = parseMoney(value);
  if (minor === null || minor < 0n) return null;
  return minor;
}

async function pricePositions(
  input: ValuationInput,
  positions: readonly Position[],
): Promise<{ ok: true; rows: Priced[] } | { ok: false; error: 'quote_unavailable' }> {
  if (input.source === 'cost_basis') {
    return { ok: true, rows: positions.map((position) => priceFromCost(position, input.now.toISOString())) };
  }
  if (!input.quoteProvider) return { ok: false, error: 'quote_unavailable' };
  if (positions.length === 0) return { ok: true, rows: [] };

  const symbols = positions.map((position) => position.symbol);
  const cached = await input.readQuoteCache(symbols);
  const cacheBySymbol = new Map(cached.map((row) => [row.symbol, row]));
  const fresh = new Map<string, QuoteCacheRow>();
  const staleSymbols: string[] = [];
  for (const symbol of symbols) {
    const row = cacheBySymbol.get(symbol);
    if (row && isFresh(row.asOf, input.now.getTime())) fresh.set(symbol, row);
    else staleSymbols.push(symbol);
  }

  const fetched = new Map<string, { price: number | null; currency: string; asOf: string }>();
  if (staleSymbols.length > 0) {
    try {
      const batch = await input.quoteProvider.getQuotes(staleSymbols);
      for (const quote of batch) {
        fetched.set(quote.symbol, {
          price: quote.price,
          currency: quote.currency || 'USD',
          asOf: quote.as_of,
        });
      }
      const writes: QuoteCacheRow[] = [];
      for (const symbol of staleSymbols) {
        const quote = fetched.get(symbol);
        if (!quote || quote.price === null) continue;
        const priceMinor = parsePrice(quote.price);
        if (priceMinor === null) continue;
        writes.push({
          symbol,
          price: priceNumber(priceMinor),
          currency: quote.currency.toUpperCase(),
          asOf: quote.asOf,
        });
      }
      if (writes.length > 0) await input.writeQuoteCache(writes);
    } catch {
      const fallback: Priced[] = [];
      let anyCache = false;
      for (const position of positions) {
        const hit = fresh.get(position.symbol) ?? cacheBySymbol.get(position.symbol);
        if (!hit || parsePrice(hit.price) === null) {
          fallback.push(unavailablePosition(position, input.now.toISOString()));
          continue;
        }
        anyCache = true;
        const fromFresh = fresh.has(position.symbol);
        fallback.push(fromCache(position, hit, fromFresh ? 'fresh' : 'stale'));
      }
      if (!anyCache) return { ok: false, error: 'quote_unavailable' };
      return { ok: true, rows: fallback };
    }
  }

  const rows = positions.map((position) => {
    const hit = fresh.get(position.symbol);
    if (hit) return fromCache(position, hit, 'fresh');
    const quote = fetched.get(position.symbol);
    if (!quote || quote.price === null) return unavailablePosition(position, input.now.toISOString());
    const priceMinor = parsePrice(quote.price);
    if (priceMinor === null) return unavailablePosition(position, input.now.toISOString());
    return {
      symbol: position.symbol,
      priceMinor,
      costMinor: position.costMinor,
      currency: quote.currency.toUpperCase(),
      asOf: quote.asOf,
      status: 'fresh' as const,
      quantityMinor: position.quantityMinor,
    };
  });
  return { ok: true, rows };
}

function priceFromCost(position: Position, asOf: string): Priced {
  if (position.costMinor === null || position.quantityMinor <= 0n) {
    return unavailablePosition(position, asOf);
  }
  const priceMinor = unitPriceMinor(position.costMinor, position.quantityMinor);
  if (priceMinor === null) return unavailablePosition(position, asOf);
  return {
    symbol: position.symbol,
    priceMinor,
    costMinor: position.costMinor,
    currency: 'USD',
    asOf,
    status: 'fresh',
    quantityMinor: position.quantityMinor,
  };
}

function unavailablePosition(position: Position, asOf: string): Priced {
  return {
    symbol: position.symbol,
    priceMinor: null,
    costMinor: position.costMinor,
    currency: 'USD',
    asOf,
    status: 'unavailable',
    quantityMinor: position.quantityMinor,
  };
}

function fromCache(position: Position, row: QuoteCacheRow, status: QuoteStatus): Priced {
  return {
    symbol: position.symbol,
    priceMinor: parsePrice(row.price),
    costMinor: position.costMinor,
    currency: row.currency.toUpperCase(),
    asOf: row.asOf,
    status,
    quantityMinor: position.quantityMinor,
  };
}

function isFresh(asOf: string, now: number): boolean {
  const then = Date.parse(asOf);
  if (Number.isNaN(then)) return false;
  const age = now - then;
  return age >= 0 && age <= QUOTE_FRESH_MS;
}

async function loadFx(
  input: ValuationInput,
  quotes: readonly CashCurrency[],
): Promise<{ ok: true; lines: FxLine[]; rates: Map<string, number> } | { ok: false; error: 'fx_unavailable' }> {
  const needed = quotes.filter((quote) => quote !== FX_BASE);
  const day = input.now.toISOString().slice(0, 10);
  if (needed.length === 0) return { ok: true, lines: [], rates: new Map() };
  const cached = await input.readFxCache(FX_BASE, [...needed], day);
  const rates = new Map<string, number>();
  for (const row of cached) {
    if (row.asOf === day && row.rate > 0) rates.set(row.quote, row.rate);
  }
  const missing = new Set<string>(needed.filter((quote) => !rates.has(quote)));
  if (missing.size > 0) {
    try {
      const batch = await input.fxProvider.getRates(FX_BASE, [...missing]);
      const writes: FxCacheRow[] = [];
      for (const rate of batch) {
        if (!missing.has(rate.quote) || rate.rate <= 0) continue;
        rates.set(rate.quote, rate.rate);
        writes.push({ base: FX_BASE, quote: rate.quote, rate: rate.rate, asOf: day });
      }
      if (writes.length > 0) await input.writeFxCache(writes);
    } catch {
      // Today's cache is the only fallback. Older days are not reused.
    }
  }
  if (needed.some((quote) => !rates.has(quote))) return { ok: false, error: 'fx_unavailable' };
  const lines = needed.map((quote) => ({
    base: FX_BASE,
    quote,
    rate: rates.get(quote) ?? 0,
    as_of: day,
  }));
  return { ok: true, lines, rates };
}

function cashCurrencies(balances: readonly CashBalance[]): CashCurrency[] {
  const seen = new Set<CashCurrency>();
  for (const balance of latestBalances(balances)) seen.add(balance.currency);
  return [...seen];
}

function latestBalances(balances: readonly CashBalance[]): CashBalance[] {
  const latest = new Map<string, CashBalance>();
  const ordered = [...balances].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  for (const balance of ordered) {
    if (!latest.has(balance.accountId)) latest.set(balance.accountId, balance);
  }
  return [...latest.values()];
}

function valueCash(balances: readonly CashBalance[], rates: Map<string, number>): bigint | null {
  let total = 0n;
  for (const balance of latestBalances(balances)) {
    const amount = parseMoney(balance.amount);
    if (amount === null) return null;
    if (balance.currency === FX_BASE) {
      total += amount;
      continue;
    }
    const rate = rates.get(balance.currency);
    if (rate === undefined) return null;
    const usd = convertToUsdMinor(amount, rate);
    if (usd === null) return null;
    total += usd;
  }
  return total;
}

function valueSecurities(rows: readonly Priced[], source: QuoteSource): bigint {
  let total = 0n;
  for (const row of rows) {
    if (row.status === 'unavailable' || row.priceMinor === null || row.quantityMinor <= 0n) continue;
    if (source === 'cost_basis') {
      if (row.costMinor !== null) total += row.costMinor;
      continue;
    }
    if (row.currency !== FX_BASE) continue;
    total += positionValueMinor(row.priceMinor, row.quantityMinor);
  }
  return total;
}

function responseQuotes(
  requested: readonly string[] | null,
  held: ReadonlySet<string>,
  rows: readonly Priced[],
  asOf: string,
): QuoteLine[] {
  const bySymbol = new Map(rows.map((row) => [row.symbol, toLine(row)]));
  if (!requested || requested.length === 0) {
    return [...bySymbol.values()];
  }
  const lines: QuoteLine[] = [];
  const seen = new Set<string>();
  for (const symbol of requested) {
    seen.add(symbol);
    if (held.has(symbol)) lines.push(bySymbol.get(symbol) ?? unavailableLine(symbol, asOf));
    else lines.push(unavailableLine(symbol, asOf));
  }
  for (const [symbol, line] of bySymbol) {
    if (!seen.has(symbol)) lines.push(line);
  }
  return lines;
}

function toLine(row: Priced): QuoteLine {
  return {
    symbol: row.symbol,
    price: row.priceMinor === null ? null : priceNumber(row.priceMinor),
    currency: row.currency,
    as_of: row.asOf,
    status: row.status,
  };
}

function unavailableLine(symbol: string, asOf: string): QuoteLine {
  return { symbol, price: null, currency: 'USD', as_of: asOf, status: 'unavailable' };
}

export function moneyText(value: number): string {
  return formatMoney(parseMoney(String(value)) ?? 0n);
}
