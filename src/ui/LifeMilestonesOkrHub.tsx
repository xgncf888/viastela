import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  computeHabitStreak,
  computeKrProgressPct,
  computeObjectiveProgressPct,
  type HabitItem,
  type LifeMilestone,
  MILESTONE_CATEGORY_META,
  type MilestoneCategory,
  OKR_CATEGORY_META,
  type OkrAutoLink,
  type OkrCategory,
  type OkrObjective,
  sortMilestonesByUrgency,
  syncOkrWithLiveMetrics,
} from '@/core/life-milestones-okr';
import {
  addDailyHabit,
  addKeyResultToObjective,
  addLifeMilestone,
  addOkrObjective,
  checkInKeyResult,
  readDailyHabits,
  readLifeMilestones,
  readOkrObjectives,
  removeLifeMilestone,
  removeOkrObjective,
  subscribeLifeOkrStore,
  toggleHabitDay,
} from '@/data/life-milestones-okr';

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

const MILESTONE_CATEGORIES: { id: MilestoneCategory; label: string }[] = [
  { id: 'love', label: '纪念日' },
  { id: 'birthday', label: '生日' },
  { id: 'countdown', label: '倒数日' },
  { id: 'career', label: '事业节点' },
  { id: 'life', label: '生活纪事' },
];

const OKR_CATEGORIES: { id: OkrCategory; label: string }[] = [
  { id: 'health', label: '身材与体能' },
  { id: 'growth', label: '认知与技能' },
  { id: 'career', label: '事业与产出' },
  { id: 'wealth', label: '资产与配置' },
  { id: 'life', label: '生活品质' },
];

const AUTO_LINK_OPTIONS: { id: OkrAutoLink; label: string }[] = [
  { id: 'none', label: '手动打卡步进' },
  { id: 'weight_kg', label: '自动联动：最新晨重 (kg)' },
  { id: 'workout_sets', label: '自动联动：累计训练组数' },
  { id: 'study_hours', label: '自动联动：累计学习小时 (h)' },
];

export function LifeMilestonesOkrHub({
  localDay,
  latestWeightKg,
  totalWorkoutSets,
  totalStudyHours,
}: {
  localDay: string;
  latestWeightKg?: number | null;
  totalWorkoutSets?: number | null;
  totalStudyHours?: number | null;
}) {
  const { color } = useTheme();
  const [milestones, setMilestones] = useState<LifeMilestone[]>(readLifeMilestones);
  const [objectives, setObjectives] = useState<OkrObjective[]>(readOkrObjectives);
  const [habits, setHabits] = useState<HabitItem[]>(readDailyHabits);

  // Forms visibility
  const [milestoneFormOpen, setMilestoneFormOpen] = useState(false);
  const [okrFormOpen, setOkrFormOpen] = useState(false);
  const [habitFormOpen, setHabitFormOpen] = useState(false);
  const [addingKrForObjId, setAddingKrForObjId] = useState<string | null>(null);

  // New Milestone inputs
  const [msTitle, setMsTitle] = useState('');
  const [msDate, setMsDate] = useState(localDay);
  const [msCategory, setMsCategory] = useState<MilestoneCategory>('love');
  const [msRecurring, setMsRecurring] = useState(true);
  const [msPrepNote, setMsPrepNote] = useState('');

  // New OKR Objective inputs
  const [okrPeriod, setOkrPeriod] = useState('2026 Q4');
  const [okrTitle, setOkrTitle] = useState('');
  const [okrCategory, setOkrCategory] = useState<OkrCategory>('growth');
  const [krTitle, setKrTitle] = useState('');
  const [krStartValue, setKrStartValue] = useState('0');
  const [krTargetValue, setKrTargetValue] = useState('100');
  const [krUnit, setKrUnit] = useState('h');
  const [krStepDelta, setKrStepDelta] = useState('1');
  const [krAutoLink, setKrAutoLink] = useState<OkrAutoLink>('none');

  // Additional KR inputs for existing Objective
  const [subKrTitle, setSubKrTitle] = useState('');
  const [subKrTarget, setSubKrTarget] = useState('20');
  const [subKrUnit, setSubKrUnit] = useState('次');
  const [subKrStep, setSubKrStep] = useState('1');

  // New Habit inputs
  const [habitTitle, setHabitTitle] = useState('');
  const [habitCategory, setHabitCategory] = useState<OkrCategory>('health');
  const [habitWeeklyDays, setHabitWeeklyDays] = useState('7');

  useEffect(() => {
    return subscribeLifeOkrStore(() => {
      setMilestones(readLifeMilestones());
      setObjectives(readOkrObjectives());
      setHabits(readDailyHabits());
    });
  }, []);

  const computedMilestones = sortMilestonesByUrgency(milestones, localDay);
  const urgentMilestones = computedMilestones.filter(
    (m) => m.urgency === 'today' || m.urgency === 'imminent',
  );

  const liveObjectives = syncOkrWithLiveMetrics(objectives, {
    latestWeightKg,
    totalWorkoutSets,
    totalStudyHours,
  });

  const avgOkrProgress =
    liveObjectives.length > 0
      ? Math.round(
          liveObjectives.reduce((acc, obj) => acc + computeObjectiveProgressPct(obj), 0) /
            liveObjectives.length,
        )
      : 0;

  const habitsCompletedToday = habits.filter((h) => h.completedDays.includes(localDay)).length;

  function onCreateMilestone() {
    if (!msTitle.trim()) {
      showToast({ text: '请输入纪念日或倒数日名称', tone: 'error' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(msDate.trim())) {
      showToast({ text: '日期格式需为 YYYY-MM-DD（例如 2026-05-20）', tone: 'error' });
      return;
    }
    addLifeMilestone({
      title: msTitle,
      targetDate: msDate,
      category: msCategory,
      recurringAnnual: msRecurring,
      prepNote: msPrepNote,
    });
    setMsTitle('');
    setMsPrepNote('');
    setMilestoneFormOpen(false);
    showToast({ text: `已添加纪念日/里程碑：${msTitle.trim()}` });
  }

  function onCreateObjective() {
    if (!okrTitle.trim() || !krTitle.trim()) {
      showToast({ text: '请填写目标 (Objective) 与首个关键结果 (KR)', tone: 'error' });
      return;
    }
    addOkrObjective({
      period: okrPeriod,
      title: okrTitle,
      category: okrCategory,
      krTitle,
      startValue: Number.parseFloat(krStartValue) || 0,
      targetValue: Number.parseFloat(krTargetValue) || 100,
      unit: krUnit || '次',
      stepDelta: Number.parseFloat(krStepDelta) || 1,
      autoLink: krAutoLink,
    });
    setOkrTitle('');
    setKrTitle('');
    setOkrFormOpen(false);
    showToast({ text: `已创建 OKR 目标：${okrTitle.trim()}` });
  }

  function onAddSubKr(objectiveId: string) {
    if (!subKrTitle.trim()) {
      showToast({ text: '请输入关键结果 (KR) 名称', tone: 'error' });
      return;
    }
    addKeyResultToObjective(objectiveId, {
      title: subKrTitle,
      targetValue: Number.parseFloat(subKrTarget) || 10,
      unit: subKrUnit || '次',
      stepDelta: Number.parseFloat(subKrStep) || 1,
    });
    setSubKrTitle('');
    setAddingKrForObjId(null);
    showToast({ text: `已追加关键结果：${subKrTitle.trim()}` });
  }

  function onCreateHabit() {
    if (!habitTitle.trim()) {
      showToast({ text: '请输入日常打卡习惯名称', tone: 'error' });
      return;
    }
    addDailyHabit({
      title: habitTitle,
      category: habitCategory,
      weeklyTargetDays: Number.parseInt(habitWeeklyDays, 10) || 7,
    });
    setHabitTitle('');
    setHabitFormOpen(false);
    showToast({ text: `已新增打卡习惯：${habitTitle.trim()}` });
  }

  return (
    <Card>
      <Stack gap="sm">
        {/* Top Header */}
        <Row justify="between" align="center" gap="sm" wrap>
          <Row gap="sm" align="center" wrap>
            <Text variant="heading">纪念日提示 · OKR 目标引擎 · 每日打卡矩阵</Text>
            <TagChip
              label={`OKR 总进度 ${avgOkrProgress}% · 今日习惯 ${habitsCompletedToday}/${habits.length}`}
              tone={habitsCompletedToday === habits.length && habits.length > 0 ? 'exec' : 'owner'}
            />
            {urgentMilestones.length > 0 ? (
              <TagChip
                label={`近期纪念提醒 ×${urgentMilestones.length}`}
                tone="exec"
              />
            ) : null}
          </Row>
          <Row gap="xs" align="center" wrap>
            <CockpitPillButton
              label="+ 纪念日/倒数日"
              accessibilityLabel="新增纪念日或重要倒数日"
              onPress={() => setMilestoneFormOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label="+ 新增 OKR"
              accessibilityLabel="新增季度或年度 OKR 目标"
              onPress={() => setOkrFormOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label="+ 打卡习惯"
              accessibilityLabel="新增每日微习惯打卡项"
              onPress={() => setHabitFormOpen((prev) => !prev)}
            />
          </Row>
        </Row>

        <Divider />

        {/* Form 1: Add Milestone */}
        {milestoneFormOpen ? (
          <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="xs">
              <Text variant="label">新增纪念日 / 生日 / 目标倒数日（自动推算周年与 100/520/1000 天整数里程碑）</Text>
              <Row gap="sm" wrap>
                <View style={{ flex: 2, minWidth: 180 }}>
                  <TextField
                    label="纪念日或事件名称"
                    value={msTitle}
                    onChangeText={setMsTitle}
                    placeholder="例如：恋爱纪念日 / 妈妈生日 / 半马比赛日"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <TextField
                    label="起始日或目标日 (YYYY-MM-DD)"
                    value={msDate}
                    onChangeText={setMsDate}
                    placeholder="2024-05-20"
                  />
                </View>
                <View style={{ flex: 2, minWidth: 180 }}>
                  <TextField
                    label="筹备提示 / 心愿备忘（可选）"
                    value={msPrepNote}
                    onChangeText={setMsPrepNote}
                    placeholder="例如：提前一周订花与江景餐厅"
                  />
                </View>
              </Row>
              <Row justify="between" align="center" wrap gap="sm">
                <ChipGroup>
                  {MILESTONE_CATEGORIES.map((cat) => (
                    <Chip
                      key={cat.id}
                      label={cat.label}
                      selected={msCategory === cat.id}
                      onPress={() => setMsCategory(cat.id)}
                    />
                  ))}
                </ChipGroup>
                <ChipGroup>
                  <Chip
                    label="每年重复（周年/生日）"
                    selected={msRecurring}
                    onPress={() => setMsRecurring(true)}
                  />
                  <Chip
                    label="单次事件（倒数日/累计日）"
                    selected={!msRecurring}
                    onPress={() => setMsRecurring(false)}
                  />
                </ChipGroup>
              </Row>
              <Row gap="sm" align="center">
                <Button label="保存纪念日" onPress={onCreateMilestone} />
                <Button label="取消" variant="ghost" onPress={() => setMilestoneFormOpen(false)} />
              </Row>
            </Stack>
          </View>
        ) : null}

        {/* Form 2: Add OKR */}
        {okrFormOpen ? (
          <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="xs">
              <Text variant="label">创建 OKR 目标（Objective）与首个量化关键结果（Key Result）</Text>
              <Row gap="sm" wrap>
                <View style={{ flex: 1, minWidth: 100 }}>
                  <TextField
                    label="周期标签"
                    value={okrPeriod}
                    onChangeText={setOkrPeriod}
                    placeholder="2026 Q4"
                  />
                </View>
                <View style={{ flex: 3, minWidth: 220 }}>
                  <TextField
                    label="目标 Objective (O)"
                    value={okrTitle}
                    onChangeText={setOkrTitle}
                    placeholder="例如：打造高精力体态与全栈 AI 产品矩阵"
                  />
                </View>
              </Row>
              <ChipGroup>
                {OKR_CATEGORIES.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={cat.label}
                    selected={okrCategory === cat.id}
                    onPress={() => setOkrCategory(cat.id)}
                  />
                ))}
              </ChipGroup>
              <Row gap="sm" wrap>
                <View style={{ flex: 2, minWidth: 200 }}>
                  <TextField
                    label="首个关键结果 Key Result (KR1)"
                    value={krTitle}
                    onChangeText={setKrTitle}
                    placeholder="例如：完成 12 篇技术深潜复盘 / 晨重降至 68kg"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 85 }}>
                  <TextField
                    label="起始值"
                    value={krStartValue}
                    onChangeText={setKrStartValue}
                    placeholder="0"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 85 }}>
                  <TextField
                    label="目标值"
                    value={krTargetValue}
                    onChangeText={setKrTargetValue}
                    placeholder="100"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 70 }}>
                  <TextField
                    label="单位"
                    value={krUnit}
                    onChangeText={setKrUnit}
                    placeholder="篇 / kg / h"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 85 }}>
                  <TextField
                    label="单次打卡步进"
                    value={krStepDelta}
                    onChangeText={setKrStepDelta}
                    placeholder="1"
                    keyboardType="decimal-pad"
                  />
                </View>
              </Row>
              <ChipGroup>
                {AUTO_LINK_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.id}
                    label={opt.label}
                    selected={krAutoLink === opt.id}
                    onPress={() => setKrAutoLink(opt.id)}
                  />
                ))}
              </ChipGroup>
              <Row gap="sm" align="center">
                <Button label="创建 OKR" onPress={onCreateObjective} />
                <Button label="取消" variant="ghost" onPress={() => setOkrFormOpen(false)} />
              </Row>
            </Stack>
          </View>
        ) : null}

        {/* Form 3: Add Daily Habit */}
        {habitFormOpen ? (
          <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="xs">
              <Text variant="label">新增每日打卡习惯（7 日热力矩阵追踪连击 Streak）</Text>
              <Row gap="sm" wrap>
                <View style={{ flex: 2, minWidth: 200 }}>
                  <TextField
                    label="习惯名称"
                    value={habitTitle}
                    onChangeText={setHabitTitle}
                    placeholder="例如：23:00 前熄灯入睡 / 每日阅读 30 分钟"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <TextField
                    label="每周目标天数 (1-7)"
                    value={habitWeeklyDays}
                    onChangeText={setHabitWeeklyDays}
                    placeholder="7"
                    keyboardType="number-pad"
                  />
                </View>
              </Row>
              <ChipGroup>
                {OKR_CATEGORIES.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={cat.label}
                    selected={habitCategory === cat.id}
                    onPress={() => setHabitCategory(cat.id)}
                  />
                ))}
              </ChipGroup>
              <Row gap="sm" align="center">
                <Button label="添加打卡习惯" onPress={onCreateHabit} />
                <Button label="取消" variant="ghost" onPress={() => setHabitFormOpen(false)} />
              </Row>
            </Stack>
          </View>
        ) : null}

        {/* Section 1: Anniversary & Milestone Radar */}
        <Stack gap="xs">
          <Row justify="between" align="center" wrap>
            <Text variant="label">纪念日与重要节点雷达（支持周年倒数 + 100 / 520 / 1000 天整数里程碑提示）</Text>
            <Text variant="caption" tone="muted">
              临近 7 天内自动高亮预警，不错过每个重要时刻
            </Text>
          </Row>

          <View style={styles.milestoneGrid}>
            {computedMilestones.map((ms) => {
              const meta = MILESTONE_CATEGORY_META[ms.item.category];
              const isUrgent = ms.urgency === 'today' || ms.urgency === 'imminent';
              return (
                <View
                  key={ms.item.id}
                  style={[
                    styles.milestoneCard,
                    cardSurfaceStyle(color.surface, color.line),
                    {
                      borderColor:
                        ms.urgency === 'today'
                          ? color.green
                          : ms.urgency === 'imminent'
                            ? color.warning
                            : color.line,
                    },
                  ]}
                >
                  <Row justify="between" align="center" gap="xs">
                    <View style={{ flex: 1 }}>
                      <Row gap="xs" align="center">
                        <TagChip label={meta.label} tone={meta.tagTone} />
                        <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                          {ms.item.title}
                        </Text>
                      </Row>
                    </View>
                    <Row gap="xs" align="center">
                      <TagChip
                        label={ms.badgeText}
                        tone={
                          ms.urgency === 'today'
                            ? 'exec'
                            : isUrgent
                              ? 'owner'
                              : 'pod'
                        }
                      />
                      {milestones.length > 1 ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`删除纪念日 ${ms.item.title}`}
                          onPress={() => removeLifeMilestone(ms.item.id)}
                          style={styles.removeBtn}
                        >
                          <Text variant="caption" tone="muted">
                            ×
                          </Text>
                        </Pressable>
                      ) : null}
                    </Row>
                  </Row>

                  <Text variant="caption" tone="muted">
                    {ms.subtitleText}
                  </Text>

                  {ms.item.prepNote ? (
                    <View
                      style={[
                        styles.prepBanner,
                        {
                          backgroundColor: isUrgent ? color.warningSoft : color.pill,
                          borderColor: color.lineSoft,
                        },
                      ]}
                    >
                      <Text variant="caption" tone={isUrgent ? 'ink' : 'muted'}>
                        {`备忘提示：${ms.item.prepNote}`}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Stack>

        <Divider />

        {/* Section 2: OKR Goal Engine */}
        <Stack gap="xs">
          <Row justify="between" align="center" wrap>
            <Text variant="label">OKR 目标与关键结果拆解（支持一键步进打卡 + 晨重/训练/学习时长实时联动）</Text>
            <Text variant="caption" tone="muted">
              将宏大目标拆解为可量化、可每日推进的 Key Results
            </Text>
          </Row>

          <Stack gap="sm">
            {liveObjectives.map((obj) => {
              const objPct = computeObjectiveProgressPct(obj);
              const catMeta = OKR_CATEGORY_META[obj.category];
              return (
                <View
                  key={obj.id}
                  style={[
                    styles.okrCard,
                    cardSurfaceStyle(color.surface, color.line),
                    { borderColor: objPct >= 100 ? color.green : color.line },
                  ]}
                >
                  <Row justify="between" align="center" gap="sm" wrap>
                    <View style={{ flex: 1 }}>
                      <Row gap="xs" align="center" wrap>
                        <TagChip label={obj.period} tone="pod" />
                        <TagChip label={catMeta.label} tone={catMeta.tagTone} />
                        <Text variant="label">{obj.title}</Text>
                      </Row>
                    </View>
                    <Row gap="xs" align="center">
                      <TagChip
                        label={`信心 ${obj.confidence}/10 · 总进度 ${objPct}%`}
                        tone={objPct >= 80 ? 'exec' : 'owner'}
                      />
                      <CockpitPillButton
                        label="+ 追加 KR"
                        accessibilityLabel={`为 ${obj.title} 追加关键结果`}
                        onPress={() =>
                          setAddingKrForObjId((cur) => (cur === obj.id ? null : obj.id))
                        }
                      />
                      {liveObjectives.length > 1 ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`删除目标 ${obj.title}`}
                          onPress={() => removeOkrObjective(obj.id)}
                          style={styles.removeBtn}
                        >
                          <Text variant="caption" tone="muted">
                            ×
                          </Text>
                        </Pressable>
                      ) : null}
                    </Row>
                  </Row>

                  <ProgressBar value={objPct / 100} masked={false} />

                  {addingKrForObjId === obj.id ? (
                    <View
                      style={[
                        styles.subPanel,
                        { backgroundColor: color.pill, borderColor: color.lineSoft },
                      ]}
                    >
                      <Stack gap="xs">
                        <Row gap="sm" wrap>
                          <View style={{ flex: 2, minWidth: 180 }}>
                            <TextField
                              label="新关键结果 (KR) 标题"
                              value={subKrTitle}
                              onChangeText={setSubKrTitle}
                              placeholder="例如：每周完成 3 次有氧跑"
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 80 }}>
                            <TextField
                              label="目标值"
                              value={subKrTarget}
                              onChangeText={setSubKrTarget}
                              placeholder="20"
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 70 }}>
                            <TextField
                              label="单位"
                              value={subKrUnit}
                              onChangeText={setSubKrUnit}
                              placeholder="次"
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 80 }}>
                            <TextField
                              label="步进值"
                              value={subKrStep}
                              onChangeText={setSubKrStep}
                              placeholder="1"
                              keyboardType="decimal-pad"
                            />
                          </View>
                        </Row>
                        <Row gap="xs">
                          <Button label="确认追加 KR" onPress={() => onAddSubKr(obj.id)} />
                          <Button
                            label="取消"
                            variant="ghost"
                            onPress={() => setAddingKrForObjId(null)}
                          />
                        </Row>
                      </Stack>
                    </View>
                  ) : null}

                  <Stack gap="xs">
                    {obj.keyResults.map((kr) => {
                      const krPct = computeKrProgressPct(kr);
                      const checkedToday = kr.lastCheckInDay === localDay;
                      const stepSign = kr.stepDelta >= 0 ? `+${kr.stepDelta}` : `${kr.stepDelta}`;
                      return (
                        <View
                          key={kr.id}
                          style={[
                            styles.krRow,
                            {
                              borderColor: color.lineSoft,
                              backgroundColor: color.pill,
                            },
                          ]}
                        >
                          <Row justify="between" align="center" gap="sm" wrap>
                            <View style={{ flex: 1, minWidth: 200 }}>
                              <Row gap="xs" align="center" wrap>
                                <Text variant="body">{kr.title}</Text>
                                {kr.autoLink !== 'none' ? (
                                  <TagChip label="实时数据联动" tone="exec" />
                                ) : null}
                              </Row>
                              <Text variant="caption" tone="muted">
                                {`当前 ${kr.currentValue} ${kr.unit} / 目标 ${kr.targetValue} ${kr.unit}（起点 ${kr.startValue} ${kr.unit} · 完成 ${krPct}%）`}
                              </Text>
                            </View>
                            <Row gap="xs" align="center">
                              <CockpitPillButton
                                label={`打卡 ${stepSign}${kr.unit}`}
                                variant={checkedToday ? 'green' : 'accent'}
                                accessibilityLabel={`推进关键结果 ${kr.title}`}
                                onPress={() => {
                                  checkInKeyResult(obj.id, kr.id, kr.stepDelta, localDay);
                                  showToast({
                                    text: `OKR 已推进：${kr.title} (${stepSign} ${kr.unit})`,
                                  });
                                }}
                              />
                            </Row>
                          </Row>
                          <ProgressBar value={krPct / 100} masked={false} />
                        </View>
                      );
                    })}
                  </Stack>
                </View>
              );
            })}
          </Stack>
        </Stack>

        <Divider />

        {/* Section 3: Daily Habit Check-In & 7-Day Streak Matrix */}
        <Stack gap="xs">
          <Row justify="between" align="center" wrap>
            <Text variant="label">每日习惯打卡矩阵（近 7 日热力追踪 · 点击任意日期格或右侧按钮即时打卡）</Text>
            <Text variant="caption" tone="muted">
              用微习惯支撑 OKR 关键结果落地
            </Text>
          </Row>

          <View style={[styles.habitTable, { borderColor: color.line, backgroundColor: color.surface }]}>
            {habits.map((habit, idx) => {
              const stat = computeHabitStreak(habit, localDay);
              const catMeta = OKR_CATEGORY_META[habit.category];
              return (
                <View
                  key={habit.id}
                  style={[
                    styles.habitRow,
                    idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.lineSoft },
                  ]}
                >
                  <Row justify="between" align="center" gap="sm" wrap>
                    <View style={{ flex: 1, minWidth: 170 }}>
                      <Row gap="xs" align="center">
                        <TagChip label={catMeta.label} tone={catMeta.tagTone} />
                        <Text variant="label">{habit.title}</Text>
                      </Row>
                      <Text variant="caption" tone="muted">
                        {`连续 ${stat.streakDays} 天 · 近 7 日达标 ${stat.last7DaysCount}/${habit.weeklyTargetDays} 天`}
                      </Text>
                    </View>

                    <Row gap="xs" align="center" wrap>
                      {stat.last7DaysFlags.map((dayFlag) => {
                        const shortDay = dayFlag.localDay.slice(8);
                        const isToday = dayFlag.localDay === localDay;
                        return (
                          <Pressable
                            key={`${habit.id}-${dayFlag.localDay}`}
                            accessibilityRole="button"
                            accessibilityLabel={`${habit.title} ${dayFlag.localDay} ${dayFlag.completed ? '已打卡' : '未打卡'}`}
                            onPress={() => {
                              toggleHabitDay(habit.id, dayFlag.localDay);
                            }}
                            style={[
                              styles.habitDayDot,
                              {
                                backgroundColor: dayFlag.completed
                                  ? color.green
                                  : isToday
                                    ? color.accentSoft
                                    : color.pill,
                                borderColor: isToday ? color.accent : color.lineSoft,
                              },
                            ]}
                          >
                            <Text
                              variant="caption"
                              style={{
                                fontSize: 10,
                                color: dayFlag.completed ? color.onToast : color.ink,
                              }}
                            >
                              {dayFlag.completed ? '✓' : shortDay}
                            </Text>
                          </Pressable>
                        );
                      })}

                      <CockpitPillButton
                        label={stat.completedToday ? '✓ 今日已打卡' : '今日打卡'}
                        variant={stat.completedToday ? 'green' : 'accent'}
                        accessibilityLabel={`切换今日打卡 ${habit.title}`}
                        onPress={() => {
                          toggleHabitDay(habit.id, localDay);
                          if (!stat.completedToday) {
                            showToast({ text: `✓ 已完成今日「${habit.title}」打卡！` });
                          }
                        }}
                      />
                    </Row>
                  </Row>
                </View>
              );
            })}
          </View>
        </Stack>
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  subPanel: {
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  milestoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  milestoneCard: {
    flex: 1,
    minWidth: 250,
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    gap: 6,
  },
  prepBanner: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  okrCard: {
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    gap: theme.space.xs,
  },
  krRow: {
    padding: theme.space.xs,
    borderRadius: theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  habitTable: {
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    overflow: 'hidden',
  },
  habitRow: {
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
  },
  habitDayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
