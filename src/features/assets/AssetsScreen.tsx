import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { assetSaveNotice } from '@/core/asset-errors';
import { deletedAccountUndo } from '@/core/asset-form';
import { dashboardTotalUsd } from '@/core/asset-summary';
import { balanceAfterUsd, balanceUsdRate } from '@/core/balance-write';
import { useRefreshOnFocus } from '@/data/refresh-on-focus';
import { createId } from '@/core/id';
import { createResultSequence } from '@/core/latest-result';
import { civilLocalDay, computeLocalDay } from '@/core/local-day';
import { formatMoney, formatShares } from '@/core/money-format';
import { projectNetWorthLines } from '@/core/projection';
import { projectionChart } from '@/core/projection-chart';
import {
  MASKED_PROGRESS_HINT,
  NO_GOAL_BUTTON_LABEL,
  NO_GOAL_BUTTON_VARIANT,
  NO_GOAL_HINT,
  formatYearMonth,
  projectionSummary,
  type ProjectionSentence,
} from '@/core/projection-copy';
import {
  COST_BASIS_CALLOUT,
  QUOTE_MISS_LINE,
  cachedQuoteAsOf,
  formatQuoteClock,
  quoteFailurePresentation,
  quoteSetStatus,
  quoteStatusLabel,
  unpricedHoldingsMessage,
} from '@/core/quote-label';
import type { QuoteFailureKind } from '@/core/quote-load';
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
import { LineChart, type ChartStroke } from '@/ui/LineChart';
import { LoadingRegion } from '@/ui/LoadingRegion';
import { Callout, Columns, Divider, Row, ScreenHeader, Stack } from '@/ui/layout';
import { RefreshStatus } from '@/ui/RefreshStatus';
import { SkeletonDisplay, SkeletonLedger, SkeletonMetric, SkeletonText } from '@/ui/Skeleton';
import { MaskedAmount } from '@/ui/MaskedAmount';
import { nativeAmountRowLabel } from '@/ui/masked-amount';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/ThemeProvider';
import { TimelineItem } from '@/ui/TimelineItem';
import { theme } from '@/ui/theme';
import { showToast } from '@/ui/toast';

import { quoteLineStatus, refreshOutcome } from './refresh-state';
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
  quoteFailure: QuoteFailureKind | null;
  masked: boolean;
};

export function AssetsScreen() {
  const { session } = useAuth();
  const { daySwitch, timeZone } = useWeight();
  const inset = useShellInset();
  const pending = useDeferredDeleteIds();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState<Ready | null>(null);
  const [sheet, setSheet] = useState<
    null | 'account' | 'balances' | 'holding' | 'assumptions' | 'goal' | { kind: 'balance'; accountId: string } | { kind: 'holding'; id: string }
  >(null);
  const userId = session?.userId ?? null;
  const readyRef = useRef<Ready | null>(null);
  const reloadRef = useRef<() => Promise<void>>(async () => undefined);
  const loads = useRef(createResultSequence());
  const mounted = useRef(true);

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
      quoteFailure: quotes.failure,
      masked,
    };
  }, [timeZone, userId]);

  const reload = useCallback(async () => {
    const token = loads.current.next();
    const background = readyRef.current !== null;
    if (background) setRefreshing(true);
    else {
      setLoading(true);
      setFailed(false);
    }
    try {
      const next = await fetchReady();
      if (!mounted.current || !loads.current.isCurrent(token) || !next) return;
      setReady(next);
      const settled = refreshOutcome(background, true);
      setFailed(settled.failed);
      setRefreshError(settled.refreshError);
      setLoading(false);
    } catch {
      if (!mounted.current || !loads.current.isCurrent(token)) return;
      const settled = refreshOutcome(background, false);
      setFailed(settled.failed);
      setRefreshError(settled.refreshError);
      setLoading(false);
    } finally {
      if (mounted.current && loads.current.isCurrent(token)) setRefreshing(false);
    }
  }, [fetchReady]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useRefreshOnFocus(() => reload());

  useEffect(() => {
    let cancelled = false;
    const token = loads.current.next();
    void fetchReady().then(
      (next) => {
        if (cancelled || !mounted.current || !loads.current.isCurrent(token) || !next) return;
        setReady(next);
        setFailed(false);
        setLoading(false);
      },
      () => {
        if (cancelled || !mounted.current || !loads.current.isCurrent(token)) return;
        setFailed(true);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetchReady]);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

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
  const quoteFailure = ready?.quoteFailure ?? null;
  const model = useMemo(() => {
    if (!portfolio) return null;
    return buildModel({
      portfolio,
      book,
      timeZone,
      pending,
      degraded,
      failure: quoteFailure,
    });
  }, [book, degraded, pending, portfolio, quoteFailure, timeZone]);

  const quoteRefresh = quoteLineStatus({
    refreshing,
    quoteFailed: quoteFailure !== null,
    refreshError,
    stale: book?.stale === true,
  });
  const refreshCachedAt =
    refreshError && book
      ? cachedQuoteAsOf(book.quotes.map((quote) => ({ asOf: quote.as_of, status: quote.status })))
      : null;

  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader
          kicker="资产"
          title="总资产"
          trailing={
            ready ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={masked ? '显示金额' : '隐藏金额'}
                onPress={() => void persistMask(!masked)}
                style={{
                  minHeight: theme.layout.control,
                  minWidth: theme.layout.control,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="muted">{masked ? '显示' : '隐藏'}</Text>
              </Pressable>
            ) : null
          }
        />
        <LoadingRegion
          name="资产"
          loading={loading && ready === null}
          error={failed && ready === null}
          onRetry={() => void reload()}
          skeleton={<AssetsSkeleton />}
        >
          {book?.source === 'cost_basis' ? <Callout tone="warning" message={COST_BASIS_CALLOUT} /> : null}
          {visibleAccounts.length === 0 ? (
            <Card>
              <EmptyState
                title="还没有账户"
                description="先添加一个账户，再记下余额和持仓。"
                action={<Button label="添加第一个账户" onPress={() => setSheet('account')} />}
              />
            </Card>
          ) : model ? (
            <Stack gap="md">
              <Columns
                main={
                  <Stack gap="md">
                    <Overview
                      model={model}
                      masked={masked}
                      onGoal={() => setSheet('goal')}
                      onUpdateBalances={() => setSheet('balances')}
                      refresh={quoteRefresh}
                      onRetry={() => void reload()}
                      timeZone={timeZone}
                      cachedAt={refreshCachedAt}
                    />
                    <AssetMixRow model={model} masked={masked} />
                  </Stack>
                }
                aside={
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
                }
              />

              <Columns
                main={
                  <Stack gap="md">
                    <Card>
                      <Row justify="between" align="center" gap="sm">
                        <Text variant="heading">账户</Text>
                        <Row gap="xs" align="center">
                          <Button label="全部更新余额" variant="ghost" onPress={() => setSheet('balances')} />
                          <Button label="添加账户" variant="secondary" size="mini" accessibilityLabel="添加账户" onPress={() => setSheet('account')} />
                        </Row>
                      </Row>
                      <Divider />
                      {visibleAccounts.map((account, index) => {
                        const balance = latestBalance(portfolio?.balances ?? [], account.id);
                        const blocked = (portfolio?.holdings ?? []).some((holding) => holding.accountId === account.id);
                        return (
                          <Fragment key={account.id}>
                            {index > 0 ? <Divider /> : null}
                            <Stack
                              gap="xs"
                              accessibilityLabel={nativeAmountRowLabel(
                                [
                                  account.name,
                                  ' ',
                                  {
                                    text: balance ? formatMoney(balance.amount, account.currency) : '暂无价格',
                                    masked: masked && Boolean(balance),
                                  },
                                ],
                                Platform.OS,
                              )}
                            >
                              <Row justify="between" align="center" gap="sm">
                                <Row gap="sm" align="center">
                                  <Text variant="body" style={{ fontWeight: theme.fontWeight.medium }}>
                                    {account.name}
                                  </Text>
                                  <Text variant="caption">{account.currency}</Text>
                                </Row>
                                <MaskedAmount
                                  text={balance ? formatMoney(balance.amount, account.currency) : '暂无价格'}
                                  masked={masked && Boolean(balance)}
                                  variant="heading"
                                />
                              </Row>
                              <Row justify="between" align="center" gap="sm" wrap>
                                <View style={{ flex: 1 }}>
                                  {balance && account.currency !== 'USD' && model.approx.get(account.id) != null ? (
                                    <Text
                                      variant="muted"
                                      accessibilityLabel={nativeAmountRowLabel(
                                        ['≈ ', { text: formatMoney(model.approx.get(account.id) ?? 0, 'USD'), masked }],
                                        Platform.OS,
                                      )}
                                    >
                                      ≈{' '}
                                      <MaskedAmount
                                        text={formatMoney(model.approx.get(account.id) ?? 0, 'USD')}
                                        masked={masked}
                                        variant="muted"
                                      />
                                    </Text>
                                  ) : blocked ? (
                                    <Text variant="muted">先移除这个账户里的持仓</Text>
                                  ) : null}
                                </View>
                                <Row gap="xs" align="center">
                                  <Button
                                    label="更新余额"
                                    variant="ghost"
                                    onPress={() => setSheet({ kind: 'balance', accountId: account.id })}
                                  />
                                  {blocked ? null : (
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
                                </Row>
                              </Row>
                            </Stack>
                          </Fragment>
                        );
                      })}
                    </Card>

                    <Card>
                      <Row justify="between" align="center" gap="sm">
                        <Text variant="heading">持仓</Text>
                        <Button label="+ 持仓" variant="secondary" size="mini" accessibilityLabel="添加持仓" onPress={() => setSheet('holding')} />
                      </Row>
                      <Divider />
                      {visibleHoldings.length === 0 ? <Text variant="muted">还没有持仓</Text> : null}
                      {visibleHoldings.map((holding, index) => {
                        const account = visibleAccounts.find((item) => item.id === holding.accountId);
                        const priced = model.priced.get(holding.id);
                        return (
                          <Fragment key={holding.id}>
                            {index > 0 ? <Divider /> : null}
                            <Stack gap="xs">
                              <Row justify="between" align="center" gap="sm">
                                <Row gap="sm" align="center" wrap>
                                  <Text variant="body" style={{ fontWeight: theme.fontWeight.medium }}>
                                    {holding.symbol}
                                  </Text>
                                  {account ? <Text variant="caption">{account.name}</Text> : null}
                                  <Text
                                    variant="muted"
                                    accessibilityLabel={nativeAmountRowLabel(
                                      [{ text: `${formatShares(holding.quantity)} 股`, masked }],
                                      Platform.OS,
                                    )}
                                  >
                                    <MaskedAmount text={`${formatShares(holding.quantity)} 股`} masked={masked} variant="muted" />
                                  </Text>
                                </Row>
                                {priced ? (
                                  <MaskedAmount text={formatMoney(priced.value, 'USD')} masked={masked} variant="heading" />
                                ) : (
                                  <Text variant="body" tone="muted">
                                    {QUOTE_MISS_LINE}
                                  </Text>
                                )}
                              </Row>
                              <Row justify="between" align="center" gap="sm" wrap>
                                <Row gap="sm" align="center" wrap>
                                  {priced ? (
                                    <Text variant="muted" tone={priced.label.tone === 'warning' ? 'warning' : 'muted'}>
                                      {priced.label.text}
                                    </Text>
                                  ) : null}
                                  {priced && holding.costBasisUsd !== null ? (
                                    <Text
                                      variant="muted"
                                      accessibilityLabel={nativeAmountRowLabel(
                                        ['盈亏 ', { text: formatMoney(priced.value - holding.costBasisUsd, 'USD'), masked }],
                                        Platform.OS,
                                      )}
                                    >
                                      盈亏{' '}
                                      <MaskedAmount
                                        text={formatMoney(priced.value - holding.costBasisUsd, 'USD')}
                                        masked={masked}
                                        variant="muted"
                                      />
                                    </Text>
                                  ) : null}
                                </Row>
                                <Row gap="xs" align="center">
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
                            </Stack>
                          </Fragment>
                        );
                      })}
                    </Card>
                  </Stack>
                }
                aside={
                  <Card>
                    <Text variant="heading">最近变动</Text>
                    <Divider />
                    {model.activity.length === 0 ? <Text variant="muted">还没有变动</Text> : null}
                    {model.activity.map((item, index) => (
                      <Fragment key={item.id}>
                        {index > 0 ? <Divider /> : null}
                        <TimelineItem
                          title={item.title}
                          time={item.time}
                          detail={item.detail ? <MaskedAmount text={item.detail} masked={masked} variant="muted" /> : undefined}
                          accessibilityLabel={
                            item.detail ? nativeAmountRowLabel([item.title, ' ', { text: item.detail, masked }], Platform.OS) : undefined
                          }
                        />
                      </Fragment>
                    ))}
                  </Card>
                }
              />
            </Stack>
          ) : null}
        </LoadingRegion>
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
        onSave={(targetUsd) =>
          saveGoal({ id: portfolio?.goal?.id ?? createId(), targetUsd, targetDate: portfolio?.goal?.targetDate ?? null })
        }
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
  onUpdateBalances,
  refresh,
  onRetry,
  timeZone,
  cachedAt,
}: {
  model: DashboardModel;
  masked: boolean;
  onGoal: () => void;
  onUpdateBalances: () => void;
  refresh: 'idle' | 'refreshing' | 'failed';
  onRetry: () => void;
  timeZone: string;
  cachedAt: string | null;
}) {
  return (
    <Card>
      <Row justify="between" align="center" gap="sm" wrap>
        <Text variant="label">净值总览</Text>
        <RefreshStatus
          status={refresh}
          onRetry={onRetry}
          cachedAt={model.quoteCachedAt ?? cachedAt}
          timeZone={timeZone}
          idle={
            model.quoteStatus ? (
              <Text variant="muted" tone={model.quoteStatus.tone === 'warning' ? 'warning' : 'muted'} style={{ fontVariant: ['tabular-nums'] }}>
                {model.quoteStatus.text}
              </Text>
            ) : null
          }
        />
      </Row>
      {model.missLine ? (
        <Text variant="heading">{model.missLine}</Text>
      ) : model.totalText ? (
        <MaskedAmount text={model.totalText} masked={masked} variant="display" tone="ink" />
      ) : (
        <Text variant="display">暂无价格</Text>
      )}
      {model.missReason ? <Text variant="muted">{model.missReason}</Text> : null}
      {model.hasGoal ? (
        <>
          <ProgressBar value={model.progress} masked={masked || model.totalText === null} />
          <Row justify="between" align="center" gap="sm" wrap>
            {masked ? (
              <Text variant="muted">{MASKED_PROGRESS_HINT}</Text>
            ) : model.totalText !== null ? (
              <Text variant="muted">{`目标进度 ${model.progressText}`}</Text>
            ) : null}
            <Button label="调整目标" variant="ghost" onPress={onGoal} />
          </Row>
        </>
      ) : (
        <Row justify="between" align="center" gap="sm" wrap>
          <Text variant="muted">{NO_GOAL_HINT}</Text>
          <Button label={NO_GOAL_BUTTON_LABEL} variant={NO_GOAL_BUTTON_VARIANT} onPress={onGoal} />
        </Row>
      )}
      {!masked && model.ratio ? <Text variant="body">{model.ratio}</Text> : null}
      {model.unpriced ? <Text variant="muted">{model.unpriced}</Text> : null}
      <Button label="更新本月资产" fill onPress={onUpdateBalances} />
    </Card>
  );
}

function AssetMixRow({ model, masked }: { model: DashboardModel; masked: boolean }) {
  return (
    <Row gap="ms" align="start">
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
        <Card>
          <Text variant="label">现金储备</Text>
          {model.cashText ? (
            <MaskedAmount text={model.cashText} masked={masked} variant="metric" />
          ) : (
            <Text variant="metric">—</Text>
          )}
        </Card>
      </View>
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
        <Card>
          <Text variant="label">证券持仓</Text>
          {model.securitiesText ? (
            <MaskedAmount text={model.securitiesText} masked={masked} variant="metric" />
          ) : (
            <Text variant="metric">—</Text>
          )}
        </Card>
      </View>
    </Row>
  );
}

/** DESIGN §6. Weight and dash are chosen per series. Tone only picks the color. */
function projectionStroke(id: string, selectedId: string): ChartStroke {
  if (id === 'actual') return { width: theme.layout.stroke };
  if (id === 'target') return { width: theme.border.width, dash: '2 3' };
  if (id === selectedId) return { width: theme.layout.strokeSelected };
  return { width: theme.layout.strokeMinor, dash: '4 3' };
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
      <Row justify="between" align="center" gap="sm">
        <Text variant="heading">预测</Text>
        <Button label="调整假设" variant="ghost" onPress={onAdjust} />
      </Row>
      <Divider />
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
          style={{
            height: theme.layout.chart,
            borderRadius: theme.radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.color.fill,
          }}
        >
          <Text variant="body">已隐藏金额</Text>
        </Pressable>
      ) : model.chart ? (
        <LineChart
          series={model.chart.series.map((series) => ({
            id: series.id,
            label: series.label,
            tone: series.tone,
            layer: series.layer,
            markers: series.markers,
            stroke: projectionStroke(series.id, model.chart?.selectedSeriesId ?? ''),
            points: series.points.map((point) => ({ id: point.id, x: point.x, y: point.y })),
          }))}
          ticks={model.chart.ticks}
          unit="US$"
          startLabel={model.chartStart}
          endLabel={model.chartEnd}
          accessibilityLabel={model.chart.accessibilityLabel}
        />
      ) : (
        <Text variant="muted">推算还不可用</Text>
      )}
      {!masked && model.chart?.note ? <Text variant="muted">{model.chart.note}</Text> : null}
    </Card>
  );
}

function Conclusion({ sentence, masked }: { sentence: ProjectionSentence | null; masked: boolean }) {
  if (!sentence) return <Text variant="body">推算还不可用</Text>;
  if (sentence.kind === 'no-goal') return <Text variant="body">{sentence.text}</Text>;
  if (sentence.kind === 'already') return <Text variant="body">已达成</Text>;
  if (sentence.kind === 'unreachable') return <Text variant="body">{sentence.text}</Text>;
  const direction = sentence.ahead ? '超前' : '落后';
  const pieces = [
    `按 ${sentence.ratePercent}% 年化，预计 ${sentence.monthLabel}达到 `,
    { text: sentence.targetText, masked },
    ...(sentence.gapText
      ? [`，比计划${direction} `, { text: sentence.gapText, masked }, sentence.monthsLabel ? `，${sentence.monthsLabel}` : '']
      : []),
  ];
  return (
    <Text variant="body" accessibilityLabel={nativeAmountRowLabel(pieces, Platform.OS)}>
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
  cashText: string | null;
  securitiesText: string | null;
  progress: number;
  progressText: string;
  ratio: string | null;
  unpriced: string | null;
  hasGoal: boolean;
  quoteStatus: { text: string; tone: 'muted' | 'warning' } | null;
  quoteCachedAt: string | null;
  missLine: string | null;
  missReason: string | null;
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
  failure: QuoteFailureKind | null;
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
  const failureCopy = quoteFailurePresentation({
    failed: input.failure !== null,
    hasCache: input.book !== null,
    cachedAsOf: input.book
      ? cachedQuoteAsOf(input.book.quotes.map((quote) => ({ asOf: quote.as_of, status: quote.status })))
      : null,
    timeZone: input.timeZone,
  });
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
    cashText: input.book ? formatMoney(cash, 'USD') : null,
    securitiesText: input.book ? formatMoney(securities, 'USD') : null,
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
    quoteCachedAt:
      input.failure !== null || input.book?.stale === true
        ? cachedQuoteAsOf((input.book?.quotes ?? []).map((quote) => ({ asOf: quote.as_of, status: quote.status })))
        : null,
    missLine: failureCopy.missLine,
    missReason: failureCopy.missReason,
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

function AssetsSkeleton() {
  return (
    <Stack gap="md">
      <Card>
        <SkeletonDisplay />
        <SkeletonText lines={1} variant="muted" />
      </Card>
      <Row gap="ms" align="start">
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
          <Card>
            <SkeletonMetric />
          </Card>
        </View>
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
          <Card>
            <SkeletonMetric />
          </Card>
        </View>
      </Row>
      <Card>
        <SkeletonLedger lines={4} />
      </Card>
    </Stack>
  );
}
