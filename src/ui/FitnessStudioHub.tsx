import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  computeDailyNutritionSummary,
  type LoggedNutritionItem,
  NUTRITION_MEAL_PRESETS,
  type NutritionMealPreset,
} from '@/core/knowledge-graph-corner';
import { formatMonthDay } from '@/core/local-day';
import {
  BAND_LABEL,
  BAND_LEVELS,
  type BandLevel,
  formatTrainingLoad,
  type TrainingMode,
  type TrainingSet,
} from '@/core/training';
import { formatKg } from '@/core/weight-stats';
import { addLedgerTransaction } from '@/data/bookkeeping';
import { recordPledgeReward } from '@/data/life-gamification';
import { incrementOrAddTimeBlock } from '@/data/time-block-tracker';

import { Card } from './Card';
import { Divider, Stack } from './layout';
import { SetRow } from './SetRow';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { useI18n } from './use-i18n';

type WorkoutSplitId = 'push' | 'pull' | 'legs' | 'cardio';

const WORKOUT_SPLITS: readonly {
  id: WorkoutSplitId;
  icon: string;
  titleZh: string;
  titleEn: string;
  subtitleZh: string;
  exercises: readonly { name: string; defaultKg: number; defaultReps: number; muscleZh: string }[];
}[] = [
  {
    id: 'push',
    icon: '🔥',
    titleZh: '推日 (Push) · 胸 / 肩 / 三头',
    titleEn: 'Push Day · Chest, Shoulders & Triceps',
    subtitleZh: '主打上肢水平推与垂直推复合动作，刺激胸大肌与三角肌前中束',
    exercises: [
      { name: '杠铃/哑铃卧推', defaultKg: 60, defaultReps: 10, muscleZh: '胸大肌' },
      { name: '上斜哑铃卧推', defaultKg: 44, defaultReps: 10, muscleZh: '上胸' },
      { name: '坐姿哑铃肩推', defaultKg: 32, defaultReps: 10, muscleZh: '三角肌前中束' },
      { name: '哑铃侧平举', defaultKg: 16, defaultReps: 15, muscleZh: '三角肌中束' },
      { name: '绳索下压 / 俯卧撑', defaultKg: 25, defaultReps: 12, muscleZh: '肱三头肌' },
    ],
  },
  {
    id: 'pull',
    icon: '💪',
    titleZh: '拉日 (Pull) · 背阔肌 / 后束 / 二头',
    titleEn: 'Pull Day · Back, Rear Delts & Biceps',
    subtitleZh: '垂直拉与水平划船结合，雕刻倒三角背阔肌并改善久坐圆肩驼背',
    exercises: [
      { name: '引体向上 / 高位下拉', defaultKg: 55, defaultReps: 10, muscleZh: '背阔肌宽度' },
      { name: '单臂哑铃划船', defaultKg: 28, defaultReps: 12, muscleZh: '背阔肌厚度' },
      { name: '杠铃俯身划船', defaultKg: 60, defaultReps: 10, muscleZh: '中下背/菱形肌' },
      { name: '弹力带面拉 (Face Pull)', defaultKg: 15, defaultReps: 15, muscleZh: '三角肌后束/肩袖' },
      { name: '哑铃交替弯举', defaultKg: 20, defaultReps: 12, muscleZh: '肱二头肌' },
    ],
  },
  {
    id: 'legs',
    icon: '🦵',
    titleZh: '腿臀日 (Legs) · 深蹲 / 硬拉 / 核心',
    titleEn: 'Leg Day · Quads, Hamstrings & Glutes',
    subtitleZh: '全身最大肌群复合刺激，拉高基础代谢率与下肢爆发力',
    exercises: [
      { name: '杠铃/高脚杯深蹲', defaultKg: 80, defaultReps: 8, muscleZh: '股四头肌/臀大肌' },
      { name: '罗马尼亚硬拉 (RDL)', defaultKg: 75, defaultReps: 10, muscleZh: '腘绳肌/臀部/下背' },
      { name: '保加利亚分腿蹲', defaultKg: 32, defaultReps: 10, muscleZh: '单侧臀腿稳定' },
      { name: '站姿提踵', defaultKg: 50, defaultReps: 15, muscleZh: '小腿三头肌' },
      { name: '悬垂举腿 / 平板支撑', defaultKg: 10, defaultReps: 15, muscleZh: '核心腹直肌' },
    ],
  },
  {
    id: 'cardio',
    icon: '🏃',
    titleZh: '心肺燃脂 (Cardio & HIIT) · 有氧代谢',
    titleEn: 'Cardio & HIIT · Fat Burn & VO2Max',
    subtitleZh: '二区有氧燃脂或高强度间歇训练，强化心肺最大摄氧量 (VO2Max)',
    exercises: [
      { name: '二区有氧慢跑 (分钟)', defaultKg: 1, defaultReps: 30, muscleZh: '心肺耐力/有氧燃脂' },
      { name: '波比跳 Burpees', defaultKg: 1, defaultReps: 20, muscleZh: '全身心肺爆发' },
      { name: '壶铃摇摆 Kettlebell Swing', defaultKg: 16, defaultReps: 20, muscleZh: '后链爆发/心肺' },
      { name: '动感单车 / 划船机 (分钟)', defaultKg: 1, defaultReps: 25, muscleZh: '低冲击燃脂' },
    ],
  },
] as const;

function classifyMuscleGroup(exerciseName: string): 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'cardio' {
  const n = exerciseName.toLowerCase();
  if (n.includes('卧推') || n.includes('俯卧撑') || n.includes('夹胸') || n.includes('胸')) return 'chest';
  if (n.includes('划船') || n.includes('引体') || n.includes('下拉') || n.includes('背')) return 'back';
  if (n.includes('深蹲') || n.includes('硬拉') || n.includes('分腿蹲') || n.includes('提踵') || n.includes('腿') || n.includes('臀')) return 'legs';
  if (n.includes('肩推') || n.includes('侧平举') || n.includes('面拉') || n.includes('推举') || n.includes('肩')) return 'shoulders';
  if (n.includes('弯举') || n.includes('下压') || n.includes('臂')) return 'arms';
  return 'cardio';
}

export function FitnessStudioHub({
  localDay,
  todaySets,
  allSets,
  latestWeightKg,
  onSaveSet,
  onDeleteSet,
}: {
  localDay: string;
  todaySets: readonly TrainingSet[];
  allSets: readonly TrainingSet[];
  latestWeightKg: number | null;
  onSaveSet: (input: {
    exercise: string;
    reps: number;
    weightKg: number | null;
    bandLevel: string | null;
  }) => void;
  onDeleteSet: (id: string) => void;
}) {
  const { color, scheme } = useTheme();
  const { t } = useI18n();
  const isDark = scheme === 'dark';

  const [selectedSplitId, setSelectedSplitId] = useState<WorkoutSplitId>('push');
  const [exerciseInput, setExerciseInput] = useState<string>('杠铃/哑铃卧推');
  const [loadMode, setLoadMode] = useState<TrainingMode>('weight');
  const [weightKgInput, setWeightKgInput] = useState<string>('60');
  const [repsInput, setRepsInput] = useState<string>('10');
  const [bandInput, setBandInput] = useState<BandLevel>('medium');

  const [restSecondsLeft, setRestSecondsLeft] = useState<number>(0);
  const [restRunning, setRestRunning] = useState<boolean>(false);

  // Feature 3: Fitness × Nutrition Macros & Calorie Deficit State
  const [loggedMeals, setLoggedMeals] = useState<LoggedNutritionItem[]>(() => [
    {
      id: 'init-meal-1',
      nameZh: '🥚 水煮蛋 3颗 + 燕麦碗',
      proteinG: 24,
      carbsG: 38,
      fatG: 15,
      kcal: 385,
      priceCny: 10,
      loggedAt: '08:30',
      syncedToLedger: false,
    },
  ]);
  const [syncMealToLedger, setSyncMealToLedger] = useState<boolean>(true);

  useEffect(() => {
    if (!restRunning) return undefined;
    const timer = setInterval(() => {
      setRestSecondsLeft((s) => {
        if (s <= 1) {
          setRestRunning(false);
          showToast({ text: t('🔔 组间休息结束！准备开始下一组训练 💪', '🔔 Rest complete! Ready for next set 💪') });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [restRunning, t]);

  const activeSplit = useMemo(
    () => WORKOUT_SPLITS.find((s) => s.id === selectedSplitId) ?? WORKOUT_SPLITS[0]!,
    [selectedSplitId],
  );

  const fitnessAnalytics = useMemo(() => {
    let todayVolumeKg = 0;
    let bestEpley1RmKg = 0;
    let bestEpleyExercise = '卧推 / 深蹲';

    const muscleSetsCount: Record<'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'cardio', number> = {
      chest: 0,
      back: 0,
      legs: 0,
      shoulders: 0,
      arms: 0,
      cardio: 0,
    };

    for (const s of todaySets) {
      const w = s.weightKg ?? 20;
      todayVolumeKg += w * s.reps;
      const epley1Rm = Math.round(w * (1 + s.reps / 30));
      if (epley1Rm > bestEpley1RmKg) {
        bestEpley1RmKg = epley1Rm;
        bestEpleyExercise = s.exercise;
      }
      const mGroup = classifyMuscleGroup(s.exercise);
      muscleSetsCount[mGroup] += 1;
    }

    for (const s of allSets.slice(0, 30)) {
      const w = s.weightKg ?? 20;
      const epley1Rm = Math.round(w * (1 + s.reps / 30));
      if (epley1Rm > bestEpley1RmKg) {
        bestEpley1RmKg = epley1Rm;
        bestEpleyExercise = s.exercise;
      }
    }

    const estKcalBurned = Math.round(todaySets.length * 38 + todayVolumeKg * 0.025);
    return {
      todaySetsCount: todaySets.length,
      todayVolumeKg: Math.round(todayVolumeKg),
      bestEpley1RmKg,
      bestEpleyExercise,
      estKcalBurned,
      muscleSetsCount,
    };
  }, [todaySets, allSets]);

  const nutritionSummary = useMemo(
    () =>
      computeDailyNutritionSummary({
        items: loggedMeals,
        bodyWeightKg: latestWeightKg ?? 72,
        workoutBurnKcal: fitnessAnalytics.estKcalBurned,
      }),
    [loggedMeals, latestWeightKg, fitnessAnalytics.estKcalBurned],
  );

  function startRestTimer(seconds: number) {
    setRestSecondsLeft(seconds);
    setRestRunning(true);
  }

  function handleLogMealPreset(preset: NutritionMealPreset) {
    setLoggedMeals((prev) => [
      {
        id: `meal-${prev.length + 1}-${preset.id}`,
        nameZh: `${preset.icon} ${preset.nameZh}`,
        proteinG: preset.proteinG,
        carbsG: preset.carbsG,
        fatG: preset.fatG,
        kcal: preset.kcal,
        priceCny: preset.estimatedPriceCny,
        loggedAt: '刚刚',
        syncedToLedger: syncMealToLedger,
      },
      ...prev,
    ]);

    if (syncMealToLedger && preset.estimatedPriceCny > 0) {
      addLedgerTransaction({
        kind: 'expense',
        amountCny: preset.estimatedPriceCny,
        categoryId: 'dining',
        accountId: 'wechat',
        note: `健身营养餐: ${preset.nameZh} (+${preset.proteinG}g蛋白)`,
        localDay,
        owner: 'me',
      });
    }

    showToast({
      text: syncMealToLedger
        ? t(
            `🍱 已记录「${preset.nameZh}」(+${preset.proteinG}g 蛋白质 / ${preset.kcal} kcal)，并已同步记入记账本 -¥${preset.estimatedPriceCny}！`,
            `🍱 Logged ${preset.nameEn} (+${preset.proteinG}g protein) & synced ¥${preset.estimatedPriceCny} to Ledger!`,
          )
        : t(
            `🍱 已记录「${preset.nameZh}」(+${preset.proteinG}g 蛋白质 / ${preset.kcal} kcal)`,
            `🍱 Logged ${preset.nameEn} (+${preset.proteinG}g protein)`,
          ),
    });
  }

  function handleSaveSet(customItem?: { exercise: string; weightKg: number | null; reps: number; bandLevel: string | null }) {
    const ex = (customItem?.exercise ?? exerciseInput).trim() || '深蹲';
    const reps = customItem?.reps ?? Math.max(1, Math.min(999, Number.parseInt(repsInput, 10) || 10));
    const weightKg =
      customItem !== undefined
        ? customItem.weightKg
        : loadMode === 'weight'
          ? Math.max(1, Math.min(499, Number.parseFloat(weightKgInput) || 20))
          : null;
    const bandLevel =
      customItem !== undefined
        ? customItem.bandLevel
        : loadMode === 'band'
          ? bandInput
          : null;

    const prevBest1Rm = allSets
      .filter((s) => s.exercise === ex && s.weightKg != null)
      .reduce((best, s) => Math.max(best, Math.round((s.weightKg ?? 0) * (1 + s.reps / 30))), 0);
    const new1Rm = weightKg != null ? Math.round(weightKg * (1 + reps / 30)) : 0;
    const isNewPr = new1Rm > 0 && new1Rm > prevBest1Rm;

    onSaveSet({
      exercise: ex,
      reps,
      weightKg,
      bandLevel,
    });
    incrementOrAddTimeBlock({
      localDay,
      category: 'fitness',
      title: `健身训练: ${ex}`,
      deltaMinutes: 5,
      goalId: null,
    });
    recordPledgeReward(
      isNewPr ? `🏆 力量 PR 突破：${ex} (估算1RM ${new1Rm}kg)` : `力量打卡：${ex}`,
      localDay,
      isNewPr ? 18 : 10,
    );
    startRestTimer(90);
    showToast({
      text: isNewPr
        ? t(
            `🏆 新 PR 突破！「${ex}」估算 1RM 达 ${new1Rm}kg · 心愿金库奖励 +¥18 & 已开启 90s 休息计时`,
            `🏆 New PR! ${ex} est. 1RM ${new1Rm}kg · Wish Vault +¥18 & 90s rest started`,
          )
        : t(
            `💪 已记录「${ex}」${weightKg ? `${weightKg}kg × ${reps}次` : `${reps}次`} · 心愿金 +¥10 & 90s 休息计时`,
            `💪 Logged ${ex} (${reps} reps) · +¥10 & 90s rest timer started`,
          ),
    });
  }

  const pal = isDark
    ? {
        cardBg: '#181a1f',
        elevated: '#20232a',
        border: 'rgba(255, 255, 255, 0.12)',
        gold: '#f5b942',
        emerald: '#34d399',
        rose: '#fb7185',
        sky: '#38bdf8',
        ink: '#f4f4f6',
        sub: '#b8bcc8',
      }
    : {
        cardBg: '#ffffff',
        elevated: '#f0ece1',
        border: 'rgba(30, 30, 30, 0.12)',
        gold: '#b45309',
        emerald: '#0f766e',
        rose: '#be123c',
        sky: '#0369a1',
        ink: '#1c1917',
        sub: '#57534e',
      };

  const muscleCards: {
    key: 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'cardio';
    labelZh: string;
    icon: string;
  }[] = [
    { key: 'chest', labelZh: '胸部肌群 (Chest)', icon: '🔥' },
    { key: 'back', labelZh: '背部肌群 (Back)', icon: '🦅' },
    { key: 'legs', labelZh: '臀腿下肢 (Legs)', icon: '🦵' },
    { key: 'shoulders', labelZh: '肩部三角肌 (Delts)', icon: '🛡️' },
    { key: 'arms', labelZh: '二头/三头 (Arms)', icon: '💪' },
    { key: 'cardio', labelZh: '核心与心肺 (Core/HIIT)', icon: '🫀' },
  ];

  return (
    <Stack gap="md">
      {/* 1. Top 4 HUD Metrics Row */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
          <Text variant="caption" style={{ color: pal.sub, fontSize: 11 }}>
            {t('🏋️ 今日完成训练组数', '🏋️ Today Completed Sets')}
          </Text>
          <Text variant="title" style={{ color: pal.emerald, fontSize: 22, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
            {`${fitnessAnalytics.todaySetsCount} 组`}
          </Text>
          <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
            {fitnessAnalytics.todaySetsCount >= 8 ? '🔥 今日训练量饱满' : '建议每次训练完成 8~16 组'}
          </Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
          <Text variant="caption" style={{ color: pal.sub, fontSize: 11 }}>
            {t('⚡ 今日训练总容量 (Tonnage)', '⚡ Today Volume Tonnage')}
          </Text>
          <Text variant="title" style={{ color: pal.gold, fontSize: 22, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
            {`${fitnessAnalytics.todayVolumeKg.toLocaleString()} kg`}
          </Text>
          <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
            {t('计算公式：Σ (重量 kg × 次数)', 'Formula: Σ (Weight × Reps)')}
          </Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
          <Text variant="caption" style={{ color: pal.sub, fontSize: 11 }}>
            {t('🏆 Epley 1RM 极限力量估算', '🏆 Estimated 1RM (Epley)')}
          </Text>
          <Text variant="title" style={{ color: pal.sky, fontSize: 22, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
            {fitnessAnalytics.bestEpley1RmKg > 0 ? `${fitnessAnalytics.bestEpley1RmKg} kg` : '75 kg (待解锁)'}
          </Text>
          <Text variant="caption" numberOfLines={1} style={{ color: pal.sub, fontSize: 10.5 }}>
            {`代表动作：${fitnessAnalytics.bestEpleyExercise}`}
          </Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
          <Text variant="caption" style={{ color: pal.sub, fontSize: 11 }}>
            {t('🔥 运动消耗 & 最新体重联动', '🔥 Est. Burn & Latest Weight')}
          </Text>
          <Text variant="title" style={{ color: pal.rose, fontSize: 22, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
            {`-${fitnessAnalytics.estKcalBurned} kcal`}
          </Text>
          <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
            {latestWeightKg != null
              ? `当前体重：${formatKg(latestWeightKg)} kg`
              : '可在快速记录中同步今日体重'}
          </Text>
        </View>
      </View>

      {/* 2. Workout Split Selector + 1-Click Preset Exercise Cards */}
      <Card>
        <Stack gap="sm">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Text variant="label" style={{ fontSize: 15, fontWeight: '700' }}>
              {t('📋 四大分化训练处方 · 点击动作一键填入或直接打卡 +1 组', '📋 Workout Split Presets · 1-Click Log Set')}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text variant="caption" tone="muted" style={{ fontSize: 11 }}>
                {t('⏱ 组间计时器：', '⏱ Rest Timer:')}
              </Text>
              {[60, 90, 120].map((sec) => (
                <Pressable
                  key={sec}
                  onPress={() => startRestTimer(sec)}
                  style={[
                    styles.microBtn,
                    {
                      borderColor: restRunning && Math.abs(restSecondsLeft - sec) < 15 ? pal.emerald : pal.border,
                      backgroundColor: pal.elevated,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                    {`${sec}s`}
                  </Text>
                </Pressable>
              ))}
              {restRunning ? (
                <Pressable
                  onPress={() => {
                    setRestRunning(false);
                    setRestSecondsLeft(0);
                  }}
                  style={[styles.microBtn, { borderColor: pal.emerald, backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}
                >
                  <Text variant="caption" style={{ color: pal.emerald, fontSize: 11.5, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                    {`⏳ 倒计时 ${restSecondsLeft}s (点击停止)`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {WORKOUT_SPLITS.map((sp) => {
              const active = sp.id === selectedSplitId;
              return (
                <Pressable
                  key={sp.id}
                  onPress={() => {
                    setSelectedSplitId(sp.id);
                    const firstEx = sp.exercises[0];
                    if (firstEx) {
                      setExerciseInput(firstEx.name);
                      setWeightKgInput(String(firstEx.defaultKg));
                      setRepsInput(String(firstEx.defaultReps));
                    }
                  }}
                  style={[
                    styles.splitTabBtn,
                    {
                      borderColor: active ? pal.gold : pal.border,
                      backgroundColor: active ? 'rgba(245, 185, 66, 0.16)' : pal.elevated,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: active ? pal.gold : pal.ink, fontSize: 12.5, fontWeight: active ? '700' : '600' }}>
                    {`${sp.icon} ${sp.titleZh}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text variant="caption" tone="muted" style={{ fontSize: 12 }}>
            {activeSplit.subtitleZh}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {activeSplit.exercises.map((ex) => {
              const isCurrent = exerciseInput === ex.name;
              return (
                <View
                  key={ex.name}
                  style={[
                    styles.presetExerciseCard,
                    {
                      borderColor: isCurrent ? pal.gold : pal.border,
                      backgroundColor: isCurrent ? 'rgba(245, 185, 66, 0.10)' : pal.elevated,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      setExerciseInput(ex.name);
                      setLoadMode('weight');
                      setWeightKgInput(String(ex.defaultKg));
                      setRepsInput(String(ex.defaultReps));
                    }}
                    style={{ gap: 3 }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
                        {`🎯 ${ex.muscleZh}`}
                      </Text>
                      <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
                        {`${ex.defaultKg}kg × ${ex.defaultReps}`}
                      </Text>
                    </View>
                    <Text variant="label" style={{ color: pal.ink, fontSize: 13.5, fontWeight: '700' }}>
                      {ex.name}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`直接记录一组 ${ex.name}`}
                    onPress={() =>
                      handleSaveSet({
                        exercise: ex.name,
                        weightKg: ex.defaultKg,
                        reps: ex.defaultReps,
                        bandLevel: null,
                      })
                    }
                    style={[styles.oneTapSetBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
                  >
                    <Text variant="caption" style={{ color: '#fffbeb', fontSize: 11, fontWeight: '700' }}>
                      {t(`＋ 直接打卡 1 组 (${ex.defaultKg}kg×${ex.defaultReps})`, `＋ Log 1 Set (${ex.defaultKg}kg×${ex.defaultReps})`)}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </Stack>
      </Card>

      {/* 3. Custom Set Logger + Muscle Group Activation Heatmap */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ flex: 1.2, minWidth: 290 }}>
          <Card>
            <Stack gap="sm">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Text variant="label" style={{ fontSize: 14.5, fontWeight: '700' }}>
                  {t('✍️ 自定义训练组打卡台', '✍️ Custom Set Logger')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable
                    onPress={() => setLoadMode('weight')}
                    style={[
                      styles.microBtn,
                      {
                        borderColor: loadMode === 'weight' ? pal.gold : pal.border,
                        backgroundColor: loadMode === 'weight' ? 'rgba(245, 185, 66, 0.16)' : 'transparent',
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: loadMode === 'weight' ? pal.gold : pal.sub, fontSize: 11, fontWeight: '700' }}>
                      {t('🏋️ 自由重量/器械 (kg)', '🏋️ Weight (kg)')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setLoadMode('band')}
                    style={[
                      styles.microBtn,
                      {
                        borderColor: loadMode === 'band' ? pal.gold : pal.border,
                        backgroundColor: loadMode === 'band' ? 'rgba(245, 185, 66, 0.16)' : 'transparent',
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: loadMode === 'band' ? pal.gold : pal.sub, fontSize: 11, fontWeight: '700' }}>
                      {t('🎗️ 弹力带阻力', '🎗️ Resistance Band')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={exerciseInput}
                  onChangeText={setExerciseInput}
                  placeholder={t('动作名称 (如：深蹲 / 卧推)', 'Exercise name...')}
                  placeholderTextColor={color.muted}
                  style={[
                    styles.inputField,
                    {
                      flex: 1.5,
                      minWidth: 140,
                      color: pal.ink,
                      backgroundColor: pal.elevated,
                      borderColor: pal.border,
                    },
                  ]}
                />

                {loadMode === 'weight' ? (
                  <TextInput
                    value={weightKgInput}
                    onChangeText={setWeightKgInput}
                    keyboardType="numeric"
                    placeholder="重量 kg"
                    placeholderTextColor={color.muted}
                    style={[
                      styles.inputField,
                      {
                        width: 84,
                        color: pal.ink,
                        backgroundColor: pal.elevated,
                        borderColor: pal.border,
                        textAlign: 'center',
                      },
                    ]}
                  />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {BAND_LEVELS.map((lvl) => (
                      <Pressable
                        key={lvl}
                        onPress={() => setBandInput(lvl)}
                        style={[
                          styles.microBtn,
                          {
                            borderColor: bandInput === lvl ? pal.gold : pal.border,
                            backgroundColor: bandInput === lvl ? 'rgba(245, 185, 66, 0.16)' : pal.elevated,
                          },
                        ]}
                      >
                        <Text variant="caption" style={{ color: pal.ink, fontSize: 11 }}>
                          {BAND_LABEL[lvl]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                <TextInput
                  value={repsInput}
                  onChangeText={setRepsInput}
                  keyboardType="numeric"
                  placeholder="次数"
                  placeholderTextColor={color.muted}
                  style={[
                    styles.inputField,
                    {
                      width: 76,
                      color: pal.ink,
                      backgroundColor: pal.elevated,
                      borderColor: pal.border,
                      textAlign: 'center',
                    },
                  ]}
                />

                <Pressable
                  onPress={() => handleSaveSet()}
                  style={[styles.primarySaveBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
                >
                  <Text variant="caption" style={{ color: '#fffbeb', fontSize: 12, fontWeight: '700' }}>
                    {t('✓ 记录此组 (+5m)', '✓ Save Set')}
                  </Text>
                </Pressable>
              </View>

              <Divider />

              <Text variant="caption" style={{ color: pal.sub, fontSize: 11.5, fontWeight: '700' }}>
                {t(
                  `📅 今日 (${formatMonthDay(localDay)}) 已完成训练流水 (${todaySets.length} 组)：`,
                  `📅 Today's Logged Sets (${todaySets.length}):`,
                )}
              </Text>

              {todaySets.length > 0 ? (
                <Stack gap="xs">
                  {todaySets.map((s) => (
                    <SetRow
                      key={s.id}
                      title={s.exercise}
                      detail={`${formatTrainingLoad(s)} × ${s.reps} 次`}
                      onDelete={() => onDeleteSet(s.id)}
                    >
                      <Pressable
                        onPress={() =>
                          handleSaveSet({
                            exercise: s.exercise,
                            weightKg: s.weightKg,
                            reps: s.reps,
                            bandLevel: s.bandLevel,
                          })
                        }
                        style={[styles.microBtn, { borderColor: pal.gold }]}
                      >
                        <Text variant="caption" style={{ color: pal.gold, fontSize: 10.5, fontWeight: '700' }}>
                          {t('＋ 再来 1 组', '＋ Repeat Set')}
                        </Text>
                      </Pressable>
                    </SetRow>
                  ))}
                </Stack>
              ) : (
                <Text variant="caption" tone="muted">
                  {t('今日尚未记录训练组，点击上方分化训练卡片上的「＋ 直接打卡 1 组」即可快速开始！', 'No sets logged today yet. Click any exercise card above to start!')}
                </Text>
              )}
            </Stack>
          </Card>
        </View>

        <View style={{ flex: 1, minWidth: 260 }}>
          <Card>
            <Stack gap="sm">
              <Text variant="label" style={{ fontSize: 14.5, fontWeight: '700' }}>
                {t('🧬 今日全身六大肌群激活热力图', '🧬 Muscle Group Activation Heatmap')}
              </Text>
              <View style={{ gap: 8 }}>
                {muscleCards.map((mc) => {
                  const count = fitnessAnalytics.muscleSetsCount[mc.key];
                  const pct = Math.min(100, count * 25);
                  return (
                    <View key={mc.key} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="caption" style={{ color: pal.ink, fontSize: 12, fontWeight: count > 0 ? '700' : '500' }}>
                          {`${mc.icon} ${mc.labelZh}`}
                        </Text>
                        <Text variant="caption" style={{ color: count > 0 ? pal.emerald : pal.sub, fontSize: 11, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                          {count > 0 ? `${count} 组 (${pct}% 充血激活)` : '待训练'}
                        </Text>
                      </View>
                      <View style={{ height: 9, borderRadius: 5, backgroundColor: pal.elevated, overflow: 'hidden' }}>
                        <View
                          style={{
                            width: `${Math.max(4, pct)}%`,
                            height: '100%',
                            backgroundColor: count >= 3 ? pal.emerald : count > 0 ? pal.gold : 'transparent',
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Stack>
          </Card>
        </View>
      </View>

      {/* 4. Feature 3: Fitness × Nutrition Macros & Calorie Deficit Bar (🍱 健身 × 饮食热量 & 蛋白质宏量营养素吧台) */}
      <Card>
        <Stack gap="sm">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ gap: 2 }}>
              <Text variant="label" style={{ fontSize: 15, fontWeight: '700' }}>
                {t('🍱 健身 × 饮食热量 & 蛋白质宏量营养素 (Macros) 吧台', '🍱 Nutrition Macros & Calorie Deficit Bar')}
              </Text>
              <Text variant="caption" style={{ color: pal.emerald, fontSize: 11.5, fontWeight: '700' }}>
                {nutritionSummary.statusLabelZh}
              </Text>
            </View>

            <Pressable
              onPress={() => setSyncMealToLedger((v) => !v)}
              style={[
                styles.microBtn,
                {
                  borderColor: syncMealToLedger ? pal.emerald : pal.border,
                  backgroundColor: syncMealToLedger ? 'rgba(52, 211, 153, 0.14)' : pal.elevated,
                },
              ]}
            >
              <Text variant="caption" style={{ color: syncMealToLedger ? pal.emerald : pal.sub, fontSize: 11, fontWeight: '700' }}>
                {syncMealToLedger
                  ? t('⚡ 已开启：打卡餐食自动同步至「记账」餐饮流水', '⚡ Auto-Sync Meal Cost to Ledger: ON')
                  : t('○ 点击开启：打卡餐食同步记账', '○ Auto-Sync to Ledger: OFF')}
              </Text>
            </Pressable>
          </View>

          {/* Protein & Calorie Deficit Summary Strip */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <View style={[styles.kpiCard, { backgroundColor: pal.elevated, borderColor: pal.border }]}>
              <Text variant="caption" style={{ color: pal.sub, fontSize: 11 }}>
                {t('🥩 今日蛋白质摄入 / 增肌目标 (1.8g/kg)', '🥩 Protein Intake / Target')}
              </Text>
              <Text variant="title" style={{ color: pal.emerald, fontSize: 19, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                {`${nutritionSummary.intakeProteinG}g / ${nutritionSummary.targetProteinG}g (${nutritionSummary.proteinCompletionPct}%)`}
              </Text>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: pal.cardBg, overflow: 'hidden', marginTop: 4 }}>
                <View style={{ width: `${nutritionSummary.proteinCompletionPct}%`, height: '100%', backgroundColor: pal.emerald }} />
              </View>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: pal.elevated, borderColor: pal.border }]}>
              <Text variant="caption" style={{ color: pal.sub, fontSize: 11 }}>
                {t('🔥 热量赤字 (总消耗 TDEE - 饮食摄入)', '🔥 Daily Calorie Deficit')}
              </Text>
              <Text variant="title" style={{ color: pal.gold, fontSize: 19, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                {`${nutritionSummary.calorieDeficitKcal >= 0 ? `赤字 -${nutritionSummary.calorieDeficitKcal}` : `盈余 +${Math.abs(nutritionSummary.calorieDeficitKcal)}`} kcal`}
              </Text>
              <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
                {`消耗 ${nutritionSummary.totalTdeeKcal} kcal vs 摄入 ${nutritionSummary.intakeKcal} kcal`}
              </Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: pal.elevated, borderColor: pal.border }]}>
              <Text variant="caption" style={{ color: pal.sub, fontSize: 11 }}>
                {t('⚖️ 三大宏量营养素 & 今日餐饮开销', '⚖️ Macros & Dining Spend')}
              </Text>
              <Text variant="caption" style={{ color: pal.ink, fontSize: 13, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                {`蛋白 ${nutritionSummary.intakeProteinG}g · 碳水 ${nutritionSummary.intakeCarbsG}g · 脂肪 ${nutritionSummary.intakeFatG}g`}
              </Text>
              <Text variant="caption" style={{ color: pal.sky, fontSize: 11, fontFamily: theme.fontFamily.mono }}>
                {`今日营养餐累计 ¥${nutritionSummary.totalFoodSpendCny}`}
              </Text>
            </View>
          </View>

          {/* 6 One-Tap Fitness Meal Presets */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {NUTRITION_MEAL_PRESETS.map((meal) => (
              <Pressable
                key={meal.id}
                onPress={() => handleLogMealPreset(meal)}
                style={[styles.presetExerciseCard, { backgroundColor: pal.elevated, borderColor: pal.border }]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
                    {meal.tagZh}
                  </Text>
                  <Text variant="caption" style={{ color: pal.gold, fontSize: 10.5, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                    {`¥${meal.estimatedPriceCny}`}
                  </Text>
                </View>
                <Text variant="label" style={{ color: pal.ink, fontSize: 13, fontWeight: '700' }}>
                  {`${meal.icon} ${meal.nameZh}`}
                </Text>
                <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
                  {`＋${meal.proteinG}g 蛋白 · ${meal.kcal} kcal`}
                </Text>
              </Pressable>
            ))}
          </View>
        </Stack>
      </Card>
    </Stack>
  );
}

const styles = StyleSheet.create({
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  splitTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetExerciseCard: {
    flex: 1,
    minWidth: 195,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'space-between',
    gap: 8,
  },
  oneTapSetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  microBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  inputField: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
    fontSize: 13,
  },
  primarySaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
});
