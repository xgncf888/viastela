import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  computeLocalDay,
  formatClock,
  formatMonthDay,
  headerAccountingLabel,
  weekdayLabel,
  civilLocalDay,
} from '@/core/local-day';
import { formatKg, recordsOnDay, sevenDayAverage, latestRecord } from '@/core/weight-stats';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useWeight } from '@/features/weight/WeightProvider';
import { useShellInset } from '@/features/shell/AppShell';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Content } from '@/ui/Content';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';

export function TodayScreen() {
  const { ready, loadError, records, failedIds, saving, daySwitch, timeZone, reload, saveWeight, retry, dismiss } =
    useWeight();
  const inset = useShellInset();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const civil = civilLocalDay(now, timeZone);
  const accounting = computeLocalDay(now, timeZone, daySwitch);
  const notice = headerAccountingLabel(now, timeZone, daySwitch);
  const average = sevenDayAverage(records, accounting);
  const today = recordsOnDay(records, accounting);
  const last = latestRecord(records);

  return (
    <Screen>
      <Content inset={inset}>
        <View style={styles.header}>
          <Text variant="muted">今日</Text>
          <Text variant="title" accessibilityRole="header">
            {formatMonthDay(civil)} {weekdayLabel(civil)}
          </Text>
          {notice ? <Text variant="heading">{notice}</Text> : null}
        </View>

        {loadError ? (
          <Card>
            <Text variant="body">{loadError}</Text>
            <Button label="重试" variant="secondary" onPress={() => void reload()} />
          </Card>
        ) : null}

        <Card>
          <Text variant="muted">近 7 日均重</Text>
          <Text variant="display">{average === null ? '—' : formatKg(average)}</Text>
          <Text variant="muted">kg · 每天最早的一笔，没有记录的日子不计入</Text>
        </Card>

        <View style={styles.section}>
          <Text variant="heading">{notice ? `${formatMonthDay(accounting)}的记录` : '今天的记录'}</Text>
          {!ready ? <Text variant="muted">读取中</Text> : null}
          {ready && today.length === 0 ? <EmptyState /> : null}
          {today.map((record, index) => {
            const failed = failedIds.has(record.id);
            const label = index === 0 ? '晨重' : '备注';
            return (
              <Card key={record.id}>
                <Text variant="muted">{label}</Text>
                <Text variant="heading">
                  {formatKg(record.weightKg)} kg · {formatClock(record.recordedAt, record.tz)}
                </Text>
                {failed ? (
                  <View style={styles.row}>
                    <Text variant="muted" tone="danger">
                      未保存
                    </Text>
                    <Button label="重试" onPress={() => void retry(record.id)} loading={saving} />
                    <Button label="放弃" variant="ghost" onPress={() => dismiss(record.id)} />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>

        {last ? (
          <Button
            label={`再记 ${formatKg(last.weightKg)} kg`}
            onPress={() => void saveWeight(last.weightKg)}
            loading={saving}
          />
        ) : (
          <Button label="先记第一笔" onPress={openRecordSheet} />
        )}
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.space.xs },
  section: { gap: theme.space.md },
  row: { gap: theme.space.sm },
});
