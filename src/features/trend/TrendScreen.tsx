import { Fragment, useEffect, useState } from 'react';

import { computeLocalDay, formatClock, formatMonthDay, weekdayLabel } from '@/core/local-day';
import { formatKg, summarizeWindow } from '@/core/weight-stats';
import { useRefreshOnFocus } from '@/data/refresh-on-focus';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useShellInset } from '@/features/shell/AppShell';
import { AverageHeadline } from '@/features/weight/WeightSummary';
import { excludePending, LOADING_TEXT, weighInLabel } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { weightAxis } from '@/ui/chart-ticks';
import { useLayoutClass } from '@/ui/chrome';
import { Content } from '@/ui/Content';
import { EmptyState } from '@/ui/EmptyState';
import { LineChart } from '@/ui/LineChart';
import { Callout, Columns, Divider, Row, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';

import { chartSeries } from './chart-model';

function shortWeekday(localDay: string): string {
  return weekdayLabel(localDay).replace('星期', '周');
}

export function TrendScreen() {
  const { ready, loadError, records, pendingDeleteIds, daySwitch, timeZone, reload, refreshing, refreshError } = useWeight();
  const inset = useShellInset();
  const layout = useLayoutClass();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useRefreshOnFocus(() => reload());

  const endDay = computeLocalDay(now, timeZone, daySwitch);
  const counted = excludePending(records, pendingDeleteIds);
  const days = [...summarizeWindow(counted, endDay)].reverse();
  const series = chartSeries(counted, endDay);
  const startLabel = formatMonthDay(series.startDay);
  const endLabel = formatMonthDay(series.endDay);
  const ticks =
    series.points.length > 0 ? weightAxis(series.points.flatMap((point) => [point.raw, point.trend])) : undefined;
  const chartHeight = layout === 'expanded' ? theme.layout.chartTrend : theme.layout.chart;

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
              <Card>
                <Row justify="between" align="center">
                  <Text variant="heading">近 28 日走势</Text>
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
      </Content>
    </Screen>
  );
}
