/**
 * Pure TypeScript engine for Zero-Friction "Pick Up Phone -> What Do I Tap First?" 1-Tap User Flow.
 * Computes the next best action based on today's completion state and time of day,
 * and provides 1-tap zero-typing presets for Weight, Focus/Study, Workout, and OKR/Habits.
 */

export type OneTapStageId = 'weight' | 'focus' | 'training' | 'evening';

export interface OneTapWeightPreset {
  id: string;
  deltaKg: number;
  weightKg: number;
  labelZh: string;
  labelEn: string;
  isPrimary?: boolean;
}

export interface OneTapFocusPreset {
  id: string;
  topicZh: string;
  topicEn: string;
  durationMinutes: number;
  category: 'study' | 'deep-work';
  isPrimary?: boolean;
}

export interface OneTapWorkoutPreset {
  id: string;
  exerciseZh: string;
  exerciseEn: string;
  reps: number;
  weightKg: number | null;
  bandLevel: string | null;
  labelZh: string;
  labelEn: string;
  isPrimary?: boolean;
}

export interface NextBestActionPlan {
  recommendedStage: OneTapStageId;
  completedSteps: number;
  totalSteps: 4;
  progressPct: number;
  promptBadgeZh: string;
  promptBadgeEn: string;
  headlineZh: string;
  headlineEn: string;
  sublineZh: string;
  sublineEn: string;
}

export function roundWeightOneDecimal(kg: number): number {
  return Math.round(kg * 10) / 10;
}

/**
 * Generates 5 zero-typing 1-tap weight buttons centered around the user's last recorded weight
 * (or 70.0 kg default if first time).
 */
export function buildOneTapWeightPresets(lastWeightKg?: number | null): OneTapWeightPreset[] {
  const base = lastWeightKg && lastWeightKg > 0 ? roundWeightOneDecimal(lastWeightKg) : 70.0;
  const deltas = [0, -0.2, -0.1, 0.1, 0.2];
  return deltas.map((delta) => {
    const target = roundWeightOneDecimal(base + delta);
    if (delta === 0) {
      return {
        id: 'wt-same',
        deltaKg: 0,
        weightKg: target,
        labelZh: `⚡ 一键记 ${target.toFixed(1)} kg (同上次)`,
        labelEn: `⚡ 1-Tap ${target.toFixed(1)} kg (Same)`,
        isPrimary: true,
      };
    }
    const sign = delta > 0 ? '+' : '';
    return {
      id: `wt-${delta > 0 ? 'plus' : 'minus'}-${Math.abs(delta)}`,
      deltaKg: delta,
      weightKg: target,
      labelZh: `${sign}${delta.toFixed(1)} → ${target.toFixed(1)} kg`,
      labelEn: `${sign}${delta.toFixed(1)} → ${target.toFixed(1)} kg`,
    };
  });
}

export const ONE_TAP_FOCUS_PRESETS: readonly OneTapFocusPreset[] = [
  {
    id: 'focus-45',
    topicZh: '深度心流创造',
    topicEn: 'Deep Flow Creation',
    durationMinutes: 45,
    category: 'deep-work',
    isPrimary: true,
  },
  {
    id: 'focus-25',
    topicZh: '番茄钟核心攻关',
    topicEn: 'Pomodoro Sprint',
    durationMinutes: 25,
    category: 'study',
  },
  {
    id: 'focus-30',
    topicZh: '系统架构与精读',
    topicEn: 'System Design & Reading',
    durationMinutes: 30,
    category: 'study',
  },
  {
    id: 'focus-60',
    topicZh: '一万小时沉浸研发',
    topicEn: '10,000h Immersive R&D',
    durationMinutes: 60,
    category: 'deep-work',
  },
] as const;

export const ONE_TAP_WORKOUT_PRESETS: readonly OneTapWorkoutPreset[] = [
  {
    id: 'wk-pushup',
    exerciseZh: '俯卧撑',
    exerciseEn: 'Push-ups',
    reps: 20,
    weightKg: 20,
    bandLevel: null,
    labelZh: '⚡ 一键记：俯卧撑 20kg × 20次',
    labelEn: '⚡ 1-Tap: Push-ups 20kg × 20',
    isPrimary: true,
  },
  {
    id: 'wk-squat',
    exerciseZh: '深蹲',
    exerciseEn: 'Squats',
    reps: 10,
    weightKg: 60,
    bandLevel: null,
    labelZh: '🏋️ 深蹲 60kg × 10次',
    labelEn: '🏋️ Squat 60kg × 10',
  },
  {
    id: 'wk-bench',
    exerciseZh: '卧推',
    exerciseEn: 'Bench Press',
    reps: 10,
    weightKg: 50,
    bandLevel: null,
    labelZh: '💪 卧推 50kg × 10次',
    labelEn: '💪 Bench 50kg × 10',
  },
  {
    id: 'wk-pullup',
    exerciseZh: '引体向上',
    exerciseEn: 'Pull-ups',
    reps: 10,
    weightKg: null,
    bandLevel: 'green',
    labelZh: '🟢 引体向上(绿带) × 10次',
    labelEn: '🟢 Pull-ups (Green) × 10',
  },
] as const;

/**
 * Determines what the user should tap first when they pick up their phone right now.
 */
export function computeNextBestUserAction(input: {
  hasWeightToday: boolean;
  hasFocusToday: boolean;
  hasWorkoutToday: boolean;
  hasEveningCheckInToday: boolean;
  currentHour?: number;
  lastWeightKg?: number | null;
}): NextBestActionPlan {
  const {
    hasWeightToday,
    hasFocusToday,
    hasWorkoutToday,
    hasEveningCheckInToday,
    lastWeightKg,
  } = input;

  const completedSteps =
    (hasWeightToday ? 1 : 0) +
    (hasFocusToday ? 1 : 0) +
    (hasWorkoutToday ? 1 : 0) +
    (hasEveningCheckInToday ? 1 : 0);
  const progressPct = Math.round((completedSteps / 4) * 100);
  const baseKg = lastWeightKg && lastWeightKg > 0 ? lastWeightKg.toFixed(1) : '70.0';

  if (!hasWeightToday) {
    return {
      recommendedStage: 'weight',
      completedSteps,
      totalSteps: 4,
      progressPct,
      promptBadgeZh: '📱 拿起手机第一步 · Step 1/4',
      promptBadgeEn: '📱 First Tap Today · Step 1/4',
      headlineZh: `先点这里：1 秒确认今日晨重（上次 ${baseKg} kg）`,
      headlineEn: `Tap Here First: 1-Tap Morning Weight (Last ${baseKg} kg)`,
      sublineZh: '无需打字输入，直接点下方胶囊即可写入今日体重并点亮第一颗星 (+¥25 心愿金)。',
      sublineEn: 'Zero typing required—tap any weight pill below to log immediately (+¥25 Wish Vault).',
    };
  }

  if (!hasFocusToday) {
    return {
      recommendedStage: 'focus',
      completedSteps,
      totalSteps: 4,
      progressPct,
      promptBadgeZh: '📱 此刻推荐动作 · Step 2/4',
      promptBadgeEn: '📱 Recommended Next · Step 2/4',
      headlineZh: '晨重已记 ✓ 下一步：一键切入今日专注时间块',
      headlineEn: 'Weight Logged ✓ Next: 1-Tap Focus & Time Block',
      sublineZh: '点一下即可同时写入「今日学习」与「24H 1分钟时间轴」，自动累加一万小时定律。',
      sublineEn: 'One tap logs both your Study record and 24H 1-minute timeline block.',
    };
  }

  if (!hasWorkoutToday) {
    return {
      recommendedStage: 'training',
      completedSteps,
      totalSteps: 4,
      progressPct,
      promptBadgeZh: '📱 此刻推荐动作 · Step 3/4',
      promptBadgeEn: '📱 Recommended Next · Step 3/4',
      headlineZh: '专注已记 ✓ 下一步：一键记录今日训练组',
      headlineEn: 'Focus Logged ✓ Next: 1-Tap Workout Set',
      sublineZh: '精选常用动作与负重，点按一次直接完成今日运动打卡，无需手动填表。',
      sublineEn: 'Tap any preset set below to complete your daily workout in 1 second.',
    };
  }

  return {
    recommendedStage: 'evening',
    completedSteps,
    totalSteps: 4,
    progressPct,
    promptBadgeZh:
      completedSteps === 4 ? '🎉 今日四步全满 · 4/4' : '📱 睡前收尾一步 · Step 4/4',
    promptBadgeEn:
      completedSteps === 4 ? '🎉 All 4 Steps Complete · 4/4' : '📱 Final Step · Step 4/4',
    headlineZh:
      completedSteps === 4
        ? '太棒了！今日晨重、专注、训练与心愿打卡已全部完成'
        : '今日三大核心已记完 ✓ 最后一步：一键推进 OKR 与心愿金',
    headlineEn:
      completedSteps === 4
        ? 'All 4 daily rituals completed! Tap any preset below to log extra sessions'
        : 'Core 3 Done ✓ Final Tap: 1-Tap Habit & OKR Check-In',
    sublineZh: '点按即可一键勾选今日微习惯、推进季度 OKR 关键结果，并向心愿金库注入 +¥25 奖励。',
    sublineEn: 'One tap checks off today’s habit, advances your OKR, and rewards +¥25 to your Wish Vault.',
  };
}
