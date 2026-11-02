import {
  buildCustomInstrument,
  buildSeedQuoteItem,
  type ColorConvention,
  DEFAULT_MARKET_INSTRUMENTS,
  downsampleSeries,
  type MarketInstrument,
  type MarketQuoteItem,
  marketSessionInfo,
  parseTencentMinuteSeries,
  parseTencentQuoteLine,
  parseYahooChartPayload,
  type RefreshIntervalSec,
  synthesizeSparkline,
  toTencentCandidateCodes,
  toTencentMinuteCode,
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

function isLocalhostPlaywrightTest(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.location?.hostname === '127.0.0.1' &&
    window.location?.port === '4173'
  );
}

function isNativeBridgeOrigin(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const proto = window.location.protocol || '';
  const host = window.location.hostname || '';
  return (
    proto === 'app:' ||
    proto === 'viastela-local:' ||
    host === 'appassets.androidplatform.net'
  );
}

/**
 * Loads Tencent Finance quotes via `<script src="https://qt.gtimg.cn/q=...">` on Web/WKWebView
 * so there are zero CORS blocks and zero API keys required.
 * Probing all candidate codes (`.OQ`, `.N`, `.AM`) resolves any US ticker automatically.
 */
async function fetchTencentScriptQuotes(
  codes: readonly string[],
): Promise<Map<string, { name: string; price: number; change: number; changePct: number }>> {
  const result = new Map<string, { name: string; price: number; change: number; changePct: number }>();
  const uniqueCodes = [...new Set(codes)];
  if (
    uniqueCodes.length === 0 ||
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    isLocalhostPlaywrightTest()
  ) {
    return result;
  }

  await new Promise<void>((resolve) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      script.remove();
      resolve();
    }, 3200);
    script.src = `https://qt.gtimg.cn/q=${uniqueCodes.join(',')}&_t=${Date.now()}`;
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
  for (const code of uniqueCodes) {
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

/**
 * Loads real intraday 1-minute curve points from Tencent `ifzq.gtimg.cn` via JSONP `<script>`
 * (works on both browser Web and native WKWebView/WebView with zero CORS restrictions).
 */
async function fetchTencentIntradaySeries(
  minuteCodes: readonly string[],
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  const unique = [...new Set(minuteCodes)];
  if (
    unique.length === 0 ||
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    isLocalhostPlaywrightTest()
  ) {
    return map;
  }

  const win = window as unknown as Record<string, unknown>;
  await Promise.allSettled(
    unique.map(
      (code) =>
        new Promise<void>((resolve) => {
          const safeId = code.replace(/[^a-zA-Z0-9]/g, '_');
          const varName = `_vs_min_${safeId}`;
          const script = document.createElement('script');
          const timer = setTimeout(() => {
            script.remove();
            resolve();
          }, 2600);
          script.src = `https://web.ifzq.gtimg.cn/appstock/app/minute/query?_var=${varName}&code=${encodeURIComponent(code)}&_t=${Date.now()}`;
          script.async = true;
          script.onload = () => {
            clearTimeout(timer);
            script.remove();
            const payload = win[varName];
            const series = parseTencentMinuteSeries(payload, code, 24);
            if (series.length >= 4) {
              map.set(code, series);
            }
            resolve();
          };
          script.onerror = () => {
            clearTimeout(timer);
            script.remove();
            resolve();
          };
          document.head.appendChild(script);
        }),
    ),
  );
  return map;
}

/**
 * On native desktop/mobile shells (`app://`, `viastela-local://`, `appassets.androidplatform.net`),
 * queries the built-in native scheme proxy `/__market__/yahoo?symbol=...` for Yahoo Finance 5m intraday charts.
 */
async function fetchNativeYahooCharts(
  instruments: readonly MarketInstrument[],
): Promise<
  Map<string, { price: number; change: number; changePct: number; sparkline: number[] }>
> {
  const out = new Map<
    string,
    { price: number; change: number; changePct: number; sparkline: number[] }
  >();
  if (!isNativeBridgeOrigin() || isLocalhostPlaywrightTest()) return out;

  await Promise.allSettled(
    instruments
      .filter((inst) => inst.yahooSymbol)
      .map(async (inst) => {
        const res = await fetch(
          `/__market__/yahoo?symbol=${encodeURIComponent(inst.yahooSymbol!)}&_t=${Date.now()}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        const parsed = parseYahooChartPayload(json, 24);
        if (parsed) {
          out.set(inst.symbol, parsed);
        }
      }),
  );
  return out;
}

/**
 * Fetches 24h real-time BTC price, 24h change, and 15m intraday klines from Binance/Coinbase,
 * plus live USD/CNY & USD/SGD rates (with previous-trading-day comparison for true daily delta).
 */
async function fetchBtcAndFxLive(): Promise<{
  btcPrice?: number;
  btcChange?: number;
  btcChangePct?: number;
  btcSparkline?: number[];
  usdCny?: number;
  usdCnyChange?: number;
  usdCnyChangePct?: number;
  usdSgd?: number;
  usdSgdChange?: number;
  usdSgdChangePct?: number;
}> {
  if (isLocalhostPlaywrightTest()) {
    return {};
  }

  const out: {
    btcPrice?: number;
    btcChange?: number;
    btcChangePct?: number;
    btcSparkline?: number[];
    usdCny?: number;
    usdCnyChange?: number;
    usdCnyChangePct?: number;
    usdSgd?: number;
    usdSgdChange?: number;
    usdSgdChangePct?: number;
  } = {};

  await Promise.allSettled([
    // 1. Binance 24hr Ticker + 15m Klines (millisecond real-time 24h change + real intraday sparkline)
    (async () => {
      const [tickerRes, klineRes] = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
        fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=30m&limit=24'),
      ]);
      if (tickerRes.ok) {
        const ticker = (await tickerRes.json()) as {
          lastPrice?: string;
          priceChange?: string;
          priceChangePercent?: string;
        };
        const price = Number.parseFloat(ticker.lastPrice ?? '');
        const change = Number.parseFloat(ticker.priceChange ?? '');
        const pct = Number.parseFloat(ticker.priceChangePercent ?? '');
        if (Number.isFinite(price) && price > 0) {
          out.btcPrice = price;
          if (Number.isFinite(change)) out.btcChange = change;
          if (Number.isFinite(pct)) out.btcChangePct = pct;
        }
      }
      if (klineRes.ok) {
        const rawKlines = (await klineRes.json()) as unknown[];
        if (Array.isArray(rawKlines)) {
          const closes = rawKlines
            .map((row) => (Array.isArray(row) ? Number.parseFloat(String(row[4] ?? '')) : NaN))
            .filter((n) => Number.isFinite(n) && n > 0);
          if (closes.length >= 6) {
            out.btcSparkline = downsampleSeries(closes, 24);
          }
        }
      }
    })(),
    // 2. Coinbase Spot Fallback (if Binance is blocked in current region)
    (async () => {
      const res = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
      if (!res.ok) return;
      const json = (await res.json()) as { data?: { amount?: string } };
      const price = Number.parseFloat(json.data?.amount ?? '');
      if (Number.isFinite(price) && price > 0 && !out.btcPrice) {
        out.btcPrice = price;
      }
    })(),
    // 3. Live FX rates + previous business day reference
    (async () => {
      const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY,SGD');
      if (!res.ok) return;
      const json = (await res.json()) as {
        date?: string;
        rates?: { CNY?: number; SGD?: number };
      };
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
  if (!apiKey || isLocalhostPlaywrightTest()) return map;

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

  // Collect all candidate Tencent codes (.OQ / .N / .AM) so any US symbol resolves automatically
  const candidateMap = new Map<string, string[]>();
  const allTencentCodes: string[] = [];
  for (const inst of instruments) {
    if (inst.tencentCode) {
      const candidates = toTencentCandidateCodes(inst.symbol);
      candidateMap.set(inst.symbol, candidates);
      allTencentCodes.push(...candidates);
    }
  }

  const finnhubKey = readFinnhubApiKey();
  const [tencentMap, macroLive, finnhubMap, yahooMap] = await Promise.all([
    fetchTencentScriptQuotes(allTencentCodes),
    fetchBtcAndFxLive(),
    fetchFinnhubLive(instruments, finnhubKey),
    fetchNativeYahooCharts(instruments),
  ]);

  // Resolve active minute codes for instruments that matched Tencent quotes
  const resolvedMinuteCodeBySymbol = new Map<string, string>();
  for (const inst of instruments) {
    const candidates = candidateMap.get(inst.symbol) ?? [];
    const matchedCode = candidates.find((c) => tencentMap.has(c)) ?? inst.tencentCode;
    if (matchedCode) {
      resolvedMinuteCodeBySymbol.set(inst.symbol, toTencentMinuteCode(matchedCode));
    }
  }

  const minuteSeriesMap = await fetchTencentIntradaySeries([
    ...resolvedMinuteCodeBySymbol.values(),
  ]);

  const updated = instruments.map((inst): MarketQuoteItem => {
    const prev = cached[inst.symbol] ?? buildSeedQuoteItem(inst, now);
    const session = marketSessionInfo(inst.category, now);
    const minuteCode = resolvedMinuteCodeBySymbol.get(inst.symbol);
    const realIntraday =
      (minuteCode ? minuteSeriesMap.get(minuteCode) : undefined) ??
      yahooMap.get(inst.symbol)?.sparkline;

    // 1. Check Finnhub override if configured
    const fh = finnhubMap.get(inst.symbol);
    if (fh) {
      return {
        ...prev,
        price: fh.price,
        change: fh.change,
        changePct: fh.changePct,
        sparkline:
          realIntraday && realIntraday.length >= 4
            ? [...realIntraday.slice(0, -1), fh.price]
            : synthesizeSparkline(fh.price, fh.change, prev.sparkline),
        asOf: now.toISOString(),
        source: 'finnhub',
        sessionLabel: session.label,
        isOpen: session.isOpen,
      };
    }

    // 2. Check Native Yahoo Chart feed (high-precision 5m candle + live FX/Indices on native apps)
    const yh = yahooMap.get(inst.symbol);

    // 3. Check Tencent Live Feed (US / HK / CN Indices & Equities across .OQ / .N / .AM)
    const candidates = candidateMap.get(inst.symbol) ?? (inst.tencentCode ? [inst.tencentCode] : []);
    const matchedTencentCode = candidates.find((c) => tencentMap.has(c));
    const tc = matchedTencentCode ? tencentMap.get(matchedTencentCode) : undefined;
    if (tc) {
      return {
        ...prev,
        name: inst.name === inst.symbol && tc.name ? tc.name : inst.name,
        price: tc.price,
        change: tc.change,
        changePct: tc.changePct,
        sparkline:
          realIntraday && realIntraday.length >= 4
            ? [...realIntraday.slice(0, -1), tc.price]
            : synthesizeSparkline(tc.price, tc.change, prev.sparkline),
        asOf: now.toISOString(),
        source: 'live',
        sessionLabel: session.label,
        isOpen: session.isOpen,
      };
    }

    if (yh) {
      return {
        ...prev,
        price: yh.price,
        change: yh.change,
        changePct: yh.changePct,
        sparkline: yh.sparkline,
        asOf: now.toISOString(),
        source: 'live',
        sessionLabel: session.label,
        isOpen: session.isOpen,
      };
    }

    // 4. Check Macro (BTC 24h real-time klines / FX)
    if (inst.symbol === 'BTC' && macroLive.btcPrice) {
      const change =
        macroLive.btcChange ?? Number((macroLive.btcPrice - (prev.price - prev.change)).toFixed(2));
      const changePct =
        macroLive.btcChangePct ??
        Number(((change / Math.max(1, macroLive.btcPrice - change)) * 100).toFixed(2));
      return {
        ...prev,
        price: macroLive.btcPrice,
        change,
        changePct,
        sparkline:
          macroLive.btcSparkline && macroLive.btcSparkline.length >= 4
            ? [...macroLive.btcSparkline.slice(0, -1), macroLive.btcPrice]
            : synthesizeSparkline(macroLive.btcPrice, change, prev.sparkline),
        asOf: now.toISOString(),
        source: 'live',
        sessionLabel: session.label,
        isOpen: session.isOpen,
      };
    }
    if (inst.symbol === 'USD/CNY' && macroLive.usdCny) {
      const change = macroLive.usdCnyChange ?? Number((macroLive.usdCny - 7.133).toFixed(4));
      const changePct =
        macroLive.usdCnyChangePct ?? Number(((change / 7.133) * 100).toFixed(2));
      return {
        ...prev,
        price: macroLive.usdCny,
        change,
        changePct,
        sparkline:
          realIntraday && realIntraday.length >= 4
            ? realIntraday
            : synthesizeSparkline(macroLive.usdCny, change, prev.sparkline),
        asOf: now.toISOString(),
        source: 'live',
        sessionLabel: session.label,
        isOpen: session.isOpen,
      };
    }
    if (inst.symbol === 'USD/SGD' && macroLive.usdSgd) {
      const change = macroLive.usdSgdChange ?? Number((macroLive.usdSgd - 1.3232).toFixed(4));
      const changePct =
        macroLive.usdSgdChangePct ?? Number(((change / 1.3232) * 100).toFixed(2));
      return {
        ...prev,
        price: macroLive.usdSgd,
        change,
        changePct,
        sparkline:
          realIntraday && realIntraday.length >= 4
            ? realIntraday
            : synthesizeSparkline(macroLive.usdSgd, change, prev.sparkline),
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

/**
 * Connects a real-time Binance WebSocket trade stream (`wss://stream.binance.com:9443/ws/btcusdt@miniTicker`)
 * for sub-second BTC ticks when the browser/WebView is online. Returns a cleanup function.
 */
export function subscribeBtcRealtimeStream(
  onTick: (tick: { price: number; change: number; changePct: number }) => void,
): () => void {
  if (
    typeof WebSocket === 'undefined' ||
    typeof window === 'undefined' ||
    isLocalhostPlaywrightTest()
  ) {
    return () => {};
  }

  let ws: WebSocket | null = null;
  let closed = false;
  let lastEmit = 0;

  try {
    ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@miniTicker');
    ws.onmessage = (event) => {
      if (closed) return;
      const now = Date.now();
      // Throttle UI updates to at most once every 1.2s for silky 60fps rendering
      if (now - lastEmit < 1200) return;
      lastEmit = now;
      try {
        const data = JSON.parse(String(event.data)) as { c?: string; o?: string };
        const close = Number.parseFloat(data.c ?? '');
        const open = Number.parseFloat(data.o ?? '');
        if (Number.isFinite(close) && close > 0 && Number.isFinite(open) && open > 0) {
          const change = Number((close - open).toFixed(2));
          const changePct = Number(((change / open) * 100).toFixed(2));
          onTick({ price: close, change, changePct });
        }
      } catch {
        // Ignore malformed frame
      }
    };
    ws.onerror = () => {
      try {
        ws?.close();
      } catch {
        // Ignore close error
      }
    };
  } catch {
    // WebSocket blocked or offline
  }

  return () => {
    closed = true;
    try {
      ws?.close();
    } catch {
      // Ignore close error
    }
  };
}
