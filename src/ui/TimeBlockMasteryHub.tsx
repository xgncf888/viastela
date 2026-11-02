import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  type ActiveTimerSession,
  build24HourMatrix,
  computeMasteryProgress,
  formatMinuteOfDay,
  formatTimerClock,
  type MasteryGoal,
  parseClockToMinute,
  TIME_BLOCK_CATEGORIES,
  type TimeBlockCategory,
  type TimeBlockItem,
} from '@/core/time-block-tracker';
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
  const { color } = useTheme();
  const [blocks, setBlocks] = useState<TimeBlockItem[]>(readTimeBlocks);
  const [goals, setGoals] = useState<MasteryGoal[]>(readMasteryGoals);
  const [timer, setTimer] = useState<ActiveTimerSession>(readActiveTimer);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [compact24h, setCompact24h] = useState(true);

  // Manual Time Block Form
  const [manualOpen, setManualOpen] = useState(false);
  const [startClock, setStartClock] = useState('09:00');
  const [endClock, setEndClock] = useState('10:30');
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

  async function onAddManualTimeBlock() {
    const startMin = parseClockToMinute(startClock);
    const endMin = parseClockToMinute(endClock);
    if (startMin === null || endMin === null || endMin <= startMin) {
      showToast({ text: '请输入有效的起止时间（例如 09:00 至 10:30，结束时间需晚于开始时间）', tone: 'error' });
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
    showToast({
      text: `已添加时间块 ${formatMinuteOfDay(startMin)}–${formatMinuteOfDay(endMin)} ${title} (${durationMin} min)`,
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
  const hourMatrix = build24HourMatrix(todayBlocks);
  const visibleHourRows = compact24h
    ? hourMatrix.filter((row) => row.hour >= 6 || row.occupiedMinutes > 0)
    : hourMatrix;
  const inspectedHourRow =
    selectedHour !== null ? hourMatrix.find((r) => r.hour === selectedHour) ?? null : null;

  return (
    <Card>
      <Stack gap="sm">
        {/* Header */}
        <Row justify="between" align="center" gap="sm" wrap>
          <Row gap="sm" align="center" wrap>
            <Text variant="heading">24H 分钟级时间块 · 实时计时器 · 10,000 小时定律</Text>
            <TagChip
              label={
                timer.isRunning
                  ? `TRACKING · ${formatTimerClock(elapsedSeconds)}`
                  : `今日已追踪 ${totalTrackedMinsToday} / 1440 分钟`
              }
              tone={timer.isRunning ? 'exec' : 'owner'}
            />
          </Row>
          <Row gap="xs" align="center" wrap>
            <CockpitPillButton
              label="+ 补录时间块"
              accessibilityLabel="手动按起止分钟补录时间块"
              onPress={() => setManualOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label="+ 10000h 目标"
              accessibilityLabel="添加新的 10000 小时精进目标"
              onPress={() => setGoalFormOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label={compact24h ? '展开凌晨 00–05 点' : '折叠空闲凌晨'}
              accessibilityLabel="切换 24 小时完整视图与日间紧凑视图"
              onPress={() => setCompact24h((prev) => !prev)}
            />
          </Row>
        </Row>

        <Divider />

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
                label="当前正在做的事（精确到分钟）"
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
              <Text variant="label">按起止分钟补录时间块（00:00 – 24:00）</Text>
              <Row gap="sm" wrap>
                <View style={{ flex: 1, minWidth: 110 }}>
                  <TextField
                    label="开始时间 (HH:MM)"
                    value={startClock}
                    onChangeText={setStartClock}
                    placeholder="09:00"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 110 }}>
                  <TextField
                    label="结束时间 (HH:MM)"
                    value={endClock}
                    onChangeText={setEndClock}
                    placeholder="10:30"
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
              <ChipGroup>
                {TIME_BLOCK_CATEGORIES.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={cat.label}
                    selected={manualCategory === cat.id}
                    onPress={() => setManualCategory(cat.id)}
                  />
                ))}
              </ChipGroup>
              <ChipGroup>
                {goals.map((g) => (
                  <Chip
                    key={g.id}
                    label={`关联: ${g.title}`}
                    selected={manualGoalId === g.id}
                    onPress={() => {
                      setManualGoalId(g.id);
                      if (!manualTitle) setManualTitle(g.title);
                      setManualCategory(g.category);
                    }}
                  />
                ))}
              </ChipGroup>
              <Row gap="sm" align="center">
                <Button label="写入 24H 时间轴" onPress={() => void onAddManualTimeBlock()} />
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
              每一次计时或一键打卡都会自动累计进入你的 10,000 小时里程碑
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

        {/* 3. 24-Hour Minute-by-Minute Visual Matrix */}
        <Stack gap="xs">
          <Row justify="between" align="center" wrap>
            <Row gap="xs" align="center" wrap>
              <Text variant="label">今日 24 小时分钟级时间块矩阵（每格 = 60 分钟，点击任意小时检视每一分钟明细）</Text>
            </Row>
            <Row gap="sm" align="center" wrap>
              {TIME_BLOCK_CATEGORIES.map((cat) => {
                const v = categoryVisual(cat.id);
                return (
                  <Row key={cat.id} gap="xs" align="center">
                    <View style={[styles.legendDot, { backgroundColor: v.bg }]} />
                    <Text variant="caption" tone="muted">
                      {cat.shortLabel}
                    </Text>
                  </Row>
                );
              })}
            </Row>
          </Row>

          <View
            style={[
              styles.matrixContainer,
              { backgroundColor: color.surface, borderColor: color.line },
            ]}
          >
            {visibleHourRows.map((row) => {
              const isSelected = selectedHour === row.hour;
              return (
                <Pressable
                  key={`hour-${row.hour}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.label} 已记录 ${row.occupiedMinutes} 分钟`}
                  onPress={() => setSelectedHour(isSelected ? null : row.hour)}
                  style={[
                    styles.hourRow,
                    {
                      borderBottomColor: color.lineSoft,
                      backgroundColor: isSelected ? color.accentSoft : 'transparent',
                    },
                  ]}
                >
                  <Text variant="caption" style={styles.hourLabel}>
                    {row.label}
                  </Text>

                  <View style={[styles.hourTrack, { backgroundColor: color.pill }]}>
                    {/* 15m / 30m / 45m subtle quarter-hour ticks */}
                    <View style={[styles.quarterTick, { left: '25%', backgroundColor: color.line }]} />
                    <View style={[styles.quarterTick, { left: '50%', backgroundColor: color.line }]} />
                    <View style={[styles.quarterTick, { left: '75%', backgroundColor: color.line }]} />

                    {row.segments.map((seg, idx) => {
                      const leftPct = (seg.startMinInHour / 60) * 100;
                      const widthPct = Math.max(2, ((seg.endMinInHour - seg.startMinInHour) / 60) * 100);
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
                          {seg.endMinInHour - seg.startMinInHour >= 12 ? (
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
                  </View>

                  <Text variant="caption" tone="muted" style={styles.hourMinsText}>
                    {row.occupiedMinutes > 0 ? `${row.occupiedMinutes}m` : '—'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {inspectedHourRow ? (
            <View
              style={[
                styles.subPanel,
                { backgroundColor: color.surface, borderColor: color.line },
              ]}
            >
              <Stack gap="xs">
                <Row justify="between" align="center">
                  <Text variant="label">
                    {`${inspectedHourRow.label} – ${String(inspectedHourRow.hour).padStart(2, '0')}:59 分钟级明细（共占用 ${inspectedHourRow.occupiedMinutes} / 60 分钟）`}
                  </Text>
                  <CockpitPillButton
                    label={`在此小时补录 (${inspectedHourRow.label})`}
                    onPress={() => {
                      setStartClock(inspectedHourRow.label);
                      setEndClock(`${String(Math.min(24, inspectedHourRow.hour + 1)).padStart(2, '0')}:00`);
                      setManualOpen(true);
                    }}
                  />
                </Row>
                {inspectedHourRow.segments.length === 0 ? (
                  <Text variant="caption" tone="muted">
                    该小时段暂未记录时间块，点击右侧「在此小时补录」可精确填入。
                  </Text>
                ) : (
                  inspectedHourRow.segments.map((seg) => (
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
                      <Button
                        label="删除"
                        variant="ghost"
                        onPress={() => setBlocks(removeTimeBlock(seg.block.id))}
                      />
                    </Row>
                  ))
                )}
              </Stack>
            </View>
          ) : null}
        </Stack>
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  timerConsole: {
    padding: 14,
    borderRadius: 10,
    borderWidth: theme.border.width,
    gap: 10,
  },
  timerLeft: {
    gap: 4,
  },
  timerReadout: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: theme.fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  subPanel: {
    padding: theme.space.ms,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 260,
    minWidth: 240,
    padding: 12,
    borderRadius: 9,
    borderWidth: theme.border.width,
    gap: 8,
  },
  monoMetric: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: theme.fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  removeBtn: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
  },
  matrixContainer: {
    borderRadius: 9,
    borderWidth: theme.border.width,
    overflow: 'hidden',
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 28,
    borderBottomWidth: theme.border.width,
    gap: 8,
  },
  hourLabel: {
    width: 44,
    fontFamily: theme.fontFamily.mono,
    fontSize: 11,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
  },
  hourTrack: {
    flex: 1,
    height: 18,
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  quarterTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    opacity: 0.35,
  },
  segmentBar: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    borderRadius: 3,
    paddingHorizontal: 5,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  hourMinsText: {
    width: 34,
    textAlign: 'right',
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
});
