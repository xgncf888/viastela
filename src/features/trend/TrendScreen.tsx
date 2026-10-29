import { useEffect, useState } from 'react';

import { computeLocalDay, formatClock, formatMonthDay } from '@/core/local-day';
import { formatKg, summarizeWindow } from '@/core/weight-stats';
import { useRefreshOnFocus } from '@/data/refresh-on-focus';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useShellInset } from '@/features/shell/AppShell';
import { AverageHeadline } from '@/features/weight/WeightSummary';
import { excludePending, LOADING_TEXT, weighInLabel } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Content } from '@/ui/Content';
import { EmptyState } from '@/ui/EmptyState';
import { LineChart } from '@/ui/LineChart';
import { Callout, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

import { chartSeries } from './chart-model';

export function TrendScreen() {
  const { ready, loadError, records, pendingDeleteIds, daySwitch, timeZone, reload, refreshing, refreshError } = useWeight();
  const inset = useShellInset();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useRefreshOnFocus(() => reload());

  const endDay = computeLocalDay(now, timeZone, daySwitch);
  const counted = excludePending(records, pendingDeleteIds);
  const days = summarizeWindow(counted, endDay);
  const series = chartSeries(counted, endDay);
  const startLabel = formatMonthDay(series.startDay);
  const endLabel = formatMonthDay(series.endDay);

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
        <AverageHeadline records={counted} endDay={endDay} />
        <Card>
          <Text variant="muted">近 28 日</Text>
          {!ready ? <Text variant="muted">{LOADING_TEXT}</Text> : null}
          {ready && series.points.length === 0 ? (
            <EmptyState
              title="还没有体重"
              description="记下体重后，这里会画出每天最早的体重，以及一条平滑趋势。"
              action={<Button label="记录" onPress={() => openRecordSheet()} />}
            />
          ) : null}
          {ready && series.points.length > 0 ? (
            <Stack gap="sm">
              <LineChart
                points={series.points}
                startLabel={startLabel}
                endLabel={endLabel}
                rawLabel="最早体重"
                trendLabel="平滑趋势"
                accessibilityLabel={`近 28 日走势，${startLabel}至${endLabel}。圆点是每天最早的体重，虚线是平滑趋势，不是均重。`}
              />
              <Text variant="muted">圆点是每天最早的体重。虚线是指数平滑，不是另一条均重。</Text>
            </Stack>
          ) : null}
        </Card>
        <Stack gap="md">
          {days.map((day) => (
            <Card key={day.localDay}>
              <Text variant="heading">{formatMonthDay(day.localDay)}</Text>
              {day.primary ? (
                <Text variant="body">
                  {weighInLabel(0)} {formatKg(day.primary.weightKg)} kg · {formatClock(day.primary.recordedAt, day.primary.tz)}
                </Text>
              ) : (
                <Text variant="muted">无记录</Text>
              )}
              {day.notes.map((note, index) => (
                <Text key={note.id} variant="muted">
                  {weighInLabel(index + 1)} {formatKg(note.weightKg)} kg · {formatClock(note.recordedAt, note.tz)}
                </Text>
              ))}
            </Card>
          ))}
        </Stack>
      </Content>
    </Screen>
  );
}
