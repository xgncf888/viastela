/**
 * Market data providers.
 * `FakeQuoteProvider` is for tests and a local harness. `index.ts` never
 * constructs it: a missing `FINNHUB_API_KEY` stays on cost-basis estimates.
 * Responses from this module never use the source value `fake`.
 */

export const FINNHUB_CONCURRENCY = 4;
export const FINNHUB_PER_MINUTE = 60;
const FINNHUB_WINDOW_MS = 60_000;
const FINNHUB_QUOTE_URL = 'https://finnhub.io/api/v1/quote';
const FRANKFURTER_URL = 'https://api.frankfurter.app/latest';

export type ProviderQuote = {
  symbol: string;
  price: number | null;
  currency: string;
  as_of: string;
};

export type ProviderRate = {
  base: string;
  quote: string;
  rate: number;
  as_of: string;
};

export interface QuoteProvider {
  getQuotes(symbols: string[]): Promise<ProviderQuote[]>;
}

export interface FxProvider {
  getRates(base: string, quotes: string[]): Promise<ProviderRate[]>;
}

export type ProviderClock = {
  now(): number;
  wait(ms: number): Promise<void>;
};

const systemClock: ProviderClock = {
  now: () => Date.now(),
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class FinnhubQuoteProvider implements QuoteProvider {
  private hits: number[] = [];

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly clock: ProviderClock = systemClock,
  ) {}

  async getQuotes(symbols: string[]): Promise<ProviderQuote[]> {
    return mapPool(symbols, FINNHUB_CONCURRENCY, (symbol) => this.fetchSymbol(symbol));
  }

  private async fetchSymbol(symbol: string): Promise<ProviderQuote> {
    await this.takeSlot();
    const url = new URL(FINNHUB_QUOTE_URL);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('token', this.apiKey);
    let response: Response;
    try {
      response = await this.fetchImpl(url);
    } catch {
      throw new Error('quote provider failed');
    }
    if (!response.ok) throw new Error('quote provider failed');
    let body: { c?: unknown; t?: unknown };
    try {
      body = await response.json();
    } catch {
      throw new Error('quote provider failed');
    }
    const current = typeof body.c === 'number' ? body.c : Number.NaN;
    const timestamp = typeof body.t === 'number' ? body.t : 0;
    const missing = current === 0 && timestamp === 0;
    if (!Number.isFinite(current) || current < 0 || missing) {
      return {
        symbol,
        price: null,
        currency: 'USD',
        as_of: new Date(this.clock.now()).toISOString(),
      };
    }
    const asOf = timestamp > 0
      ? new Date(timestamp * 1000).toISOString()
      : new Date(this.clock.now()).toISOString();
    return { symbol, price: current, currency: 'USD', as_of: asOf };
  }

  private async takeSlot(): Promise<void> {
    while (true) {
      const now = this.clock.now();
      this.hits = this.hits.filter((hit) => now - hit < FINNHUB_WINDOW_MS);
      if (this.hits.length < FINNHUB_PER_MINUTE) {
        this.hits.push(now);
        return;
      }
      const oldest = this.hits[0] ?? now;
      await this.clock.wait(Math.max(0, FINNHUB_WINDOW_MS - (now - oldest)));
    }
  }
}

export class FrankfurterFxProvider implements FxProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async getRates(base: string, quotes: string[]): Promise<ProviderRate[]> {
    if (quotes.length === 0) return [];
    const url = new URL(FRANKFURTER_URL);
    url.searchParams.set('from', base);
    url.searchParams.set('to', quotes.join(','));
    let response: Response;
    try {
      response = await this.fetchImpl(url);
    } catch {
      throw new Error('fx provider failed');
    }
    if (!response.ok) throw new Error('fx provider failed');
    let body: { date?: unknown; rates?: unknown };
    try {
      body = await response.json();
    } catch {
      throw new Error('fx provider failed');
    }
    const rates = body.rates;
    const asOf = typeof body.date === 'string' ? body.date : '';
    if (!rates || typeof rates !== 'object' || !asOf) throw new Error('fx provider failed');
    return quotes.map((quote) => {
      const rate = (rates as Record<string, unknown>)[quote];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        throw new Error('fx provider failed');
      }
      return { base, quote, rate, as_of: asOf };
    });
  }
}

/** Deterministic stand-in for tests and local harnesses. Not selected by `index.ts`. */
export class FakeQuoteProvider implements QuoteProvider {
  calls = 0;
  seen: string[][] = [];
  fail = false;

  constructor(
    private readonly prices: Readonly<Record<string, number>>,
    private readonly asOf: () => string,
  ) {}

  async getQuotes(symbols: string[]): Promise<ProviderQuote[]> {
    this.calls += 1;
    this.seen.push([...symbols]);
    if (this.fail) throw new Error('quote provider failed');
    return symbols.map((symbol) => {
      const price = this.prices[symbol];
      if (price === undefined || !Number.isFinite(price) || price < 0) {
        return { symbol, price: null, currency: 'USD', as_of: this.asOf() };
      }
      return { symbol, price, currency: 'USD', as_of: this.asOf() };
    });
  }
}

export class FakeFxProvider implements FxProvider {
  calls = 0;
  fail = false;

  constructor(
    private readonly rates: Readonly<Record<string, number>>,
    private readonly asOf: string,
  ) {}

  async getRates(base: string, quotes: string[]): Promise<ProviderRate[]> {
    this.calls += 1;
    if (this.fail) throw new Error('fx provider failed');
    return quotes.map((quote) => {
      const rate = this.rates[quote];
      if (rate === undefined || !Number.isFinite(rate) || rate <= 0) {
        throw new Error('fx provider failed');
      }
      return { base, quote, rate, as_of: this.asOf };
    });
  }
}

async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await fn(item);
    }
  });
  await Promise.all(workers);
  return results;
}
