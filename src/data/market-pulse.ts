import {
  buildCustomInstrument,
  buildSeedQuoteItem,
  type ColorConvention,
  DEFAULT_MARKET_INSTRUMENTS,
  type MarketInstrument,
  type MarketQuoteItem,
  marketSessionInfo,
  parseTencentQuoteLine,
  type RefreshIntervalSec,
  synthesizeSparkline,
} from '@/core/market-pulse';

const WATCHLIST_KEY = 'viastela.market.watchlist.v1';
const CACHE_KEY = 'viastela.market.quotes.v1';
const COLOR_CONV_KEY = 'viastela.market.color_convention.v1';
const INTERVAL_KEY = 'viastela.market.refresh_sec.v1';
const FINNHUB_KEY = 'viastela.market.finnhub_key.v1';

export function readColorConvention(): ColorConvention {
  try {
    if (typeof localStorage === 'undefined') return 'intl';
    return localStorage.getItem(COLOR_CONV_KEY) === 'cn' ? 'cn' : 'intl';
  } catch {
    return 'intl';
  }
}

export function writeColorConvention(next: ColorConvention): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(COLOR_CONV_KEY, next);
    }
  } catch {
    // Ignore storage error
  }
}

export function readRefreshIntervalSec(): RefreshIntervalSec {
  try {
    if (typeof localStorage === 'undefined') return 15;
    const raw = Number(localStorage.getItem(INTERVAL_KEY));
    if (raw === 0 || raw === 15 || raw === 60) return raw;
    return 15;
  } catch {
    return 15;
  }
}

export function writeRefreshIntervalSec(sec: RefreshIntervalSec): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(INTERVAL_KEY, String(sec));
    }
  } catch {
    // Ignore storage error
  }
}

export function readFinnhubApiKey(): string {
  try {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(FINNHUB_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function writeFinnhubApiKey(token: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const clean = token.trim();
    if (clean) localStorage.setItem(FINNHUB_KEY, clean);
    else localStorage.removeItem(FINNHUB_KEY);
  } catch {
    // Ignore storage error
  }
}

export function readCustomWatchlist(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().toUpperCase());
  } catch {
    return [];
  }
}

export function writeCustomWatchlist(symbols: readonly string[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...new Set(symbols)]));
    }
  } catch {
    // Ignore storage error
  }
}

export function buildActiveInstruments(
  holdingSymbols: readonly string[],
  customSymbols: readonly string[],
): MarketInstrument[] {
  const map = new Map<string, MarketInstrument>();
  for (const inst of DEFAULT_MARKET_INSTRUMENTS) {
    map.set(inst.symbol, inst);
  }
  for (const sym of [...holdingSymbols, ...customSymbols]) {
    const clean = sym.trim().toUpperCase();
    if (!clean || map.has(clean)) continue;
    map.set(clean, buildCustomInstrument(clean));
  }
  return [...map.values()];
}

function readCachedMap(): Record<string, MarketQuoteItem> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, MarketQuoteItem>) : {};
  } catch {
    return {};
  }
}

function writeCachedMap(items: readonly MarketQuoteItem[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const map: Record<string, MarketQuoteItem> = {};
    for (const item of items) {
      map[item.symbol] = item;
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
    const win = globalThis as unknown as {
      __VIASTELA_LIVE_QUOTES__?: Record<string, number>;
    };
    win.__VIASTELA_LIVE_QUOTES__ = win.__VIASTELA_LIVE_QUOTES__ ?? {};
    for (const item of items) {
      if (item.price > 0) {
        win.__VIASTELA_LIVE_QUOTES__[item.symbol] = item.price;
      }
    }
  } catch {
    // Ignore storage error
  }
}

/**
 * Loads Tencent Finance quotes via `<script src="https://qt.gtimg.cn/q=...">` on Web/WKWebView
 * so there are zero CORS blocks and zero API keys required.
 */
async function fetchTencentScriptQuotes(
  codes: readonly string[],
): Promise<Map<string, { name: string; price: number; change: number; changePct: number }>> {
  const result = new Map<string, { name: string; price: number; change: number; changePct: number }>();
  if (codes.length === 0 || typeof document === 'undefined' || typeof window === 'undefined') {
    return result;
  }

  // Skip external network calls inside localhost Playwright E2E test runner
  if (
    window.location?.hostname === '127.0.0.1' &&
    window.location?.port === '4173'
  ) {
    return result;
  }

  await new Promise<void>((resolve) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      script.remove();
      resolve();
    }, 3200);
    script.src = `https://qt.gtimg.cn/q=${codes.join(',')}&_t=${Date.now()}`;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      script.remove();
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      resolve();
    };
    document.head.appendChild(script);
  });

  const win = window as unknown as Record<string, unknown>;
  for (const code of codes) {
    const varName = `v_${code}`;
    const rawVal = win[varName];
    if (typeof rawVal === 'string') {
      const parsed = parseTencentQuoteLine(`${varName}="${rawVal}"`);
      if (parsed) {
        result.set(code, {
          name: parsed.name,
          price: parsed.price,
          change: parsed.change,
          changePct: parsed.changePct,
        });
      }
    }
  }
  return result;
}

async function fetchBtcAndFxLive(): Promise<{
  btcPrice?: number;
  usdCny?: number;
  usdSgd?: number;
}> {
  if (
    typeof window !== 'undefined' &&
    window.location?.hostname === '127.0.0.1' &&
    window.location?.port === '4173'
  ) {
    return {};
  }

  const out: { btcPrice?: number; usdCny?: number; usdSgd?: number } = {};
  await Promise.allSettled([
    (async () => {
      const res = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
      if (!res.ok) return;
      const json = (await res.json()) as { data?: { amount?: string } };
      const price = Number.parseFloat(json.data?.amount ?? '');
      if (Number.isFinite(price) && price > 0) out.btcPrice = price;
    })(),
    (async () => {
      const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY,SGD');
      if (!res.ok) return;
      const json = (await res.json()) as { rates?: { CNY?: number; SGD?: number } };
      if (typeof json.rates?.CNY === 'number') out.usdCny = json.rates.CNY;
      if (typeof json.rates?.SGD === 'number') out.usdSgd = json.rates.SGD;
    })(),
  ]);
  return out;
}

async function fetchFinnhubLive(
  instruments: readonly MarketInstrument[],
  apiKey: string,
): Promise<Map<string, { price: number; change: number; changePct: number }>> {
  const map = new Map<string, { price: number; change: number; changePct: number }>();
  if (!apiKey) return map;

  const targets = instruments.filter((inst) => inst.finnhubSymbol);
  await Promise.allSettled(
    targets.map(async (inst) => {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(inst.finnhubSymbol!)}&token=${encodeURIComponent(apiKey)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { c?: number; d?: number; dp?: number };
      if (typeof data.c === 'number' && data.c > 0) {
        map.set(inst.symbol, {
          price: data.c,
          change: typeof data.d === 'number' ? data.d : 0,
          changePct: typeof data.dp === 'number' ? data.dp : 0,
        });
      }
    }),
  );
  return map;
}

export function loadInitialMarketQuotes(
  holdingSymbols: readonly string[] = [],
  customSymbols: readonly string[] = readCustomWatchlist(),
): MarketQuoteItem[] {
  const now = new Date();
  const cached = readCachedMap();
  const instruments = buildActiveInstruments(holdingSymbols, customSymbols);
  return instruments.map((inst) => {
    const hit = cached[inst.symbol];
    if (hit) {
      const session = marketSessionInfo(inst.category, now);
      return {
        ...hit,
        sessionLabel: session.label,
        isOpen: session.isOpen,
      };
    }
    return buildSeedQuoteItem(inst, now);
  });
}

export async function refreshMarketQuotes(
  holdingSymbols: readonly string[] = [],
  customSymbols: readonly string[] = readCustomWatchlist(),
): Promise<MarketQuoteItem[]> {
  const now = new Date();
  const cached = readCachedMap();
  const instruments = buildActiveInstruments(holdingSymbols, customSymbols);
  const tencentCodes = instruments
    .map((inst) => inst.tencentCode)
    .filter((code): code is string => Boolean(code));

  const finnhubKey = readFinnhubApiKey();
  const [tencentMap, macroLive, finnhubMap] = await Promise.all([
    fetchTencentScriptQuotes(tencentCodes),
    fetchBtcAndFxLive(),
    fetchFinnhubLive(instruments, finnhubKey),
  ]);

  const updated = instruments.map((inst): MarketQuoteItem => {
    const prev = cached[inst.symbol] ?? buildSeedQuoteItem(inst, now);
    const session = marketSessionInfo(inst.category, now);

    // 1. Check Finnhub override if configured
    const fh = finnhubMap.get(inst.symbol);
    if (fh) {
      return {
        ...prev,
        price: fh.price,
        change: fh.change,
        changePct: fh.changePct,
        sparkline: synthesizeSparkline(fh.price, fh.change, prev.sparkline),
        asOf: now.toISOString(),
        source: 'finnhub',
        sessionLabel: session.label,
        isOpen: session.isOpen,
      };
    }

    // 2. Check Tencent Live Feed (US / HK / CN Indices & Equities)
    if (inst.tencentCode) {
      const tc = tencentMap.get(inst.tencentCode);
      if (tc) {
        return {
          ...prev,
          name: inst.name === inst.symbol && tc.name ? tc.name : inst.name,
          price: tc.price,
          change: tc.change,
          changePct: tc.changePct,
          sparkline: synthesizeSparkline(tc.price, tc.change, prev.sparkline),
          asOf: now.toISOString(),
          source: 'live',
          sessionLabel: session.label,
          isOpen: session.isOpen,
        };
      }
    }

    // 3. Check Macro (BTC / FX)
    if (inst.symbol === 'BTC' && macroLive.btcPrice) {
      const change = Number((macroLive.btcPrice - (prev.price - prev.change)).toFixed(2));
      const changePct = Number(((change / (macroLive.btcPrice - change)) * 100).toFixed(2));
      return {
        ...prev,
        price: macroLive.btcPrice,
        change,
        changePct,
        sparkline: synthesizeSparkline(macroLive.btcPrice, change, prev.sparkline),
        asOf: now.toISOString(),
        source: 'live',
        sessionLabel: session.label,
        isOpen: session.isOpen,
      };
    }
    if (inst.symbol === 'USD/CNY' && macroLive.usdCny) {
      const change = Number((macroLive.usdCny - 7.133).toFixed(4));
      const changePct = Number(((change / 7.133) * 100).toFixed(2));
      return {
        ...prev,
        price: macroLive.usdCny,
        change,
        changePct,
        sparkline: synthesizeSparkline(macroLive.usdCny, change, prev.sparkline),
        asOf: now.toISOString(),
        source: 'live',
        sessionLabel: session.label,
        isOpen: session.isOpen,
      };
    }
    if (inst.symbol === 'USD/SGD' && macroLive.usdSgd) {
      const change = Number((macroLive.usdSgd - 1.3232).toFixed(4));
      const changePct = Number(((change / 1.3232) * 100).toFixed(2));
      return {
        ...prev,
        price: macroLive.usdSgd,
        change,
        changePct,
        sparkline: synthesizeSparkline(macroLive.usdSgd, change, prev.sparkline),
        asOf: now.toISOString(),
        source: 'live',
        sessionLabel: session.label,
        isOpen: session.isOpen,
      };
    }

    return {
      ...prev,
      sessionLabel: session.label,
      isOpen: session.isOpen,
    };
  });

  writeCachedMap(updated);
  return updated;
}
