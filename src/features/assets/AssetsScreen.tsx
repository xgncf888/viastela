import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { assetSaveNotice } from '@/core/asset-errors';
import { deletedAccountUndo } from '@/core/asset-form';
import { dashboardTotalUsd } from '@/core/asset-summary';
import { balanceAfterUsd, balanceUsdRate } from '@/core/balance-write';
import { createId } from '@/core/id';
import { civilLocalDay, computeLocalDay } from '@/core/local-day';
import { formatMoney, formatShares } from '@/core/money-format';
import { projectNetWorthLines } from '@/core/projection';
import { projectionChart } from '@/core/projection-chart';
import { formatYearMonth, projectionSummary, type ProjectionSentence } from '@/core/projection-copy';
import {
  COST_BASIS_CALLOUT,
  OFFLINE_QUOTE_CALLOUT,
  formatQuoteClock,
  quoteSetStatus,
  quoteStatusLabel,
  unpricedHoldingsMessage,
} from '@/core/quote-label';
import {
  insertAccount,
  insertBalance,
  insertHolding,
  listAccountBalances,
  listAssetAccounts,
  listAssetEvents,
  listAssumptions,
  listGoal,
  listHoldings,
  listSnapshots,
  saveAssumptions,
  saveGoal,
  softDeleteAccount,
  softDeleteHolding,
  updateHolding,
  type AccountBalanceRow,
  type AssetAccountRow,
  type AssetCurrency,
  type AssetEventRow,
  type AssumptionsRow,
  type GoalRow,
  type HoldingRow,
  type SnapshotRow,
} from '@/data/assets';
import { readAmountMasked, writeAmountMasked } from '@/data/amount-mask';
import { loadQuoteBook } from '@/data/quotes';
import type { CachedQuoteBook } from '@/data/quoteCache';
import { useAuth } from '@/features/auth/AuthProvider';
import { scheduleDeferredDelete, useDeferredDeleteIds } from '@/features/record/deferred-delete';
import { useShellInset } from '@/features/shell/AppShell';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ChipGroup } from '@/ui/ChipGroup';
import { Content } from '@/ui/Content';
import { EmptyState } from '@/ui/EmptyState';
import { LineChart } from '@/ui/LineChart';
import { Callout, Row, ScreenHeader, Stack } from '@/ui/layout';
import { MaskedAmount } from '@/ui/MaskedAmount';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/ThemeProvider';
import { TimelineItem } from '@/ui/TimelineItem';
import { theme } from '@/ui/theme';
import { showToast } from '@/ui/toast';

import { AccountForm, AssumptionsForm, BalanceForm, GoalForm, HoldingForm } from './sheets';

const DEFAULT_RATES: [number, number, number] = [0.03, 0.05, 0.07];

type Portfolio = {
  accounts: AssetAccountRow[];
  balances: AccountBalanceRow[];
  holdings: HoldingRow[];
  goal: GoalRow | null;
  assumptions: AssumptionsRow | null;
  snapshots: SnapshotRow[];
  events: AssetEventRow[];
};

type Ready = {
  portfolio: Portfolio;
  book: CachedQuoteBook | null;
  degraded: boolean;
  masked: boolean;
};

export function AssetsScreen() {
  const { session } = useAuth();
  const { daySwitch, timeZone } = useWeight();
  const inset = useShellInset();
  const pending = useDeferredDeleteIds();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState<Ready | null>(null);
  const [sheet, setSheet] = useState<
    null | 'account' | 'balances' | 'holding' | 'assumptions' | 'goal' | { kind: 'balance'; accountId: string } | { kind: 'holding'; id: string }
  >(null);
  const userId = session?.userId ?? null;
  const reloadRef = useRef<() => Promise<void>>(async () => undefined);

  const fetchReady = useCallback(async () => {
    if (!userId) return null;
    const [accounts, balances, holdings, goal, assumptions, snapshots, events, masked, quotes] = await Promise.all([
      listAssetAccounts(),
      listAccountBalances(),
      listHoldings(),
      listGoal(),
      listAssumptions(),
      listSnapshots(),
      listAssetEvents(),
      readAmountMasked(userId),
      loadQuoteBook(userId, timeZone),
    ]);
    return {
      portfolio: { accounts, balances, holdings, goal, assumptions, snapshots, events },
      book: quotes.book,
      degraded: quotes.degraded,
      masked,
    };
  }, [timeZone, userId]);

  const reload = useCallback(async () => {
    try {
      const next = await fetchReady();
      if (!next) return;
      setReady(next);
      setFailed(false);
      setLoading(false);
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }, [fetchReady]);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    void fetchReady().then(
      (next) => {
        if (cancelled || !next) return;
        setReady(next);
        setFailed(false);
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetchReady]);

  const portfolio = ready?.portfolio;
  const book = ready?.book ?? null;
  const masked = ready?.masked ?? true;
  const visibleAccounts = (portfolio?.accounts ?? []).filter((account) => !pending.has(account.id));
  const visibleHoldings = (portfolio?.holdings ?? []).filter((holding) => !pending.has(holding.id));

  async function persistMask(next: boolean) {
    setReady((current) => (current ? { ...current, masked: next } : current));
    if (userId) await writeAmountMasked(userId, next);
  }

  const degraded = ready?.degraded ?? false;
  const model = useMemo(() => {
    if (!portfolio) return null;
    return buildModel({
      portfolio,
      book,
      timeZone,
      pending,
      degraded,
    });
  }, [book, degraded, pending, portfolio, timeZone]);

  if (loading && !ready) {
    return (
      <Screen>
        <Content inset={inset}>
          <Text variant="body">读取中</Text>
        </Content>
      </Screen>
    );
  }

  return (
    <Screen>
      <Content inset={inset}>
        <Row justify="between" align="start">
          <ScreenHeader kicker="资产" title="总资产" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={masked ? '显示金额' : '隐藏金额'}
            onPress={() => void persistMask(!masked)}
            style={styles.eye}
          >
            <Text variant="muted">{masked ? '显示' : '隐藏'}</Text>
          </Pressable>
        </Row>
        {failed && !ready ? (
          <Callout message="读取失败，请重试" action={<Button label="重试" variant="secondary" onPress={() => void reload()} />} />
        ) : null}
        {ready?.degraded ? <Callout tone="warning" message={OFFLINE_QUOTE_CALLOUT} /> : null}
        {book?.source === 'cost_basis' ? <Callout tone="warning" message={COST_BASIS_CALLOUT} /> : null}
        {visibleAccounts.length === 0 ? (
          <EmptyState
            title="还没有账户"
            description="先添加一个账户，再记下余额和持仓。"
            action={<Button label="添加第一个账户" onPress={() => setSheet('account')} />}
          />
        ) : model ? (
          <>
            <Overview model={model} masked={masked} onGoal={() => setSheet('goal')} />
            <Projection
              model={model}
              masked={masked}
              onAdjust={() => setSheet('assumptions')}
              onReveal={() => void persistMask(false)}
              onSelect={(index) => {
                void selectRate(index).catch((error: unknown) => {
                  showToast({ text: assetSaveNotice(error).message, tone: 'error' });
                });
              }}
            />
            <Card>
              <Row justify="between">
                <Text variant="heading">账户</Text>
                <Button label="全部更新余额" variant="ghost" onPress={() => setSheet('balances')} />
              </Row>
              {visibleAccounts.map((account) => {
                const balance = latestBalance(portfolio?.balances ?? [], account.id);
                const blocked = (portfolio?.holdings ?? []).some((holding) => holding.accountId === account.id);
                return (
                  <Stack key={account.id} gap="xs">
                    <Row justify="between">
                      <Text variant="body">{account.name}</Text>
                      <Button label="更新余额" variant="ghost" onPress={() => setSheet({ kind: 'balance', accountId: account.id })} />
                    </Row>
                    <MaskedAmount
                      text={balance ? formatMoney(balance.amount, account.currency) : '暂无价格'}
                      masked={masked && Boolean(balance)}
                      variant="heading"
                    />
                    {balance && account.currency !== 'USD' && model.approx.get(account.id) != null ? (
                      <Text variant="muted">
                        ≈{' '}
                        <MaskedAmount text={formatMoney(model.approx.get(account.id) ?? 0, 'USD')} masked={masked} variant="muted" />
                      </Text>
                    ) : null}
                    {blocked ? (
                      <Text variant="muted">先移除这个账户里的持仓</Text>
                    ) : (
                      <Button
                        label="删除"
                        variant="ghost"
                        onPress={() =>
                          scheduleDeferredDelete(
                            'assets',
                            account.id,
                            async () => {
                              try {
                                await softDeleteAccount(account.id);
                                await reloadRef.current();
                              } catch (error) {
                                showToast({ text: assetSaveNotice(error).message, tone: 'error' });
                              }
                            },
                            deletedAccountUndo(account.name),
                          )
                        }
                      />
                    )}
                  </Stack>
                );
              })}
              <Button label="添加账户" variant="secondary" onPress={() => setSheet('account')} />
            </Card>
            <Card>
              <Row justify="between">
                <Text variant="heading">持仓</Text>
                <Button label="+ 持仓" variant="ghost" onPress={() => setSheet('holding')} />
              </Row>
              {visibleHoldings.length === 0 ? <Text variant="muted">还没有持仓</Text> : null}
              {visibleHoldings.map((holding) => {
                const account = visibleAccounts.find((item) => item.id === holding.accountId);
                const priced = model.priced.get(holding.id);
                return (
                  <Stack key={holding.id} gap="xs">
                    <Row justify="between">
                      <Text variant="body">{holding.symbol}</Text>
                      <Row gap="sm">
                        <Button label="编辑" variant="ghost" onPress={() => setSheet({ kind: 'holding', id: holding.id })} />
                        <Button
                          label="删除"
                          variant="ghost"
                          onPress={() =>
                            scheduleDeferredDelete('assets', holding.id, async () => {
                              try {
                                await softDeleteHolding(holding.id);
                                await reloadRef.current();
                              } catch (error) {
                                showToast({ text: assetSaveNotice(error).message, tone: 'error' });
                              }
                            })
                          }
                        />
                      </Row>
                    </Row>
                    <Text variant="muted">
                      <MaskedAmount text={`${formatShares(holding.quantity)} 股`} masked={masked} variant="muted" />
                    </Text>
                    {priced ? (
                      <MaskedAmount text={formatMoney(priced.value, 'USD')} masked={masked} variant="heading" />
                    ) : (
                      <Text variant="body">暂无价格</Text>
                    )}
                    <Text variant="muted" tone={priced?.label.tone === 'warning' ? 'warning' : 'muted'}>
                      {priced?.label.text ?? '暂无价格'}
                    </Text>
                    {priced && holding.costBasisUsd !== null ? (
                      <Text variant="muted">
                        盈亏 <MaskedAmount text={formatMoney(priced.value - holding.costBasisUsd, 'USD')} masked={masked} variant="muted" />
                      </Text>
                    ) : null}
                    {account ? <Text variant="muted">{account.name}</Text> : null}
                  </Stack>
                );
              })}
            </Card>
            <Card>
              <Text variant="heading">最近变动</Text>
              {model.activity.length === 0 ? <Text variant="muted">还没有变动</Text> : null}
              {model.activity.map((item) => (
                <TimelineItem
                  key={item.id}
                  title={item.title}
                  time={item.time}
                  detail={item.detail ? <MaskedAmount text={item.detail} masked={masked} variant="muted" /> : undefined}
                />
              ))}
            </Card>
          </>
        ) : null}
      </Content>
      <AccountForm
        visible={sheet === 'account'}
        onClose={() => setSheet(null)}
        onReload={reload}
        onSave={async (input) => {
          await insertAccount({ id: createId(), ...input });
          await reload();
        }}
      />
      <BalanceForm
        visible={sheet === 'balances' || (sheet !== null && typeof sheet === 'object' && sheet.kind === 'balance')}
        rows={balanceRows(
          sheet !== null && typeof sheet === 'object' && sheet.kind === 'balance'
            ? visibleAccounts.filter((account) => account.id === sheet.accountId)
            : visibleAccounts,
          portfolio?.balances ?? [],
        )}
        onClose={() => setSheet(null)}
        onReload={reload}
        onSave={async (changes) => {
          const now = new Date();
          for (const change of changes) {
            await insertBalance({
              id: createId(),
              accountId: change.accountId,
              amount: change.amount,
              currency: change.currency,
              unitsPerUsd: unitsPerUsd(book, change.currency),
              recordedAt: now.toISOString(),
              tz: timeZone,
              localDay: computeLocalDay(now, timeZone, daySwitch),
            });
          }
          showToast({ text: `已更新 ${changes.length} 个账户` });
          await reload();
        }}
      />
      <HoldingForm
        visible={sheet === 'holding' || (sheet !== null && typeof sheet === 'object' && sheet.kind === 'holding')}
        accounts={visibleAccounts.map((account) => ({ id: account.id, name: account.name }))}
        initial={holdingInitial(sheet, visibleHoldings, visibleAccounts)}
        onClose={() => setSheet(null)}
        onReload={reload}
        onSave={async (input) => {
          if (sheet !== null && typeof sheet === 'object' && sheet.kind === 'holding') {
            await updateHolding(sheet.id, { quantity: input.quantity, costBasisUsd: input.costBasisUsd });
          } else {
            await insertHolding({ id: createId(), ...input });
          }
          await reload();
        }}
      />
      <AssumptionsForm
        visible={sheet === 'assumptions'}
        initial={assumptionInitial(portfolio?.assumptions ?? null)}
        onClose={() => setSheet(null)}
        onReload={reload}
        onSave={(input) => saveRates(portfolio?.assumptions ?? null, input)}
      />
      <GoalForm
        visible={sheet === 'goal'}
        initial={portfolio?.goal ? String(portfolio.goal.targetUsd) : ''}
        onClose={() => setSheet(null)}
        onReload={reload}
        onSave={async (targetUsd) => {
          await saveGoal({ id: portfolio?.goal?.id ?? createId(), targetUsd, targetDate: portfolio?.goal?.targetDate ?? null });
          await reload();
        }}
      />
    </Screen>
  );

  async function selectRate(mainRateIndex: number) {
    const assumptions = portfolio?.assumptions;
    const rates = assumptions?.returnRates ?? DEFAULT_RATES;
    await saveAssumptions({
      id: assumptions?.id ?? createId(),
      startUsd: assumptions?.startUsd ?? 0,
      startMonth: assumptions?.startMonth ?? `${civilLocalDay(new Date(), timeZone).slice(0, 7)}-01`,
      monthlyNetUsd: assumptions?.monthlyNetUsd ?? 0,
      returnRates: rates,
      mainRateIndex,
    });
    await reload();
  }

  async function saveRates(
    assumptions: AssumptionsRow | null,
    input: { startUsd: number; startMonth: string; monthlyNetUsd: number; thirdPercent: number },
  ) {
    const rates = assumptions?.returnRates ?? DEFAULT_RATES;
    await saveAssumptions({
      id: assumptions?.id ?? createId(),
      startUsd: input.startUsd,
      startMonth: `${input.startMonth}-01`,
      monthlyNetUsd: input.monthlyNetUsd,
      returnRates: [rates[0], rates[1], input.thirdPercent / 100],
      mainRateIndex: assumptions?.mainRateIndex ?? 1,
    });
    await reload();
  }
}

function Overview({
  model,
  masked,
  onGoal,
}: {
  model: DashboardModel;
  masked: boolean;
  onGoal: () => void;
}) {
  return (
    <Card>
      {model.totalText ? (
        <MaskedAmount text={model.totalText} masked={masked} variant="display" tone="accent" />
      ) : (
        <Text variant="display">暂无价格</Text>
      )}
      {model.quoteStatus ? (
        <Text variant="muted" tone={model.quoteStatus.tone === 'warning' ? 'warning' : 'muted'} style={styles.quoteClock}>
          {model.quoteStatus.text}
        </Text>
      ) : null}
      {model.hasGoal ? (
        <>
          <ProgressBar value={model.progress} masked={masked || model.totalText === null} />
          <Text variant="muted">
            目标进度 <MaskedAmount text={model.progressText} masked={masked || model.totalText === null} variant="muted" />
          </Text>
          <Button label="调整目标" variant="ghost" onPress={onGoal} />
        </>
      ) : (
        <Button label="设一个目标" onPress={onGoal} />
      )}
      {model.ratio ? <Text variant="body">{model.ratio}</Text> : null}
      {model.unpriced ? <Text variant="muted">{model.unpriced}</Text> : null}
    </Card>
  );
}

function Projection({
  model,
  masked,
  onAdjust,
  onReveal,
  onSelect,
}: {
  model: DashboardModel;
  masked: boolean;
  onAdjust: () => void;
  onReveal: () => void;
  onSelect: (index: number) => void;
}) {
  const palette = useTheme();
  return (
    <Card>
      <Text variant="heading">预测</Text>
      <Conclusion sentence={model.sentence} masked={masked} />
      <ChipGroup>
        {model.rateLabels.map((label, index) => (
          <Chip key={label} label={label} selected={model.mainRateIndex === index + 1} onPress={() => onSelect(index + 1)} />
        ))}
      </ChipGroup>
      {masked ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="已隐藏金额"
          onPress={onReveal}
          style={[styles.hiddenChart, { backgroundColor: palette.color.fill }]}
        >
          <Text variant="body">已隐藏金额</Text>
        </Pressable>
      ) : model.chart ? (
        <LineChart
          series={model.chart.series.map((series) => ({
            id: series.id,
            label: series.label,
            style: series.style,
            tone: series.tone,
            markers: series.markers,
            thin: series.thin,
            points: series.points.map((point) => ({ id: point.id, x: point.x, y: point.y })),
          }))}
          startLabel={model.chartStart}
          endLabel={model.chartEnd}
          accessibilityLabel={model.chart.accessibilityLabel}
        />
      ) : (
        <Text variant="muted">推算还不可用</Text>
      )}
      {!masked && model.chart?.note ? <Text variant="muted">{model.chart.note}</Text> : null}
      <Button label="调整假设" variant="ghost" onPress={onAdjust} />
    </Card>
  );
}

function Conclusion({ sentence, masked }: { sentence: ProjectionSentence | null; masked: boolean }) {
  if (!sentence) return <Text variant="body">推算还不可用</Text>;
  if (sentence.kind === 'no-goal') return null;
  if (sentence.kind === 'already') return <Text variant="body">已达成</Text>;
  if (sentence.kind === 'unreachable') return <Text variant="body">{sentence.text}</Text>;
  const direction = sentence.ahead ? '超前' : '落后';
  return (
    <Text variant="body">
      {`按 ${sentence.ratePercent}% 年化，预计 ${sentence.monthLabel}达到 `}
      <MaskedAmount text={sentence.targetText} masked={masked} />
      {sentence.gapText ? (
        <>
          {`，比计划${direction} `}
          <MaskedAmount text={sentence.gapText} masked={masked} />
          {sentence.monthsLabel ? `，${sentence.monthsLabel}` : ''}
        </>
      ) : null}
    </Text>
  );
}

type DashboardModel = {
  totalText: string | null;
  progress: number;
  progressText: string;
  ratio: string | null;
  unpriced: string | null;
  hasGoal: boolean;
  quoteStatus: { text: string; tone: 'muted' | 'warning' } | null;
  sentence: ProjectionSentence | null;
  chart: ReturnType<typeof projectionChart> | null;
  chartStart: string;
  chartEnd: string;
  rateLabels: string[];
  mainRateIndex: number;
  priced: Map<string, { value: number; label: ReturnType<typeof quoteStatusLabel> }>;
  approx: Map<string, number>;
  activity: { id: string; title: string; time: string; detail?: string }[];
};

function buildModel(input: {
  portfolio: Portfolio;
  book: CachedQuoteBook | null;
  timeZone: string;
  pending: ReadonlySet<string>;
  degraded: boolean;
}): DashboardModel {
  const assumptions = input.portfolio.assumptions;
  const rates = assumptions?.returnRates ?? DEFAULT_RATES;
  const mainRateIndex = assumptions?.mainRateIndex ?? 1;
  const target = input.portfolio.goal?.targetUsd ?? null;
  const startMonth = (assumptions?.startMonth ?? civilLocalDay(new Date(), input.timeZone)).slice(0, 7);
  const total = dashboardTotalUsd(input.book);
  let sentence: ProjectionSentence | null = null;
  let chart: ReturnType<typeof projectionChart> | null = null;
  let chartStart = formatYearMonth(startMonth);
  let chartEnd = chartStart;
  try {
    const lines = projectNetWorthLines(
      {
        startUsd: assumptions?.startUsd ?? 0,
        startMonth,
        monthlyNetUsd: assumptions?.monthlyNetUsd ?? 0,
        targetUsd: target,
      },
      rates,
    );
    const selected = lines[Math.min(2, Math.max(0, mainRateIndex - 1))] ?? lines[0];
    chartStart = formatYearMonth(lines[0].points[0]?.month ?? startMonth);
    chartEnd = formatYearMonth(lines[0].points[lines[0].points.length - 1]?.month ?? startMonth);
    sentence = projectionSummary({
      rates,
      mainRateIndex,
      line: selected,
      actualUsd: total ?? assumptions?.startUsd ?? 0,
      onDay: civilLocalDay(new Date(), input.timeZone),
      monthlyNetUsd: assumptions?.monthlyNetUsd ?? 0,
      targetUsd: target,
    });
    if (total === null && sentence.kind === 'forecast') {
      sentence = { ...sentence, gapText: '', monthsLabel: null };
    }
    const actual = input.portfolio.snapshots.map((row) => ({ month: row.localDay.slice(0, 7), totalUsd: row.totalUsd }));
    chart = projectionChart({
      lines,
      rates,
      mainRateIndex,
      actual,
      targetUsd: target,
      snapshot: input.book?.snapshot ?? null,
    });
  } catch {
    sentence = null;
    chart = null;
  }
  const quotes = new Map((input.book?.quotes ?? []).map((quote) => [quote.symbol, quote]));
  const priced = new Map<string, { value: number; label: ReturnType<typeof quoteStatusLabel> }>();
  for (const holding of input.portfolio.holdings) {
    if (input.pending.has(holding.id)) continue;
    const quote = quotes.get(holding.symbol);
    const label = quote
      ? quoteStatusLabel({
          source: quote.source,
          status: quote.status,
          asOf: quote.as_of,
          timeZone: input.timeZone,
          possiblyExpired: input.degraded,
        })
      : quoteStatusLabel({
          source: 'finnhub',
          status: 'unavailable',
          asOf: new Date().toISOString(),
          timeZone: input.timeZone,
        });
    if (!quote || quote.status === 'unavailable' || quote.price === null) continue;
    priced.set(holding.id, { value: quote.price * holding.quantity, label });
  }
  const cash = input.book?.cash_usd ?? 0;
  const securities = input.book?.securities_usd ?? 0;
  const mix = cash + securities;
  const progress = target !== null && target > 0 && total !== null ? Math.min(1, Math.max(0, total / target)) : 0;
  const visibleAccountIds = new Set(
    input.portfolio.accounts.filter((account) => account.deletedAt === null && !input.pending.has(account.id)).map((account) => account.id),
  );
  return {
    totalText: total === null ? null : formatMoney(total, 'USD'),
    progress: sentence?.kind === 'already' ? 1 : progress,
    progressText: `${Math.round((sentence?.kind === 'already' ? 1 : progress) * 100)}%`,
    ratio: input.book && mix !== 0 ? `现金 ${Math.round((cash / mix) * 100)}% · 股票 ${Math.round((securities / mix) * 100)}%` : null,
    unpriced: unpricedHoldingsMessage(input.book?.unpriced),
    hasGoal: target !== null,
    quoteStatus: quoteSetStatus({
      quotes: (input.book?.quotes ?? []).map((quote) => ({ source: quote.source, status: quote.status, asOf: quote.as_of })),
      timeZone: input.timeZone,
      possiblyExpired: input.degraded,
    }),
    sentence,
    chart,
    chartStart,
    chartEnd,
    rateLabels: rates.map((rate) => `${Math.round(rate * 1000) / 10}%`),
    mainRateIndex,
    priced,
    approx: approximateUsd(input.portfolio, input.book),
    activity: activityItems(input.portfolio, input.timeZone, visibleAccountIds).slice(0, 3),
  };
}

function approximateUsd(portfolio: Portfolio, book: CachedQuoteBook | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const account of portfolio.accounts) {
    const balance = latestBalance(portfolio.balances, account.id);
    if (!balance) continue;
    const usd = balanceAfterUsd(balance.amount, balanceUsdRate(account.currency, unitsPerUsd(book, account.currency)));
    if (usd !== null) map.set(account.id, usd);
  }
  return map;
}

/** Quotes `rates` entry: units of `currency` per 1 USD. `usd_rate` stores the reciprocal. */
function unitsPerUsd(book: CachedQuoteBook | null, currency: AssetCurrency): number | null {
  if (currency === 'USD') return 1;
  const rate = book?.rates.find((item) => item.base === 'USD' && item.quote === currency)?.rate;
  return rate && rate > 0 ? rate : null;
}

function latestBalance(balances: readonly AccountBalanceRow[], accountId: string): AccountBalanceRow | null {
  return balances.find((balance) => balance.accountId === accountId) ?? null;
}

function balanceRows(accounts: readonly AssetAccountRow[], balances: readonly AccountBalanceRow[]) {
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    currency: account.currency,
    amount: latestBalance(balances, account.id)?.amount ?? null,
  }));
}

function holdingInitial(
  sheet: null | 'account' | 'balances' | 'holding' | 'assumptions' | 'goal' | { kind: 'balance'; accountId: string } | { kind: 'holding'; id: string },
  holdings: readonly HoldingRow[],
  accounts: readonly AssetAccountRow[],
) {
  if (!sheet || typeof sheet === 'string' || sheet.kind !== 'holding') return null;
  const holding = holdings.find((item) => item.id === sheet.id);
  if (!holding) return null;
  const account = accounts.find((item) => item.id === holding.accountId);
  return {
    id: holding.id,
    accountId: holding.accountId,
    accountName: account?.name ?? '',
    symbol: holding.symbol,
    quantity: String(holding.quantity),
    cost: holding.costBasisUsd === null ? '' : String(holding.costBasisUsd),
  };
}

function assumptionInitial(assumptions: AssumptionsRow | null) {
  const rates = assumptions?.returnRates ?? DEFAULT_RATES;
  return {
    startUsd: String(assumptions?.startUsd ?? 0),
    startMonth: (assumptions?.startMonth ?? '2026-01').slice(0, 7),
    monthlyNet: String(assumptions?.monthlyNetUsd ?? 0),
    thirdPercent: String(Math.round(rates[2] * 1000) / 10),
  };
}

function activityItems(portfolio: Portfolio, timeZone: string, visibleAccountIds: ReadonlySet<string>) {
  const names = new Map(portfolio.accounts.map((account) => [account.id, account.name]));
  const items = [
    ...portfolio.events.map((event) => ({
      id: event.id,
      at: event.occurredAt,
      title: eventTitle(event),
      detail: undefined as string | undefined,
    })),
    ...portfolio.balances.filter((balance) => visibleAccountIds.has(balance.accountId)).map((balance) => ({
      id: balance.id,
      at: balance.recordedAt,
      title: `更新了 ${names.get(balance.accountId) ?? '账户'} 余额`,
      detail: formatMoney(balance.amount, portfolio.accounts.find((account) => account.id === balance.accountId)?.currency ?? 'USD'),
    })),
  ];
  return items
    .sort((left, right) => right.at.localeCompare(left.at))
    .map((item) => ({ ...item, time: formatQuoteClock(item.at, timeZone) }));
}

function eventTitle(event: AssetEventRow): string {
  if (event.kind === 'holding_added') return `新增持仓 ${event.symbol ?? ''}`.trim();
  if (event.kind === 'holding_removed') return `移除了持仓 ${event.symbol ?? ''}`.trim();
  if (event.kind === 'holding_changed') return `调整了 ${event.symbol ?? ''} 持仓`.trim();
  if (event.kind === 'goal_changed') return '修改了目标';
  return '资产变动';
}

const styles = StyleSheet.create({
  eye: {
    minHeight: theme.layout.control,
    minWidth: theme.layout.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteClock: { fontVariant: ['tabular-nums'] },
  hiddenChart: {
    height: theme.layout.chart,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
