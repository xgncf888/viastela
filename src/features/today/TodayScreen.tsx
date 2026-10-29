import { useEffect, useState } from 'react';

import {
  computeLocalDay,
  formatClock,
  formatMonthDay,
  isBeforeDaySwitch,
  parseDaySwitch,
  weekdayLabel,
} from '@/core/local-day';
import { studyDaySummary, studyDetail, studyRecordsOnDay } from '@/core/study';
import { formatTrainingLoad, trainingDaySummary, trainingSetsOnDay } from '@/core/training';
import { formatKg, latestRecord, recordsOnDay } from '@/core/weight-stats';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useShellInset } from '@/features/shell/AppShell';
import { useStudy } from '@/features/study/StudyProvider';
import { useTraining } from '@/features/training/TrainingProvider';
import { AverageHeadline } from '@/features/weight/WeightSummary';
import { excludePending, todayReadout, weighInLabel, weightColumnPhase } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SetRow } from '@/ui/SetRow';
import { CardRow, StatusCard } from '@/ui/StatusCard';
import { Content } from '@/ui/Content';
import { EmptyState } from '@/ui/EmptyState';
import { LoadingRegion } from '@/ui/LoadingRegion';
import { Row, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { SkeletonDisplay, SkeletonLedger, SkeletonText } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { useLoadGate } from '@/ui/use-load-gate';

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
  const study = useStudy();
  const inset = useShellInset();
  const [now, setNow] = useState(() => new Date());
  const [trainingDetail, setTrainingDetail] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);

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
  const studyToday = studyRecordsOnDay(excludePending(study.records, study.pendingDeleteIds), accounting);
  const readout = todayReadout(ready, today.length, last !== null);
  const trainingTitle = beforeSwitch ? `${formatMonthDay(accounting)}的训练` : '今天的训练';
  const studyTitle = beforeSwitch ? `${formatMonthDay(accounting)}的学习` : '今天的学习';
  const allLogged = visibleToday.length > 0 && trainingToday.length > 0 && studyToday.length > 0;
  const note = [beforeSwitch ? nightLine(daySwitch) : null, allLogged ? '今天都记完了' : null].filter(Boolean).join(' · ');

  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader
          kicker="今日"
          title={`${formatMonthDay(accounting)} ${shortWeekday(accounting)}`}
          note={note || undefined}
        />

        <LoadingRegion
          name="今日"
          loading={!ready}
          error={loadError !== null}
          onRetry={() => void reload()}
          skeleton={<TodaySkeleton />}
        >
          <Stack gap="md">
          <AverageHeadline records={counted} endDay={accounting} />
          <RecordEntry />
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
          {last && today.length > 0 ? (
            <Button label={`再记 ${formatKg(last.weightKg)} kg`} onPress={() => openRecordSheet(last.weightKg)} />
          ) : null}
          </Stack>
        </LoadingRegion>

        <CardRow>
          <WeightColumn
            ready={ready}
            failed={loadError !== null}
            recorded={visibleToday.length > 0}
            summary={visibleToday[0] ? `${formatKg(visibleToday[0].weightKg)} kg` : '未记录'}
            hint={visibleToday[0] ? formatClock(visibleToday[0].recordedAt, visibleToday[0].tz) : undefined}
          />
          <Stack gap="sm">
            <Text variant="heading">{trainingTitle}</Text>
            <LoadingRegion
              name="训练记录"
              loading={!training.ready}
              error={training.loadError !== null}
              onRetry={() => void training.reload()}
              skeleton={
                <Card>
                  <SkeletonText lines={2} />
                </Card>
              }
            >
              {trainingToday.length === 0 ? (
                <StatusCard summary="未记录" actionLabel="记一笔" onAction={() => openRecordSheet(undefined, 'training')} />
              ) : (
                <StatusCard
                  summary={trainingDaySummary(trainingToday)}
                  hint={trainingDetail ? '收起' : '查看每组'}
                  onPress={() => setTrainingDetail((open) => !open)}
                />
              )}
            </LoadingRegion>
          </Stack>
          <Stack gap="sm">
            <Text variant="heading">{studyTitle}</Text>
            <LoadingRegion
              name="学习记录"
              loading={!study.ready}
              error={study.loadError !== null}
              onRetry={() => void study.reload()}
              skeleton={
                <Card>
                  <SkeletonText lines={2} />
                </Card>
              }
            >
              {studyToday.length === 0 ? (
                <StatusCard summary="未记录" actionLabel="记一笔" onAction={() => openRecordSheet(undefined, 'study')} />
              ) : (
                <StatusCard
                  summary={studyDaySummary(studyToday)}
                  hint={studyOpen ? '收起' : '查看记录'}
                  onPress={() => setStudyOpen((open) => !open)}
                />
              )}
            </LoadingRegion>
          </Stack>
        </CardRow>

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
        {studyOpen
          ? studyToday.map((record) => {
              const failed = study.failedIds.has(record.id);
              return (
                <SetRow
                  key={record.id}
                  title={record.topic}
                  detail={studyDetail(record)}
                  onDelete={failed ? undefined : () => study.scheduleDelete(record.id)}
                >
                  {failed ? (
                    <Row gap="sm" wrap>
                      <Text variant="muted" tone="danger">
                        未保存
                      </Text>
                      <Button label="重试" onPress={() => void study.retry(record.id)} loading={study.saving} />
                      <Button label="放弃" variant="ghost" onPress={() => study.dismiss(record.id)} />
                    </Row>
                  ) : null}
                </SetRow>
              );
            })
          : null}

      </Content>
    </Screen>
  );
}

function RecordEntry() {
  return <Button label="记录" fill onPress={() => openRecordSheet()} />;
}

function TodaySkeleton() {
  return (
    <Stack gap="md">
      <Card>
        <Text variant="muted">7 日均重</Text>
        <SkeletonDisplay />
      </Card>
      <RecordEntry />
      <Card>
        <SkeletonLedger lines={3} />
      </Card>
    </Stack>
  );
}

function WeightColumn({
  ready,
  failed,
  recorded,
  summary,
  hint,
}: {
  ready: boolean;
  failed: boolean;
  recorded: boolean;
  summary: string;
  hint?: string;
}) {
  const gate = useLoadGate(!ready);
  const phase = weightColumnPhase({ ready, failed, showSkeleton: gate.showSkeleton });
  return (
    <Stack gap="sm">
      <Text variant="heading">体重</Text>
      {phase === 'dash' ? (
        <Card>
          <Text variant="muted">—</Text>
        </Card>
      ) : null}
      {phase === 'skeleton' ? (
        <Card>
          <SkeletonText lines={2} />
        </Card>
      ) : null}
      {phase === 'content' && !recorded ? (
        <StatusCard summary="未记录" actionLabel="记一笔" onAction={() => openRecordSheet()} />
      ) : null}
      {phase === 'content' && recorded ? <StatusCard summary={summary} hint={hint} /> : null}
    </Stack>
  );
}
