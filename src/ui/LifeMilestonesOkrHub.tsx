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
 * Seamlessly adapts between Obsidian Gold (dark) and Sunlit Warm Parchment (light).
 */
function Milestone25DEmblemSvg({
  category,
  accent,
  isDark,
}: {
  category: MilestoneCategory;
  accent: string;
  isDark: boolean;
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
          backgroundColor: isDark ? '#1d1916' : '#f4eedf',
        }}
      />
    );
  }

  const pedestalTop = isDark ? '#2b241d' : '#f3ebdc';
  const pedestalLeft = isDark ? '#1a1511' : '#e4d9c5';
  const pedestalRight = isDark ? '#120f0c' : '#d5c6ac';
  const goldHighlight = isDark ? '#fde68a' : '#b88228';
  const goldMid = isDark ? '#f5b942' : '#d99b38';
  const hourglassFill = isDark ? '#42321b' : '#f8f0df';

  return createElement(
    'svg',
    {
      width: 58,
      height: 58,
      viewBox: '0 0 64 64',
      fill: 'none',
      style: {
        filter: isDark
          ? `drop-shadow(0 6px 12px rgba(0,0,0,0.55)) drop-shadow(0 0 8px ${accent}33)`
          : `drop-shadow(0 4px 10px rgba(38, 36, 31, 0.12))`,
      },
    },
    createElement('polygon', {
      points: '32,56 58,44 32,32 6,44',
      fill: pedestalTop,
      stroke: accent,
      strokeWidth: 1.3,
    }),
    createElement('polygon', {
      points: '6,44 32,56 32,61 6,49',
      fill: pedestalLeft,
    }),
    createElement('polygon', {
      points: '58,44 32,56 32,61 58,49',
      fill: pedestalRight,
    }),
    category === 'love'
      ? createElement(
          'g',
          null,
          createElement('ellipse', {
            cx: 27,
            cy: 34,
            rx: 9,
            ry: 5.5,
            transform: 'rotate(-18 27 34)',
            fill: 'none',
            stroke: goldHighlight,
            strokeWidth: 2.2,
          }),
          createElement('ellipse', {
            cx: 37,
            cy: 34,
            rx: 9,
            ry: 5.5,
            transform: 'rotate(18 37 34)',
            fill: 'none',
            stroke: goldMid,
            strokeWidth: 2.2,
          }),
          createElement('polygon', {
            points: '32,12 40,20 32,30 24,20',
            fill: '#e8924a',
            stroke: goldHighlight,
            strokeWidth: 1,
          }),
        )
      : category === 'countdown'
        ? createElement(
            'g',
            null,
            createElement('ellipse', {
              cx: 32,
              cy: 14,
              rx: 11,
              ry: 4.5,
              fill: hourglassFill,
              stroke: goldMid,
              strokeWidth: 1.5,
            }),
            createElement('ellipse', {
              cx: 32,
              cy: 40,
              rx: 11,
              ry: 4.5,
              fill: hourglassFill,
              stroke: goldMid,
              strokeWidth: 1.5,
            }),
            createElement('path', {
              d: 'M23 15 L32 27 L41 15 M23 39 L32 27 L41 39',
              stroke: goldHighlight,
              strokeWidth: 1.6,
              fill: 'rgba(245, 185, 66, 0.22)',
            }),
            createElement('circle', { cx: 32, cy: 27, r: 2.5, fill: goldMid }),
          )
        : createElement(
            'g',
            null,
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
              fill: goldMid,
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
  isDark,
}: {
  pct: number;
  confidence: number;
  accent: string;
  isDark: boolean;
}) {
  const textFill = isDark ? '#f5f5f4' : '#26241f';
  const discFill = isDark ? '#141210' : '#f7f3ea';
  const outerStroke = isDark ? 'rgba(255,248,235,0.10)' : 'rgba(38, 36, 31, 0.12)';
  const trackStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(38, 36, 31, 0.10)';

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
        <Text variant="label" style={{ color: textFill }}>{`${pct}%`}</Text>
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
        filter: isDark
          ? `drop-shadow(0 0 10px ${accent}44)`
          : `drop-shadow(0 3px 8px rgba(38, 36, 31, 0.08))`,
      },
    },
    createElement('circle', {
      cx: 39,
      cy: 39,
      r: 35,
      fill: discFill,
      stroke: outerStroke,
      strokeWidth: 1,
      strokeDasharray: '2 4',
    }),
    createElement('circle', {
      cx: 39,
      cy: 39,
      r: radius,
      fill: 'none',
      stroke: trackStroke,
      strokeWidth: 5.5,
    }),
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
        fill: textFill,
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
  const { color, scheme } = useTheme();
  const isDark = scheme === 'dark';

  // Unified Adaptive Palette: Warm Parchment in light mode, Obsidian & Molten Gold in dark mode
  const pal = isDark
    ? {
        containerBg: '#121110',
        containerBorder: 'rgba(245, 185, 66, 0.28)',
        headerBg: '#171513',
        headerBorder: 'rgba(255, 248, 235, 0.08)',
        titleText: '#fafaf9',
        subText: '#a8a29e',
        mutedText: '#78716c',
        cardBg: '#191714',
        cardBorder: 'rgba(255, 248, 235, 0.10)',
        cardRecessedBg: '#13110f',
        cardRecessedBorder: 'rgba(255, 248, 235, 0.07)',
        pillBg: 'rgba(245, 185, 66, 0.12)',
        pillBorder: 'rgba(245, 185, 66, 0.35)',
        pillText: '#fde68a',
        actionBtnBg: '#211e1a',
        actionBtnBorder: 'rgba(255, 248, 235, 0.14)',
        actionBtnText: '#e7e5e4',
        goldPrimary: '#f5b942',
        goldLight: '#fde68a',
        emeraldPrimary: '#34d399',
        amberPrimary: '#e8924a',
        segmentOffBg: 'rgba(255, 255, 255, 0.06)',
        keycapOffTop: '#24201c',
        keycapOffLip: '#15120f',
        keycapOffBorder: 'rgba(255, 248, 235, 0.10)',
        keycapOnTop: '#16382b',
        keycapOnLip: '#0c231b',
        keycapOnBorder: '#34d399',
        keycapOnText: '#a7f3d0',
      }
    : {
        containerBg: '#FFFFFF',
        containerBorder: '#E7E2D6',
        headerBg: '#F9F6EE',
        headerBorder: '#E7E2D6',
        titleText: '#26241F',
        subText: '#5F5B52',
        mutedText: '#8C867A',
        cardBg: '#FBFAF6',
        cardBorder: '#E7E2D6',
        cardRecessedBg: '#F3EFE4',
        cardRecessedBorder: '#E3DEC9',
        pillBg: '#F6EBD8',
        pillBorder: '#DFC496',
        pillText: '#8E6116',
        actionBtnBg: '#FFFFFF',
        actionBtnBorder: '#DCD5C6',
        actionBtnText: '#26241F',
        goldPrimary: '#B88228',
        goldLight: '#9A6B1E',
        emeraldPrimary: '#1F5E4B',
        amberPrimary: '#CC785C',
        segmentOffBg: 'rgba(38, 36, 31, 0.09)',
        keycapOffTop: '#FFFFFF',
        keycapOffLip: '#DFD8C8',
        keycapOffBorder: '#DCD5C6',
        keycapOnTop: '#E2F2EC',
        keycapOnLip: '#B7D9CD',
        keycapOnBorder: '#1F5E4B',
        keycapOnText: '#144435',
      };

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
    <View
      style={[
        styles.obsidianContainer,
        {
          backgroundColor: pal.containerBg,
          borderColor: pal.containerBorder,
        },
      ]}
    >
      {/* Top Command Bar */}
      <View
        style={[
          styles.topHeaderBar,
          {
            backgroundColor: pal.headerBg,
            borderBottomColor: pal.headerBorder,
          },
        ]}
      >
        <View style={styles.topHeaderLeft}>
          <View style={[styles.goldPulseDot, { backgroundColor: pal.goldPrimary }]} />
          <Text variant="label" style={[styles.mainHeaderTitle, { color: pal.titleText }]}>
            星轨纪念日 · OKR 双环指挥台 · 每日微习惯 3D 键帽舱
          </Text>
          <View
            style={[
              styles.summaryPill,
              { backgroundColor: pal.pillBg, borderColor: pal.pillBorder },
            ]}
          >
            <Text variant="caption" style={[styles.summaryPillText, { color: pal.pillText }]}>
              {`OKR 总进度 ${avgOkrProgress}% · 今日习惯 ${habitsCompletedToday}/${habits.length}`}
            </Text>
          </View>
        </View>

        <View style={styles.topHeaderActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新增纪念日或重要倒数日"
            onPress={() => setMilestoneFormOpen((prev) => !prev)}
            style={[
              styles.actionDarkPill,
              { backgroundColor: pal.actionBtnBg, borderColor: pal.actionBtnBorder },
            ]}
          >
            <Text variant="caption" style={[styles.actionDarkPillText, { color: pal.actionBtnText }]}>
              ＋ 纪念日/倒数日
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新增季度或年度 OKR 目标"
            onPress={() => setOkrFormOpen((prev) => !prev)}
            style={[
              styles.actionDarkPill,
              { backgroundColor: pal.actionBtnBg, borderColor: pal.actionBtnBorder },
            ]}
          >
            <Text variant="caption" style={[styles.actionDarkPillText, { color: pal.actionBtnText }]}>
              ＋ 新增 OKR
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新增每日微习惯打卡项"
            onPress={() => setHabitFormOpen((prev) => !prev)}
            style={[
              styles.actionGoldPill,
              { backgroundColor: pal.pillBg, borderColor: pal.pillBorder },
            ]}
          >
            <Text variant="caption" style={[styles.actionGoldPillText, { color: pal.pillText }]}>
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
            <Text variant="label" style={[styles.secTitleText, { color: pal.titleText }]}>
              2.5D 星轨纪念日与重要节点画廊
            </Text>
            <Text variant="caption" style={[styles.secSubText, { color: pal.mutedText }]}>
              自动推算周年倒数与 100 / 520 / 1000 天整数里程碑
            </Text>
          </View>

          <View style={styles.milestoneGalleryGrid}>
            {computedMilestones.map((ms, idx) => {
              const meta = MILESTONE_CATEGORY_META[ms.item.category];
              const accent =
                ms.item.category === 'love'
                  ? pal.amberPrimary
                  : ms.item.category === 'countdown'
                    ? pal.goldPrimary
                    : idx % 2 === 0
                      ? pal.emeraldPrimary
                      : pal.goldLight;
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
                    {
                      backgroundColor: pal.cardBg,
                      borderColor: pal.cardBorder,
                      borderTopColor: accent,
                    },
                  ]}
                >
                  <View style={styles.msCardTop}>
                    <Milestone25DEmblemSvg
                      category={ms.item.category}
                      accent={accent}
                      isDark={isDark}
                    />

                    <View style={styles.msCardCenter}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={[
                            styles.catBadge,
                            {
                              backgroundColor: pal.cardRecessedBg,
                              borderColor: `${accent}66`,
                            },
                          ]}
                        >
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
                            <Text variant="caption" style={{ color: pal.mutedText, fontSize: 12 }}>
                              ×
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <Text
                        variant="label"
                        style={[styles.msTitleText, { color: pal.titleText }]}
                        numberOfLines={1}
                      >
                        {ms.item.title}
                      </Text>
                      <Text
                        variant="caption"
                        style={[styles.msSubtitleText, { color: pal.subText }]}
                        numberOfLines={1}
                      >
                        {ms.subtitleText}
                      </Text>
                    </View>

                    {/* Sculpted Flip-Counter Number Box */}
                    <View
                      style={[
                        styles.flipCounterBox,
                        {
                          backgroundColor: pal.cardRecessedBg,
                          borderColor: `${accent}55`,
                        },
                      ]}
                    >
                      <Text variant="heading" style={[styles.flipNumberText, { color: accent }]}>
                        {dayCountNumber}
                      </Text>
                      <Text variant="caption" style={[styles.flipUnitText, { color: pal.mutedText }]}>
                        {dayCountCaption}
                      </Text>
                    </View>
                  </View>

                  {ms.item.prepNote ? (
                    <View
                      style={[
                        styles.msPrepCapsule,
                        {
                          backgroundColor: pal.cardRecessedBg,
                          borderColor: pal.cardRecessedBorder,
                        },
                      ]}
                    >
                      <Text variant="caption" style={[styles.msPrepIcon, { color: pal.goldPrimary }]}>
                        ✦
                      </Text>
                      <Text
                        variant="caption"
                        style={[styles.msPrepText, { color: pal.subText }]}
                        numberOfLines={1}
                      >
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
            <Text variant="label" style={[styles.secTitleText, { color: pal.titleText }]}>
              OKR 目标与关键结果星环指挥台
            </Text>
            <Text variant="caption" style={[styles.secSubText, { color: pal.mutedText }]}>
              支持晨重 / 训练 / 学习时长实时联动 + 16 段能量槽打卡推进
            </Text>
          </View>

          <View style={styles.okrBentoGrid}>
            {liveObjectives.map((obj, objIdx) => {
              const objPct = computeObjectiveProgressPct(obj);
              const catMeta = OKR_CATEGORY_META[obj.category];
              const ringAccent = objIdx % 2 === 0 ? pal.goldPrimary : pal.emeraldPrimary;

              return (
                <View
                  key={obj.id}
                  style={[
                    styles.okrCommandPod,
                    {
                      backgroundColor: pal.cardBg,
                      borderColor: objPct >= 100 ? pal.emeraldPrimary : pal.cardBorder,
                    },
                  ]}
                >
                  {/* Pod Top Header with 2.5D Radial Ring Gauge */}
                  <View style={styles.okrPodHead}>
                    <OkrRadialRingSvg
                      pct={objPct}
                      confidence={obj.confidence}
                      accent={ringAccent}
                      isDark={isDark}
                    />

                    <View style={styles.okrPodTitleWrap}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <View
                          style={[
                            styles.periodBadge,
                            { backgroundColor: pal.pillBg, borderColor: pal.pillBorder },
                          ]}
                        >
                          <Text variant="caption" style={[styles.periodBadgeText, { color: pal.pillText }]}>
                            {obj.period}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.catBadge,
                            {
                              backgroundColor: pal.cardRecessedBg,
                              borderColor: `${ringAccent}66`,
                            },
                          ]}
                        >
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
                          style={[
                            styles.addKrMiniBtn,
                            {
                              backgroundColor: pal.actionBtnBg,
                              borderColor: pal.actionBtnBorder,
                            },
                          ]}
                        >
                          <Text
                            variant="caption"
                            style={[styles.addKrMiniBtnText, { color: pal.subText }]}
                          >
                            ＋ 追加 KR
                          </Text>
                        </Pressable>
                        {liveObjectives.length > 1 ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`删除目标 ${obj.title}`}
                            onPress={() => removeOkrObjective(obj.id)}
                          >
                            <Text variant="caption" style={{ color: pal.mutedText, fontSize: 12 }}>
                              ×
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>

                      <Text variant="label" style={[styles.okrPodTitleText, { color: pal.titleText }]}>
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

                  {/* Key Results with 16-Segment LED Energy Bars */}
                  <View style={styles.krListStack}>
                    {obj.keyResults.map((kr, krIdx) => {
                      const krPct = computeKrProgressPct(kr);
                      const isAuto = kr.autoLink && kr.autoLink !== 'none';
                      const totalSegments = 16;
                      const litSegments = Math.round((krPct / 100) * totalSegments);
                      const segColor =
                        krPct >= 100
                          ? pal.emeraldPrimary
                          : krIdx % 2 === 0
                            ? pal.goldPrimary
                            : pal.emeraldPrimary;

                      return (
                        <View
                          key={kr.id}
                          style={[
                            styles.krDarkRowCard,
                            {
                              backgroundColor: pal.cardRecessedBg,
                              borderColor: pal.cardRecessedBorder,
                            },
                          ]}
                        >
                          <View style={styles.krRowTop}>
                            <View style={styles.krTitleLeft}>
                              <View style={[styles.krIndexBadge, { borderColor: `${segColor}66` }]}>
                                <Text
                                  variant="caption"
                                  style={[styles.krIndexBadgeText, { color: segColor }]}
                                >
                                  {`KR${krIdx + 1}`}
                                </Text>
                              </View>
                              <Text
                                variant="body"
                                style={[styles.krTitleText, { color: pal.titleText }]}
                                numberOfLines={1}
                              >
                                {kr.title}
                              </Text>
                              {isAuto ? (
                                <View
                                  style={[
                                    styles.autoSyncTag,
                                    {
                                      backgroundColor: isDark
                                        ? 'rgba(52, 211, 153, 0.14)'
                                        : '#E2F2EC',
                                      borderColor: pal.emeraldPrimary,
                                    },
                                  ]}
                                >
                                  <Text
                                    variant="caption"
                                    style={[
                                      styles.autoSyncTagText,
                                      { color: pal.emeraldPrimary },
                                    ]}
                                  >
                                    ⚡ 实时联动
                                  </Text>
                                </View>
                              ) : null}
                            </View>

                            <View style={styles.krRightControls}>
                              <Text
                                variant="caption"
                                style={[styles.krNumbersText, { color: pal.subText }]}
                              >
                                {`${kr.currentValue} / ${kr.targetValue} ${kr.unit}`}
                              </Text>
                              <Text
                                variant="caption"
                                style={[styles.krPctHighlight, { color: segColor }]}
                              >
                                {`${krPct}%`}
                              </Text>
                              {!isAuto ? (
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`打卡推进 ${kr.title}`}
                                  onPress={() => {
                                    checkInKeyResult(obj.id, kr.id, kr.stepDelta, localDay);
                                    recordPledgeReward(`KR 打卡推进：${kr.title}`, localDay);
                                    showToast({
                                      text: `KR 打卡推进：${kr.title} (${kr.stepDelta > 0 ? '+' : ''}${kr.stepDelta}${kr.unit}) · 已入账心愿金`,
                                    });
                                  }}
                                  style={[
                                    styles.krStep3DBtn,
                                    {
                                      backgroundColor: pal.pillBg,
                                      borderColor: pal.pillBorder,
                                    },
                                  ]}
                                >
                                  <Text
                                    variant="caption"
                                    style={[styles.krStep3DBtnText, { color: pal.pillText }]}
                                  >
                                    {`打卡 ${kr.stepDelta > 0 ? '+' : ''}${kr.stepDelta}${kr.unit}`}
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>

                          {/* 16-Segment Illuminated Energy Bar */}
                          <View style={styles.segmentedBarRow}>
                            {Array.from({ length: totalSegments }, (_, segIdx) => {
                              const lit = segIdx < litSegments;
                              return (
                                <View
                                  key={segIdx}
                                  style={[
                                    styles.energySegmentCell,
                                    lit
                                      ? {
                                          backgroundColor: segColor,
                                          borderColor: segColor,
                                        }
                                      : {
                                          backgroundColor: pal.segmentOffBg,
                                          borderColor: 'transparent',
                                        },
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

        {/* ================= SECTION 3: 每日微习惯 3D 机械键帽打卡矩阵 ================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.secHeaderRow}>
            <Text variant="label" style={[styles.secTitleText, { color: pal.titleText }]}>
              每日微习惯 3D 机械键帽矩阵（近 7 日连击 Streak）
            </Text>
            <Text variant="caption" style={[styles.secSubText, { color: pal.mutedText }]}>
              点击任意键帽即可切换当日达成状态并赢取自律心愿金
            </Text>
          </View>

          <View style={styles.habitKeycapGrid}>
            {habits.map((habit, habitIdx) => {
              const stats = computeHabitStreak(habit, localDay);
              const catMeta = OKR_CATEGORY_META[habit.category];
              const streakHot = stats.streakDays >= 3;
              const habitAccent = habitIdx % 2 === 0 ? pal.emeraldPrimary : pal.goldPrimary;

              return (
                <View
                  key={habit.id}
                  style={[
                    styles.habitPodCard,
                    {
                      backgroundColor: pal.cardBg,
                      borderColor: pal.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.habitPodTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={[
                            styles.catBadge,
                            {
                              backgroundColor: pal.cardRecessedBg,
                              borderColor: `${habitAccent}66`,
                            },
                          ]}
                        >
                          <Text
                            variant="caption"
                            style={[styles.catBadgeText, { color: habitAccent }]}
                          >
                            {catMeta.label}
                          </Text>
                        </View>
                        <Text
                          variant="label"
                          style={[styles.habitTitleText, { color: pal.titleText }]}
                          numberOfLines={1}
                        >
                          {habit.title}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.streak3DBadge,
                        {
                          backgroundColor: pal.cardRecessedBg,
                          borderColor: pal.cardBorder,
                        },
                        streakHot && {
                          backgroundColor: pal.pillBg,
                          borderColor: pal.pillBorder,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={[
                          styles.streak3DBadgeText,
                          { color: streakHot ? pal.pillText : pal.subText },
                        ]}
                      >
                        {`🔥 ${stats.streakDays}连击 · 本周 ${stats.last7DaysCount}/${habit.weeklyTargetDays}`}
                      </Text>
                    </View>
                  </View>

                  {/* 7-Day 3D Mechanical Keycaps */}
                  <View style={styles.keycapRow}>
                    {stats.last7DaysFlags.map((cell) => {
                      const isToday = cell.localDay === localDay;
                      const shortLabel = isToday ? '今日' : cell.localDay.slice(8);
                      return (
                        <Pressable
                          key={cell.localDay}
                          accessibilityRole="button"
                          accessibilityLabel={`${habit.title} ${cell.localDay} ${cell.completed ? '已打卡' : '未打卡'}`}
                          onPress={() => {
                            toggleHabitDay(habit.id, cell.localDay);
                            if (!cell.completed) {
                              recordPledgeReward(`完成微习惯打卡：${habit.title}`, cell.localDay);
                            }
                          }}
                          style={styles.keycapOuterWrap}
                        >
                          {/* 3D Keycap Bottom Lip */}
                          <View
                            style={[
                              styles.keycap3DBaseLip,
                              {
                                backgroundColor: cell.completed ? pal.keycapOnLip : pal.keycapOffLip,
                              },
                            ]}
                          >
                            {/* 3D Keycap Top Cap */}
                            <View
                              style={[
                                styles.keycap3DTopSurface,
                                {
                                  backgroundColor: cell.completed ? pal.keycapOnTop : pal.keycapOffTop,
                                  borderColor: cell.completed
                                    ? pal.keycapOnBorder
                                    : isToday
                                      ? pal.goldPrimary
                                      : pal.keycapOffBorder,
                                },
                              ]}
                            >
                              <Text
                                variant="caption"
                                style={[
                                  styles.keycapDayLabel,
                                  {
                                    color: cell.completed
                                      ? pal.keycapOnText
                                      : isToday
                                        ? pal.goldPrimary
                                        : pal.subText,
                                  },
                                ]}
                              >
                                {shortLabel}
                              </Text>
                              <Text
                                variant="caption"
                                style={[
                                  styles.keycapCheckGlyph,
                                  {
                                    color: cell.completed ? pal.emeraldPrimary : pal.mutedText,
                                  },
                                ]}
                              >
                                {cell.completed ? '✓' : '·'}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
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
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  goldPulseDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  mainHeaderTitle: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  summaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  summaryPillText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: theme.fontFamily.mono,
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionDarkPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionDarkPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionGoldPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionGoldPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bodyPadding: {
    padding: 18,
    gap: 20,
  },
  formPanel: {
    padding: 14,
    borderRadius: 12,
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
    fontWeight: '700',
    fontSize: 13.5,
    letterSpacing: 0.3,
  },
  secSubText: {
    fontSize: 11,
  },
  milestoneGalleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  milestone3DCard: {
    flex: 1,
    minWidth: 265,
    borderRadius: 14,
    borderWidth: 1,
    borderTopWidth: 3,
    padding: 13,
    gap: 10,
  } as ViewStyle,
  msCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  msCardCenter: {
    flex: 1,
    gap: 3,
  },
  catBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  msTitleText: {
    fontWeight: '700',
    fontSize: 14,
  },
  msSubtitleText: {
    fontSize: 11,
    fontFamily: theme.fontFamily.mono,
  },
  flipCounterBox: {
    minWidth: 68,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipNumberText: {
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '700',
    fontFamily: theme.fontFamily.mono,
  },
  flipUnitText: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    fontFamily: theme.fontFamily.mono,
  },
  msPrepCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  msPrepIcon: {
    fontSize: 10,
  },
  msPrepText: {
    flex: 1,
    fontSize: 11,
  },
  okrBentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  okrCommandPod: {
    flex: 1,
    minWidth: 330,
    borderRadius: 15,
    borderWidth: 1,
    padding: 15,
    gap: 14,
  } as ViewStyle,
  okrPodHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  okrPodTitleWrap: {
    flex: 1,
    gap: 6,
  },
  periodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  periodBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: theme.fontFamily.mono,
  },
  addKrMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  addKrMiniBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  okrPodTitleText: {
    fontWeight: '700',
    fontSize: 14.5,
    lineHeight: 20,
  },
  krListStack: {
    gap: 10,
  },
  krDarkRowCard: {
    borderRadius: 11,
    borderWidth: 1,
    padding: 11,
    gap: 8,
  },
  krRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  krTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 170,
  },
  krIndexBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
  },
  krIndexBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    fontFamily: theme.fontFamily.mono,
  },
  krTitleText: {
    fontSize: 12.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  autoSyncTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
  },
  autoSyncTagText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  krRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  krNumbersText: {
    fontSize: 11,
    fontFamily: theme.fontFamily.mono,
  },
  krPctHighlight: {
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: theme.fontFamily.mono,
  },
  krStep3DBtn: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    borderBottomWidth: 2,
  },
  krStep3DBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  segmentedBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 8,
  },
  energySegmentCell: {
    flex: 1,
    height: 7,
    borderRadius: 2.5,
    borderWidth: 0.5,
  },
  habitKeycapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  habitPodCard: {
    flex: 1,
    minWidth: 285,
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    gap: 11,
  } as ViewStyle,
  habitPodTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  habitTitleText: {
    fontWeight: '700',
    fontSize: 13,
  },
  streak3DBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  streak3DBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    fontFamily: theme.fontFamily.mono,
  },
  keycapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  keycapOuterWrap: {
    flex: 1,
  },
  keycap3DBaseLip: {
    borderRadius: 9,
    paddingBottom: 3,
  },
  keycap3DTopSurface: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  keycapDayLabel: {
    fontSize: 9.5,
    fontFamily: theme.fontFamily.mono,
  },
  keycapCheckGlyph: {
    fontSize: 12,
    fontWeight: '700',
  },
});
