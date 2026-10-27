import { useEffect, useState } from 'react';

import {
  computeLocalDay,
  formatClock,
  formatMonthDay,
  isBeforeDaySwitch,
  parseDaySwitch,
  weekdayLabel,
} from '@/core/local-day';
import { formatKg, latestRecord, recordsOnDay } from '@/core/weight-stats';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useShellInset } from '@/features/shell/AppShell';
import { AverageHeadline } from '@/features/weight/WeightSummary';
import { LOADING_TEXT, todayReadout, weighInLabel } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Content } from '@/ui/Content';
import { EmptyState } from '@/ui/EmptyState';
import { Callout, Row, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

function shortWeekday(localDay: string): string {
  return weekdayLabel(localDay).replace('星期', '周');
}

function nightLine(daySwitch: string): string {
  const { hour } = parseDaySwitch(daySwitch);
  return `凌晨 ${hour} 点前的记录算作前一天`;
}

export function TodayScreen() {
  const { ready, loadError, records, failedIds, saving, daySwitch, timeZone, reload, retry, dismiss, removeRecord } =
    useWeight();
  const inset = useShellInset();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const accounting = computeLocalDay(now, timeZone, daySwitch);
  const beforeSwitch = isBeforeDaySwitch(now, timeZone, daySwitch);
  const today = recordsOnDay(records, accounting);
  const last = latestRecord(records);
  const readout = todayReadout(ready, today.length, last !== null);

  if (readout.loading) {
    return (
      <Screen>
        <Content inset={inset}>
          <Text variant="body">{LOADING_TEXT}</Text>
        </Content>
      </Screen>
    );
  }

  return (
    <Screen>
      <Content inset={inset}>
        <ScreenHeader
          kicker="今日"
          title={`${formatMonthDay(accounting)} ${shortWeekday(accounting)}`}
          note={beforeSwitch ? nightLine(daySwitch) : undefined}
        />

        {loadError ? (
          <Callout message={loadError} action={<Button label="重试" variant="secondary" onPress={() => void reload()} />} />
        ) : null}

        <AverageHeadline records={records} endDay={accounting} />

        <Stack gap="md">
          <Text variant="heading">{beforeSwitch ? `${formatMonthDay(accounting)}的记录` : '今天的记录'}</Text>
          {readout.firstRecord ? (
            <EmptyState title={readout.firstRecord} action={<Button label="记录" onPress={() => openRecordSheet()} />} />
          ) : null}
          {today.length === 0 && last ? (
            <EmptyState
              title="今天还没有记录"
              description="再记会带上上次的体重，点保存后才会写入。"
              action={
                <Button label={`再记 ${formatKg(last.weightKg)} kg`} onPress={() => openRecordSheet(last.weightKg)} />
              }
            />
          ) : null}
          {today.map((record, index) => {
            const failed = failedIds.has(record.id);
            return (
              <Card key={record.id}>
                <Text variant="muted">{weighInLabel(index)}</Text>
                <Text variant="heading">
                  {formatKg(record.weightKg)} kg · {formatClock(record.recordedAt, record.tz)}
                </Text>
                {failed ? (
                  <Row gap="sm" wrap>
                    <Text variant="muted" tone="danger">
                      未保存
                    </Text>
                    <Button label="重试" onPress={() => void retry(record.id)} loading={saving} />
                    <Button label="放弃" variant="ghost" onPress={() => dismiss(record.id)} />
                  </Row>
                ) : (
                  <Button label="删除" variant="danger" onPress={() => void removeRecord(record.id)} />
                )}
              </Card>
            );
          })}
        </Stack>

        {last && today.length > 0 ? (
          <Button label={`再记 ${formatKg(last.weightKg)} kg`} onPress={() => openRecordSheet(last.weightKg)} />
        ) : null}
      </Content>
    </Screen>
  );
}
