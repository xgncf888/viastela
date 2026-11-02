import { describe, expect, it } from '@jest/globals';

import {
  buildCustomInstrument,
  buildSeedQuoteItem,
  buildSparklineSvgPath,
  DEFAULT_MARKET_INSTRUMENTS,
  formatChangePctText,
  marketSessionInfo,
  parseTencentMinuteSeries,
  parseTencentQuoteLine,
  parseYahooChartPayload,
  toTencentCandidateCodes,
  toTencentMinuteCode,
  toTencentSymbolCode,
  toYahooChartSymbol,
} from './market-pulse';

describe('market-pulse core', () => {
  it('maps US, HK, and CN ticker symbols to Tencent brief quote codes and multi-exchange candidates', () => {
    expect(toTencentSymbolCode('SPX')).toBe('s_usINX');
    expect(toTencentSymbolCode('NVDA')).toBe('s_usNVDA.OQ');
    expect(toTencentSymbolCode('SPY')).toBe('s_usSPY.AM');
    expect(toTencentSymbolCode('00700.HK')).toBe('s_hk00700');
    expect(toTencentSymbolCode('600519.SH')).toBe('s_sh600519');
    expect(toTencentCandidateCodes('BABA')).toEqual(['s_usBABA.N', 's_usBABA.OQ', 's_usBABA.AM']);
    expect(toTencentMinuteCode('s_usINX')).toBe('us.INX');
    expect(toTencentMinuteCode('s_usNVDA.OQ')).toBe('usNVDA.OQ');
    expect(toYahooChartSymbol('SPX')).toBe('^GSPC');
    expect(toYahooChartSymbol('00700.HK')).toBe('0700.HK');
  });

  it('parses Tencent quote script lines into structured price and change metrics', () => {
    const raw = 'v_s_usINX="200~标普500~.INX~5864.50~48.10~0.83~123456~0~0~";';
    const parsed = parseTencentQuoteLine(raw);
    expect(parsed).toEqual({
      code: 's_usINX',
      name: '标普500',
      price: 5864.5,
      change: 48.1,
      changePct: 0.83,
    });
  });

  it('parses Tencent intraday minute series and Yahoo chart payloads', () => {
    const minutePayload = {
      data: {
        'usNVDA.OQ': {
          data: {
            data: [
              '0930 139.20 100',
              '0931 139.85 150',
              '0932 140.40 210',
              '0933 141.10 310',
              '0934 141.55 400',
            ],
          },
        },
      },
    };
    expect(parseTencentMinuteSeries(minutePayload, 'usNVDA.OQ')).toEqual([
      139.2, 139.85, 140.4, 141.1, 141.55,
    ]);

    const yahooPayload = {
      chart: {
        result: [
          {
            meta: { regularMarketPrice: 7.1245, chartPreviousClose: 7.133 },
            indicators: {
              quote: [{ close: [7.133, 7.131, 7.128, 7.126, 7.1245] }],
            },
          },
        ],
      },
    };
    const parsedYahoo = parseYahooChartPayload(yahooPayload);
    expect(parsedYahoo?.price).toBe(7.1245);
    expect(parsedYahoo?.sparkline.length).toBeGreaterThanOrEqual(5);
  });

  it('builds SVG sparkline paths and seed quote items without forbidden substrings', () => {
    const now = new Date('2026-11-02T15:00:00Z');
    for (const inst of DEFAULT_MARKET_INSTRUMENTS) {
      const item = buildSeedQuoteItem(inst, now);
      expect(item.price).toBeGreaterThan(0);
      expect(formatChangePctText(item.changePct)).not.toContain('2%');
      const svg = buildSparklineSvgPath(item.sparkline);
      expect(svg.linePath.startsWith('M')).toBe(true);
      expect(svg.areaPath.endsWith('Z')).toBe(true);
    }
    const session = marketSessionInfo('us', now);
    expect(session.isOpen).toBe(true);
    expect(buildCustomInstrument('tsla').symbol).toBe('TSLA');
  });
});
