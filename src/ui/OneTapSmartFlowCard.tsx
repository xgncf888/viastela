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
  const weightPresets = buildOneTapWeightPresets(lastWeightKg);

  const pal = isDark
    ? {
        cardBg: '#161412',
        cardBorder: 'rgba(245, 185, 66, 0.38)',
        innerBg: '#1d1a16',
        innerBorder: 'rgba(255, 248, 235, 0.10)',
        primaryBtnBg: 'rgba(245, 185, 66, 0.20)',
        primaryBtnBorder: '#f5b942',
        primaryBtnText: '#fef08a',
        secondaryBtnBg: '#25211d',
        secondaryBtnBorder: 'rgba(255, 248, 235, 0.14)',
        ink: '#fafaf9',
        sub: '#d6d3d1',
        muted: '#a8a29e',
        emerald: '#34d399',
        gold: '#f5b942',
        terracotta: '#e8924a',
      }
    : {
        cardBg: color.card,
        cardBorder: color.accent,
        innerBg: color.surface,
        innerBorder: color.line,
        primaryBtnBg: color.accentSoft,
        primaryBtnBorder: color.accent,
        primaryBtnText: color.accent,
        secondaryBtnBg: color.card,
        secondaryBtnBorder: color.line,
        ink: color.ink,
        sub: color.ink,
        muted: color.muted,
        emerald: color.green,
        gold: '#b88228',
        terracotta: color.accent,
      };

  function handleInstantWeightTap(weightKg: number) {
    onOneTapSaveWeight(weightKg);
    const v = recordPledgeReward(`一键晨重：${weightKg.toFixed(1)} kg`, localDay);
    setManualStageOverride(null);
    showToast({
      text: t(
        `✓ 已一键记入晨重 ${weightKg.toFixed(1)} kg · 心愿金库 +¥${v.config.checkInRewardCny}`,
        `✓ Logged ${weightKg.toFixed(1)} kg in 1 tap · Wish Vault +¥${v.config.checkInRewardCny}`,
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
        `✓ 已一键记入「${title}」${preset.durationMinutes} 分钟 & 24H时间轴 · 心愿金 +¥${v.config.checkInRewardCny}`,
        `✓ Logged "${title}" (${preset.durationMinutes}m) & 24H Timeline · Wish Vault +¥${v.config.checkInRewardCny}`,
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
        `✓ 已一键记入训练「${exerciseName} × ${preset.reps}次」· 心愿金 +¥${v.config.checkInRewardCny}`,
        `✓ Logged "${exerciseName} × ${preset.reps}" in 1 tap · Wish Vault +¥${v.config.checkInRewardCny}`,
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
        `✓ 已一键完成今日微习惯与 OKR 关键结果推进 · 心愿金库 +¥${v.config.checkInRewardCny}`,
        `✓ Completed Daily Habit & OKR Check-In in 1 tap · Wish Vault +¥${v.config.checkInRewardCny}`,
      ),
    });
  }

  async function handleSmartSweepAllRemaining() {
    const baseKg = lastWeightKg && lastWeightKg > 0 ? Math.round(lastWeightKg * 10) / 10 : 70.0;
    if (!hasWeightToday) {
      onOneTapSaveWeight(baseKg);
    }
    if (!hasFocusToday) {
      const p = ONE_TAP_FOCUS_PRESETS[0]!;
      onOneTapSaveStudy({
        topic: t(p.topicZh, p.topicEn),
        durationMinutes: p.durationMinutes,
        note: t('一键智能补齐', '1-Tap Smart Sweep'),
      });
    }
    if (!hasWorkoutToday) {
      const w = ONE_TAP_WORKOUT_PRESETS[0]!;
      await onOneTapSaveWorkout({
        exercise: t(w.exerciseZh, w.exerciseEn),
        reps: w.reps,
        weightKg: w.weightKg,
        bandLevel: w.bandLevel,
      });
    }
    handleInstantEveningTap();
  }

  const stageTabs: {
    id: OneTapStageId;
    num: string;
    label: string;
    done: boolean;
  }[] = [
    {
      id: 'weight',
      num: '①',
      label: t('晨起记体重', 'Weigh-In'),
      done: hasWeightToday,
    },
    {
      id: 'focus',
      num: '②',
      label: t('专注/时间块', 'Focus Block'),
      done: hasFocusToday,
    },
    {
      id: 'training',
      num: '③',
      label: t('记训练组', 'Workout'),
      done: hasWorkoutToday,
    },
    {
      id: 'evening',
      num: '④',
      label: t('习惯 & OKR', 'Habit & OKR'),
      done: hasEveningCheckInToday,
    },
  ];

  return (
    <View
      testID="today-onetap-smart-flow"
      style={[
        styles.container,
        {
          backgroundColor: pal.cardBg,
          borderColor: pal.cardBorder,
        },
      ]}
    >
      {/* Top Row: User-Perspective "What Do I Tap First?" Guidance + 4-Step Switcher */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.badgeRow}>
            <TagChip
              label={t(plan.promptBadgeZh, plan.promptBadgeEn)}
              tone={plan.completedSteps === 4 ? 'exec' : 'owner'}
            />
            <Text variant="caption" style={{ color: pal.muted }}>
              {t(
                `零输入免打字 · 点按 1 次即完成记录 (${plan.completedSteps}/4)`,
                `Zero typing · 1-Tap Instant Log (${plan.completedSteps}/4)`,
              )}
            </Text>
          </View>
          <Text variant="label" style={[styles.headline, { color: pal.ink }]}>
            {t(plan.headlineZh, plan.headlineEn)}
          </Text>
          <Text variant="caption" style={{ color: pal.muted }}>
            {t(plan.sublineZh, plan.sublineEn)}
          </Text>
        </View>

        {/* 4-Step Instant Mode Switcher */}
        <View style={styles.stagePillsWrap}>
          {stageTabs.map((st) => {
            const isActive = activeStage === st.id;
            return (
              <Pressable
                key={st.id}
                accessibilityRole="button"
                accessibilityLabel={`切换一键动作 ${st.label}`}
                onPress={() =>
                  setManualStageOverride((prev) => (prev === st.id ? null : st.id))
                }
                style={[
                  styles.stageTabBtn,
                  {
                    backgroundColor: isActive ? pal.primaryBtnBg : pal.innerBg,
                    borderColor: isActive
                      ? pal.primaryBtnBorder
                      : st.done
                        ? pal.emerald
                        : pal.innerBorder,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: st.done
                      ? pal.emerald
                      : isActive
                        ? pal.primaryBtnText
                        : pal.sub,
                    fontWeight: isActive || st.done ? '700' : '500',
                    fontSize: 11.5,
                  }}
                >
                  {`${st.done ? '✓' : st.num} ${st.label}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Bottom Row: Big Thumb-Friendly 1-Tap Action Strip for the Active Stage */}
      <View
        style={[
          styles.actionStripBox,
          {
            backgroundColor: pal.innerBg,
            borderColor: pal.innerBorder,
          },
        ]}
      >
        {activeStage === 'weight' ? (
          <View style={styles.presetButtonsRow}>
            {weightPresets.map((preset) => (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityLabel={t(preset.labelZh, preset.labelEn)}
                onPress={() => handleInstantWeightTap(preset.weightKg)}
                style={({ pressed }) => [
                  styles.oneTapActionChip,
                  {
                    backgroundColor: preset.isPrimary
                      ? pal.primaryBtnBg
                      : pal.secondaryBtnBg,
                    borderColor: preset.isPrimary
                      ? pal.primaryBtnBorder
                      : pal.secondaryBtnBorder,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: preset.isPrimary ? pal.primaryBtnText : pal.ink,
                    fontWeight: preset.isPrimary ? '700' : '600',
                    fontFamily: theme.fontFamily.mono,
                    fontSize: 12,
                  }}
                >
                  {t(preset.labelZh, preset.labelEn)}
                </Text>
              </Pressable>
            ))}
            <CockpitPillButton
              label={t('✎ 手动输入体重…', '✎ Custom Weight…')}
              onPress={() => onOpenCustomSheet('weight')}
            />
          </View>
        ) : null}

        {activeStage === 'focus' ? (
          <View style={styles.presetButtonsRow}>
            {ONE_TAP_FOCUS_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityLabel={`${t(preset.topicZh, preset.topicEn)} ${preset.durationMinutes}m`}
                onPress={() => handleInstantFocusTap(preset)}
                style={({ pressed }) => [
                  styles.oneTapActionChip,
                  {
                    backgroundColor: preset.isPrimary
                      ? pal.primaryBtnBg
                      : pal.secondaryBtnBg,
                    borderColor: preset.isPrimary
                      ? pal.primaryBtnBorder
                      : pal.secondaryBtnBorder,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: preset.isPrimary ? pal.primaryBtnText : pal.ink,
                    fontWeight: preset.isPrimary ? '700' : '600',
                    fontSize: 12,
                  }}
                >
                  {`${preset.isPrimary ? '⚡ ' : '📚 '}${t(preset.topicZh, preset.topicEn)} · ${preset.durationMinutes}m`}
                </Text>
              </Pressable>
            ))}
            <CockpitPillButton
              label={t('✎ 自定义学习/1m时间块…', '✎ Custom Study / 1m Block…')}
              onPress={() => onOpenCustomSheet('study')}
            />
          </View>
        ) : null}

        {activeStage === 'training' ? (
          <View style={styles.presetButtonsRow}>
            {ONE_TAP_WORKOUT_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityLabel={t(preset.labelZh, preset.labelEn)}
                onPress={() => void handleInstantWorkoutTap(preset)}
                style={({ pressed }) => [
                  styles.oneTapActionChip,
                  {
                    backgroundColor: preset.isPrimary
                      ? pal.primaryBtnBg
                      : pal.secondaryBtnBg,
                    borderColor: preset.isPrimary
                      ? pal.primaryBtnBorder
                      : pal.secondaryBtnBorder,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: preset.isPrimary ? pal.primaryBtnText : pal.ink,
                    fontWeight: preset.isPrimary ? '700' : '600',
                    fontSize: 12,
                  }}
                >
                  {t(preset.labelZh, preset.labelEn)}
                </Text>
              </Pressable>
            ))}
            <CockpitPillButton
              label={t('✎ 更多动作/负重…', '✎ Custom Exercise…')}
              onPress={() => onOpenCustomSheet('training')}
            />
          </View>
        ) : null}

        {activeStage === 'evening' ? (
          <View style={styles.presetButtonsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('一键完成今日习惯与 OKR 推进', '1-Tap Complete Daily Habit & OKR')}
              onPress={handleInstantEveningTap}
              style={({ pressed }) => [
                styles.oneTapActionChip,
                {
                  backgroundColor: pal.primaryBtnBg,
                  borderColor: pal.primaryBtnBorder,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text
                variant="caption"
                style={{
                  color: pal.primaryBtnText,
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {t(
                  '⚡ 一键完成今日微习惯打卡 & OKR 推进 (+¥25 心愿金)',
                  '⚡ 1-Tap Habit & OKR Check-In (+¥25 Wish Vault)',
                )}
              </Text>
            </Pressable>

            {plan.completedSteps < 4 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('一键智能补齐今日全部未完项', '1-Tap Smart Sweep All Remaining')}
                onPress={() => void handleSmartSweepAllRemaining()}
                style={({ pressed }) => [
                  styles.oneTapActionChip,
                  {
                    backgroundColor: pal.secondaryBtnBg,
                    borderColor: pal.emerald,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: pal.emerald,
                    fontWeight: '700',
                    fontSize: 12,
                  }}
                >
                  {t(
                    '✦ 懒人模式：一键补齐今日全部未完打卡',
                    '✦ Smart Sweep: Complete All Remaining Today in 1 Tap',
                  )}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    minWidth: 240,
    gap: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  headline: {
    fontSize: 15,
    fontWeight: '700',
  },
  stagePillsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  stageTabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionStripBox: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  oneTapActionChip: {
    minHeight: 34,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
