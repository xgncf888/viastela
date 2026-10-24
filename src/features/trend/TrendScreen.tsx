import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { computeLocalDay, formatClock, formatMonthDay } from '@/core/local-day';
import { formatKg, sevenDayAverage, summarizeWindow } from '@/core/weight-stats';
import { useShellInset } from '@/features/shell/AppShell';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Content } from '@/ui/Content';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';

import { TrendChart } from './TrendChart';

export function TrendScreen() {
  const { ready, loadError, records, daySwitch, timeZone, reload } = useWeight();
  const inset = useShellInset();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const endDay = computeLocalDay(now, timeZone, daySwitch);
  const days = summarizeWindow(records, endDay);
  const average = sevenDayAverage(records, endDay);
  const hasAny = days.some((day) => day.primary);

  return (
    <Screen>
      <Content inset={inset}>
        <View style={styles.header}>
          <Text variant="muted">趋势</Text>
          <Text variant="title" accessibilityRole="header">
            近 7 日
          </Text>
          <Text variant="muted">均重用每天最早的一笔。同一天的其他记录留作备注，不进均重。</Text>
        </View>
        {loadError ? (
          <Card>
            <Text variant="body">{loadError}</Text>
            <Button label="重试" variant="secondary" onPress={() => void reload()} />
          </Card>
        ) : null}
        <Card>
          <Text variant="muted">7 日均重</Text>
          <Text variant="display">{average === null ? '—' : formatKg(average)}</Text>
          <Text variant="muted">kg</Text>
          {ready && !hasAny ? <EmptyState /> : <TrendChart days={days} />}
        </Card>
        {days.map((day) => (
          <Card key={day.localDay}>
            <Text variant="heading">{formatMonthDay(day.localDay)}</Text>
            {day.primary ? (
              <Text variant="body">
                晨重 {formatKg(day.primary.weightKg)} kg · {formatClock(day.primary.recordedAt, day.primary.tz)}
              </Text>
            ) : (
              <Text variant="muted">无记录</Text>
            )}
            {day.notes.map((note) => (
              <Text key={note.id} variant="muted">
                备注 {formatKg(note.weightKg)} kg · {formatClock(note.recordedAt, note.tz)}
              </Text>
            ))}
          </Card>
        ))}
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.space.xs },
});
