import { useEffect, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import {
  type ActiveTimerSession,
  build24HourMatrix,
  build60MinuteLoupeCells,
  computeMasteryProgress,
  computeMinuteFromPointerRatio,
  formatMinuteOfDay,
  formatTimerClock,
  type MasteryGoal,
  normalizeDragMinuteRange,
  nudgeMinuteRange,
  parseClockToMinute,
  type SnapGranularity,
  TIME_BLOCK_CATEGORIES,
  type TimeBlockCategory,
  type TimeBlockItem,
} from '@/core/time-block-tracker';
import {
  computeDailyTimeValueLedger,
  computeFocusSessionValue,
} from '@/core/time-pricing';
import {
  addMasteryGoal,
  addTimeBlock,
  readActiveTimer,
  readMasteryGoals,
  readTimeBlocks,
  removeMasteryGoal,
  removeTimeBlock,
  writeActiveTimer,
} from '@/data/time-block-tracker';
import {
  readEffectiveTimePricing,
  subscribeTimePricingStore,
  writeTimePricingConfig,
} from '@/data/time-pricing';

import { useI18n } from './use-i18n';

import { Button } from './Button';
import { Card, cardSurfaceStyle } from './Card';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { Divider, Row, Stack } from './layout';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';
import { TextField } from './TextField';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { CockpitPillButton, TagChip } from './WorkbenchConsole';

const QUICK_SPAN_PRESETS = [15, 25, 45, 60, 90, 120] as const;

export function TimeBlockMasteryHub({
  localDay,
  onSyncStudyRecord,
  onSyncTrainingSet,
  onSyncTimelineBlock,
}: {
  localDay: string;
  onSyncStudyRecord?: (input: { topic: string; durationMinutes: number; note: string | null }) => void;
  onSyncTrainingSet?: (input: {
    exercise: string;
    reps: number;
    weightKg: number | null;
    bandLevel: string | null;
  }) => Promise<unknown>;
  onSyncTimelineBlock?: (body: string) => Promise<unknown>;
}) {
  const { color, scheme } = useTheme();
  const { t } = useI18n();
  const isDark = scheme === 'dark';
  const [blocks, setBlocks] = useState<TimeBlockItem[]>(readTimeBlocks);
  const [goals, setGoals] = useState<MasteryGoal[]>(readMasteryGoals);
  const [timer, setTimer] = useState<ActiveTimerSession>(readActiveTimer);
  const [timePricing, setTimePricing] = useState(() => readEffectiveTimePricing());

  useEffect(() => {
    return subscribeTimePricingStore(() => {
      setTimePricing(readEffectiveTimePricing());
    });
  }, []);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedHour, setSelectedHour] = useState<number | null>(9);
  const [compact24h, setCompact24h] = useState(true);

  // 1-Minute Drag & Mobile Touch Selection State
  const [snapGranularity, setSnapGranularity] = useState<SnapGranularity>(1);
  const [selectionRange, setSelectionRange] = useState<{
    startMinute: number;
    endMinute: number;
  }>({
    startMinute: 9 * 60, // 09:00
    endMinute: 9 * 60 + 45, // 09:45
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragAnchorMinuteRef = useRef<number | null>(null);
  const [mobileTapAnchor, setMobileTapAnchor] = useState<number | null>(null);
  const trackWidthsRef = useRef<Record<number, number>>({});

  // Manual / Drag Time Block Form
  const [manualOpen, setManualOpen] = useState(false);
  const [startClock, setStartClock] = useState('09:00');
  const [endClock, setEndClock] = useState('09:45');
  const [manualCategory, setManualCategory] = useState<TimeBlockCategory>('study');
  const [manualTitle, setManualTitle] = useState('');
  const [manualGoalId, setManualGoalId] = useState<string | null>('goal-ai-infra');

  // New 10,000-Hour Goal Form
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState<TimeBlockCategory>('study');
  const [newGoalPriorHours, setNewGoalPriorHours] = useState('0');
  const [newGoalDailyMins, setNewGoalDailyMins] = useState('60');

  useEffect(() => {
    if (!timer.isRunning) return undefined;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [timer.isRunning]);

  // Global mouseup listener on Web so dragging across hour rows releases cleanly anywhere
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onGlobalMouseUp = () => {
      if (dragAnchorMinuteRef.current !== null) {
        dragAnchorMinuteRef.current = null;
        setIsDragging(false);
      }
    };
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => window.removeEventListener('mouseup', onGlobalMouseUp);
  }, []);

  function syncClocksFromRange(startMinute: number, endMinute: number) {
    setSelectionRange({ startMinute, endMinute });
    setStartClock(formatMinuteOfDay(startMinute));
    setEndClock(formatMinuteOfDay(endMinute));
  }

  function resolveMinuteFromResponderEvent(hour: number, evt: GestureResponderEvent): number {
    const locationX = evt.nativeEvent.locationX ?? 0;
    const width = trackWidthsRef.current[hour] || 360;
    const ratio = Math.max(0, Math.min(1, locationX / Math.max(1, width)));
    return computeMinuteFromPointerRatio(hour, ratio, snapGranularity);
  }

  function handleTrackPressIn(hour: number, evt: GestureResponderEvent) {
    const minute = resolveMinuteFromResponderEvent(hour, evt);
    setSelectedHour(hour);
    dragAnchorMinuteRef.current = minute;
    setIsDragging(true);
    const next = normalizeDragMinuteRange(minute, minute + Math.max(1, snapGranularity), 1);
    syncClocksFromRange(next.startMinute, next.endMinute);
  }

  function handleTrackMove(hour: number, evt: GestureResponderEvent) {
    if (dragAnchorMinuteRef.current === null) return;
    const currentMinute = resolveMinuteFromResponderEvent(hour, evt);
    const next = normalizeDragMinuteRange(dragAnchorMinuteRef.current, currentMinute, 1);
    syncClocksFromRange(next.startMinute, next.endMinute);
  }

  function handleTrackRelease() {
    if (dragAnchorMinuteRef.current !== null) {
      dragAnchorMinuteRef.current = null;
      setIsDragging(false);
    }
  }

  function handleLoupeMinutePress(minuteOfDay: number) {
    // Mobile-friendly two-tap or instant range selection on the 60-minute loupe
    if (mobileTapAnchor === null) {
      setMobileTapAnchor(minuteOfDay);
      const next = normalizeDragMinuteRange(minuteOfDay, minuteOfDay + 1, 1);
      syncClocksFromRange(next.startMinute, next.endMinute);
    } else {
      const next = normalizeDragMinuteRange(
        mobileTapAnchor,
        minuteOfDay >= mobileTapAnchor ? minuteOfDay + 1 : minuteOfDay,
        1,
      );
      syncClocksFromRange(next.startMinute, next.endMinute);
      setMobileTapAnchor(null);
    }
  }

  function handleNudge(edge: 'start' | 'end' | 'both', deltaMinutes: number) {
    const next = nudgeMinuteRange(
      selectionRange.startMinute,
      selectionRange.endMinute,
      edge,
      deltaMinutes,
    );
    syncClocksFromRange(next.startMinute, next.endMinute);
    setSelectedHour(Math.min(23, Math.floor(next.startMinute / 60)));
  }

  function handleQuickSpanPreset(spanMins: number) {
    const start = selectionRange.startMinute;
    const end = Math.min(1440, start + spanMins);
    syncClocksFromRange(start, Math.max(start + 1, end));
  }

  const elapsedSeconds =
    timer.isRunning && timer.startedAtMs
      ? timer.accumulatedSeconds + Math.max(0, Math.floor((nowMs - timer.startedAtMs) / 1000))
      : timer.accumulatedSeconds;

  function updateTimerState(next: ActiveTimerSession) {
    setTimer(next);
    writeActiveTimer(next);
  }

  function onStartOrPauseTimer() {
    if (timer.isRunning) {
      updateTimerState({
        ...timer,
        isRunning: false,
        startedAtMs: null,
        accumulatedSeconds: elapsedSeconds,
      });
      showToast({ text: '计时已暂停' });
    } else {
      const now = Date.now();
      setNowMs(now);
      updateTimerState({
        ...timer,
        isRunning: true,
        startedAtMs: now,
      });
      showToast({ text: `开始计时：${timer.title || '专注时间块'}` });
    }
  }

  function onResetTimer() {
    updateTimerState({
      ...timer,
      isRunning: false,
      startedAtMs: null,
      accumulatedSeconds: 0,
    });
  }

  async function onFinishAndCommitTimer() {
    const durationMin = Math.max(1, Math.round(elapsedSeconds / 60));
    const now = new Date();
    const endMinute = now.getHours() * 60 + now.getMinutes();
    const startMinute = Math.max(0, endMinute - durationMin);
    const title = timer.title.trim() || '专注时间块';

    const nextBlocks = addTimeBlock({
      localDay,
      startMinute,
      endMinute: Math.max(startMinute + 1, endMinute),
      category: timer.category,
      title,
      goalId: timer.goalId,
      note: `计时器记录 ${formatTimerClock(elapsedSeconds)}`,
    });
    setBlocks(nextBlocks);

    if (timer.category === 'study' || timer.category === 'deep-work') {
      onSyncStudyRecord?.({
        topic: title,
        durationMinutes: durationMin,
        note: `时间块 ${formatMinuteOfDay(startMinute)}–${formatMinuteOfDay(endMinute)}`,
      });
    } else if (timer.category === 'fitness') {
      await onSyncTrainingSet?.({
        exercise: title,
        reps: durationMin,
        weightKg: null,
        bandLevel: null,
      });
    }

    await onSyncTimelineBlock?.(
      `[${formatMinuteOfDay(startMinute)}–${formatMinuteOfDay(endMinute)}] ${title}（${durationMin} 分钟）`,
    );

    onResetTimer();
    showToast({
      text: `已切入 24H 时间块：${formatMinuteOfDay(startMinute)}–${formatMinuteOfDay(endMinute)} ${title} (${durationMin} min)`,
    });
  }

  async function onQuickCheckInGoal(goal: MasteryGoal) {
    const durationMin = goal.dailyTargetMinutes;
    const now = new Date();
    const endMinute = now.getHours() * 60 + now.getMinutes();
    const startMinute = Math.max(0, endMinute - durationMin);

    const nextBlocks = addTimeBlock({
      localDay,
      startMinute,
      endMinute: Math.max(startMinute + 1, endMinute),
      category: goal.category,
      title: goal.title,
      goalId: goal.id,
      note: '今日目标一键打卡',
    });
    setBlocks(nextBlocks);

    if (goal.category === 'study' || goal.category === 'deep-work') {
      onSyncStudyRecord?.({
        topic: goal.title,
        durationMinutes: durationMin,
        note: `10000h 目标打卡 (${durationMin} min)`,
      });
    } else if (goal.category === 'fitness') {
      await onSyncTrainingSet?.({
        exercise: goal.title,
        reps: durationMin,
        weightKg: null,
        bandLevel: null,
      });
    }

    showToast({
      text: `已完成「${goal.title}」今日打卡 (+${durationMin} 分钟 · 累计进度已更新)`,
    });
  }

  async function onCommitSelectedRange(customStartMin?: number, customEndMin?: number) {
    const startMin = customStartMin ?? parseClockToMinute(startClock) ?? selectionRange.startMinute;
    const endMin = customEndMin ?? parseClockToMinute(endClock) ?? selectionRange.endMinute;
    if (startMin === null || endMin === null || endMin <= startMin) {
      showToast({
        text: '请框选或输入有效的起止分钟（结束时间需晚于开始时间，最小粒度 1 分钟）',
        tone: 'error',
      });
      return;
    }
    const matchedGoal = goals.find((g) => g.id === manualGoalId);
    const title = manualTitle.trim() || matchedGoal?.title || '专注时间块';
    const durationMin = endMin - startMin;

    const nextBlocks = addTimeBlock({
      localDay,
      startMinute: startMin,
      endMinute: endMin,
      category: manualCategory,
      title,
      goalId: manualGoalId,
      note: null,
    });
    setBlocks(nextBlocks);

    if (manualCategory === 'study' || manualCategory === 'deep-work') {
      onSyncStudyRecord?.({
        topic: title,
        durationMinutes: durationMin,
        note: `${formatMinuteOfDay(startMin)}–${formatMinuteOfDay(endMin)}`,
      });
    } else if (manualCategory === 'fitness') {
      await onSyncTrainingSet?.({
        exercise: title,
        reps: durationMin,
        weightKg: null,
        bandLevel: null,
      });
    }

    setManualOpen(false);
    setManualTitle('');
    setMobileTapAnchor(null);
    showToast({
      text: `已切入 1m 级时间块：${formatMinuteOfDay(startMin)}–${formatMinuteOfDay(endMin)} ${title} (${durationMin} min)`,
    });
  }

  function onCreateMasteryGoal() {
    if (!newGoalTitle.trim()) {
      showToast({ text: '请输入 10,000 小时目标名称', tone: 'error' });
      return;
    }
    const prior = Number.parseFloat(newGoalPriorHours) || 0;
    const daily = Number.parseInt(newGoalDailyMins, 10) || 60;
    const next = addMasteryGoal({
      title: newGoalTitle,
      category: newGoalCategory,
      targetHours: 10000,
      priorHours: prior,
      dailyTargetMinutes: daily,
    });
    setGoals(next);
    setNewGoalTitle('');
    setGoalFormOpen(false);
    showToast({ text: `已新增 10,000 小时长期目标：${newGoalTitle.trim()}` });
  }

  function categoryVisual(cat: TimeBlockCategory) {
    if (cat === 'study') return { bg: color.accent, soft: color.accentSoft, label: '学习' };
    if (cat === 'fitness') return { bg: color.green, soft: color.greenSoft, label: '健身' };
    if (cat === 'deep-work') return { bg: color.warning, soft: color.warningSoft, label: '创造' };
    if (cat === 'life') return { bg: color.ink, soft: color.pill, label: '日常' };
    return { bg: color.muted, soft: color.pill, label: '恢复' };
  }

  const todayBlocks = blocks.filter((b) => b.localDay === localDay);
  const totalTrackedMinsToday = todayBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  const liveTimerValue = computeFocusSessionValue(
    elapsedSeconds,
    timer.category,
    timePricing.breakdown,
  );
  const dailyValueLedger = computeDailyTimeValueLedger(
    todayBlocks,
    timePricing.breakdown,
    elapsedSeconds,
    timer.category,
  );
  const hourMatrix = build24HourMatrix(todayBlocks);
  const visibleHourRows = compact24h
    ? hourMatrix.filter((row) => row.hour >= 6 || row.occupiedMinutes > 0)
    : hourMatrix;

  const activeLoupeHour = selectedHour ?? Math.min(23, Math.floor(selectionRange.startMinute / 60));
  const inspectedHourRow = hourMatrix.find((r) => r.hour === activeLoupeHour) ?? null;
  const loupeCells = build60MinuteLoupeCells(activeLoupeHour, todayBlocks, selectionRange);
  const selectedSpanMins = Math.max(1, selectionRange.endMinute - selectionRange.startMinute);

  return (
    <Card>
      <Stack gap="sm">
        {/* Header */}
        <Row justify="between" align="center" gap="sm" wrap>
          <Row gap="sm" align="center" wrap>
            <Text variant="heading">
              {t('24H 1分钟级拖拽时间轴 · 实时计时器 · 10,000 小时定律', '24H 1-Min Drag Timeline · Live Timer · 10,000-Hour Mastery')}
            </Text>
            <TagChip
              label={
                timer.isRunning
                  ? `TRACKING · ${formatTimerClock(elapsedSeconds)}`
                  : t(`今日已追踪 ${totalTrackedMinsToday} / 1440 分钟`, `Tracked ${totalTrackedMinsToday} / 1440m today`)
              }
              tone={timer.isRunning ? 'exec' : 'owner'}
            />
            {timePricing.breakdown.trueNetHourlyCny > 0 ? (
              <TagChip
                label={`⏳ 今日创造价值 +¥${dailyValueLedger.totalValueCreatedCny.toFixed(1)} · 真实时薪 ¥${timePricing.breakdown.trueNetHourlyCny.toFixed(0)}/h`}
                tone="exec"
              />
            ) : null}
          </Row>
          <Row gap="xs" align="center" wrap>
            <CockpitPillButton
              label={t('+ 手动输入起止', '+ Manual Range')}
              accessibilityLabel="手动按起止分钟补录时间块"
              onPress={() => setManualOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label={t('+ 10000h 目标', '+ 10000h Goal')}
              accessibilityLabel="添加新的 10000 小时精进目标"
              onPress={() => setGoalFormOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label={compact24h ? t('展开凌晨 00–05 点', 'Show 00–05h') : t('折叠空闲凌晨', 'Hide Idle Night')}
              accessibilityLabel="切换 24 小时完整视图与日间紧凑视图"
              onPress={() => setCompact24h((prev) => !prev)}
            />
          </Row>
        </Row>

        <Divider />

        {/* 0. Cross-Module 24H Time-Value Ledger Strip (今日时间价值账单) */}
        <View
          style={[
            styles.subPanel,
            { backgroundColor: color.surface, borderColor: color.line },
          ]}
        >
          <Row justify="between" align="center" gap="sm" wrap>
            <Row gap="xs" align="center" wrap>
              <TagChip
                label={
                  timePricing.breakdown.trueNetHourlyCny > 0
                    ? `⏳ 真实净时薪 ¥${timePricing.breakdown.trueNetHourlyCny.toFixed(1)}/h · 深度复利 ¥${timePricing.breakdown.focusCompoundHourlyCny.toFixed(1)}/h`
                    : '⏳ 24H 时间定价账单'
                }
                tone={timePricing.breakdown.trueNetHourlyCny > 0 ? 'exec' : 'pod'}
              />
              <Text variant="caption" tone="muted">
                {dailyValueLedger.headlineZh}
              </Text>
            </Row>
            <Row gap="xs" align="center" wrap>
              <Text variant="caption" tone="muted">
                {t('快速设定税后月薪:', 'Quick Salary:')}
              </Text>
              {[15000, 25000, 40000].map((sal) => (
                <CockpitPillButton
                  key={sal}
                  label={`¥${sal / 1000}k`}
                  active={timePricing.config.monthlyNetIncomeCny === sal}
                  accessibilityLabel={`快速设定税后月薪为 ${sal} 元以启用时间计价`}
                  onPress={() => {
                    writeTimePricingConfig({ monthlyNetIncomeCny: sal });
                    showToast({ text: `已启用时间计价：税后月薪 ¥${sal.toLocaleString()}` });
                  }}
                />
              ))}
            </Row>
          </Row>
        </View>

        {/* 1. Live Focus & Workout Timer Tracker */}
        <View
          style={[
            styles.timerConsole,
            cardSurfaceStyle(color.surface, color.line),
            { borderColor: timer.isRunning ? color.green : color.line },
          ]}
        >
          <Row justify="between" align="center" gap="sm" wrap>
            <View style={styles.timerLeft}>
              <Row gap="xs" align="center" wrap>
                <TagChip
                  label={timer.isRunning ? 'LIVE TIMER · 正在计时' : 'FOCUS & WORKOUT TRACKER'}
                  tone={timer.isRunning ? 'exec' : 'pod'}
                />
                {timePricing.breakdown.trueNetHourlyCny > 0 ? (
                  <TagChip
                    label={`💎 本次专注创造 +¥${liveTimerValue.valueCny.toFixed(2)} (${liveTimerValue.rateLabelZh} ¥${liveTimerValue.appliedHourlyCny.toFixed(0)}/h)`}
                    tone="exec"
                  />
                ) : null}
                <Text variant="caption" tone="muted">
                  计时结束后自动按真实起止分钟切入下方 24 小时时间轴，并同步累加至 10,000 小时目标
                </Text>
              </Row>
              <Text variant="display" style={styles.timerReadout}>
                {formatTimerClock(elapsedSeconds)}
              </Text>
            </View>

            <Row gap="xs" align="center" wrap>
              <Button
                label={timer.isRunning ? '暂停计时' : elapsedSeconds > 0 ? '继续计时' : '开始专注/训练计时'}
                variant="primary"
                onPress={onStartOrPauseTimer}
              />
              {elapsedSeconds > 0 ? (
                <>
                  <Button
                    label="完成并写入时间块"
                    variant="secondary"
                    onPress={() => void onFinishAndCommitTimer()}
                  />
                  <Button label="重置" variant="ghost" onPress={onResetTimer} />
                </>
              ) : null}
            </Row>
          </Row>

          <ChipGroup>
            {TIME_BLOCK_CATEGORIES.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.label}
                selected={timer.category === cat.id}
                onPress={() => updateTimerState({ ...timer, category: cat.id })}
              />
            ))}
          </ChipGroup>

          <Row gap="sm" align="center" wrap>
            <View style={{ flex: 1, minWidth: 220 }}>
              <TextField
                label="当前正在做的事（精确到 1 分钟）"
                value={timer.title}
                onChangeText={(text) => updateTimerState({ ...timer, title: text })}
                placeholder="例如：AI Infra 论文精读 / 哑铃肩推力量训练 / 核心代码重构"
              />
            </View>
            <View style={{ flex: 1, minWidth: 220 }}>
              <Stack gap="xs">
                <Text variant="caption" tone="muted">
                  关联 10,000 小时定律目标（点击快速切换）
                </Text>
                <ChipGroup>
                  {goals.map((g) => (
                    <Chip
                      key={g.id}
                      label={g.title}
                      selected={timer.goalId === g.id}
                      onPress={() =>
                        updateTimerState({
                          ...timer,
                          goalId: g.id,
                          title: g.title,
                          category: g.category,
                        })
                      }
                    />
                  ))}
                </ChipGroup>
              </Stack>
            </View>
          </Row>
        </View>

        {/* Manual Time Block Entry Panel */}
        {manualOpen ? (
          <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="xs">
              <Text variant="label">按起止分钟精确补录时间块（00:00 – 24:00，最小粒度 1 分钟）</Text>
              <Row gap="sm" wrap>
                <View style={{ flex: 1, minWidth: 110 }}>
                  <TextField
                    label="开始时间 (HH:MM)"
                    value={startClock}
                    onChangeText={(val) => {
                      setStartClock(val);
                      const parsed = parseClockToMinute(val);
                      if (parsed !== null && parsed < selectionRange.endMinute) {
                        setSelectionRange((prev) => ({ ...prev, startMinute: parsed }));
                      }
                    }}
                    placeholder="09:07"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 110 }}>
                  <TextField
                    label="结束时间 (HH:MM)"
                    value={endClock}
                    onChangeText={(val) => {
                      setEndClock(val);
                      const parsed = parseClockToMinute(val);
                      if (parsed !== null && parsed > selectionRange.startMinute) {
                        setSelectionRange((prev) => ({ ...prev, endMinute: parsed }));
                      }
                    }}
                    placeholder="09:53"
                  />
                </View>
                <View style={{ flex: 2, minWidth: 200 }}>
                  <TextField
                    label="事项名称"
                    value={manualTitle}
                    onChangeText={setManualTitle}
                    placeholder="例如：深度学习 / 力量训练 / 复盘"
                  />
                </View>
              </Row>
              <Row gap="sm" align="center">
                <Button label="写入 24H 时间轴" onPress={() => void onCommitSelectedRange()} />
                <Button label="取消" variant="ghost" onPress={() => setManualOpen(false)} />
              </Row>
            </Stack>
          </View>
        ) : null}

        {/* New 10,000-Hour Goal Panel */}
        {goalFormOpen ? (
          <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="xs">
              <Text variant="label">新增 10,000 小时定律（一万小时天才理论）长期目标与每日打卡</Text>
              <Row gap="sm" wrap>
                <View style={{ flex: 2, minWidth: 200 }}>
                  <TextField
                    label="长期目标技能 / 领域名称"
                    value={newGoalTitle}
                    onChangeText={setNewGoalTitle}
                    placeholder="例如：系统架构设计 / 自由泳与有氧体能 / 英语母语级听说"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <TextField
                    label="已累计历史小时数 (h)"
                    value={newGoalPriorHours}
                    onChangeText={setNewGoalPriorHours}
                    placeholder="例如 500"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <TextField
                    label="每日打卡目标 (分钟)"
                    value={newGoalDailyMins}
                    onChangeText={setNewGoalDailyMins}
                    placeholder="例如 60"
                    keyboardType="number-pad"
                  />
                </View>
              </Row>
              <ChipGroup>
                {TIME_BLOCK_CATEGORIES.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={cat.label}
                    selected={newGoalCategory === cat.id}
                    onPress={() => setNewGoalCategory(cat.id)}
                  />
                ))}
              </ChipGroup>
              <Row gap="sm" align="center">
                <Button label="创建 10,000h 目标" onPress={onCreateMasteryGoal} />
                <Button label="取消" variant="ghost" onPress={() => setGoalFormOpen(false)} />
              </Row>
            </Stack>
          </View>
        ) : null}

        {/* 2. 10,000-Hour Rule Mastery & Daily Check-In Board */}
        <Stack gap="xs">
          <Row justify="between" align="center" wrap>
            <Text variant="label">10,000 小时定律长期精进 &amp; 今日目标打卡</Text>
            <Text variant="caption" tone="muted">
              每一次计时、拖拽框选或一键打卡都会自动累计进入你的 10,000 小时里程碑
            </Text>
          </Row>
          <View style={styles.goalsGrid}>
            {goals.map((goal) => {
              const stat = computeMasteryProgress(goal, blocks, localDay);
              const vis = categoryVisual(goal.category);
              return (
                <View
                  key={goal.id}
                  style={[
                    styles.goalCard,
                    cardSurfaceStyle(color.surface, color.line),
                    { borderColor: stat.checkedInToday ? color.green : color.line },
                  ]}
                >
                  <Row justify="between" align="center" gap="xs">
                    <View style={{ flex: 1 }}>
                      <Row gap="xs" align="center">
                        <TagChip label={vis.label} tone={stat.checkedInToday ? 'exec' : 'owner'} />
                        <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                          {goal.title}
                        </Text>
                      </Row>
                    </View>
                    {goals.length > 1 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`移除目标 ${goal.title}`}
                        onPress={() => setGoals(removeMasteryGoal(goal.id))}
                        style={styles.removeBtn}
                      >
                        <Text variant="caption" tone="muted">
                          ×
                        </Text>
                      </Pressable>
                    ) : null}
                  </Row>

                  <Row justify="between" align="center">
                    <Text variant="heading" style={styles.monoMetric}>
                      {`${stat.totalHours.toLocaleString('en-US')} / ${goal.targetHours.toLocaleString('en-US')} h`}
                    </Text>
                    <TagChip label={`${stat.tier.level} · ${stat.tier.progressPct}%`} tone="pod" />
                  </Row>

                  <ProgressBar value={Math.min(1, stat.totalHours / goal.targetHours)} masked={false} />

                  <Row justify="between" align="center" gap="xs" wrap>
                    <Text variant="caption" tone={stat.checkedInToday ? 'ink' : 'muted'}>
                      {stat.checkedInToday
                        ? `✓ 今日已达标 (${stat.todayMinutes}/${goal.dailyTargetMinutes} min) · 连续 ${stat.streakDays} 天`
                        : `今日已记 ${stat.todayMinutes}/${goal.dailyTargetMinutes} min · 差 ${Math.max(0, goal.dailyTargetMinutes - stat.todayMinutes)} min 达标`}
                    </Text>
                    <Row gap="xs" align="center">
                      <CockpitPillButton
                        label="▶ 计时"
                        accessibilityLabel={`开始计时 ${goal.title}`}
                        onPress={() => {
                          const now = Date.now();
                          setNowMs(now);
                          updateTimerState({
                            isRunning: true,
                            startedAtMs: now,
                            accumulatedSeconds: 0,
                            category: goal.category,
                            title: goal.title,
                            goalId: goal.id,
                          });
                          showToast({ text: `已启动「${goal.title}」专注计时` });
                        }}
                      />
                      <CockpitPillButton
                        label={stat.checkedInToday ? '＋ 再打卡' : `✓ 打卡 ${goal.dailyTargetMinutes}m`}
                        variant={stat.checkedInToday ? 'green' : 'accent'}
                        accessibilityLabel={`一键完成 ${goal.title} 今日打卡`}
                        onPress={() => void onQuickCheckInGoal(goal)}
                      />
                    </Row>
                  </Row>
                </View>
              );
            })}
          </View>
        </Stack>

        <Divider />

        {/* 3. Interactive 1-Minute Drag-to-Select 24H Matrix + Mobile-Friendly 60-Min Loupe & Micro-Steppers */}
        <Stack gap="xs">
          <Row justify="between" align="center" gap="sm" wrap>
            <Row gap="xs" align="center" wrap>
              <Text variant="label">
                24H 1分钟级拖拽时间轴（支持按住直接拖动框选 · 移动端支持 60 格放大尺与 ±1m 微调）
              </Text>
              <TagChip
                label={`当前选区 ${formatMinuteOfDay(selectionRange.startMinute)}–${formatMinuteOfDay(selectionRange.endMinute)} (${selectedSpanMins} min)`}
                tone="owner"
              />
            </Row>

            {/* Snap Granularity Selector (1m / 5m / 15m) */}
            <Row gap="xs" align="center" wrap>
              <Text variant="caption" tone="muted">
                拖动粒度:
              </Text>
              {([1, 5, 15] as const).map((snap) => (
                <CockpitPillButton
                  key={snap}
                  label={snap === 1 ? '1m 逐分精调' : `${snap}m 磁吸`}
                  active={snapGranularity === snap}
                  accessibilityLabel={`切换拖动粒度为 ${snap} 分钟`}
                  onPress={() => setSnapGranularity(snap)}
                />
              ))}
            </Row>
          </Row>

          {/* Interactive 24-Hour Track Matrix with Live Drag Range Overlay */}
          <View
            style={[
              styles.matrixContainer,
              { backgroundColor: color.surface, borderColor: color.line },
            ]}
          >
            {visibleHourRows.map((row) => {
              const isSelected = activeLoupeHour === row.hour;
              const hourStart = row.hour * 60;
              const hourEnd = (row.hour + 1) * 60;
              const selOverlapStart = Math.max(hourStart, selectionRange.startMinute);
              const selOverlapEnd = Math.min(hourEnd, selectionRange.endMinute);
              const hasSelInRow = selOverlapEnd > selOverlapStart;
              const selLeftPct = hasSelInRow ? ((selOverlapStart - hourStart) / 60) * 100 : 0;
              const selWidthPct = hasSelInRow
                ? Math.max(1.6, ((selOverlapEnd - selOverlapStart) / 60) * 100)
                : 0;

              return (
                <View
                  key={`hour-${row.hour}`}
                  style={[
                    styles.hourRow,
                    {
                      borderBottomColor: color.lineSoft,
                      backgroundColor: isSelected ? color.accentSoft : 'transparent',
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`聚焦 ${row.label} 60分钟放大滑尺`}
                    onPress={() => setSelectedHour(row.hour)}
                    style={styles.hourLabelBtn}
                  >
                    <Text variant="caption" style={styles.hourLabel}>
                      {row.label}
                    </Text>
                  </Pressable>

                  {/* Drag-Enabled 60-Minute Track */}
                  <View
                    onLayout={(e: LayoutChangeEvent) => {
                      trackWidthsRef.current[row.hour] = e.nativeEvent.layout.width;
                    }}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(evt) => handleTrackPressIn(row.hour, evt)}
                    onResponderMove={(evt) => handleTrackMove(row.hour, evt)}
                    onResponderRelease={handleTrackRelease}
                    onResponderTerminate={handleTrackRelease}
                    {...(Platform.OS === 'web'
                      ? {
                          onMouseEnter: (evt: unknown) => {
                            const mouseEvt = evt as {
                              buttons?: number;
                              nativeEvent?: { offsetX?: number };
                            };
                            if (mouseEvt.buttons === 1 && dragAnchorMinuteRef.current !== null) {
                              const offsetX = mouseEvt.nativeEvent?.offsetX ?? 0;
                              const width = trackWidthsRef.current[row.hour] || 360;
                              const ratio = Math.max(0, Math.min(1, offsetX / Math.max(1, width)));
                              const curMin = computeMinuteFromPointerRatio(
                                row.hour,
                                ratio,
                                snapGranularity,
                              );
                              const next = normalizeDragMinuteRange(
                                dragAnchorMinuteRef.current,
                                curMin,
                                1,
                              );
                              syncClocksFromRange(next.startMinute, next.endMinute);
                            }
                          },
                          onMouseMove: (evt: unknown) => {
                            const mouseEvt = evt as {
                              buttons?: number;
                              nativeEvent?: { offsetX?: number };
                            };
                            if (mouseEvt.buttons === 1 && dragAnchorMinuteRef.current !== null) {
                              const offsetX = mouseEvt.nativeEvent?.offsetX ?? 0;
                              const width = trackWidthsRef.current[row.hour] || 360;
                              const ratio = Math.max(0, Math.min(1, offsetX / Math.max(1, width)));
                              const curMin = computeMinuteFromPointerRatio(
                                row.hour,
                                ratio,
                                snapGranularity,
                              );
                              const next = normalizeDragMinuteRange(
                                dragAnchorMinuteRef.current,
                                curMin,
                                1,
                              );
                              syncClocksFromRange(next.startMinute, next.endMinute);
                            }
                          },
                        }
                      : {})}
                    style={[
                      styles.hourTrack,
                      {
                        backgroundColor: color.pill,
                        cursor: Platform.OS === 'web' ? 'ew-resize' : undefined,
                      } as unknown as object,
                    ]}
                  >
                    {/* 5-minute minor ticks + 15m/30m/45m quarter-hour ticks */}
                    {Array.from({ length: 11 }, (_, idx) => {
                      const minMark = (idx + 1) * 5;
                      const isQuarter = minMark % 15 === 0;
                      return (
                        <View
                          key={minMark}
                          style={[
                            isQuarter ? styles.quarterTick : styles.fiveMinTick,
                            {
                              left: `${(minMark / 60) * 100}%`,
                              backgroundColor: isQuarter ? color.line : color.lineSoft,
                            },
                          ]}
                        />
                      );
                    })}

                    {/* Committed TimeBlock Segments */}
                    {row.segments.map((seg, idx) => {
                      const leftPct = (seg.startMinInHour / 60) * 100;
                      const widthPct = Math.max(
                        1.6,
                        ((seg.endMinInHour - seg.startMinInHour) / 60) * 100,
                      );
                      const vis = categoryVisual(seg.block.category);
                      return (
                        <View
                          key={`${seg.block.id}-${idx}`}
                          style={[
                            styles.segmentBar,
                            {
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              backgroundColor: vis.bg,
                            },
                          ]}
                        >
                          {seg.endMinInHour - seg.startMinInHour >= 10 ? (
                            <Text
                              variant="caption"
                              numberOfLines={1}
                              style={[styles.segmentText, { color: color.onToast }]}
                            >
                              {`${seg.block.title} (${seg.endMinInHour - seg.startMinInHour}m)`}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}

                    {/* Live 1-Minute Drag Selection Range Highlight */}
                    {hasSelInRow ? (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.liveSelectionOverlay,
                          {
                            left: `${selLeftPct}%`,
                            width: `${selWidthPct}%`,
                            borderColor: isDark ? '#FDE68A' : color.accent,
                            backgroundColor: isDark
                              ? 'rgba(245, 185, 66, 0.28)'
                              : 'rgba(204, 120, 92, 0.25)',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.selectionHandleLeft,
                            { backgroundColor: isDark ? '#FDE68A' : color.accent },
                          ]}
                        />
                        {selOverlapEnd - selOverlapStart >= 8 ? (
                          <Text
                            variant="caption"
                            numberOfLines={1}
                            style={[
                              styles.liveSelectionText,
                              { color: isDark ? '#FEF08A' : color.ink },
                            ]}
                          >
                            {`${formatMinuteOfDay(selOverlapStart)}–${formatMinuteOfDay(selOverlapEnd)} (${selOverlapEnd - selOverlapStart}m)`}
                          </Text>
                        ) : null}
                        <View
                          style={[
                            styles.selectionHandleRight,
                            { backgroundColor: isDark ? '#FDE68A' : color.accent },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>

                  <Text variant="caption" tone="muted" style={styles.hourMinsText}>
                    {row.occupiedMinutes > 0 ? `${row.occupiedMinutes}m` : '—'}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* 4. Mobile & Desktop 1-Minute Magnifier Loupe + Dual-Edge Fine-Tune Command Dock */}
          <View
            style={[
              styles.loupeDock,
              cardSurfaceStyle(color.surface, color.line),
              { borderColor: isDragging ? color.accent : color.line },
            ]}
          >
            <Stack gap="xs">
              <Row justify="between" align="center" gap="sm" wrap>
                <Row gap="xs" align="center" wrap>
                  <TagChip
                    label={`🔍 ${String(activeLoupeHour).padStart(2, '0')}:00 – ${String(activeLoupeHour).padStart(2, '0')}:59 · 60格×1分钟精调放大镜`}
                    tone="owner"
                  />
                  <Text variant="caption" tone="muted">
                    {mobileTapAnchor !== null
                      ? `已锚定起点 ${formatMinuteOfDay(mobileTapAnchor)}，请再点选结束分钟格`
                      : '桌面端可按住横条拖动；移动端可点选任意两格设起止，或用下方 ±1m 步进器单手微调'}
                  </Text>
                </Row>

                {/* Quick Hour Switcher for Mobile */}
                <Row gap="xs" align="center">
                  <CockpitPillButton
                    label="◀ 上一小时"
                    accessibilityLabel="切换到上一小时放大镜"
                    onPress={() => setSelectedHour(Math.max(0, activeLoupeHour - 1))}
                  />
                  <CockpitPillButton
                    label="下一小时 ▶"
                    accessibilityLabel="切换到下一小时放大镜"
                    onPress={() => setSelectedHour(Math.min(23, activeLoupeHour + 1))}
                  />
                </Row>
              </Row>

              {/* 60 Individual 1-Minute Cells (6 rows × 10 minutes or responsive wrap) */}
              <View style={styles.loupeGrid}>
                {loupeCells.map((cell) => {
                  const isAnchor = mobileTapAnchor === cell.minuteOfDay;
                  const isFiveMark = cell.minuteOfHour % 5 === 0;
                  return (
                    <Pressable
                      key={cell.minuteOfDay}
                      accessibilityRole="button"
                      accessibilityLabel={`选择分钟 ${cell.clockLabel}`}
                      onPress={() => handleLoupeMinutePress(cell.minuteOfDay)}
                      style={[
                        styles.loupeMinuteCell,
                        {
                          backgroundColor: cell.isSelected
                            ? isDark
                              ? 'rgba(245, 185, 66, 0.28)'
                              : color.accentSoft
                            : cell.occupiedBlock
                              ? color.greenSoft
                              : color.card,
                          borderColor:
                            cell.isSelectionStart || cell.isSelectionEnd || isAnchor
                              ? color.accent
                              : isFiveMark
                                ? color.line
                                : color.lineSoft,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={[
                          styles.loupeCellText,
                          {
                            color: cell.isSelected
                              ? color.accent
                              : cell.occupiedBlock
                                ? color.green
                                : isFiveMark
                                  ? color.ink
                                  : color.muted,
                            fontWeight:
                              cell.isSelected || isFiveMark
                                ? theme.fontWeight.semibold
                                : theme.fontWeight.regular,
                          },
                        ]}
                      >
                        {`:${String(cell.minuteOfHour).padStart(2, '0')}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Divider />

              {/* Mobile-Ergonomic Dual-Edge Steppers (Start ±1m/±5m & End ±1m/±5m + Quick Duration Presets) */}
              <Row justify="between" align="center" gap="sm" wrap>
                <View style={styles.stepperGroup}>
                  <Text variant="caption" style={styles.stepperTitle}>
                    {`起点 ${formatMinuteOfDay(selectionRange.startMinute)}`}
                  </Text>
                  <Row gap="xs" align="center" wrap>
                    <CockpitPillButton label="-15m" onPress={() => handleNudge('start', -15)} />
                    <CockpitPillButton label="-5m" onPress={() => handleNudge('start', -5)} />
                    <CockpitPillButton label="-1m" active onPress={() => handleNudge('start', -1)} />
                    <CockpitPillButton label="+1m" active onPress={() => handleNudge('start', 1)} />
                    <CockpitPillButton label="+5m" onPress={() => handleNudge('start', 5)} />
                    <CockpitPillButton label="+15m" onPress={() => handleNudge('start', 15)} />
                  </Row>
                </View>

                <View style={styles.stepperGroup}>
                  <Text variant="caption" style={styles.stepperTitle}>
                    {`终点 ${formatMinuteOfDay(selectionRange.endMinute)}（共 ${selectedSpanMins} 分钟）`}
                  </Text>
                  <Row gap="xs" align="center" wrap>
                    <CockpitPillButton label="-15m" onPress={() => handleNudge('end', -15)} />
                    <CockpitPillButton label="-5m" onPress={() => handleNudge('end', -5)} />
                    <CockpitPillButton label="-1m" active onPress={() => handleNudge('end', -1)} />
                    <CockpitPillButton label="+1m" active onPress={() => handleNudge('end', 1)} />
                    <CockpitPillButton label="+5m" onPress={() => handleNudge('end', 5)} />
                    <CockpitPillButton label="+15m" onPress={() => handleNudge('end', 15)} />
                  </Row>
                </View>
              </Row>

              {/* Quick Duration Capsules + Whole-Block Shift */}
              <Row justify="between" align="center" gap="sm" wrap>
                <Row gap="xs" align="center" wrap>
                  <Text variant="caption" tone="muted">
                    快捷时长:
                  </Text>
                  {QUICK_SPAN_PRESETS.map((mins) => (
                    <CockpitPillButton
                      key={mins}
                      label={mins === 25 ? '25m 番茄' : `${mins}m`}
                      active={selectedSpanMins === mins}
                      onPress={() => handleQuickSpanPreset(mins)}
                    />
                  ))}
                </Row>

                <Row gap="xs" align="center">
                  <Text variant="caption" tone="muted">
                    整体平移:
                  </Text>
                  <CockpitPillButton label="◀ -5m" onPress={() => handleNudge('both', -5)} />
                  <CockpitPillButton label="◀ -1m" onPress={() => handleNudge('both', -1)} />
                  <CockpitPillButton label="+1m ▶" onPress={() => handleNudge('both', 1)} />
                  <CockpitPillButton label="+5m ▶" onPress={() => handleNudge('both', 5)} />
                </Row>
              </Row>

              <Divider />

              {/* Instant 1-Click Commit Bar */}
              <Row justify="between" align="center" gap="sm" wrap>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Stack gap="xs">
                    <ChipGroup>
                      {TIME_BLOCK_CATEGORIES.map((cat) => (
                        <Chip
                          key={cat.id}
                          label={cat.shortLabel}
                          selected={manualCategory === cat.id}
                          onPress={() => setManualCategory(cat.id)}
                        />
                      ))}
                    </ChipGroup>
                    <ChipGroup>
                      {goals.map((g) => (
                        <Chip
                          key={g.id}
                          label={g.title}
                          selected={manualGoalId === g.id}
                          onPress={() => {
                            setManualGoalId(g.id);
                            setManualCategory(g.category);
                            if (!manualTitle) setManualTitle(g.title);
                          }}
                        />
                      ))}
                    </ChipGroup>
                  </Stack>
                </View>

                <View style={{ flex: 1, minWidth: 200 }}>
                  <TextField
                    label="时间块标题（可选，默认关联目标名）"
                    value={manualTitle}
                    onChangeText={setManualTitle}
                    placeholder="例如：深度架构设计 / 核心训练"
                  />
                </View>

                <CockpitPillButton
                  label={`✦ 写入时间块 ${formatMinuteOfDay(selectionRange.startMinute)}–${formatMinuteOfDay(selectionRange.endMinute)} (${selectedSpanMins}m)`}
                  active
                  accessibilityLabel="将当前选中的分钟区间写入24小时时间轴"
                  onPress={() =>
                    void onCommitSelectedRange(selectionRange.startMinute, selectionRange.endMinute)
                  }
                />
              </Row>

              {/* Existing Segments in Inspected Hour */}
              {inspectedHourRow && inspectedHourRow.segments.length > 0 ? (
                <Stack gap="xs">
                  <Divider />
                  <Text variant="caption" tone="muted">
                    {`${inspectedHourRow.label} 已记录的时间块明细（共 ${inspectedHourRow.occupiedMinutes} 分钟）：`}
                  </Text>
                  {inspectedHourRow.segments.map((seg) => (
                    <Row key={seg.block.id} justify="between" align="center" gap="sm">
                      <Row gap="xs" align="center">
                        <TagChip
                          label={`${formatMinuteOfDay(seg.block.startMinute)}–${formatMinuteOfDay(seg.block.endMinute)}`}
                          tone="owner"
                        />
                        <Text variant="body">{seg.block.title}</Text>
                        <Text variant="caption" tone="muted">
                          {`(${seg.block.durationMinutes} 分钟)`}
                        </Text>
                      </Row>
                      <CockpitPillButton
                        label="× 删除"
                        onPress={() => setBlocks(removeTimeBlock(seg.block.id))}
                      />
                    </Row>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </View>
        </Stack>
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  timerConsole: {
    padding: 14,
    borderRadius: theme.radius.card,
    borderWidth: theme.border.width,
    gap: 10,
  },
  timerLeft: {
    gap: 4,
    flex: 1,
    minWidth: 220,
  },
  timerReadout: {
    fontFamily: theme.fontFamily.mono,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  subPanel: {
    padding: 12,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalCard: {
    flex: 1,
    minWidth: 260,
    padding: 12,
    borderRadius: theme.radius.card,
    borderWidth: theme.border.width,
    gap: 8,
  },
  monoMetric: {
    fontFamily: theme.fontFamily.mono,
    fontVariant: ['tabular-nums'],
  },
  removeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  matrixContainer: {
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    overflow: 'hidden',
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: 8,
    borderBottomWidth: theme.border.width,
    gap: 8,
  },
  hourLabelBtn: {
    width: 44,
    height: '100%',
    justifyContent: 'center',
  },
  hourLabel: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 11,
  },
  hourTrack: {
    flex: 1,
    height: 20,
    borderRadius: 5,
    position: 'relative',
    overflow: 'hidden',
  },
  quarterTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  fiveMinTick: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    width: 1,
    opacity: 0.45,
  },
  segmentBar: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    borderRadius: 3,
    paddingHorizontal: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentText: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: theme.fontWeight.semibold,
  },
  liveSelectionOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  selectionHandleLeft: {
    width: 4,
    height: '100%',
  },
  selectionHandleRight: {
    width: 4,
    height: '100%',
  },
  liveSelectionText: {
    fontSize: 9.5,
    lineHeight: 12,
    fontFamily: theme.fontFamily.mono,
    fontWeight: theme.fontWeight.semibold,
    paddingHorizontal: 4,
  },
  hourMinsText: {
    width: 38,
    textAlign: 'right',
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
  },
  loupeDock: {
    padding: 14,
    borderRadius: theme.radius.card,
    borderWidth: theme.border.width,
  },
  loupeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  loupeMinuteCell: {
    width: 42,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loupeCellText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 13,
  },
  stepperGroup: {
    gap: 4,
  },
  stepperTitle: {
    fontFamily: theme.fontFamily.mono,
    fontWeight: theme.fontWeight.semibold,
  },
});
