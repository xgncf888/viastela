import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  buildOneTapWeightPresets,
  computeNextBestUserAction,
  ONE_TAP_FOCUS_PRESETS,
  ONE_TAP_WORKOUT_PRESETS,
  type OneTapFocusPreset,
  type OneTapStageId,
  type OneTapWorkoutPreset,
} from '@/core/one-tap-flow';
import { recordPledgeReward } from '@/data/life-gamification';
import {
  checkInKeyResult,
  readDailyHabits,
  readOkrObjectives,
  subscribeLifeOkrStore,
  toggleHabitDay,
} from '@/data/life-milestones-okr';
import { addTimeBlock } from '@/data/time-block-tracker';

import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { useI18n } from './use-i18n';
import { CockpitPillButton, TagChip } from './WorkbenchConsole';

/**
 * Low-Entropy Single-Line "Next Best Action" Bar.
 * Shows only the single most relevant next action right now with 1-tap zero-typing pills.
 */
export function OneTapSmartFlowCard({
  localDay,
  lastWeightKg,
  hasWeightToday,
  hasFocusToday,
  hasWorkoutToday,
  onOneTapSaveWeight,
  onOneTapSaveStudy,
  onOneTapSaveWorkout,
  onOpenCustomSheet,
}: {
  localDay: string;
  lastWeightKg?: number | null;
  hasWeightToday: boolean;
  hasFocusToday: boolean;
  hasWorkoutToday: boolean;
  onOneTapSaveWeight: (weightKg: number) => void;
  onOneTapSaveStudy: (input: { topic: string; durationMinutes: number; note: string | null }) => void;
  onOneTapSaveWorkout: (input: {
    exercise: string;
    reps: number;
    weightKg: number | null;
    bandLevel: string | null;
  }) => Promise<unknown>;
  onOpenCustomSheet: (kind: 'weight' | 'training' | 'study' | 'block') => void;
}) {
  const { color, scheme } = useTheme();
  const { t } = useI18n();
  const isDark = scheme === 'dark';

  const [habits, setHabits] = useState(readDailyHabits);
  const [objectives, setObjectives] = useState(readOkrObjectives);
  const [manualStageOverride, setManualStageOverride] = useState<OneTapStageId | null>(null);

  useEffect(() => {
    return subscribeLifeOkrStore(() => {
      setHabits(readDailyHabits());
      setObjectives(readOkrObjectives());
    });
  }, []);

  const habitsDoneToday = habits.filter((h) => h.completedDays.includes(localDay)).length;
  const hasEveningCheckInToday = habitsDoneToday > 0;

  const plan = computeNextBestUserAction({
    hasWeightToday,
    hasFocusToday,
    hasWorkoutToday,
    hasEveningCheckInToday,
    lastWeightKg,
  });

  const activeStage: OneTapStageId = manualStageOverride ?? plan.recommendedStage;
  const weightPresets = buildOneTapWeightPresets(lastWeightKg).slice(0, 3); // Keep only top 3 low-entropy choices: Same, -0.2, -0.1 / +0.1

  const pal = isDark
    ? {
        cardBg: '#161412',
        cardBorder: 'rgba(245, 185, 66, 0.32)',
        primaryBtnBg: 'rgba(245, 185, 66, 0.18)',
        primaryBtnBorder: '#f5b942',
        primaryBtnText: '#fef08a',
        secondaryBtnBg: '#221f1b',
        secondaryBtnBorder: 'rgba(255, 248, 235, 0.12)',
        ink: '#fafaf9',
        muted: '#a8a29e',
        emerald: '#34d399',
      }
    : {
        cardBg: color.card,
        cardBorder: color.line,
        primaryBtnBg: color.accentSoft,
        primaryBtnBorder: color.accent,
        primaryBtnText: color.accent,
        secondaryBtnBg: color.surface,
        secondaryBtnBorder: color.line,
        ink: color.ink,
        muted: color.muted,
        emerald: color.green,
      };

  function handleInstantWeightTap(weightKg: number) {
    onOneTapSaveWeight(weightKg);
    const v = recordPledgeReward(`一键晨重：${weightKg.toFixed(1)} kg`, localDay);
    setManualStageOverride(null);
    showToast({
      text: t(
        `✓ 已记晨重 ${weightKg.toFixed(1)} kg · 心愿金 +¥${v.config.checkInRewardCny}`,
        `✓ Logged ${weightKg.toFixed(1)} kg · Wish Vault +¥${v.config.checkInRewardCny}`,
      ),
    });
  }

  function handleInstantFocusTap(preset: OneTapFocusPreset) {
    const title = t(preset.topicZh, preset.topicEn);
    const now = new Date();
    const endMin = Math.max(preset.durationMinutes, now.getHours() * 60 + now.getMinutes());
    const startMin = Math.max(0, endMin - preset.durationMinutes);

    onOneTapSaveStudy({
      topic: title,
      durationMinutes: preset.durationMinutes,
      note: t('一键专注打卡', '1-Tap Focus Log'),
    });
    addTimeBlock({
      localDay,
      startMinute: startMin,
      endMinute: endMin,
      category: preset.category,
      title,
      goalId: 'goal-ai-infra',
      note: null,
    });
    const v = recordPledgeReward(`一键专注：${title} (${preset.durationMinutes}m)`, localDay);
    setManualStageOverride(null);
    showToast({
      text: t(
        `✓ 已记专注「${title}」${preset.durationMinutes}m · 心愿金 +¥${v.config.checkInRewardCny}`,
        `✓ Logged "${title}" (${preset.durationMinutes}m) · Wish Vault +¥${v.config.checkInRewardCny}`,
      ),
    });
  }

  async function handleInstantWorkoutTap(preset: OneTapWorkoutPreset) {
    const exerciseName = t(preset.exerciseZh, preset.exerciseEn);
    await onOneTapSaveWorkout({
      exercise: exerciseName,
      reps: preset.reps,
      weightKg: preset.weightKg,
      bandLevel: preset.bandLevel,
    });
    const v = recordPledgeReward(`一键训练：${exerciseName} × ${preset.reps}`, localDay);
    setManualStageOverride(null);
    showToast({
      text: t(
        `✓ 已记训练「${exerciseName} × ${preset.reps}」· 心愿金 +¥${v.config.checkInRewardCny}`,
        `✓ Logged "${exerciseName} × ${preset.reps}" · Wish Vault +¥${v.config.checkInRewardCny}`,
      ),
    });
  }

  function handleInstantEveningTap() {
    const pendingHabit = habits.find((h) => !h.completedDays.includes(localDay)) ?? habits[0];
    if (pendingHabit && !pendingHabit.completedDays.includes(localDay)) {
      toggleHabitDay(pendingHabit.id, localDay);
    }
    const firstObj = objectives[0];
    const firstKr = firstObj?.keyResults[0];
    if (firstObj && firstKr) {
      checkInKeyResult(firstObj.id, firstKr.id, firstKr.stepDelta, localDay);
    }
    const v = recordPledgeReward('晚间一键习惯与 OKR 收尾打卡', localDay);
    setManualStageOverride(null);
    showToast({
      text: t(
        `✓ 已完成今日习惯与 OKR 推进 · 心愿金 +¥${v.config.checkInRewardCny}`,
        `✓ Completed Daily Habit & OKR · Wish Vault +¥${v.config.checkInRewardCny}`,
      ),
    });
  }

  const stages: { id: OneTapStageId; label: string; done: boolean }[] = [
    { id: 'weight', label: t('① 晨重', '① Weight'), done: hasWeightToday },
    { id: 'focus', label: t('② 专注', '② Focus'), done: hasFocusToday },
    { id: 'training', label: t('③ 训练', '③ Workout'), done: hasWorkoutToday },
    { id: 'evening', label: t('④ 心愿', '④ OKR'), done: hasEveningCheckInToday },
  ];

  return (
    <View
      testID="today-onetap-smart-flow"
      style={[
        styles.bar,
        {
          backgroundColor: pal.cardBg,
          borderColor: pal.cardBorder,
        },
      ]}
    >
      {/* Left: Concise Next Step Indicator + Mini Step Dots */}
      <View style={styles.leftCluster}>
        <TagChip
          label={t(plan.promptBadgeZh, plan.promptBadgeEn)}
          tone={plan.completedSteps === 4 ? 'exec' : 'owner'}
        />
        <Text variant="label" style={[styles.headline, { color: pal.ink }]} numberOfLines={1}>
          {t(plan.headlineZh, plan.headlineEn)}
        </Text>
        <View style={styles.stepDotsRow}>
          {stages.map((st) => {
            const active = activeStage === st.id;
            return (
              <Pressable
                key={st.id}
                accessibilityRole="button"
                accessibilityLabel={`切换步骤 ${st.label}`}
                onPress={() => setManualStageOverride((p) => (p === st.id ? null : st.id))}
                style={[
                  styles.miniStepPill,
                  {
                    backgroundColor: active ? pal.primaryBtnBg : 'transparent',
                    borderColor: active ? pal.primaryBtnBorder : st.done ? pal.emerald : pal.secondaryBtnBorder,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    fontSize: 10.5,
                    fontWeight: active || st.done ? '700' : '500',
                    color: st.done ? pal.emerald : active ? pal.primaryBtnText : pal.muted,
                  }}
                >
                  {st.done ? `✓ ${st.label.slice(2)}` : st.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Right: 1-Tap Zero-Typing Action Pills */}
      <View style={styles.rightActions}>
        {activeStage === 'weight' ? (
          <>
            {weightPresets.map((preset) => (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityLabel={t(preset.labelZh, preset.labelEn)}
                onPress={() => handleInstantWeightTap(preset.weightKg)}
                style={({ pressed }) => [
                  styles.actionPill,
                  {
                    backgroundColor: preset.isPrimary ? pal.primaryBtnBg : pal.secondaryBtnBg,
                    borderColor: preset.isPrimary ? pal.primaryBtnBorder : pal.secondaryBtnBorder,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: preset.isPrimary ? pal.primaryBtnText : pal.ink,
                    fontWeight: preset.isPrimary ? '700' : '600',
                    fontFamily: theme.fontFamily.mono,
                    fontSize: 11.5,
                  }}
                >
                  {t(preset.labelZh, preset.labelEn)}
                </Text>
              </Pressable>
            ))}
            <CockpitPillButton
              label={t('自定义…', 'Custom…')}
              onPress={() => onOpenCustomSheet('weight')}
            />
          </>
        ) : null}

        {activeStage === 'focus' ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('点一下翻书加一分钟', 'Tap book to flip page +1m')}
              onPress={() =>
                handleInstantFocusTap({
                  id: 'book-flip-1m',
                  topicZh: '📖 沉浸翻书',
                  topicEn: '📖 Book Flip',
                  durationMinutes: 1,
                  category: 'study',
                  isPrimary: true,
                })
              }
              style={({ pressed }) => [
                styles.actionPill,
                {
                  backgroundColor: pal.primaryBtnBg,
                  borderColor: pal.primaryBtnBorder,
                  transform: [{ scale: pressed ? 0.93 : 1 }],
                },
              ]}
            >
              <Text
                variant="caption"
                style={{
                  color: pal.primaryBtnText,
                  fontWeight: '700',
                  fontSize: 11.5,
                }}
              >
                {t('📖 翻一页 +1m', '📖 Flip +1m')}
              </Text>
            </Pressable>
            {ONE_TAP_FOCUS_PRESETS.slice(0, 2).map((preset) => (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityLabel={`${t(preset.topicZh, preset.topicEn)} ${preset.durationMinutes}m`}
                onPress={() => handleInstantFocusTap(preset)}
                style={({ pressed }) => [
                  styles.actionPill,
                  {
                    backgroundColor: pal.secondaryBtnBg,
                    borderColor: pal.secondaryBtnBorder,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: pal.ink,
                    fontWeight: '600',
                    fontSize: 11.5,
                  }}
                >
                  {`${t(preset.topicZh, preset.topicEn)} ${preset.durationMinutes}m`}
                </Text>
              </Pressable>
            ))}
            <CockpitPillButton
              label={t('自定义…', 'Custom…')}
              onPress={() => onOpenCustomSheet('study')}
            />
          </>
        ) : null}

        {activeStage === 'training' ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('点一下健身小人动一下加一次', 'Tap fitness character +1 rep')}
              onPress={() =>
                void handleInstantWorkoutTap({
                  id: 'mini-avatar-rep',
                  labelZh: '⚡ 动一下 +1',
                  labelEn: '⚡ Rep +1',
                  exerciseZh: '深蹲',
                  exerciseEn: 'Squat',
                  reps: 1,
                  weightKg: 60,
                  bandLevel: null,
                  isPrimary: true,
                })
              }
              style={({ pressed }) => [
                styles.actionPill,
                {
                  backgroundColor: pal.primaryBtnBg,
                  borderColor: pal.primaryBtnBorder,
                  transform: [{ scale: pressed ? 0.93 : 1 }],
                },
              ]}
            >
              <Text
                variant="caption"
                style={{
                  color: pal.primaryBtnText,
                  fontWeight: '700',
                  fontSize: 11.5,
                }}
              >
                {t('🏋️ 动一下 +1次', '🏋️ Rep +1')}
              </Text>
            </Pressable>
            {ONE_TAP_WORKOUT_PRESETS.slice(0, 2).map((preset) => (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityLabel={t(preset.labelZh, preset.labelEn)}
                onPress={() => void handleInstantWorkoutTap(preset)}
                style={({ pressed }) => [
                  styles.actionPill,
                  {
                    backgroundColor: pal.secondaryBtnBg,
                    borderColor: pal.secondaryBtnBorder,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: pal.ink,
                    fontWeight: '600',
                    fontSize: 11.5,
                  }}
                >
                  {t(preset.labelZh, preset.labelEn)}
                </Text>
              </Pressable>
            ))}
            <CockpitPillButton
              label={t('自定义…', 'Custom…')}
              onPress={() => onOpenCustomSheet('training')}
            />
          </>
        ) : null}

        {activeStage === 'evening' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('一键完成今日习惯与 OKR 推进', '1-Tap Complete Daily Habit & OKR')}
            onPress={handleInstantEveningTap}
            style={({ pressed }) => [
              styles.actionPill,
              {
                backgroundColor: pal.primaryBtnBg,
                borderColor: pal.primaryBtnBorder,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: pal.primaryBtnText,
                fontWeight: '700',
                fontSize: 11.5,
              }}
            >
              {t('⚡ 一键打卡习惯 & OKR (+¥25)', '⚡ 1-Tap Habit & OKR (+¥25)')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
    minWidth: 240,
  },
  headline: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  stepDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStepPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionPill: {
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
