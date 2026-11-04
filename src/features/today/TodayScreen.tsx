import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { detectRuntimeHostMode } from '@/core/charioteer-plugin';
import { useI18n } from '@/ui/use-i18n';
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
  type SpatialModuleFilter,
  TagChip,
  WorkbenchConsoleCard,
} from '@/ui/WorkbenchConsole';
import { CharioteerMobileCockpit } from '@/ui/CharioteerMobileCockpit';
import { LifeMilestonesOkrHub } from '@/ui/LifeMilestonesOkrHub';
import { LifeSynergyPlaygroundHub } from '@/ui/LifeSynergyPlaygroundHub';
import { TimeBlockMasteryHub } from '@/ui/TimeBlockMasteryHub';
import { WearableSyncHub } from '@/ui/WearableSyncHub';
import { computeMonthlyBookkeepingSummary } from '@/core/bookkeeping';
import { readBookkeepingState } from '@/data/bookkeeping';

function shortWeekday(localDay: string): string {
  return weekdayLabel(localDay).replace('星期', '周');
}

function nightLine(daySwitch: string, t: (zh: string, en: string) => string): string {
  const { hour } = parseDaySwitch(daySwitch);
  return t(`凌晨 ${hour} 点前的记录算作前一天`, `Entries before 0${hour}:00 count toward yesterday`);
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
    saveWeight,
  } = useWeight();
  const training = useTraining();
  const study = useStudy();
  const inset = useShellInset();
  const layout = useLayoutClass();
  const { color, scheme, toggleTheme } = useTheme();
  const { locale, toggleLocale, t } = useI18n();
  const [now, setNow] = useState(() => new Date());
  const [trainingDetail, setTrainingDetail] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [showClassicLedger, setShowClassicLedger] = useState(() => Platform.OS !== 'web');
  const [forceMobileCockpit, setForceMobileCockpit] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [activeModuleFilter, setActiveModuleFilter] = useState<SpatialModuleFilter>('all');
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
  const trainingTitle = beforeSwitch
    ? t(`${formatMonthDay(accounting)}的训练`, `${formatMonthDay(accounting)} Workout`)
    : t('今天的训练', "Today's Workout");
  const studyTitle = beforeSwitch
    ? t(`${formatMonthDay(accounting)}的学习`, `${formatMonthDay(accounting)} Study`)
    : t('今天的学习', "Today's Study");
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

  const hudSummary = `${last ? `${formatKg(last.weightKg)} kg · ` : ''}${t(`${loggedCount}/3 已记`, `${loggedCount}/3 Logged`)}`;



  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader
          kicker={t('今日', 'Today')}
          title={`${formatMonthDay(accounting)} ${shortWeekday(accounting)}`}
          trailing={
            layout === 'compact' ? (
              <Row gap="xs" align="center">
                <CockpitPillButton
                  label={scheme === 'dark' ? '✦' : '☀'}
                  accessibilityLabel={t('切换主题', 'Toggle theme')}
                  onPress={toggleTheme}
                />
                <CockpitPillButton
                  label={locale === 'zh' ? 'EN' : '中'}
                  accessibilityLabel={t('切换语言', 'Switch language')}
                  onPress={toggleLocale}
                />
                <BrandMark />
              </Row>
            ) : (
              <Row gap="xs" align="center" wrap>
                <CockpitPillButton
                  label={forceMobileCockpit ? t('🖥 桌面舱', '🖥 Desktop') : t('📱 移动舱', '📱 Mobile')}
                  active={forceMobileCockpit}
                  accessibilityLabel={t('切换移动端 Charioteer 驾驶舱预览', 'Toggle Charioteer mobile cockpit preview')}
                  onPress={() => setForceMobileCockpit((prev) => !prev)}
                />
                <CockpitHeaderBar
                  mode={hostMode}
                  hudText={hudSummary}
                  onOpenRecord={() => openRecordSheet(last?.weightKg)}
                  onOpenPalette={() => openDesktopBridge('palette')}
                  onOpenScope={() => openDesktopBridge('scope')}
                />
              </Row>
            )
          }
          subtitle={{
            failed: refreshError || training.refreshError || study.refreshError,
            refreshing: refreshing || training.refreshing || study.refreshing,
            hint: beforeSwitch ? nightLine(daySwitch, t) : null,
            description: allLogged ? t('今天都记完了', 'All 3 daily core logs completed') : null,
            timeZone,
            onRetry: () => {
              void reload();
              void training.reload();
              void study.reload();
            },
          }}
        />

        <Stack gap="md">
          {/* Front & Center Interactive Sanctuary on Wide Desktop; Charioteer Mobile Cockpit on Compact/Mobile */}
          {layout !== 'compact' && !forceMobileCockpit ? (
            <WorkbenchConsoleCard
              mode={hostMode}
              localDay={accounting}
              latestWeightKg={last?.weightKg ?? null}
              loggedCount={loggedCount}
              activeWeightDays={activeWeightDays}
              trainingSetsCount={trainingToday.length}
              trainingVolumeKg={trainingVolumeKg}
              studyMinutes={studyMinutesToday}
              studyCount={studyToday.length}
              activeModuleFilter={activeModuleFilter}
              onSelectModuleFilter={setActiveModuleFilter}
              onQuickWeight={() => openRecordSheet(last?.weightKg, 'weight')}
              onQuickTraining={() => openRecordSheet(undefined, 'training')}
              onQuickStudy={() => openRecordSheet(undefined, 'study')}
              onQuickJournal={() => openRecordSheet(undefined, 'block')}
              onOpenScope={() => openDesktopBridge('scope')}
              onInstantSaveWeight={(kg) => void saveWeight(kg)}
              onInstantSaveStudy={(input) =>
                study.saveRecord({
                  topic: input.subject,
                  durationMinutes: input.durationMinutes,
                  note: input.note,
                })
              }
              onInstantSaveWorkout={(input) =>
                void training.saveSet({
                  exercise: input.exercise,
                  reps: input.reps,
                  weightKg: input.weightKg,
                  bandLevel: null,
                })
              }
            />
          ) : (
            <CharioteerMobileCockpit
              localDay={accounting}
              latestWeightKg={last?.weightKg ?? null}
              hasWeightToday={visibleToday.length > 0}
              trainingSetsCount={trainingToday.length}
              trainingVolumeKg={trainingVolumeKg}
              studyMinutesToday={studyMinutesToday}
              monthlyExpenseCny={
                computeMonthlyBookkeepingSummary(readBookkeepingState(), accounting, 'pool')
                  .totalExpenseCny
              }
              monthlyBudgetCny={
                computeMonthlyBookkeepingSummary(readBookkeepingState(), accounting, 'pool')
                  .monthlyBudgetCny
              }
              onSaveWeight={(kg) => void saveWeight(kg)}
              onSaveWorkout={(input) => {
                for (let i = 0; i < input.setsCount; i += 1) {
                  void training.saveSet({
                    exercise: input.exercise,
                    reps: input.reps,
                    weightKg: input.weightKg,
                    bandLevel: null,
                  });
                }
              }}
              onSaveStudy={(input) => void study.saveRecord(input)}
              onOpenSheet={(kind) => openRecordSheet(last?.weightKg, kind)}
            />
          )}

          <MonthEndNotice timeZone={timeZone} />

          {/* Collapsible Classic Ledger Drawer Toggle so First Screen has Zero Duplicate Tables */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: theme.space.xs,
              paddingHorizontal: theme.space.sm,
              paddingVertical: theme.space.xs,
              borderRadius: theme.radius.sm,
              borderWidth: theme.border.width,
              borderColor: color.lineSoft,
              backgroundColor: color.surface,
            }}
          >
            <Row gap="sm" align="center" wrap>
              <Text variant="caption" style={{ fontWeight: theme.fontWeight.semibold }}>
                {t('传统明细账本（7日均重 · 今日记录 · 周节律）', 'Classic Ledger (7D EMA · Logs · Weekly Rhythm)')}
              </Text>
              <TagChip
                label={
                  last
                    ? `${formatKg(last.weightKg)} kg · ${t(`已记 ${loggedCount}/3`, `${loggedCount}/3 logged`)}`
                    : t(`已记 ${loggedCount}/3`, `${loggedCount}/3 logged`)
                }
                tone={allLogged ? 'exec' : 'pod'}
              />
            </Row>
            <Row gap="xs" align="center">
              <CockpitPillButton
                label={t('＋ 记一笔', '＋ Quick Log')}
                shortcut="⌘K"
                accessibilityLabel="打开快速记录面板"
                onPress={() => openRecordSheet(last?.weightKg)}
              />
              <CockpitPillButton
                label={showClassicLedger ? t('收起明细 ▲', 'Hide Ledger ▲') : t('展开明细 ▼', 'Show Ledger ▼')}
                active={showClassicLedger}
                accessibilityLabel={t('展开或收起传统明细账本', 'Toggle classic ledger details')}
                onPress={() => setShowClassicLedger((prev) => !prev)}
              />
            </Row>
          </View>

          {showClassicLedger ? (
            <Stack gap="md">
              {/* 2. Sleek 7-Day Average & Today's Records Cockpit Card */}
              <AverageBlock
                records={counted}
                endDay={accounting}
                ready={ready}
                failed={loadError !== null}
                showSkeleton={weightGate.showSkeleton}
                timedOut={weightGate.timedOut}
                lastWeightKg={last?.weightKg}
              />

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
                  <Card>
                    <Stack gap="xs">
                      <Row justify="between" align="center" gap="sm" wrap>
                        <Row gap="sm" align="center" wrap>
                          <Text variant="label" style={{ fontWeight: theme.fontWeight.semibold }}>
                            {beforeSwitch
                              ? t(`${formatMonthDay(accounting)}的记录`, `${formatMonthDay(accounting)} Records`)
                              : t('今天的记录', "Today's Records")}
                          </Text>
                          {loggedCount > 0 ? (
                            <TagChip
                              label={
                                allLogged
                                  ? t('今天都记完了', 'All Logged')
                                  : t(`已记 ${loggedCount}/3`, `Logged ${loggedCount}/3`)
                              }
                              tone={allLogged ? 'exec' : 'owner'}
                            />
                          ) : null}
                        </Row>

                        <Row gap="xs" align="center" wrap>
                          <CockpitPillButton
                            label={t('＋ 记一笔', '＋ Quick Log')}
                            shortcut="⌘K"
                            active
                            accessibilityLabel="打开快速记录面板"
                            onPress={() => openRecordSheet()}
                          />
                          {last && today.length > 0 ? (
                            <CockpitPillButton
                              label={t(`↻ 再记 ${formatKg(last.weightKg)} kg`, `↻ Log ${formatKg(last.weightKg)} kg`)}
                              accessibilityLabel={`再记 ${formatKg(last.weightKg)} kg`}
                              onPress={() => openRecordSheet(last.weightKg)}
                            />
                          ) : null}
                        </Row>
                      </Row>

                      <Divider />

                      {readout.firstRecord ? (
                        <EmptyState
                          title={readout.firstRecord}
                          description={t(
                            '记下体重后，这里会显示近 7 日均重。',
                            'Log your weight to see your 7-day rolling EMA average.',
                          )}
                          action={
                            <CockpitPillButton
                              label={t('＋ 记录首笔', '＋ Log First Entry')}
                              active
                              onPress={() => openRecordSheet()}
                            />
                          }
                        />
                      ) : null}

                      {today.length === 0 && last ? (
                        <EmptyState
                          title={t('今天还没有记录', 'No entries yet today')}
                          description={t(
                            '再记会带上上次的体重，点保存后才会写入。',
                            'Pre-fills your last weight and saves on confirmation.',
                          )}
                          action={
                            <CockpitPillButton
                              label={t(`↻ 再记 ${formatKg(last.weightKg)} kg`, `↻ Log ${formatKg(last.weightKg)} kg`)}
                              active
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
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  paddingVertical: theme.space.xs,
                                  paddingHorizontal: theme.space.sm,
                                  borderRadius: theme.radius.sm,
                                  backgroundColor: color.surface,
                                }}
                              >
                                <Row gap="md" align="center">
                                  <TagChip
                                    label={weighInLabel(index)}
                                    tone={index === 0 ? 'owner' : 'pod'}
                                  />
                                  <Text
                                    variant="body"
                                    style={{
                                      fontFamily: theme.fontFamily.mono,
                                      fontWeight: theme.fontWeight.semibold,
                                    }}
                                  >
                                    {formatKg(record.weightKg)} kg
                                  </Text>
                                  <Text
                                    variant="caption"
                                    tone="muted"
                                    style={{ fontFamily: theme.fontFamily.mono }}
                                  >
                                    {formatClock(record.recordedAt, record.tz)}
                                  </Text>
                                </Row>
                                {failed ? null : (
                                  <CockpitPillButton
                                    label={t('× 删除', '× Delete')}
                                    accessibilityLabel="删除该条体重记录"
                                    onPress={() => scheduleDelete(record.id)}
                                  />
                                )}
                              </View>
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
                  </Card>
                </View>

                {layout === 'expanded' || Platform.OS === 'web' ? (
                  <WeeklyRhythmCard
                    endDay={accounting}
                    weightRecords={counted}
                    trainingSets={countedTraining}
                    studyRecords={countedStudy}
                  />
                ) : null}
              </Stack>
            </LoadingRegion>

            <CardRow>
              <WeightColumn
                ready={ready}
                failed={loadError !== null}
                showSkeleton={weightGate.showSkeleton}
                timedOut={weightGate.timedOut}
                recorded={visibleToday.length > 0}
                summary={visibleToday[0] ? `${formatKg(visibleToday[0].weightKg)} kg` : t('未记录', 'Not logged')}
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
                    <StatusCard
                      summary={t('未记录', 'Not logged')}
                      actionLabel={t('记一笔', 'Log')}
                      onAction={() => openRecordSheet(undefined, 'training')}
                    />
                  ) : (
                    <StatusCard
                      summary={trainingDaySummary(trainingToday)}
                      hint={trainingDetail ? t('收起', 'Hide') : t('查看每组', 'View sets')}
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
                    <StatusCard
                      summary={t('未记录', 'Not logged')}
                      actionLabel={t('记一笔', 'Log')}
                      onAction={() => openRecordSheet(undefined, 'study')}
                    />
                  ) : (
                    <StatusCard
                      summary={studyDaySummary(studyToday)}
                      hint={studyOpen ? t('收起', 'Hide') : t('查看记录', 'View logs')}
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
            </Stack>
          ) : null}
        </Stack>

        {activeModuleFilter === 'focus' ? (
          <TimeBlockMasteryHub
            localDay={accounting}
            onSyncStudyRecord={(input) => study.saveRecord(input)}
            onSyncTrainingSet={(input) => training.saveSet(input)}
          />
        ) : null}

        {activeModuleFilter === 'vitality' ? (
          <WearableSyncHub
            latestWeightKg={last?.weightKg}
            localDay={accounting}
            onSyncWorkoutSet={(input) => training.saveSet(input)}
            onSyncWeightKg={(kg) => saveWeight(kg)}
          />
        ) : null}

        {activeModuleFilter === 'wishes' ? (
          <Stack gap="md">
            <LifeMilestonesOkrHub
              localDay={accounting}
              latestWeightKg={last?.weightKg ?? null}
              totalWorkoutSets={countedTraining.length}
              totalStudyHours={
                countedStudy.reduce((sum, item) => sum + item.durationMinutes, 0) / 60
              }
            />
            <LifeSynergyPlaygroundHub
              localDay={accounting}
              weightRecords={counted}
              trainingSets={countedTraining}
              studyRecords={countedStudy}
            />
          </Stack>
        ) : null}
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
  const { t } = useI18n();
  return (
    <Row gap="xs" align="center" wrap>
      <Text variant="muted" tone="danger">
        {t('未保存 ·', 'Unsaved ·')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="重试"
        onPress={onRetry}
        style={{
          minHeight: theme.layout.controlMini,
          paddingHorizontal: theme.space.sm,
          justifyContent: 'center',
        }}
      >
        <Text variant="muted" tone="accent">
          {t('重试', 'Retry')}
        </Text>
      </Pressable>
      <Button label={t('放弃', 'Dismiss')} variant="ghost" onPress={onDismiss} />
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
  const { t } = useI18n();
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
    { key: 'weight', label: t('晨重', 'Weight'), isRecorded: (day) => day.hasWeight },
    { key: 'training', label: t('训练', 'Workout'), isRecorded: (day) => day.trainingCount > 0 },
    { key: 'study', label: t('学习', 'Study'), isRecorded: (day) => day.studyCount > 0 },
  ];

  return (
    <View testID="today-weekly-rhythm">
      <Card>
        <Row justify="between" align="center" gap="sm" wrap>
          <Row gap="sm" align="center" wrap>
            <Text variant="heading">{t('近 7 天', 'Last 7 Days')}</Text>
            <TagChip
              label={t(
                `晨重 ${activeWeightDays}/7 · 训练 ${totalSets} 组 · 学习 ${totalStudyMin} min`,
                `Weight ${activeWeightDays}/7 · Workout ${totalSets} sets · Study ${totalStudyMin} min`,
              )}
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
                      {isToday ? t('今日', 'Today') : item.dayKey.slice(8)}
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
                <Text variant="caption">{t('实时槽位检视', 'Slot Inspector')}</Text>
              </Row>
              <Text variant="caption">
                {t(
                  `晨重 ${activeDay.hasWeight ? '已记' : '未记'} · 训练 ${activeDay.trainingCount} 组 · 学习 ${activeDay.studyMinutes > 0 ? `${activeDay.studyMinutes} 分钟` : activeDay.studyCount > 0 ? `${activeDay.studyCount} 项` : '0 分钟'}`,
                  `Weight ${activeDay.hasWeight ? 'Logged' : 'None'} · Workout ${activeDay.trainingCount} sets · Study ${activeDay.studyMinutes > 0 ? `${activeDay.studyMinutes}m` : activeDay.studyCount > 0 ? `${activeDay.studyCount} items` : '0m'}`,
                )}
              </Text>
            </Row>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

/**
 * Compact 7-day rolling weight card with inline Charioteer-style capsule actions.
 */
function AverageBlock({
  records,
  endDay,
  ready,
  failed,
  showSkeleton,
  timedOut,
  lastWeightKg,
}: {
  records: Parameters<typeof averageCaption>[0];
  endDay: string;
  ready: boolean;
  failed: boolean;
  showSkeleton: boolean;
  timedOut: boolean;
  lastWeightKg?: number;
}) {
  const { t } = useI18n();
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
      <Row justify="between" align="center" gap="md" wrap>
        <View style={{ minHeight: averageBlockBodyHeight(), gap: theme.space.xs, flex: 1 }}>
          <LineBox height={theme.lineHeight.sm}>
            <Row gap="xs" align="center">
              <Text variant="muted" style={{ lineHeight: theme.lineHeight.sm }}>
                {t('7 日均重', '7-Day Average')}
              </Text>
              <TagChip label={t('EMA 滚动均值', 'Rolling EMA')} tone="owner" />
            </Row>
          </LineBox>
          <LineBox height={theme.lineHeight.display - 2} hidden={phase === 'wait' || phase === 'skeleton'}>
            {value}
          </LineBox>
          <LineBox height={theme.lineHeight.sm} hidden={phase !== 'content'}>
            {detail}
          </LineBox>
        </View>

        <Row gap="xs" align="center" wrap>
          <CockpitPillButton
            label={t('⚖ 记录晨重', '⚖ Log Weight')}
            shortcut="⌘K"
            active
            accessibilityLabel="记录晨重"
            onPress={() => openRecordSheet(lastWeightKg, 'weight')}
          />
          <CockpitPillButton
            label={t('🏋️ 训练', '🏋️ Workout')}
            shortcut="⇧⌘T"
            accessibilityLabel="记录训练"
            onPress={() => openRecordSheet(undefined, 'training')}
          />
          <CockpitPillButton
            label={t('📚 学习', '📚 Study')}
            shortcut="⇧⌘L"
            accessibilityLabel="记录学习"
            onPress={() => openRecordSheet(undefined, 'study')}
          />
        </Row>
      </Row>
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
  const { t } = useI18n();
  const phase = weightColumnPhase({ ready, failed, showSkeleton, timedOut });
  return (
    <View testID="today-weight-column">
      <Stack gap="sm">
        <Text variant="heading">{t('体重', 'Weight')}</Text>
        <View style={{ position: 'relative' }}>
          <View {...(phase === 'content' ? undefined : skeletonHiddenProps)}>
            <StatusCard
              summary={summary}
              hint={hint}
              actionLabel={recorded ? undefined : t('记一笔', 'Log')}
              onAction={recorded ? undefined : () => openRecordSheet()}
            />
          </View>
          {phase === 'wait' || phase === 'skeleton' ? (
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
              <Card>
                {phase === 'skeleton' ? (
                  <SkeletonText lines={2} />
                ) : (
                  <View style={{ height: theme.lineHeight.md * 2 + theme.space.xs }} {...skeletonHiddenProps} />
                )}
              </Card>
            </View>
          ) : null}
          {phase === 'dash' ? (
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
              <Card>
                <Text variant="muted">—</Text>
              </Card>
            </View>
          ) : null}
        </View>
      </Stack>
    </View>
  );
}
