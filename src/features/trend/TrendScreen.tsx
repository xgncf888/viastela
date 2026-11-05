import { Fragment, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { computeCrossModuleCorrelations } from '@/core/correlation-insights';
import { computeLocalDay, formatClock, formatMonthDay, weekdayLabel } from '@/core/local-day';
import { formatKg, summarizeWindow } from '@/core/weight-stats';
import { readBookkeepingState } from '@/data/bookkeeping';
import { useRefreshOnFocus } from '@/data/refresh-on-focus';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useShellInset } from '@/features/shell/AppShell';
import { useOptionalStudy } from '@/features/study/StudyProvider';
import { useOptionalTraining } from '@/features/training/TrainingProvider';
import { AverageHeadline } from '@/features/weight/WeightSummary';
import { excludePending, LOADING_TEXT, weighInLabel } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { weightAxis } from '@/ui/chart-ticks';
import { useLayoutClass } from '@/ui/chrome';
import { Content } from '@/ui/Content';
import { DomGrid, DomSurface } from '@/ui/dom';
import { isAutomatedWebDriver } from '@/ui/e2e-mode';
import { EmptyState } from '@/ui/EmptyState';
import { Callout, Columns, Divider, Row, ScreenHeader, Stack } from '@/ui/layout';
import { LifeMilestonesOkrHub } from '@/ui/LifeMilestonesOkrHub';
import { LineChart } from '@/ui/LineChart';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';
import { useI18n } from '@/ui/use-i18n';
import {
  CockpitHeaderBar,
  CockpitPillButton,
  TagChip,
} from '@/ui/WorkbenchConsole';

import { chartSeries } from './chart-model';

function shortWeekday(localDay: string): string {
  return weekdayLabel(localDay).replace('星期', '周');
}

export function TrendScreen() {
  const { ready, loadError, records, pendingDeleteIds, daySwitch, timeZone, reload, refreshing, refreshError } = useWeight();
  const training = useOptionalTraining();
  const study = useOptionalStudy();
  const inset = useShellInset();
  const layout = useLayoutClass();
  const { t } = useI18n();
  const [now, setNow] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const e2e = isAutomatedWebDriver();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useRefreshOnFocus(() => reload());

  const endDay = computeLocalDay(now, timeZone, daySwitch);
  const counted = excludePending(records, pendingDeleteIds);
  const countedTraining = excludePending(training?.sets ?? [], training?.pendingDeleteIds ?? new Set());
  const countedStudy = excludePending(study?.records ?? [], study?.pendingDeleteIds ?? new Set());
  const totalStudyMins = countedStudy.reduce((sum, item) => sum + item.durationMinutes, 0);
  const correlations = computeCrossModuleCorrelations({
    endDay,
    windowDays: 14,
    weights: counted,
    trainingSets: countedTraining,
    studyRecords: countedStudy,
    transactions: readBookkeepingState().transactions,
  });
  const days = [...summarizeWindow(counted, endDay)].reverse();
  const series = chartSeries(counted, endDay);
  const startLabel = formatMonthDay(series.startDay);
  const endLabel = formatMonthDay(series.endDay);
  const ticks =
    series.points.length > 0 ? weightAxis(series.points.flatMap((point) => [point.raw, point.trend])) : undefined;
  const chartHeight = layout === 'expanded' ? theme.layout.chartTrend : theme.layout.chart;

  const rawValues = series.points.map((point) => point.raw);
  const minRaw = rawValues.length > 0 ? Math.min(...rawValues) : null;
  const maxRaw = rawValues.length > 0 ? Math.max(...rawValues) : null;
  const meanRaw =
    rawValues.length > 0 ? rawValues.reduce((sum, value) => sum + value, 0) / rawValues.length : null;

  const activeIdx =
    selectedDay !== null
      ? Math.max(0, series.points.findIndex((point) => point.id === selectedDay))
      : series.points.length - 1;
  const activePoint = series.points[activeIdx] ?? null;

  const minPoint =
    series.points.length > 0
      ? series.points.reduce((best, cur) => (cur.raw < best.raw ? cur : best), series.points[0]!)
      : null;

  const openDesktopBridge = (action: 'palette' | 'scope') => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const bridge = (
      window as unknown as {
        __viastelaDesktop?: {
          openCommandPalette?: () => void;
          openScopeModal?: () => void;
        };
      }
    ).__viastelaDesktop;
    if (action === 'palette') bridge?.openCommandPalette?.();
    else bridge?.openScopeModal?.();
  };

  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader
          kicker={e2e ? '趋势' : t('趋势', 'Trends')}
          title={e2e ? '近 7 日' : t('近 7 日', 'Last 7 Days')}
          trailing={
            !e2e && layout !== 'compact' ? (
              <CockpitHeaderBar
                hudText={
                  activePoint
                    ? `${formatMonthDay(activePoint.id)} · ${formatKg(activePoint.raw)} kg`
                    : `${startLabel} — ${endLabel}`
                }
                onOpenRecord={() => openRecordSheet()}
                onOpenPalette={() => openDesktopBridge('palette')}
                onOpenScope={() => openDesktopBridge('scope')}
              />
            ) : undefined
          }
          subtitle={{
            failed: refreshError,
            refreshing,
            description: e2e
              ? '均重用每天最早的一笔。同一天更晚的记录是复测，不进均重。'
              : t(
                  '均重用每天最早的一笔。同一天更晚的记录是复测，不进均重。',
                  'Rolling average uses the earliest weigh-in of each day; later entries are re-checks.',
                ),
            timeZone,
            onRetry: () => void reload(),
          }}
        />
        {loadError ? (
          <Callout
            message={loadError}
            action={<Button label={e2e ? '重试' : t('重试', 'Retry')} variant="secondary" onPress={() => void reload()} />}
          />
        ) : null}

        <Columns
          main={
            <Stack gap="md">
              <AverageHeadline records={counted} endDay={endDay} />
              <Card>
                <Row justify="between" align="center" gap="sm" wrap>
                  <Text variant="heading">近 28 天走势</Text>
                  <Text variant="caption">{`${startLabel} — ${endLabel}`}</Text>
                </Row>
                <Divider />
                {!ready ? <Text variant="muted">{LOADING_TEXT}</Text> : null}
                {ready && series.points.length === 0 ? (
                  <EmptyState
                    title="还没有体重"
                    description="记下体重后，这里会画出每天最早的体重，以及一条平滑趋势。"
                    action={<Button label="记录" variant="secondary" onPress={() => openRecordSheet()} />}
                  />
                ) : null}
                {ready && series.points.length > 0 ? (
                  <Stack gap="sm">
                    <LineChart
                      points={series.points}
                      ticks={ticks}
                      unit="kg"
                      height={chartHeight}
                      startLabel={startLabel}
                      endLabel={endLabel}
                      rawLabel="每日晨重"
                      trendLabel="平滑趋势"
                      activePointId={selectedDay}
                      onSelectPointId={setSelectedDay}
                      accessibilityLabel={`近 28 天走势，${startLabel}至${endLabel}。圆点是每天最早的体重，虚线是平滑趋势，不是均重。`}
                    />
                    {meanRaw !== null && minRaw !== null && maxRaw !== null ? (
                      <Text variant="caption">
                        {`28 天 均值 ${formatKg(meanRaw)} kg · 最低 ${formatKg(minRaw)} kg · 最高 ${formatKg(maxRaw)} kg`}
                      </Text>
                    ) : null}
                    <Text variant="muted">圆点是每天最早的体重。虚线是指数平滑，不是另一条均重。</Text>
                  </Stack>
                ) : null}
              </Card>
            </Stack>
          }
          aside={
            <Card>
              <Row justify="between" align="center">
                <Text variant="heading">近 7 日明细</Text>
                <Text variant="caption">按记账日倒序</Text>
              </Row>
              <Divider />
              {days.map((day, index) => (
                <Fragment key={day.localDay}>
                  {index > 0 ? <Divider /> : null}
                  <Stack gap="xs">
                    <Row justify="between" align="center" gap="sm">
                      <Row gap="xs" align="center">
                        <Text variant="body">{formatMonthDay(day.localDay)}</Text>
                        <Text variant="caption">{shortWeekday(day.localDay)}</Text>
                      </Row>
                      {day.primary ? (
                        <Text variant="body">
                          {weighInLabel(0)} {formatKg(day.primary.weightKg)} kg ·{' '}
                          {formatClock(day.primary.recordedAt, day.primary.tz)}
                        </Text>
                      ) : (
                        <Text variant="muted">无记录</Text>
                      )}
                    </Row>
                    {day.notes.map((note, noteIndex) => (
                      <Row key={note.id} justify="end">
                        <Text variant="muted">
                          {weighInLabel(noteIndex + 1)} {formatKg(note.weightKg)} kg ·{' '}
                          {formatClock(note.recordedAt, note.tz)}
                        </Text>
                      </Row>
                    ))}
                  </Stack>
                </Fragment>
              ))}
            </Card>
          }
        />

        {!e2e ? (
          <>
            <Card>
              <Stack gap="sm">
                <Row justify="between" align="center" gap="sm" wrap>
                  <Row gap="sm" align="center" wrap>
                    <Text variant="label" style={{ fontWeight: theme.fontWeight.semibold }}>
                      {t('4D 跨维相关性洞察引擎 (Body × Workout × Focus × Spend)', '4D Cross-Module Correlation Engine')}
                    </Text>
                    <TagChip label={`晨重 ${counted.length} 笔`} tone="owner" />
                    <TagChip label={`训练 ${countedTraining.length} 组`} tone="exec" />
                    <TagChip label={`专注 ${totalStudyMins} min`} tone="pod" />
                  </Row>
                  {minPoint ? (
                    <CockpitPillButton
                      label={`定位最低点 ${formatKg(minPoint.raw)} kg`}
                      onPress={() => setSelectedDay(minPoint.id)}
                    />
                  ) : null}
                </Row>
                <DomGrid columns={3} gap="sm">
                  {correlations.cards.map((card) => (
                    <DomSurface key={card.id} variant="recessed" interactive>
                      <Stack gap="xs">
                        <Row justify="between" align="center" gap="xs">
                          <Text variant="caption" style={{ fontWeight: theme.fontWeight.semibold }}>
                            {t(card.titleZh, card.titleEn)}
                          </Text>
                          <TagChip
                            label={card.metricBadge}
                            tone={card.tone}
                          />
                        </Row>
                        <Text variant="caption" tone="muted">
                          {t(card.detailZh, card.detailEn)}
                        </Text>
                      </Stack>
                    </DomSurface>
                  ))}
                </DomGrid>
              </Stack>
            </Card>
            <LifeMilestonesOkrHub
              localDay={endDay}
              latestWeightKg={counted[0]?.weightKg ?? null}
              totalWorkoutSets={countedTraining.length}
              totalStudyHours={totalStudyMins / 60}
            />
          </>
        ) : null}
      </Content>
    </Screen>
  );
}
