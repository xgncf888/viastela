import { Fragment, useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { computeLocalDay, formatClock, formatMonthDay, weekdayLabel } from '@/core/local-day';
import { formatKg, summarizeWindow } from '@/core/weight-stats';
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
import { EmptyState } from '@/ui/EmptyState';
import { useI18n } from '@/ui/use-i18n';
import { LineChart } from '@/ui/LineChart';
import { Callout, Columns, Divider, Row, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/ThemeProvider';
import { theme } from '@/ui/theme';
import {
  CockpitHeaderBar,
  CockpitPillButton,
  TagChip,
} from '@/ui/WorkbenchConsole';
import { LifeMilestonesOkrHub } from '@/ui/LifeMilestonesOkrHub';

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
  const { color } = useTheme();
  const { t } = useI18n();
  const [now, setNow] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
          kicker={t('趋势', 'Trends')}
          title={t('近 7 日', 'Last 7 Days')}
          trailing={
            layout !== 'compact' ? (
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
            description: t(
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
            action={<Button label={t('重试', 'Retry')} variant="secondary" onPress={() => void reload()} />}
          />
        ) : null}

        {/* Multi-Metric Body × Mind Synergy Strip */}
        <Card>
          <Row justify="between" align="center" gap="sm" wrap>
            <Row gap="sm" align="center" wrap>
              <Text variant="label" style={{ fontWeight: theme.fontWeight.semibold }}>
                {t('✦ 身心节律三维联动（晨重 × 训练 × 专注）', '✦ Body × Mind Synergy (Weight × Workout × Focus)')}
              </Text>
              <TagChip
                label={t(
                  `采样 ${counted.length} 笔 · 训练 ${countedTraining.length} 组 · 专注 ${totalStudyMins} 分钟`,
                  `${counted.length} weigh-ins · ${countedTraining.length} sets · ${totalStudyMins}m focus`,
                )}
                tone="exec"
              />
            </Row>
            <CockpitPillButton
              label={t('＋ 记一笔', '＋ Quick Log')}
              onPress={() => openRecordSheet()}
            />
          </Row>
        </Card>

        <Columns
          main={
            <Stack gap="md">
              <AverageHeadline records={counted} endDay={endDay} />
              <Card>
                <Row justify="between" align="center" gap="sm" wrap>
                  <Row gap="sm" align="center" wrap>
                    <Text variant="heading">{t('近 28 天走势', '28-Day Trajectory')}</Text>
                    <TagChip label={`${startLabel} — ${endLabel}`} tone="pod" />
                  </Row>
                  {series.points.length > 1 ? (
                    <Row gap="xs" align="center">
                      <CockpitPillButton
                        label="◀"
                        accessibilityLabel="前一个采样日"
                        onPress={() => {
                          const prev = series.points[Math.max(0, activeIdx - 1)];
                          if (prev) setSelectedDay(prev.id);
                        }}
                      />
                      <CockpitPillButton
                        label="▶"
                        accessibilityLabel="后一个采样日"
                        onPress={() => {
                          const next = series.points[Math.min(series.points.length - 1, activeIdx + 1)];
                          if (next) setSelectedDay(next.id);
                        }}
                      />
                      {minPoint ? (
                        <CockpitPillButton
                          label="Low"
                          accessibilityLabel="跳转区间最低晨重"
                          onPress={() => setSelectedDay(minPoint.id)}
                        />
                      ) : null}
                      <CockpitPillButton
                        label="Latest"
                        accessibilityLabel="跳转最新晨重"
                        onPress={() => {
                          const latest = series.points[series.points.length - 1];
                          if (latest) setSelectedDay(latest.id);
                        }}
                      />
                    </Row>
                  ) : (
                    <Text variant="caption">{`${startLabel} — ${endLabel}`}</Text>
                  )}
                </Row>
                <Divider />
                {!ready ? <Text variant="muted">{LOADING_TEXT}</Text> : null}
                {ready && series.points.length === 0 ? (
                  <EmptyState
                    title={t('还没有体重', 'No weight entries yet')}
                    description={t(
                      '记下体重后，这里会画出每天最早的体重，以及一条平滑趋势。',
                      'Log your weight to plot daily morning weigh-ins alongside an EMA trend curve.',
                    )}
                    action={<Button label={t('记录', 'Log')} variant="secondary" onPress={() => openRecordSheet()} />}
                  />
                ) : null}
                {ready && series.points.length > 0 ? (
                  <Stack gap="sm">
                    <View
                      style={{
                        padding: theme.space.sm,
                        borderRadius: theme.radius.sm,
                        borderWidth: theme.border.width,
                        borderColor: color.lineSoft,
                        backgroundColor: color.surface,
                      }}
                    >
                      <LineChart
                        points={series.points}
                        ticks={ticks}
                        unit="kg"
                        height={chartHeight}
                        startLabel={startLabel}
                        endLabel={endLabel}
                        rawLabel={t('每日晨重', 'Morning Weight')}
                        trendLabel={t('平滑趋势', 'EMA Trend')}
                        activePointId={activePoint?.id ?? null}
                        onSelectPointId={(id) => setSelectedDay(id)}
                        accessibilityLabel={`近 28 天走势，${startLabel}至${endLabel}。圆点是每天最早的体重，虚线是平滑趋势，不是均重。`}
                      />
                    </View>
                    {activePoint ? (
                      <View
                        style={{
                          paddingHorizontal: theme.space.ms,
                          paddingVertical: theme.space.xs,
                          borderRadius: theme.radius.sm,
                          borderWidth: theme.border.width,
                          borderColor: color.lineSoft,
                          backgroundColor: color.surface,
                        }}
                      >
                        <Row justify="between" align="center" gap="sm" wrap>
                          <Row gap="xs" align="center" wrap>
                            <TagChip label={formatMonthDay(activePoint.id)} tone="owner" />
                            <Text variant="caption">
                              {t(
                                `晨重 ${formatKg(activePoint.raw)} kg · 趋势 ${formatKg(activePoint.trend)} kg`,
                                `Raw ${formatKg(activePoint.raw)} kg · Trend ${formatKg(activePoint.trend)} kg`,
                              )}
                            </Text>
                          </Row>
                          {meanRaw !== null && minRaw !== null && maxRaw !== null ? (
                            <Text variant="caption">
                              {t(
                                `28D 均值 ${formatKg(meanRaw)} kg · 极值 ${formatKg(minRaw)}–${formatKg(maxRaw)} kg`,
                                `28D Mean ${formatKg(meanRaw)} kg · Range ${formatKg(minRaw)}–${formatKg(maxRaw)} kg`,
                              )}
                            </Text>
                          ) : null}
                        </Row>
                      </View>
                    ) : null}
                    <Text variant="muted">
                      {t(
                        '圆点是每天最早的体重。虚线是指数平滑，不是另一条均重。',
                        'Dots represent the earliest weigh-in of each day; the dashed line is exponential smoothing.',
                      )}
                    </Text>
                  </Stack>
                ) : null}
              </Card>
            </Stack>
          }
          aside={
            <Card>
              <Row justify="between" align="center">
                <Text variant="heading">{t('近 7 日明细', '7-Day Breakdown')}</Text>
                <TagChip label={t('按记账日倒序', 'Reverse Chronological')} tone="pod" />
              </Row>
              <Divider />
              {days.map((day, index) => {
                const isSelected = activePoint?.id === day.localDay && day.primary !== null;
                return (
                  <Fragment key={day.localDay}>
                    {index > 0 ? <Divider /> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${formatMonthDay(day.localDay)} ${shortWeekday(day.localDay)}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        if (day.primary) setSelectedDay(day.localDay);
                      }}
                      style={{
                        minHeight: theme.layout.control,
                        justifyContent: 'center',
                        paddingHorizontal: theme.space.xs,
                        borderRadius: theme.radius.sm,
                        backgroundColor: isSelected ? color.accentSoft : 'transparent',
                      }}
                    >
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
                            <Text variant="muted">{t('无记录', 'No entry')}</Text>
                          )}
                        </Row>
                        {day.notes.map((note, noteIndex) => (
                          <View key={note.id}>
                            <Row justify="end">
                              <Text variant="muted">
                                {weighInLabel(noteIndex + 1)} {formatKg(note.weightKg)} kg ·{' '}
                                {formatClock(note.recordedAt, note.tz)}
                              </Text>
                            </Row>
                          </View>
                        ))}
                      </Stack>
                    </Pressable>
                  </Fragment>
                );
              })}
            </Card>
          }
        />
        <LifeMilestonesOkrHub
          localDay={endDay}
          latestWeightKg={activePoint?.raw ?? null}
          totalWorkoutSets={countedTraining.length}
          totalStudyHours={totalStudyMins / 60}
        />
      </Content>
    </Screen>
  );
}
