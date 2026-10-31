import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { detectRuntimeHostMode } from '@/core/charioteer-plugin';
import {
  computeLocalDay,
  formatClock,
  formatMonthDay,
  isBeforeDaySwitch,
  parseDaySwitch,
  shiftLocalDay,
  weekdayLabel,
} from '@/core/local-day';
import { studyDaySummary, studyDetail, studyRecordsOnDay, type StudyRecord } from '@/core/study';
import { formatTrainingLoad, trainingDaySummary, trainingSetsOnDay, type TrainingSet } from '@/core/training';
import { formatKg, latestRecord, recordsOnDay, type WeightRecord } from '@/core/weight-stats';
import { useRefreshOnFocus } from '@/data/refresh-on-focus';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { MonthEndNotice } from '@/features/today/MonthEndNotice';
import { useShellInset } from '@/features/shell/AppShell';
import { useStudy } from '@/features/study/StudyProvider';
import { useTraining } from '@/features/training/TrainingProvider';
import { averageCaption, excludePending, todayReadout, weighInLabel, weightColumnPhase } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { BrandMark } from '@/ui/BrandMark';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { useLayoutClass } from '@/ui/chrome';
import { SetRow } from '@/ui/SetRow';
import { CardRow, StatusCard } from '@/ui/StatusCard';
import { Content } from '@/ui/Content';
import { EmptyState } from '@/ui/EmptyState';
import { LoadingRegion } from '@/ui/LoadingRegion';
import { Divider, Row, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { skeletonHiddenProps, SkeletonDisplay, SkeletonLedger, SkeletonText } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/ThemeProvider';
import { theme } from '@/ui/theme';
import { useLoadGate } from '@/ui/use-load-gate';
import {
  CockpitHeaderBar,
  CockpitPillButton,
  TagChip,
  WorkbenchConsoleCard,
} from '@/ui/WorkbenchConsole';

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
    refreshing,
    refreshError,
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
  const layout = useLayoutClass();
  const [now, setNow] = useState(() => new Date());
  const [trainingDetail, setTrainingDetail] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const weightGate = useLoadGate(!ready, loadAttempt);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useRefreshOnFocus(async () => {
    await Promise.all([reload(), training.reload(), study.reload()]);
  });

  const accounting = computeLocalDay(now, timeZone, daySwitch);
  const beforeSwitch = isBeforeDaySwitch(now, timeZone, daySwitch);
  const counted = excludePending(records, pendingDeleteIds);
  const countedTraining = excludePending(training.sets, training.pendingDeleteIds);
  const countedStudy = excludePending(study.records, study.pendingDeleteIds);
  const today = recordsOnDay(records, accounting);
  const visibleToday = recordsOnDay(counted, accounting);
  const last = latestRecord(records);
  const trainingToday = trainingSetsOnDay(countedTraining, accounting);
  const studyToday = studyRecordsOnDay(countedStudy, accounting);
  const readout = todayReadout(ready, today.length, last !== null);
  const trainingTitle = beforeSwitch ? `${formatMonthDay(accounting)}的训练` : '今天的训练';
  const studyTitle = beforeSwitch ? `${formatMonthDay(accounting)}的学习` : '今天的学习';
  const allLogged = visibleToday.length > 0 && trainingToday.length > 0 && studyToday.length > 0;
  const loggedCount =
    (visibleToday.length > 0 ? 1 : 0) + (trainingToday.length > 0 ? 1 : 0) + (studyToday.length > 0 ? 1 : 0);

  const activeWeightDays = Array.from({ length: 7 }, (_, index) => {
    const dayKey = shiftLocalDay(accounting, -(6 - index));
    return recordsOnDay(counted, dayKey).length > 0 ? 1 : 0;
  }).reduce<number>((sum, val) => sum + val, 0);

  const trainingVolumeKg = trainingToday.reduce(
    (sum, item) => sum + (item.weightKg ?? 0) * item.reps,
    0,
  );
  const studyMinutesToday = studyToday.reduce((sum, item) => sum + item.durationMinutes, 0);

  const hostMode =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? detectRuntimeHostMode({
          hasHostGlobal: Boolean(
            (window as unknown as { __charioteerHost?: unknown }).__charioteerHost,
          ),
          search: window.location?.search ?? '',
        })
      : 'standalone';

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

  const hudSummary = `${last ? `${formatKg(last.weightKg)} kg · ` : ''}${loggedCount}/3 已记`;

  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader
          kicker="今日"
          title={`${formatMonthDay(accounting)} ${shortWeekday(accounting)}`}
          trailing={
            layout === 'compact' ? (
              <BrandMark />
            ) : (
              <CockpitHeaderBar
                mode={hostMode}
                hudText={hudSummary}
                onOpenRecord={() => openRecordSheet(last?.weightKg)}
                onOpenPalette={() => openDesktopBridge('palette')}
                onOpenScope={() => openDesktopBridge('scope')}
              />
            )
          }
          subtitle={{
            failed: refreshError || training.refreshError || study.refreshError,
            refreshing: refreshing || training.refreshing || study.refreshing,
            hint: beforeSwitch ? nightLine(daySwitch) : null,
            description: allLogged ? '今天都记完了' : null,
            timeZone,
            onRetry: () => {
              void reload();
              void training.reload();
              void study.reload();
            },
          }}
        />

        <Stack gap="md">
          <AverageBlock
            records={counted}
            endDay={accounting}
            ready={ready}
            failed={loadError !== null}
            showSkeleton={weightGate.showSkeleton}
            timedOut={weightGate.timedOut}
          />
          <RecordEntry />
          <MonthEndNotice timeZone={timeZone} />
          <LoadingRegion
            name="今日"
            loading={!ready}
            error={loadError !== null}
            onRetry={() => {
              setLoadAttempt((current) => current + 1);
              void reload();
            }}
            skeleton={
              <Stack gap="sm">
                <Divider />
                <SkeletonLedger lines={3} />
              </Stack>
            }
          >
            <Stack gap="md">
              <View testID="today-records">
                <Stack gap="sm">
                  <Row justify="between" align="center" gap="sm">
                    <Row gap="sm" align="center">
                      <Text variant="heading">{beforeSwitch ? `${formatMonthDay(accounting)}的记录` : '今天的记录'}</Text>
                      {loggedCount > 0 ? (
                        <TagChip
                          label={allLogged ? '今天都记完了' : `已记 ${loggedCount}/3`}
                          tone={allLogged ? 'exec' : 'owner'}
                        />
                      ) : null}
                    </Row>
                    {last && today.length > 0 ? (
                      <Button
                        label={`再记 ${formatKg(last.weightKg)} kg`}
                        variant="secondary"
                        onPress={() => openRecordSheet(last.weightKg)}
                      />
                    ) : null}
                  </Row>
                  <Divider />
                  {readout.firstRecord ? (
                    <EmptyState
                      title={readout.firstRecord}
                      description="记下体重后，这里会显示近 7 日均重。"
                      action={<Button label="记录" variant="secondary" onPress={() => openRecordSheet()} />}
                    />
                  ) : null}
                  {today.length === 0 && last ? (
                    <EmptyState
                      title="今天还没有记录"
                      description="再记会带上上次的体重，点保存后才会写入。"
                      action={
                        <Button
                          label={`再记 ${formatKg(last.weightKg)} kg`}
                          variant="secondary"
                          onPress={() => openRecordSheet(last.weightKg)}
                        />
                      }
                    />
                  ) : null}
                  {visibleToday.map((record, index) => {
                    const failed = failedIds.has(record.id);
                    return (
                      <Fragment key={record.id}>
                        {index > 0 ? <Divider /> : null}
                        <Stack gap="xs">
                          <Row justify="between" align="center" gap="sm">
                            <Row gap="md" align="center">
                              <Text variant="label">{weighInLabel(index)}</Text>
                              <Text variant="body">
                                {formatKg(record.weightKg)} kg · {formatClock(record.recordedAt, record.tz)}
                              </Text>
                            </Row>
                            {failed ? null : (
                              <Button label="删除" variant="ghost" onPress={() => scheduleDelete(record.id)} />
                            )}
                          </Row>
                          {failed ? (
                            <FailedSaveRow
                              onRetry={() => void retry(record.id)}
                              onDismiss={() => dismiss(record.id)}
                            />
                          ) : null}
                        </Stack>
                      </Fragment>
                    );
                  })}
                </Stack>
              </View>

              {layout === 'expanded' ? (
                <>
                  <WorkbenchConsoleCard
                    mode={hostMode}
                    loggedCount={loggedCount}
                    activeWeightDays={activeWeightDays}
                    trainingSetsCount={trainingToday.length}
                    trainingVolumeKg={trainingVolumeKg}
                    studyMinutes={studyMinutesToday}
                    studyCount={studyToday.length}
                    onQuickWeight={() => openRecordSheet(last?.weightKg, 'weight')}
                    onQuickTraining={() => openRecordSheet(undefined, 'training')}
                    onQuickStudy={() => openRecordSheet(undefined, 'study')}
                    onQuickJournal={() => openRecordSheet(undefined, 'block')}
                    onOpenScope={() => openDesktopBridge('scope')}
                  />
                  <WeeklyRhythmCard
                    endDay={accounting}
                    weightRecords={counted}
                    trainingSets={countedTraining}
                    studyRecords={countedStudy}
                  />
                </>
              ) : null}
            </Stack>
          </LoadingRegion>
        </Stack>

        <CardRow>
          <WeightColumn
            ready={ready}
            failed={loadError !== null}
            showSkeleton={weightGate.showSkeleton}
            timedOut={weightGate.timedOut}
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
                    <FailedSaveRow
                      onRetry={() => void training.retry(set.id)}
                      onDismiss={() => training.dismiss(set.id)}
                    />
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
                    <FailedSaveRow
                      onRetry={() => void study.retry(record.id)}
                      onDismiss={() => study.dismiss(record.id)}
                    />
                  ) : null}
                </SetRow>
              );
            })
          : null}
      </Content>
    </Screen>
  );
}

function FailedSaveRow({
  onRetry,
  onDismiss,
}: {
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <Row gap="xs" align="center" wrap>
      <Text variant="muted" tone="danger">
        未保存 ·
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="重试"
        onPress={onRetry}
        style={{
          minHeight: theme.layout.control,
          minWidth: theme.layout.control,
          justifyContent: 'center',
        }}
      >
        <Text variant="muted" tone="accent">
          重试
        </Text>
      </Pressable>
      <Button label="放弃" variant="ghost" onPress={onDismiss} />
    </Row>
  );
}

function RhythmMarker({
  recorded,
  kind = 'ink',
}: {
  recorded: boolean;
  kind?: 'weight' | 'training' | 'study' | 'ink';
}) {
  const { color } = useTheme();
  const fill =
    kind === 'weight'
      ? color.accent
      : kind === 'training'
        ? color.green
        : color.ink;
  return (
    <View
      style={{
        width: theme.layout.dotLast,
        height: theme.layout.dotLast,
        borderRadius: theme.radius.pill,
        backgroundColor: recorded ? fill : 'transparent',
        borderWidth: recorded ? 0 : theme.border.width,
        borderColor: color.line,
      }}
    />
  );
}

function WeeklyRhythmCard({
  endDay,
  weightRecords,
  trainingSets,
  studyRecords,
}: {
  endDay: string;
  weightRecords: readonly WeightRecord[];
  trainingSets: readonly TrainingSet[];
  studyRecords: readonly StudyRecord[];
}) {
  const { color } = useTheme();
  const [selectedDay, setSelectedDay] = useState<string>(endDay);

  const days = Array.from({ length: 7 }, (_, index) => {
    const dayKey = shiftLocalDay(endDay, -(6 - index));
    const dayWeights = recordsOnDay(weightRecords, dayKey);
    const dayTraining = trainingSetsOnDay(trainingSets, dayKey);
    const dayStudy = studyRecordsOnDay(studyRecords, dayKey);
    const studyMinutes = dayStudy.reduce((sum, item) => sum + item.durationMinutes, 0);
    return {
      dayKey,
      hasWeight: dayWeights.length > 0,
      trainingCount: dayTraining.length,
      studyCount: dayStudy.length,
      studyMinutes,
    };
  });

  const activeIdx = Math.max(
    0,
    days.findIndex((item) => item.dayKey === selectedDay),
  );
  const activeDay = days[activeIdx] ?? days[days.length - 1];
  const activeWeightDays = days.filter((item) => item.hasWeight).length;
  const totalSets = days.reduce((sum, item) => sum + item.trainingCount, 0);
  const totalStudyMin = days.reduce((sum, item) => sum + item.studyMinutes, 0);

  const rows: {
    key: 'weight' | 'training' | 'study';
    label: string;
    isRecorded: (day: (typeof days)[number]) => boolean;
  }[] = [
    { key: 'weight', label: '晨重', isRecorded: (day) => day.hasWeight },
    { key: 'training', label: '训练', isRecorded: (day) => day.trainingCount > 0 },
    { key: 'study', label: '学习', isRecorded: (day) => day.studyCount > 0 },
  ];

  return (
    <View testID="today-weekly-rhythm">
      <Card>
        <Row justify="between" align="center" gap="sm" wrap>
          <Row gap="sm" align="center" wrap>
            <Text variant="heading">近 7 天</Text>
            <TagChip
              label={`晨重 ${activeWeightDays}/7 · 训练 ${totalSets} 组 · 学习 ${totalStudyMin} min`}
              tone="pod"
            />
          </Row>
          <Row gap="xs" align="center">
            <CockpitPillButton
              label="◀"
              accessibilityLabel="检视前一天"
              onPress={() => {
                const prev = days[Math.max(0, activeIdx - 1)];
                if (prev) setSelectedDay(prev.dayKey);
              }}
            />
            <CockpitPillButton
              label="▶"
              accessibilityLabel="检视后一天"
              onPress={() => {
                const next = days[Math.min(days.length - 1, activeIdx + 1)];
                if (next) setSelectedDay(next.dayKey);
              }}
            />
            <CockpitPillButton
              label="Latest"
              accessibilityLabel="跳回今日"
              onPress={() => setSelectedDay(endDay)}
            />
          </Row>
        </Row>
        <Divider />
        <View
          style={{
            padding: theme.space.sm,
            borderRadius: theme.radius.sm,
            borderWidth: theme.border.width,
            borderColor: color.lineSoft,
            backgroundColor: color.surface,
          }}
        >
          <Stack gap="xs">
            <Row justify="between" align="center" gap="xs">
              <View style={{ width: theme.layout.timeColumn }} />
              {days.map((item) => {
                const isToday = item.dayKey === endDay;
                const isSelected = activeDay?.dayKey === item.dayKey;
                return (
                  <Pressable
                    key={item.dayKey}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatMonthDay(item.dayKey)} ${shortWeekday(item.dayKey)}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedDay(item.dayKey)}
                    style={{
                      flex: 1,
                      minWidth: theme.layout.control,
                      minHeight: theme.layout.control,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: theme.radius.sm,
                      backgroundColor: isSelected ? color.accentSoft : 'transparent',
                    }}
                  >
                    <Text variant="caption">{shortWeekday(item.dayKey)}</Text>
                    <Text variant="label" tone={isToday ? 'ink' : 'muted'}>
                      {isToday ? '今日' : item.dayKey.slice(8)}
                    </Text>
                  </Pressable>
                );
              })}
            </Row>
            {rows.map((row) => (
              <Fragment key={row.key}>
                <Divider />
                <Row justify="between" align="center" gap="xs">
                  <View style={{ width: theme.layout.timeColumn, justifyContent: 'center' }}>
                    <Text variant="caption">{row.label}</Text>
                  </View>
                  {days.map((item) => {
                    const recorded = row.isRecorded(item);
                    const isSelected = activeDay?.dayKey === item.dayKey;
                    return (
                      <Pressable
                        key={`${row.key}-${item.dayKey}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${formatMonthDay(item.dayKey)} ${row.label} ${recorded ? '已记' : '未记'}`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setSelectedDay(item.dayKey)}
                        style={{
                          flex: 1,
                          minWidth: theme.layout.control,
                          minHeight: theme.layout.control,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: theme.radius.sm,
                          backgroundColor: isSelected ? color.accentSoft : 'transparent',
                        }}
                      >
                        <RhythmMarker recorded={recorded} kind={row.key} />
                      </Pressable>
                    );
                  })}
                </Row>
              </Fragment>
            ))}
          </Stack>
        </View>
        {activeDay ? (
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
              <Row gap="xs" align="center">
                <TagChip
                  label={`${formatMonthDay(activeDay.dayKey)} ${shortWeekday(activeDay.dayKey)}`}
                  tone="owner"
                />
                <Text variant="caption">实时槽位检视</Text>
              </Row>
              <Text variant="caption">
                {`晨重 ${activeDay.hasWeight ? '已记' : '未记'} · 训练 ${activeDay.trainingCount} 组 · 学习 ${activeDay.studyMinutes > 0 ? `${activeDay.studyMinutes} 分钟` : activeDay.studyCount > 0 ? `${activeDay.studyCount} 项` : '0 分钟'}`}
              </Text>
            </Row>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function RecordEntry() {
  return <Button label="记录" fill onPress={() => openRecordSheet()} />;
}

/**
 * Title, display line, and detail line on every phase, so the record button
 * under this card does not move. The wait phase keeps the skeleton's space
 * without painting it. 「数据不足」 uses heading type inside the display line.
 */
function AverageBlock({
  records,
  endDay,
  ready,
  failed,
  showSkeleton,
  timedOut,
}: {
  records: Parameters<typeof averageCaption>[0];
  endDay: string;
  ready: boolean;
  failed: boolean;
  showSkeleton: boolean;
  timedOut: boolean;
}) {
  const phase = weightColumnPhase({ ready, failed, showSkeleton, timedOut });
  const caption = averageCaption(records, endDay);
  const insufficient = caption.headline === '数据不足';
  const value =
    phase === 'content' ? (
      <Text variant={insufficient ? 'heading' : 'display'}>{caption.headline}</Text>
    ) : phase === 'skeleton' ? (
      <SkeletonDisplay />
    ) : phase === 'dash' ? (
      <Text variant="muted">—</Text>
    ) : null;
  const detail =
    phase === 'content' ? (
      <Text variant="muted" style={{ lineHeight: theme.lineHeight.sm }}>{caption.detail}</Text>
    ) : phase === 'skeleton' ? (
      <SkeletonText lines={1} variant="muted" />
    ) : null;
  return (
    <Card>
      <View style={{ minHeight: averageBlockBodyHeight(), gap: theme.space.sm }}>
        <LineBox height={theme.lineHeight.sm}>
          <Text variant="muted" style={{ lineHeight: theme.lineHeight.sm }}>7 日均重</Text>
        </LineBox>
        <LineBox height={theme.lineHeight.display - 2} hidden={phase === 'wait' || phase === 'skeleton'}>
          {value}
        </LineBox>
        <LineBox height={theme.lineHeight.sm} hidden={phase !== 'content'}>
          {detail}
        </LineBox>
      </View>
    </Card>
  );
}

/** Title line, display line, and detail line, plus the two gaps between them. */
function averageBlockBodyHeight(): number {
  return theme.lineHeight.sm + theme.space.sm + (theme.lineHeight.display - 2) + theme.space.sm + theme.lineHeight.sm;
}

function LineBox({
  height,
  hidden = false,
  children,
}: {
  height: number;
  hidden?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={{ height, justifyContent: 'center' }} {...(hidden ? skeletonHiddenProps : undefined)}>
      {children}
    </View>
  );
}

function WeightColumn({
  ready,
  failed,
  showSkeleton,
  timedOut,
  recorded,
  summary,
  hint,
}: {
  ready: boolean;
  failed: boolean;
  showSkeleton: boolean;
  timedOut: boolean;
  recorded: boolean;
  summary: string;
  hint?: string;
}) {
  const phase = weightColumnPhase({ ready, failed, showSkeleton, timedOut });
  return (
    <View testID="today-weight-column">
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
    </View>
  );
}
