import { useEffect, useState } from 'react';

import {
  computeLocalDay,
  formatClock,
  formatMonthDay,
  isBeforeDaySwitch,
  parseDaySwitch,
  weekdayLabel,
} from '@/core/local-day';
import { formatTrainingLoad, trainingDaySummary, trainingSetsOnDay } from '@/core/training';
import { formatKg, latestRecord, recordsOnDay } from '@/core/weight-stats';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useShellInset } from '@/features/shell/AppShell';
import { useTraining } from '@/features/training/TrainingProvider';
import { AverageHeadline } from '@/features/weight/WeightSummary';
import { excludePending, LOADING_TEXT, todayReadout, weighInLabel } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SetRow } from '@/ui/SetRow';
import { StatusCard } from '@/ui/StatusCard';
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
  const {
    ready,
    loadError,
    records,
    failedIds,
    saving,
    daySwitch,
    timeZone,
    reload,
    retry,
    dismiss,
    scheduleDelete,
    pendingDeleteIds,
  } = useWeight();
  const training = useTraining();
  const inset = useShellInset();
  const [now, setNow] = useState(() => new Date());
  const [trainingDetail, setTrainingDetail] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const accounting = computeLocalDay(now, timeZone, daySwitch);
  const beforeSwitch = isBeforeDaySwitch(now, timeZone, daySwitch);
  const counted = excludePending(records, pendingDeleteIds);
  const today = recordsOnDay(records, accounting);
  const visibleToday = recordsOnDay(counted, accounting);
  const last = latestRecord(records);
  const trainingToday = trainingSetsOnDay(excludePending(training.sets, training.pendingDeleteIds), accounting);
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

        <AverageHeadline records={counted} endDay={accounting} />

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
          {visibleToday.map((record, index) => {
            const failed = failedIds.has(record.id);
            return (
              <Card key={record.id}>
                <Row justify="between" align="center">
                  <Text variant="muted">{weighInLabel(index)}</Text>
                  {failed ? null : (
                    <Button label="删除" variant="ghost" onPress={() => scheduleDelete(record.id)} />
                  )}
                </Row>
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
                ) : null}
              </Card>
            );
          })}
        </Stack>

        <Stack gap="md">
          <Text variant="heading">{beforeSwitch ? `${formatMonthDay(accounting)}的训练` : '今天的训练'}</Text>
          {training.loadError ? (
            <Callout
              message={training.loadError}
              action={<Button label="重试" variant="secondary" onPress={() => void training.reload()} />}
            />
          ) : null}
          {!training.ready ? <Text variant="body">{LOADING_TEXT}</Text> : null}
          {training.ready && trainingToday.length === 0 ? (
            <Button label="记一笔" onPress={() => openRecordSheet(undefined, 'training')} />
          ) : null}
          {trainingToday.length > 0 ? (
            <StatusCard summary={trainingDaySummary(trainingToday)} onPress={() => setTrainingDetail(true)} />
          ) : null}
          {trainingDetail
            ? trainingToday.map((set) => {
                const failed = training.failedIds.has(set.id);
                return (
                  <SetRow
                    key={set.id}
                    title={set.exercise}
                    detail={`${set.reps} 次 · ${formatTrainingLoad(set)}`}
                    onDelete={failed ? undefined : () => training.scheduleDelete(set.id)}
                  >
                    {failed ? (
                      <Row gap="sm" wrap>
                        <Text variant="muted" tone="danger">
                          未保存
                        </Text>
                        <Button label="重试" onPress={() => void training.retry(set.id)} loading={training.saving} />
                        <Button label="放弃" variant="ghost" onPress={() => training.dismiss(set.id)} />
                      </Row>
                    ) : null}
                  </SetRow>
                );
              })
            : null}
        </Stack>

        {last && today.length > 0 ? (
          <Button label={`再记 ${formatKg(last.weightKg)} kg`} onPress={() => openRecordSheet(last.weightKg)} />
        ) : null}
      </Content>
    </Screen>
  );
}
