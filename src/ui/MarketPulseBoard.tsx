import { createElement, useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  buildSparklineSvgPath,
  type ColorConvention,
  DEFAULT_MARKET_INSTRUMENTS,
  formatChangePctText,
  formatQuotePrice,
  isPositiveMove,
  type MarketCategory,
  type MarketQuoteItem,
  type RefreshIntervalSec,
} from '@/core/market-pulse';
import {
  loadInitialMarketQuotes,
  readColorConvention,
  readCustomWatchlist,
  readFinnhubApiKey,
  readRefreshIntervalSec,
  refreshMarketQuotes,
  subscribeBtcRealtimeStream,
  writeColorConvention,
  writeCustomWatchlist,
  writeFinnhubApiKey,
  writeRefreshIntervalSec,
} from '@/data/market-pulse';

import { Button } from './Button';
import { Card, cardSurfaceStyle } from './Card';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { Divider, Row, Stack } from './layout';
import { Text } from './Text';
import { TextField } from './TextField';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { CockpitPillButton, TagChip } from './WorkbenchConsole';

type FilterTab = 'all' | MarketCategory;

const FILTER_TABS: readonly { id: FilterTab; label: string }[] = [
  { id: 'all', label: '全球总览' },
  { id: 'us', label: '美股大盘' },
  { id: 'apac', label: '亚太核心' },
  { id: 'macro', label: '加密与汇率' },
  { id: 'equity', label: '持仓与自选' },
] as const;

function SparklineGraphic({
  points,
  strokeColor,
  fillColor,
}: {
  points: readonly number[];
  strokeColor: string;
  fillColor: string;
}) {
  const { linePath, areaPath } = buildSparklineSvgPath(points, 86, 26);
  if (!linePath) return null;

  if (Platform.OS === 'web') {
    return createElement(
      'svg',
      { width: 86, height: 26, viewBox: '0 0 86 26', fill: 'none', 'aria-hidden': true },
      createElement('path', { d: areaPath, fill: fillColor }),
      createElement('path', {
        d: linePath,
        stroke: strokeColor,
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: Svg, Path } = require('react-native-svg') as typeof import('react-native-svg');
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.sparkWrap}>
      <Svg width={86} height={26} viewBox="0 0 86 26" fill="none">
        <Path d={areaPath} fill={fillColor} />
        <Path d={linePath} stroke={strokeColor} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

export function MarketPulseBoard({
  holdingSymbols = [],
  onSyncPortfolioQuotes,
}: {
  holdingSymbols?: readonly string[];
  onSyncPortfolioQuotes?: () => void;
}) {
  const { color } = useTheme();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [watchlist, setWatchlist] = useState<string[]>(readCustomWatchlist);
  const [quotes, setQuotes] = useState<MarketQuoteItem[]>(() =>
    loadInitialMarketQuotes(holdingSymbols, readCustomWatchlist()),
  );
  const [colorConv, setColorConv] = useState<ColorConvention>(readColorConvention);
  const [intervalSec, setIntervalSec] = useState<RefreshIntervalSec>(readRefreshIntervalSec);
  const [refreshing, setRefreshing] = useState(false);
  const [addingSymbol, setAddingSymbol] = useState(false);
  const [symbolInput, setSymbolInput] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [finnhubKey, setFinnhubKey] = useState(readFinnhubApiKey);

  const presetSymbols = new Set(DEFAULT_MARKET_INSTRUMENTS.map((i) => i.symbol));

  const triggerRefresh = useCallback(
    async (notify = false) => {
      setRefreshing(true);
      try {
        const next = await refreshMarketQuotes(holdingSymbols, watchlist);
        setQuotes(next);
        onSyncPortfolioQuotes?.();
        if (notify) {
          showToast({ text: '实时大盘与自选行情已刷新' });
        }
      } finally {
        setRefreshing(false);
      }
    },
    [holdingSymbols, onSyncPortfolioQuotes, watchlist],
  );

  useEffect(() => {
    let active = true;
    void refreshMarketQuotes(holdingSymbols, watchlist).then((next) => {
      if (!active) return;
      setQuotes(next);
      onSyncPortfolioQuotes?.();
    });
    return () => {
      active = false;
    };
  }, [holdingSymbols, onSyncPortfolioQuotes, watchlist]);

  useEffect(() => {
    if (intervalSec <= 0) return undefined;
    const timer = setInterval(() => {
      void refreshMarketQuotes(holdingSymbols, watchlist).then((next) => {
        setQuotes(next);
        onSyncPortfolioQuotes?.();
      });
    }, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [holdingSymbols, intervalSec, onSyncPortfolioQuotes, watchlist]);

  // Connect sub-second WebSocket stream for BTC 24h real-time ticks
  useEffect(() => {
    return subscribeBtcRealtimeStream((tick) => {
      setQuotes((prev) =>
        prev.map((item) => {
          if (item.symbol !== 'BTC') return item;
          const nextSpark =
            item.sparkline.length >= 4
              ? [...item.sparkline.slice(0, -1), tick.price]
              : [...item.sparkline, tick.price];
          return {
            ...item,
            price: tick.price,
            change: tick.change,
            changePct: tick.changePct,
            sparkline: nextSpark,
            source: 'live',
            asOf: new Date().toISOString(),
          };
        }),
      );
    });
  }, []);

  function onToggleColorConv() {
    const next: ColorConvention = colorConv === 'intl' ? 'cn' : 'intl';
    setColorConv(next);
    writeColorConvention(next);
  }

  function onCycleInterval() {
    const next: RefreshIntervalSec = intervalSec === 15 ? 60 : intervalSec === 60 ? 0 : 15;
    setIntervalSec(next);
    writeRefreshIntervalSec(next);
  }

  function onAddCustomSymbol() {
    const clean = symbolInput.trim().toUpperCase();
    if (!clean) return;
    const nextList = [...new Set([...watchlist, clean])];
    setWatchlist(nextList);
    writeCustomWatchlist(nextList);
    setSymbolInput('');
    setAddingSymbol(false);
    setQuotes(loadInitialMarketQuotes(holdingSymbols, nextList));
    void refreshMarketQuotes(holdingSymbols, nextList).then((updated) => {
      setQuotes(updated);
      onSyncPortfolioQuotes?.();
    });
    showToast({ text: `已添加自选标的 ${clean}` });
  }

  function onRemoveCustomSymbol(sym: string) {
    const nextList = watchlist.filter((item) => item !== sym);
    setWatchlist(nextList);
    writeCustomWatchlist(nextList);
    setQuotes(loadInitialMarketQuotes(holdingSymbols, nextList));
    showToast({ text: `已移除 ${sym}` });
  }

  function onSaveFinnhubKey() {
    writeFinnhubApiKey(finnhubKey);
    setConfigOpen(false);
    void triggerRefresh(true);
  }

  const visibleQuotes = quotes.filter((item) => (filter === 'all' ? true : item.category === filter));
  const liveCount = quotes.filter((item) => item.source === 'live' || item.source === 'finnhub').length;

  function colorsForMove(positive: boolean) {
    const useGreen = (colorConv === 'intl' && positive) || (colorConv === 'cn' && !positive);
    if (useGreen) {
      return {
        fg: color.green,
        bg: color.greenSoft,
        fill: 'rgba(30, 107, 74, 0.12)',
      };
    }
    return {
      fg: color.danger,
      bg: color.dangerSoft,
      fill: 'rgba(154, 70, 62, 0.12)',
    };
  }

  return (
    <Card>
      <Stack gap="sm">
        <Row justify="between" align="center" gap="sm" wrap>
          <Row gap="sm" align="center" wrap>
            <Text variant="heading">实时大盘与自选脉搏</Text>
            <TagChip
              label={
                refreshing
                  ? 'SYNCING…'
                  : liveCount > 0
                    ? `LIVE · ${liveCount} 路直连`
                    : 'LOCAL SNAPSHOT'
              }
              tone={liveCount > 0 ? 'exec' : 'owner'}
            />
          </Row>
          <Row gap="xs" align="center" wrap>
            <CockpitPillButton
              label={colorConv === 'intl' ? '绿涨红跌' : '红涨绿跌'}
              accessibilityLabel="切换涨跌配色习惯"
              onPress={onToggleColorConv}
            />
            <CockpitPillButton
              label={intervalSec === 0 ? '手动刷新' : `${intervalSec}s 自动`}
              accessibilityLabel="切换自动刷新频率"
              onPress={onCycleInterval}
            />
            <CockpitPillButton
              label="+ 自选"
              accessibilityLabel="添加自选股票或指数"
              onPress={() => setAddingSymbol((prev) => !prev)}
            />
            <CockpitPillButton
              label="数据源"
              accessibilityLabel="配置行情数据源"
              onPress={() => setConfigOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label={refreshing ? '刷新中…' : '立即刷新'}
              variant="accent"
              accessibilityLabel="立即刷新大盘行情"
              onPress={() => void triggerRefresh(true)}
            />
          </Row>
        </Row>

        <ChipGroup segmented>
          {FILTER_TABS.map((tab) => (
            <Chip
              key={tab.id}
              label={tab.label}
              selected={filter === tab.id}
              onPress={() => setFilter(tab.id)}
            />
          ))}
        </ChipGroup>

        {addingSymbol ? (
          <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="xs">
              <TextField
                label="添加股票 / ETF / 港A股代码（美股自动识别纳斯达克 / 纽交所 / AMEX）"
                value={symbolInput}
                onChangeText={setSymbolInput}
                onSubmitEditing={onAddCustomSymbol}
                returnKeyType="done"
                placeholder="例如 TSLA、BABA、BRK、SPY、00700.HK、600519.SH"
                autoCapitalize="none"
                autoFocus
              />
              <Row gap="sm" align="center">
                <Button label="添加到看板" onPress={onAddCustomSymbol} />
                <Button label="取消" variant="ghost" onPress={() => setAddingSymbol(false)} />
              </Row>
            </Stack>
          </View>
        ) : null}

        {configOpen ? (
          <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="xs">
              <Text variant="caption" tone="muted">
                默认已开启「免 Key 多源实时直连 + 真实日内分时曲线」（自动聚合美股/港A股秒级行情与分钟线、Binance 24H WebSocket 毫秒级流、Yahoo Finance 5m 图表与汇率，并自动同步至持仓估值）。如需额外叠加 Finnhub 专属流，可在下方填入 API Key：
              </Text>
              <TextField
                label="FINNHUB API KEY（选填）"
                value={finnhubKey}
                onChangeText={setFinnhubKey}
                onSubmitEditing={onSaveFinnhubKey}
                returnKeyType="done"
                placeholder="留空则使用默认免 Key 全球直连源"
                autoCapitalize="none"
              />
              <Row gap="sm" align="center">
                <Button label="保存数据源设置" onPress={onSaveFinnhubKey} />
                <Button label="关闭" variant="ghost" onPress={() => setConfigOpen(false)} />
              </Row>
            </Stack>
          </View>
        ) : null}

        <Divider />

        <View style={styles.grid}>
          {visibleQuotes.map((item) => {
            const positive = isPositiveMove(item.changePct);
            const moveColors = colorsForMove(positive);
            const isCustom = !presetSymbols.has(item.symbol) && watchlist.includes(item.symbol);
            const deltaSign = item.change > 0 ? '+' : '';
            return (
              <View
                key={item.symbol}
                style={[
                  styles.tickerCard,
                  cardSurfaceStyle(color.surface, color.line),
                  { borderColor: color.line },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.titleCluster}>
                    <Row gap="xs" align="center">
                      <Text variant="label" style={styles.symbolText}>
                        {item.symbol}
                      </Text>
                      <View
                        style={[
                          styles.sessionBadge,
                          { backgroundColor: item.isOpen ? color.greenSoft : color.pill },
                        ]}
                      >
                        <View
                          style={[
                            styles.sessionDot,
                            { backgroundColor: item.isOpen ? color.green : color.muted },
                          ]}
                        />
                        <Text
                          variant="caption"
                          style={[
                            styles.sessionText,
                            { color: item.isOpen ? color.green : color.muted },
                          ]}
                        >
                          {item.sessionLabel}
                        </Text>
                      </View>
                    </Row>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  {isCustom ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`移除 ${item.symbol}`}
                      onPress={() => onRemoveCustomSymbol(item.symbol)}
                      style={styles.removeBtn}
                    >
                      <Text variant="caption" tone="muted">
                        ×
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.cardBottomRow}>
                  <View style={styles.priceCluster}>
                    <Text variant="heading" style={styles.priceText}>
                      {formatQuotePrice(item.price, item.decimals)}
                    </Text>
                    <View style={styles.deltaRow}>
                      <View style={[styles.pctBadge, { backgroundColor: moveColors.bg }]}>
                        <Text
                          variant="caption"
                          style={[styles.pctText, { color: moveColors.fg }]}
                        >
                          {formatChangePctText(item.changePct)}
                        </Text>
                      </View>
                      <Text
                        variant="caption"
                        style={[styles.deltaValText, { color: moveColors.fg }]}
                      >
                        {`${deltaSign}${item.change.toFixed(item.decimals === 0 ? 0 : 2)}`}
                      </Text>
                    </View>
                  </View>

                  <SparklineGraphic
                    points={item.sparkline}
                    strokeColor={moveColors.fg}
                    fillColor={moveColors.fill}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  subPanel: {
    padding: theme.space.ms,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tickerCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 215,
    minWidth: 205,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: theme.border.width,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  titleCluster: {
    flex: 1,
    gap: 2,
  },
  symbolText: {
    fontFamily: theme.fontFamily.mono,
    fontWeight: theme.fontWeight.semibold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: theme.radius.pill,
  },
  sessionDot: {
    width: 5,
    height: 5,
    borderRadius: theme.radius.pill,
  },
  sessionText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: theme.fontWeight.medium,
  },
  removeBtn: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  priceCluster: {
    gap: 3,
  },
  priceText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: theme.fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pctBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  pctText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: theme.fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  deltaValText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 11,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
  },
  sparkWrap: {
    width: 86,
    height: 26,
  },
});
