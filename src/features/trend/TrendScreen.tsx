import { Fragment, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { computeLocalDay, formatClock, formatMonthDay, shiftLocalDay, weekdayLabel } from '@/core/local-day';
import { formatKg, summarizeWindow } from '@/core/weight-stats';
import { useRefreshOnFocus } from '@/data/refresh-on-focus';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useShellInset } from '@/features/shell/AppShell';
import { AverageHeadline } from '@/features/weight/WeightSummary';
import { excludePending, LOADING_TEXT, weighInLabel } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ChipGroup } from '@/ui/ChipGroup';
import { weightAxis } from '@/ui/chart-ticks';
import { useLayoutClass } from '@/ui/chrome';
import { Content } from '@/ui/Content';
import { EmptyState } from '@/ui/EmptyState';
import { LineChart, type LinePoint } from '@/ui/LineChart';
import { Callout, Columns, Divider, Row, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/ThemeProvider';
import { theme } from '@/ui/theme';

import { chartSeries } from './chart-model';

const WINDOWS: { days: 7 | 14 | 28; label: string }[] = [
  { days: 7, label: '7D' },
  { days: 14, label: '14D' },
  { days: 28, label: '28D' },
];

function shortWeekday(localDay: string): string {
  return weekdayLabel(localDay).replace('星期', '周');
}

function sliceWindowPoints(
  points: readonly LinePoint[],
  endDay: string,
  windowDays: 7 | 14 | 28,
): { startDay: string; endDay: string; points: LinePoint[] } {
  const startDay = shiftLocalDay(endDay, -(windowDays - 1));
  const filtered = points.filter((point) => point.id >= startDay && point.id <= endDay);
  const span = Math.max(windowDays - 1, 1);
  return {
    startDay,
    endDay,
    points: filtered.map((point) => {
      const offset = Math.max(
        0,
        Math.min(
          span,
          Math.round((Date.parse(`${point.id}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86_400_000),
        ),
      );
      return {
        ...point,
        position: offset / span,
      };
    }),
  };
}

export function TrendScreen() {
  const { ready, loadError, records, pendingDeleteIds, daySwitch, timeZone, reload, refreshing, refreshError } = useWeight();
  const inset = useShellInset();
  const layout = useLayoutClass();
  const { color } = useTheme();
  const [now, setNow] = useState(() => new Date());
  const [windowDays, setWindowDays] = useState<7 | 14 | 28>(28);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useRefreshOnFocus(() => reload());

  const endDay = computeLocalDay(now, timeZone, daySwitch);
  const counted = excludePending(records, pendingDeleteIds);
  const days = [...summarizeWindow(counted, endDay)].reverse();
  const fullSeries = chartSeries(counted, endDay);
  const activeSeries =
    windowDays === 28 ? fullSeries : sliceWindowPoints(fullSeries.points, endDay, windowDays);
  const startLabel = formatMonthDay(activeSeries.startDay);
  const endLabel = formatMonthDay(activeSeries.endDay);
  const ticks =
    activeSeries.points.length > 0
      ? weightAxis(activeSeries.points.flatMap((point) => [point.raw, point.trend]))
      : undefined;
  const chartHeight = layout === 'expanded' ? theme.layout.chartTrend : theme.layout.chart;

  const rawValues = activeSeries.points.map((point) => point.raw);
  const minRaw = rawValues.length > 0 ? Math.min(...rawValues) : null;
  const maxRaw = rawValues.length > 0 ? Math.max(...rawValues) : null;
  const latestPoint = activeSeries.points[activeSeries.points.length - 1] ?? null;
  const firstPoint = activeSeries.points[0] ?? null;
  const trendDelta = latestPoint && firstPoint ? latestPoint.trend - firstPoint.trend : null;
  const recordedDays7 = days.filter((day) => day.primary !== null).length;

  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader
          kicker="趋势"
          title="近 7 日"
          subtitle={{
            failed: refreshError,
            refreshing,
            description: '均重用每天最早的一笔。同一天更晚的记录是复测，不进均重。',
            timeZone,
            onRetry: () => void reload(),
          }}
        />
        {loadError ? (
          <Callout message={loadError} action={<Button label="重试" variant="secondary" onPress={() => void reload()} />} />
        ) : null}
        <Columns
          main={
            <Stack gap="md">
              <AverageHeadline records={counted} endDay={endDay} />
              {ready && fullSeries.points.length > 0 && minRaw !== null && maxRaw !== null && latestPoint ? (
                <Columns columns={3}>
                  <Card>
                    <Text variant="label">区间极值</Text>
                    <Text variant="heading">{`${formatKg(minRaw)} — ${formatKg(maxRaw)} kg`}</Text>
                    <Text variant="caption">{`波动幅度 ${formatKg(maxRaw - minRaw)} kg`}</Text>
                  </Card>
                  <Card>
                    <Text variant="label">平滑趋势</Text>
                    <Text variant="heading">{`${formatKg(latestPoint.trend)} kg`}</Text>
                    <Text variant="caption">
                      {trendDelta !== null
                        ? `区间变化 ${trendDelta > 0 ? '+' : ''}${formatKg(trendDelta)} kg`
                        : '指数平滑基准'}
                    </Text>
                  </Card>
                  <Card>
                    <Text variant="label">打卡活跃度</Text>
                    <Text variant="heading">{`${recordedDays7}/7 天`}</Text>
                    <Text variant="caption">{`近 28 日已记 ${fullSeries.points.length} 天`}</Text>
                  </Card>
                </Columns>
              ) : null}
              <Card>
                <Row justify="between" align="center" gap="sm" wrap>
                  <Row gap="sm" align="center">
                    <Text variant="heading">近 28 日走势</Text>
                    <Text variant="caption">{`${startLabel} — ${endLabel}`}</Text>
                  </Row>
                  {ready && fullSeries.points.length > 0 ? (
                    <ChipGroup>
                      {WINDOWS.map((item) => (
                        <Chip
                          key={item.days}
                          label={item.label}
                          selected={windowDays === item.days}
                          onPress={() => setWindowDays(item.days)}
                        />
                      ))}
                    </ChipGroup>
                  ) : null}
                </Row>
                <Divider />
                {!ready ? <Text variant="muted">{LOADING_TEXT}</Text> : null}
                {ready && fullSeries.points.length === 0 ? (
                  <EmptyState
                    title="还没有体重"
                    description="记下体重后，这里会画出每天最早的体重，以及一条平滑趋势。"
                    action={<Button label="记录" variant="secondary" onPress={() => openRecordSheet()} />}
                  />
                ) : null}
                {ready && activeSeries.points.length > 0 ? (
                  <Stack gap="sm">
                    <LineChart
                      points={activeSeries.points}
                      ticks={ticks}
                      unit="kg"
                      height={chartHeight}
                      startLabel={startLabel}
                      endLabel={endLabel}
                      rawLabel="每日晨重"
                      trendLabel="平滑趋势"
                      interactive
                      selectedPointId={selectedDay}
                      onSelectPointId={setSelectedDay}
                      accessibilityLabel={`近 28 日走势，${startLabel}至${endLabel}。圆点是每天最早的体重，虚线是平滑趋势，不是均重。`}
                    />
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
                <Text variant="caption">轻触行可联动图表</Text>
              </Row>
              <Divider />
              {days.map((day, index) => {
                const isSelected = selectedDay === day.localDay;
                return (
                  <Fragment key={day.localDay}>
                    {index > 0 ? <Divider /> : null}
                    <Pressable
                      onPress={() => setSelectedDay((current) => (current === day.localDay ? null : day.localDay))}
                      style={[
                        styles.dayRow,
                        isSelected ? { backgroundColor: color.fill, borderColor: color.line } : null,
                      ]}
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
                    </Pressable>
                  </Fragment>
                );
              })}
            </Card>
          }
        />
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayRow: {
    paddingVertical: theme.space.xs,
    paddingHorizontal: theme.space.xs,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    borderColor: 'transparent',
  },
});
