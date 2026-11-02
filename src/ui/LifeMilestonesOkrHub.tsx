import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

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
import { recordPledgeReward } from '@/data/life-gamification';
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
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { Row, Stack } from './layout';
import { Text } from './Text';
import { TextField } from './TextField';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';

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

/**
 * 2.5D Isometric Miniature Emblem SVG for Milestone Cards
 */
function Milestone25DEmblemSvg({
  category,
  accent,
}: {
  category: MilestoneCategory;
  accent: string;
}) {
  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: accent,
          backgroundColor: '#1d1916',
        }}
      />
    );
  }

  return createElement(
    'svg',
    {
      width: 58,
      height: 58,
      viewBox: '0 0 64 64',
      fill: 'none',
      style: {
        filter: `drop-shadow(0 6px 12px rgba(0,0,0,0.55)) drop-shadow(0 0 8px ${accent}33)`,
      },
    },
    // Isometric 2.5D Pedestal Tile
    createElement('polygon', {
      points: '32,56 58,44 32,32 6,44',
      fill: '#2b241d',
      stroke: accent,
      strokeWidth: 1.3,
    }),
    createElement('polygon', {
      points: '6,44 32,56 32,61 6,49',
      fill: '#1a1511',
    }),
    createElement('polygon', {
      points: '58,44 32,56 32,61 58,49',
      fill: '#120f0c',
    }),
    category === 'love'
      ? createElement(
          'g',
          null,
          // 2.5D Intertwined Golden Rings & Faceted Ruby Gem
          createElement('ellipse', {
            cx: 27,
            cy: 34,
            rx: 9,
            ry: 5.5,
            transform: 'rotate(-18 27 34)',
            fill: 'none',
            stroke: '#fde68a',
            strokeWidth: 2.2,
          }),
          createElement('ellipse', {
            cx: 37,
            cy: 34,
            rx: 9,
            ry: 5.5,
            transform: 'rotate(18 37 34)',
            fill: 'none',
            stroke: '#f5b942',
            strokeWidth: 2.2,
          }),
          createElement('polygon', {
            points: '32,12 40,20 32,30 24,20',
            fill: '#e8924a',
            stroke: '#fef08a',
            strokeWidth: 1,
          }),
        )
      : category === 'countdown'
        ? createElement(
            'g',
            null,
            // 2.5D Golden Hourglass & Time Pillars
            createElement('ellipse', { cx: 32, cy: 14, rx: 11, ry: 4.5, fill: '#42321b', stroke: '#f5b942', strokeWidth: 1.5 }),
            createElement('ellipse', { cx: 32, cy: 40, rx: 11, ry: 4.5, fill: '#42321b', stroke: '#f5b942', strokeWidth: 1.5 }),
            createElement('path', {
              d: 'M23 15 L32 27 L41 15 M23 39 L32 27 L41 39',
              stroke: '#fde68a',
              strokeWidth: 1.6,
              fill: 'rgba(245, 185, 66, 0.22)',
            }),
            createElement('circle', { cx: 32, cy: 27, r: 2.5, fill: '#fef08a' }),
          )
        : createElement(
            'g',
            null,
            // 2.5D Celestial Polaris Star & Astrolabe Ring
            createElement('circle', {
              cx: 32,
              cy: 26,
              r: 13,
              fill: 'none',
              stroke: accent,
              strokeWidth: 1.8,
              strokeDasharray: '3 2',
            }),
            createElement('path', {
              d: 'M32 10 L35 22 L47 26 L35 30 L32 42 L29 30 L17 26 L29 22 Z',
              fill: '#fde68a',
            }),
          ),
  );
}

/**
 * 2.5D Dual-Ring Radial Gauge SVG for OKR Objective Cards
 */
function OkrRadialRingSvg({
  pct,
  confidence,
  accent,
}: {
  pct: number;
  confidence: number;
  accent: string;
}) {
  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          borderWidth: 3,
          borderColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="label" style={{ color: '#f5f5f4' }}>{`${pct}%`}</Text>
      </View>
    );
  }

  const radius = 29;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(4, Math.min(100, pct));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return createElement(
    'svg',
    {
      width: 78,
      height: 78,
      viewBox: '0 0 78 78',
      fill: 'none',
      style: {
        filter: `drop-shadow(0 0 10px ${accent}44)`,
      },
    },
    // Outer decorative compass ticks
    createElement('circle', {
      cx: 39,
      cy: 39,
      r: 35,
      fill: '#141210',
      stroke: 'rgba(255,248,235,0.10)',
      strokeWidth: 1,
      strokeDasharray: '2 4',
    }),
    // Track ring
    createElement('circle', {
      cx: 39,
      cy: 39,
      r: radius,
      fill: 'none',
      stroke: 'rgba(255,255,255,0.08)',
      strokeWidth: 5.5,
    }),
    // Glowing Progress Arc
    createElement('circle', {
      cx: 39,
      cy: 39,
      r: radius,
      fill: 'none',
      stroke: accent,
      strokeWidth: 5.5,
      strokeLinecap: 'round',
      strokeDasharray: `${circumference}`,
      strokeDashoffset: `${strokeDashoffset}`,
      transform: 'rotate(-90 39 39)',
    }),
    createElement(
      'text',
      {
        x: 39,
        y: 38,
        textAnchor: 'middle',
        fill: '#f5f5f4',
        fontSize: '14',
        fontWeight: '700',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      `${pct}%`,
    ),
    createElement(
      'text',
      {
        x: 39,
        y: 51,
        textAnchor: 'middle',
        fill: accent,
        fontSize: '8.5',
        fontWeight: '600',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      `信心 ${confidence}/10`,
    ),
  );
}

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
    <View style={styles.obsidianContainer}>
      {/* Top Command Bar */}
      <View style={styles.topHeaderBar}>
        <View style={styles.topHeaderLeft}>
          <View style={styles.goldPulseDot} />
          <Text variant="label" style={styles.mainHeaderTitle}>
            星轨纪念日 · OKR 双环指挥台 · 每日微习惯 3D 键帽舱
          </Text>
          <View style={styles.summaryPill}>
            <Text variant="caption" style={styles.summaryPillText}>
              {`OKR 总进度 ${avgOkrProgress}% · 今日习惯 ${habitsCompletedToday}/${habits.length}`}
            </Text>
          </View>
        </View>

        <View style={styles.topHeaderActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新增纪念日或重要倒数日"
            onPress={() => setMilestoneFormOpen((prev) => !prev)}
            style={styles.actionDarkPill}
          >
            <Text variant="caption" style={styles.actionDarkPillText}>
              ＋ 纪念日/倒数日
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新增季度或年度 OKR 目标"
            onPress={() => setOkrFormOpen((prev) => !prev)}
            style={styles.actionDarkPill}
          >
            <Text variant="caption" style={styles.actionDarkPillText}>
              ＋ 新增 OKR
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新增每日微习惯打卡项"
            onPress={() => setHabitFormOpen((prev) => !prev)}
            style={styles.actionGoldPill}
          >
            <Text variant="caption" style={styles.actionGoldPillText}>
              ＋ 打卡习惯
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.bodyPadding}>
        {/* Form 1: Add Milestone */}
        {milestoneFormOpen ? (
          <View style={[styles.formPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
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
          <View style={[styles.formPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
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
          <View style={[styles.formPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="xs">
              <Text variant="label">新增每日打卡习惯（3D 键帽矩阵追踪连击 Streak）</Text>
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

        {/* ================= SECTION 1: 2.5D 星轨纪念日与里程碑画廊 ================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.secHeaderRow}>
            <Text variant="label" style={styles.secTitleText}>
              2.5D 星轨纪念日与重要节点画廊
            </Text>
            <Text variant="caption" style={styles.secSubText}>
              自动推算周年倒数与 100 / 520 / 1000 天整数里程碑
            </Text>
          </View>

          <View style={styles.milestoneGalleryGrid}>
            {computedMilestones.map((ms, idx) => {
              const meta = MILESTONE_CATEGORY_META[ms.item.category];
              const accent =
                ms.item.category === 'love'
                  ? '#e8924a'
                  : ms.item.category === 'countdown'
                    ? '#f5b942'
                    : idx % 2 === 0
                      ? '#34d399'
                      : '#fde68a';
              const dayCountNumber =
                ms.daysUntilNext >= 0 ? ms.daysUntilNext : Math.abs(ms.elapsedDays);
              const dayCountCaption =
                ms.daysUntilNext > 0
                  ? 'DAYS LEFT'
                  : ms.daysUntilNext === 0
                    ? 'TODAY'
                    : 'DAYS ELAPSED';

              return (
                <View
                  key={ms.item.id}
                  style={[
                    styles.milestone3DCard,
                    { borderTopColor: accent },
                  ]}
                >
                  <View style={styles.msCardTop}>
                    <Milestone25DEmblemSvg category={ms.item.category} accent={accent} />

                    <View style={styles.msCardCenter}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.catBadge, { borderColor: `${accent}66` }]}>
                          <Text variant="caption" style={[styles.catBadgeText, { color: accent }]}>
                            {meta.label}
                          </Text>
                        </View>
                        {milestones.length > 1 ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`删除纪念日 ${ms.item.title}`}
                            onPress={() => removeLifeMilestone(ms.item.id)}
                          >
                            <Text variant="caption" style={{ color: '#78716c', fontSize: 12 }}>
                              ×
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <Text variant="label" style={styles.msTitleText} numberOfLines={1}>
                        {ms.item.title}
                      </Text>
                      <Text variant="caption" style={styles.msSubtitleText} numberOfLines={1}>
                        {ms.subtitleText}
                      </Text>
                    </View>

                    {/* Sculpted Flip-Counter Number Box */}
                    <View style={[styles.flipCounterBox, { borderColor: `${accent}55` }]}>
                      <Text variant="heading" style={[styles.flipNumberText, { color: accent }]}>
                        {dayCountNumber}
                      </Text>
                      <Text variant="caption" style={styles.flipUnitText}>
                        {dayCountCaption}
                      </Text>
                    </View>
                  </View>

                  {ms.item.prepNote ? (
                    <View style={styles.msPrepCapsule}>
                      <Text variant="caption" style={styles.msPrepIcon}>
                        ✦
                      </Text>
                      <Text variant="caption" style={styles.msPrepText} numberOfLines={1}>
                        {ms.item.prepNote}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* ================= SECTION 2: OKR 双舱星环指挥台 (2.5D Radial Ring + Segmented LED Energy Bars) ================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.secHeaderRow}>
            <Text variant="label" style={styles.secTitleText}>
              OKR 目标与关键结果星环指挥台
            </Text>
            <Text variant="caption" style={styles.secSubText}>
              支持晨重 / 训练 / 学习时长实时联动 + 16 段能量槽打卡推进
            </Text>
          </View>

          <View style={styles.okrBentoGrid}>
            {liveObjectives.map((obj, objIdx) => {
              const objPct = computeObjectiveProgressPct(obj);
              const catMeta = OKR_CATEGORY_META[obj.category];
              const ringAccent = objIdx % 2 === 0 ? '#f5b942' : '#34d399';

              return (
                <View
                  key={obj.id}
                  style={[
                    styles.okrCommandPod,
                    { borderColor: objPct >= 100 ? '#34d399' : 'rgba(245, 185, 66, 0.22)' },
                  ]}
                >
                  {/* Pod Top Header with 2.5D Radial Ring Gauge */}
                  <View style={styles.okrPodHead}>
                    <OkrRadialRingSvg
                      pct={objPct}
                      confidence={obj.confidence}
                      accent={ringAccent}
                    />

                    <View style={styles.okrPodTitleWrap}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <View style={styles.periodBadge}>
                          <Text variant="caption" style={styles.periodBadgeText}>
                            {obj.period}
                          </Text>
                        </View>
                        <View style={[styles.catBadge, { borderColor: `${ringAccent}66` }]}>
                          <Text variant="caption" style={[styles.catBadgeText, { color: ringAccent }]}>
                            {catMeta.label}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`为 ${obj.title} 追加关键结果`}
                          onPress={() =>
                            setAddingKrForObjId((cur) => (cur === obj.id ? null : obj.id))
                          }
                          style={styles.addKrMiniBtn}
                        >
                          <Text variant="caption" style={styles.addKrMiniBtnText}>
                            ＋ 追加 KR
                          </Text>
                        </Pressable>
                        {liveObjectives.length > 1 ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`删除目标 ${obj.title}`}
                            onPress={() => removeOkrObjective(obj.id)}
                          >
                            <Text variant="caption" style={{ color: '#78716c', fontSize: 12 }}>
                              ×
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>

                      <Text variant="label" style={styles.okrPodTitleText}>
                        {obj.title}
                      </Text>
                    </View>
                  </View>

                  {addingKrForObjId === obj.id ? (
                    <View
                      style={[
                        styles.formPanel,
                        { backgroundColor: color.surface, borderColor: color.line },
                      ]}
                    >
                      <Stack gap="xs">
                        <Row gap="sm" wrap>
                          <View style={{ flex: 2, minWidth: 160 }}>
                            <TextField
                              label="新关键结果 (KR) 标题"
                              value={subKrTitle}
                              onChangeText={setSubKrTitle}
                              placeholder="例如：每周完成 3 次有氧跑"
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 70 }}>
                            <TextField
                              label="目标值"
                              value={subKrTarget}
                              onChangeText={setSubKrTarget}
                              placeholder="20"
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 65 }}>
                            <TextField
                              label="单位"
                              value={subKrUnit}
                              onChangeText={setSubKrUnit}
                              placeholder="次"
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 70 }}>
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

                  {/* Key Results with 16-Segment Glowing LED Energy Bars */}
                  <View style={{ gap: 8 }}>
                    {obj.keyResults.map((kr, krIdx) => {
                      const krPct = computeKrProgressPct(kr);
                      const stepSign = kr.stepDelta >= 0 ? `+${kr.stepDelta}` : `${kr.stepDelta}`;
                      const segAccent = krIdx % 2 === 0 ? ringAccent : '#e8924a';
                      const filledSegments = Math.round((krPct / 100) * 16);

                      return (
                        <View key={kr.id} style={styles.krTelemetrySlot}>
                          <View style={styles.krTopRow}>
                            <View style={{ flex: 1, gap: 2 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text variant="label" style={styles.krTitleText}>
                                  {kr.title}
                                </Text>
                                {kr.autoLink !== 'none' ? (
                                  <View style={styles.liveLinkBadge}>
                                    <Text variant="caption" style={styles.liveLinkBadgeText}>
                                      ⚡ 实时数据联动
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text variant="caption" style={styles.krTrajectoryText}>
                                {`起点 ${kr.startValue}${kr.unit} ──▸ 当前 ${kr.currentValue}${kr.unit} ──▸ 目标 ${kr.targetValue}${kr.unit} (${krPct}%)`}
                              </Text>
                            </View>

                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`推进关键结果 ${kr.title}`}
                              onPress={() => {
                                checkInKeyResult(obj.id, kr.id, kr.stepDelta, localDay);
                                const v = recordPledgeReward(`OKR 推进奖励：${kr.title}`, localDay);
                                showToast({
                                  text: `OKR 已推进：${kr.title} (${stepSign} ${kr.unit}) · 心愿金库 +¥${v.config.checkInRewardCny}`,
                                });
                              }}
                              style={({ pressed }) => [
                                styles.krAdvanceBtn,
                                {
                                  borderColor: segAccent,
                                  opacity: pressed ? 0.85 : 1,
                                },
                              ]}
                            >
                              <Text
                                variant="caption"
                                style={[styles.krAdvanceBtnText, { color: segAccent }]}
                              >
                                {`打卡 ${stepSign}${kr.unit}`}
                              </Text>
                            </Pressable>
                          </View>

                          {/* 16-Segment Glowing LED Energy Bar */}
                          <View style={styles.segmentedBarRow}>
                            {Array.from({ length: 16 }, (_, sIdx) => {
                              const lit = sIdx < filledSegments;
                              return (
                                <View
                                  key={`${kr.id}-seg-${sIdx}`}
                                  style={[
                                    styles.energySegment,
                                    {
                                      backgroundColor: lit
                                        ? segAccent
                                        : 'rgba(255, 255, 255, 0.06)',
                                    },
                                    lit && Platform.OS === 'web'
                                      ? ({
                                          boxShadow: `0 0 8px ${segAccent}88`,
                                        } as unknown as ViewStyle)
                                      : null,
                                  ]}
                                />
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ================= SECTION 3: 每日微习惯 3D 键帽打卡舱 (2x2 Bento + 3D Keycap Tiles) ================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.secHeaderRow}>
            <Text variant="label" style={styles.secTitleText}>
              每日微习惯 3D 键帽打卡舱
            </Text>
            <Text variant="caption" style={styles.secSubText}>
              点击任意 3D 日期键帽或右侧按钮点亮今日连击（每次打卡自动注入 +¥50 心愿奖励）
            </Text>
          </View>

          <View style={styles.habitBentoGrid}>
            {habits.map((habit, hIdx) => {
              const stat = computeHabitStreak(habit, localDay);
              const catMeta = OKR_CATEGORY_META[habit.category];
              const accent =
                hIdx % 3 === 0 ? '#34d399' : hIdx % 3 === 1 ? '#f5b942' : '#e8924a';
              const weeklyPct = Math.min(
                100,
                Math.round((stat.last7DaysCount / Math.max(1, habit.weeklyTargetDays)) * 100),
              );

              return (
                <View
                  key={habit.id}
                  style={[
                    styles.habitPodCard,
                    stat.completedToday ? { borderColor: `${accent}88` } : null,
                  ]}
                >
                  <View style={styles.habitPodTop}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.catBadge, { borderColor: `${accent}66` }]}>
                          <Text variant="caption" style={[styles.catBadgeText, { color: accent }]}>
                            {catMeta.label}
                          </Text>
                        </View>
                        <View style={styles.streakFlamePill}>
                          <Text variant="caption" style={styles.streakFlameText}>
                            {`🔥 连击 ${stat.streakDays} 天 · 本周 ${stat.last7DaysCount}/${habit.weeklyTargetDays}`}
                          </Text>
                        </View>
                      </View>
                      <Text variant="label" style={styles.habitPodTitle}>
                        {habit.title}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`切换今日打卡 ${habit.title}`}
                      onPress={() => {
                        toggleHabitDay(habit.id, localDay);
                        if (!stat.completedToday) {
                          const v = recordPledgeReward(`每日习惯打卡：${habit.title}`, localDay);
                          showToast({
                            text: `✓ 已点亮今日「${habit.title}」· 心愿金库 +¥${v.config.checkInRewardCny}！`,
                          });
                        }
                      }}
                      style={[
                        styles.habitCheckBtn,
                        stat.completedToday
                          ? { backgroundColor: 'rgba(52, 211, 153, 0.20)', borderColor: '#34d399' }
                          : { backgroundColor: '#29231d', borderColor: accent },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: stat.completedToday ? '#34d399' : '#fde68a',
                          fontWeight: '700',
                          fontSize: 11.5,
                        }}
                      >
                        {stat.completedToday ? '✓ 今日已点亮' : '⚡ 今日打卡'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* 7-Day 3D Keycap Tiles Row */}
                  <View style={styles.keycapRow}>
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
                            styles.dayKeycap,
                            dayFlag.completed
                              ? {
                                  backgroundColor: accent,
                                  borderColor: '#fef08a',
                                  borderBottomWidth: 3,
                                }
                              : isToday
                                ? {
                                    backgroundColor: '#29241e',
                                    borderColor: accent,
                                    borderBottomWidth: 3,
                                  }
                                : {
                                    backgroundColor: '#171513',
                                    borderColor: 'rgba(255,255,255,0.10)',
                                    borderBottomWidth: 3,
                                  },
                          ]}
                        >
                          <Text
                            variant="caption"
                            style={{
                              fontSize: 10.5,
                              fontWeight: '700',
                              fontFamily: theme.fontFamily.mono,
                              color: dayFlag.completed
                                ? '#0f1412'
                                : isToday
                                  ? '#fde68a'
                                  : '#a8a29e',
                            }}
                          >
                            {dayFlag.completed ? '✓' : shortDay}
                          </Text>
                          <Text
                            variant="caption"
                            style={{
                              fontSize: 8.5,
                              color: dayFlag.completed ? '#18181b' : '#78716c',
                            }}
                          >
                            {isToday ? '今日' : `${dayFlag.localDay.slice(5, 7)}/${shortDay}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Mini Weekly Completion Bar */}
                  <View style={styles.habitMiniTrack}>
                    <View
                      style={[
                        styles.habitMiniFill,
                        { width: `${Math.max(6, weeklyPct)}%`, backgroundColor: accent },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  obsidianContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 185, 66, 0.24)',
    backgroundColor: '#121110',
    overflow: 'hidden',
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1613',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 248, 235, 0.08)',
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  goldPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f5b942',
  },
  mainHeaderTitle: {
    color: '#f5f5f4',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 185, 66, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 185, 66, 0.38)',
  },
  summaryPillText: {
    color: '#fde68a',
    fontSize: 10.5,
    fontWeight: '600',
    fontFamily: theme.fontFamily.mono,
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionDarkPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#26221e',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.14)',
  },
  actionDarkPillText: {
    color: '#e7e5e4',
    fontSize: 11.5,
    fontWeight: '600',
  },
  actionGoldPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#362919',
    borderWidth: 1,
    borderColor: '#f5b942',
  },
  actionGoldPillText: {
    color: '#fde68a',
    fontSize: 11.5,
    fontWeight: '700',
  },
  bodyPadding: {
    padding: 14,
    gap: 16,
  },
  formPanel: {
    padding: theme.space.sm,
    borderRadius: 10,
    borderWidth: 1,
  },
  sectionBlock: {
    gap: 10,
  },
  secHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  secTitleText: {
    color: '#f5f5f4',
    fontSize: 13.5,
    fontWeight: '700',
  },
  secSubText: {
    color: '#a8a29e',
    fontSize: 11,
  },
  // Section 1: 2.5D Milestone Gallery
  milestoneGalleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  milestone3DCard: {
    flex: 1,
    minWidth: 275,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.10)',
    borderTopWidth: 2.5,
    backgroundColor: '#181614',
    padding: 12,
    gap: 10,
  },
  msCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  msCardCenter: {
    flex: 1,
    gap: 3,
  },
  catBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 248, 235, 0.05)',
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  msTitleText: {
    color: '#f5f5f4',
    fontSize: 13.5,
    fontWeight: '700',
  },
  msSubtitleText: {
    color: '#a8a29e',
    fontSize: 10.5,
  },
  flipCounterBox: {
    minWidth: 68,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#100e0c',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipNumberText: {
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: theme.fontFamily.mono,
  },
  flipUnitText: {
    color: '#78716c',
    fontSize: 8.5,
    fontWeight: '700',
    fontFamily: theme.fontFamily.mono,
    letterSpacing: 0.4,
  },
  msPrepCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#211d19',
    borderWidth: 1,
    borderColor: 'rgba(245, 185, 66, 0.18)',
  },
  msPrepIcon: {
    color: '#f5b942',
    fontSize: 11,
  },
  msPrepText: {
    color: '#d6d3d1',
    fontSize: 11,
    flex: 1,
  },
  // Section 2: OKR Dual-Pod Command Deck
  okrBentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  okrCommandPod: {
    flex: 1,
    minWidth: 330,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#181614',
    padding: 14,
    gap: 12,
  },
  okrPodHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 248, 235, 0.07)',
  },
  okrPodTitleWrap: {
    flex: 1,
    gap: 6,
  },
  periodBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 5,
    backgroundColor: '#27231f',
  },
  periodBadgeText: {
    color: '#d6d3d1',
    fontSize: 10,
    fontFamily: theme.fontFamily.mono,
    fontWeight: '600',
  },
  addKrMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#27231f',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.14)',
  },
  addKrMiniBtnText: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '600',
  },
  okrPodTitleText: {
    color: '#f5f5f4',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  krTelemetrySlot: {
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#11100e',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.08)',
    gap: 8,
  },
  krTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  krTitleText: {
    color: '#f5f5f4',
    fontSize: 12.5,
    fontWeight: '600',
  },
  liveLinkBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.38)',
  },
  liveLinkBadgeText: {
    color: '#34d399',
    fontSize: 9.5,
    fontWeight: '600',
  },
  krTrajectoryText: {
    color: '#a8a29e',
    fontSize: 10.5,
    fontFamily: theme.fontFamily.mono,
  },
  krAdvanceBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#231e19',
    borderWidth: 1,
  },
  krAdvanceBtnText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: theme.fontFamily.mono,
  },
  segmentedBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  energySegment: {
    flex: 1,
    height: 6,
    borderRadius: 2,
  },
  // Section 3: 3D Keycap Habit Matrix
  habitBentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  habitPodCard: {
    flex: 1,
    minWidth: 310,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.10)',
    backgroundColor: '#181614',
    padding: 12,
    gap: 10,
  },
  habitPodTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  streakFlamePill: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 5,
    backgroundColor: 'rgba(245, 185, 66, 0.12)',
  },
  streakFlameText: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '600',
  },
  habitPodTitle: {
    color: '#f5f5f4',
    fontSize: 13.5,
    fontWeight: '700',
  },
  habitCheckBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  keycapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayKeycap: {
    flex: 1,
    minWidth: 36,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  habitMiniTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  habitMiniFill: {
    height: '100%',
    borderRadius: 999,
  },
});
