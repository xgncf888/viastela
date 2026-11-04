import type { LedgerTransaction } from './bookkeeping';
import { shiftLocalDay } from './local-day';
import type { StudyRecord } from './study';
import type { TrainingSet } from './training';
import type { WeightRecord } from './weight-stats';

export type CorrelationInsightCard = {
  id: string;
  tagZh: string;
  tagEn: string;
  tone: 'exec' | 'owner' | 'rev' | 'pod';
  titleZh: string;
  titleEn: string;
  metricBadge: string;
  detailZh: string;
  detailEn: string;
};

export type CrossModuleCorrelationSummary = {
  windowDays: number;
  activeDaysCount: number;
  synergyScore: number;
  cards: CorrelationInsightCard[];
};

/**
 * Computes cross-module correlation insights across Morning Weight, Workout Volume,
 * Deep Study Focus, and Daily Spending over a rolling window (default 14 days).
 */
export function computeCrossModuleCorrelations(input: {
  endDay: string;
  windowDays?: number;
  weights: readonly WeightRecord[];
  trainingSets: readonly TrainingSet[];
  studyRecords: readonly StudyRecord[];
  transactions: readonly LedgerTransaction[];
}): CrossModuleCorrelationSummary {
  const windowDays = Math.max(7, input.windowDays ?? 14);
  const days: string[] = [];
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    days.push(shiftLocalDay(input.endDay, -i));
  }
  const daySet = new Set(days);

  // Earliest weight per day
  const weightByDay = new Map<string, number>();
  for (const w of input.weights) {
    if (!daySet.has(w.localDay)) continue;
    if (!weightByDay.has(w.localDay)) {
      weightByDay.set(w.localDay, w.weightKg);
    }
  }

  // Training volume & sets per day
  const workoutSetsByDay = new Map<string, number>();
  const workoutVolByDay = new Map<string, number>();
  for (const s of input.trainingSets) {
    if (!daySet.has(s.localDay)) continue;
    workoutSetsByDay.set(s.localDay, (workoutSetsByDay.get(s.localDay) ?? 0) + 1);
    workoutVolByDay.set(
      s.localDay,
      (workoutVolByDay.get(s.localDay) ?? 0) + (s.weightKg ?? 25) * s.reps,
    );
  }

  // Study minutes per day
  const studyMinsByDay = new Map<string, number>();
  for (const r of input.studyRecords) {
    if (!daySet.has(r.localDay)) continue;
    studyMinsByDay.set(r.localDay, (studyMinsByDay.get(r.localDay) ?? 0) + r.durationMinutes);
  }

  // Expense CNY per day
  const expenseByDay = new Map<string, number>();
  for (const tx of input.transactions) {
    if (tx.kind !== 'expense' || !daySet.has(tx.localDay)) continue;
    expenseByDay.set(tx.localDay, (expenseByDay.get(tx.localDay) ?? 0) + tx.amountCny);
  }

  let activeDaysCount = 0;
  for (const d of days) {
    if (
      weightByDay.has(d) ||
      (workoutSetsByDay.get(d) ?? 0) > 0 ||
      (studyMinsByDay.get(d) ?? 0) > 0
    ) {
      activeDaysCount += 1;
    }
  }

  // 1. Workout -> Next-day morning weight delta
  const workoutNextDayDeltas: number[] = [];
  const restNextDayDeltas: number[] = [];
  for (let i = 0; i < days.length - 1; i += 1) {
    const today = days[i]!;
    const tomorrow = days[i + 1]!;
    const w0 = weightByDay.get(today);
    const w1 = weightByDay.get(tomorrow);
    if (w0 !== undefined && w1 !== undefined) {
      const delta = w1 - w0;
      if ((workoutSetsByDay.get(today) ?? 0) > 0) {
        workoutNextDayDeltas.push(delta);
      } else {
        restNextDayDeltas.push(delta);
      }
    }
  }

  const avgWorkoutDelta =
    workoutNextDayDeltas.length > 0
      ? workoutNextDayDeltas.reduce((s, v) => s + v, 0) / workoutNextDayDeltas.length
      : null;

  // 2. Deep Study days (>= 45m) vs non-study days daily discretionary spend
  const studyDaySpends: number[] = [];
  const nonStudyDaySpends: number[] = [];
  for (const d of days) {
    const spend = expenseByDay.get(d) ?? 0;
    const mins = studyMinsByDay.get(d) ?? 0;
    if (mins >= 30) {
      studyDaySpends.push(spend);
    } else if (spend > 0) {
      nonStudyDaySpends.push(spend);
    }
  }
  const avgStudySpend =
    studyDaySpends.length > 0
      ? studyDaySpends.reduce((s, v) => s + v, 0) / studyDaySpends.length
      : null;
  const avgNonStudySpend =
    nonStudyDaySpends.length > 0
      ? nonStudyDaySpends.reduce((s, v) => s + v, 0) / nonStudyDaySpends.length
      : null;

  // 3. Dual-Active Synergy Days (both Workout + Study on the same day)
  const dualActiveDays = days.filter(
    (d) => (workoutSetsByDay.get(d) ?? 0) > 0 && (studyMinsByDay.get(d) ?? 0) > 0,
  ).length;
  const totalWorkoutDays = days.filter((d) => (workoutSetsByDay.get(d) ?? 0) > 0).length;
  const totalStudyDays = days.filter((d) => (studyMinsByDay.get(d) ?? 0) > 0).length;

  const synergyScore = Math.min(
    100,
    Math.round(
      (activeDaysCount / windowDays) * 55 +
        (Math.min(totalWorkoutDays, 6) / 6) * 25 +
        (Math.min(totalStudyDays, 7) / 7) * 20,
    ),
  );

  const cards: CorrelationInsightCard[] = [
    {
      id: 'workout-weight-coupling',
      tagZh: '训练 × 次日晨重',
      tagEn: 'WORKOUT × NEXT-DAY WEIGHT',
      tone: 'exec',
      titleZh:
        avgWorkoutDelta !== null
          ? `训练日次晨体重均值变化 ${avgWorkoutDelta >= 0 ? '+' : ''}${avgWorkoutDelta.toFixed(2)} kg`
          : `近 ${windowDays} 日累计完成 ${totalWorkoutDays} 个训练日`,
      titleEn:
        avgWorkoutDelta !== null
          ? `Next-morning weight delta after workout: ${avgWorkoutDelta >= 0 ? '+' : ''}${avgWorkoutDelta.toFixed(2)} kg`
          : `${totalWorkoutDays} active workout days in last ${windowDays}d`,
      metricBadge:
        avgWorkoutDelta !== null
          ? `${avgWorkoutDelta >= 0 ? '+' : ''}${avgWorkoutDelta.toFixed(2)} kg`
          : `${totalWorkoutDays}/${windowDays}d`,
      detailZh:
        avgWorkoutDelta !== null
          ? avgWorkoutDelta <= 0
            ? '力量或有氧训练后的次日晨重呈稳步下降趋势，说明晚间代谢消耗与水盐恢复节奏良好。'
            : '训练次日晨重略有上浮，通常源于肌糖原超量恢复与储水反应，属于正常肌肉修复信号。'
          : '连续记录当日训练与次日晨重后，这里会自动计算训练负荷对次晨体重的净影响。',
      detailEn:
        avgWorkoutDelta !== null
          ? 'Tracks how strength/cardio sessions affect next-morning glycogen & fluid weight.'
          : 'Log consecutive morning weights and workouts to unlock next-day metabolic delta.',
    },
    {
      id: 'focus-spend-coupling',
      tagZh: '深度学习 × 消费冲动',
      tagEn: 'DEEP FOCUS × SPENDING',
      tone: 'owner',
      titleZh:
        avgStudySpend !== null && avgNonStudySpend !== null && avgNonStudySpend > 0
          ? `深度专注日均支出 ¥${Math.round(avgStudySpend)}（较非专注日 ${
              avgStudySpend <= avgNonStudySpend
                ? `省 ¥${Math.round(avgNonStudySpend - avgStudySpend)}`
                : `+¥${Math.round(avgStudySpend - avgNonStudySpend)}`
            }）`
          : `近 ${windowDays} 日完成 ${totalStudyDays} 天深度专注日`,
      titleEn:
        avgStudySpend !== null
          ? `Focus-day avg spend ¥${Math.round(avgStudySpend)}`
          : `${totalStudyDays} focus days logged in ${windowDays}d`,
      metricBadge:
        avgStudySpend !== null ? `¥${Math.round(avgStudySpend)}/d` : `${totalStudyDays} 天`,
      detailZh:
        avgStudySpend !== null && avgNonStudySpend !== null
          ? '沉浸在阅读或技术钻研的日子里，即时多巴胺消费冲动明显更低，心流本身就是最好的节流阀。'
          : '当同日既有专注学习又有记账流水时，自动对比「心流日」与「碎片日」的消费差异。',
      detailEn:
        'Compares daily discretionary spending on high-focus days (>=30m) versus fragmented days.',
    },
    {
      id: 'body-mind-resonance',
      tagZh: '文武双修同频度',
      tagEn: 'BODY × MIND RESONANCE',
      tone: dualActiveDays >= 3 ? 'exec' : 'rev',
      titleZh: `近 ${windowDays} 日共达成 ${dualActiveDays} 天「训练 + 学习」双满贯`,
      titleEn: `${dualActiveDays} dual-active days (Workout + Study) in ${windowDays}d`,
      metricBadge: `Score ${synergyScore}`,
      detailZh:
        dualActiveDays > 0
          ? '中等强度力量训练能提升 BDNF（脑源性神经营养因子），在训练日搭配 45 分钟精读往往记忆留存率最高。'
          : '尝试在完成一组俯卧撑或深蹲后开启 25 分钟番茄钟，触发「运动后高专注窗口」。',
      detailEn:
        'Tracks days where both physical training and cognitive study were logged.',
    },
  ];

  return {
    windowDays,
    activeDaysCount,
    synergyScore,
    cards,
  };
}
