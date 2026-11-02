import { addDaysToLocalDay } from './life-milestones-okr';
import { type TimeBlockItem } from './time-block-tracker';

export type PledgeRuleConfig = {
  /** Reward credited into Wish Vault on each daily habit / OKR / 10000h check-in (CNY) */
  checkInRewardCny: number;
  /** Penalty transferred into Index DCA Pool on missed day / manual pledge trigger (CNY) */
  missedPenaltyCny: number;
  /** Target index ETF name for penalty DCA pool */
  penaltyIndexName: string;
};

export type WishVaultItem = {
  id: string;
  title: string;
  targetCny: number;
  allocatedCny: number;
  linkedLabel: string;
  redeemed: boolean;
  createdAt: string;
};

export type PledgeLedgerEntry = {
  id: string;
  localDay: string;
  kind: 'reward' | 'penalty' | 'redeem';
  amountCny: number;
  reason: string;
  createdAt: string;
};

export type PledgeVaultState = {
  config: PledgeRuleConfig;
  wishBalanceCny: number;
  penaltyDcaPoolCny: number;
  wishes: WishVaultItem[];
  ledger: PledgeLedgerEntry[];
};

export type TimeCapsuleItem = {
  id: string;
  title: string;
  recipientLabel: string;
  message: string;
  createdDay: string;
  /** YYYY-MM-DD when capsule can be opened */
  unlockDay: string;
  openedAt: string | null;
};

export type TimeCapsuleComputed = {
  capsule: TimeCapsuleItem;
  isUnlocked: boolean;
  daysUntilUnlock: number;
  statusBadge: string;
};

export type HeatmapCell = {
  localDay: string;
  /** 0..4 intensity level */
  level: 0 | 1 | 2 | 3 | 4;
  score: number;
  hasWeight: boolean;
  trainingCount: number;
  studyMinutes: number;
  habitCount: number;
  milestoneTitle: string | null;
};

export type BodyFocusCorrelationSummary = {
  synergyScore: number;
  trainingDaysCount: number;
  restDaysCount: number;
  avgFocusOnTrainingDayMins: number;
  avgFocusOnRestDayMins: number;
  trainingFocusBoostPct: number | null;
  goldenHourLabel: string;
  goldenHourMinutes: number;
  insightHeadline: string;
  insightDetail: string;
};

export const DEFAULT_PLEDGE_VAULT: PledgeVaultState = {
  config: {
    checkInRewardCny: 50,
    missedPenaltyCny: 100,
    penaltyIndexName: '沪深300 / 纳指100 定投池',
  },
  wishBalanceCny: 350,
  penaltyDcaPoolCny: 200,
  wishes: [
    {
      id: 'wish-anniversary-dinner',
      title: '纪念日米其林双人晚宴与花束基金',
      targetCny: 1500,
      allocatedCny: 350,
      linkedLabel: '关联：重要纪念日',
      redeemed: false,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'wish-home-gym-upgrade',
      title: '升级可调式哑铃 / 专业跑鞋装备',
      targetCny: 1200,
      allocatedCny: 0,
      linkedLabel: '关联：O1 精益体态与体能',
      redeemed: false,
      createdAt: '2026-10-05T00:00:00.000Z',
    },
  ],
  ledger: [
    {
      id: 'pledge-init-1',
      localDay: '2026-11-01',
      kind: 'reward',
      amountCny: 50,
      reason: '完成每日晨重与深度专注打卡奖励',
      createdAt: '2026-11-01T09:00:00.000Z',
    },
  ],
};

export const DEFAULT_TIME_CAPSULES: readonly TimeCapsuleItem[] = [
  {
    id: 'cap-2026-yearend',
    title: '写给 2026 年末收官日的自己',
    recipientLabel: '未来的自己 · 年度复盘',
    message:
      '当你打开这封信时，2026 年已经走完。希望你的晨重已经稳定在目标区间，AI 架构的 10,000 小时里程碑又扎实地向前迈进了一大步。无论外界市场如何波动，保持健康的体魄和专注的节奏就是最大的复利。',
    createdDay: '2026-01-01',
    unlockDay: '2026-12-31',
    openedAt: null,
  },
  {
    id: 'cap-unlocked-milestone',
    title: '开启数字化自律系统的初心锚点',
    recipientLabel: '随时重温 · 初心记录',
    message:
      '记录不是为了数字本身，而是为了看清每一分钟、每一克体重和每一份资产背后的生活轨迹。',
    createdDay: '2026-01-01',
    unlockDay: '2026-01-01',
    openedAt: null,
  },
];

function parseUtcMs(localDay: string): number {
  const [y, m, d] = localDay.split('-').map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0;
  return Date.UTC(y!, m! - 1, d!);
}

export function computeTimeCapsuleStatus(
  capsule: TimeCapsuleItem,
  todayLocalDay: string,
): TimeCapsuleComputed {
  const diff = Math.round((parseUtcMs(capsule.unlockDay) - parseUtcMs(todayLocalDay)) / 86_400_000);
  const isUnlocked = diff <= 0;
  const daysUntilUnlock = Math.max(0, diff);
  const statusBadge = isUnlocked
    ? `已解锁 · 可开启阅读`
    : `封印中 · 距 ${capsule.unlockDay} 开启还有 ${daysUntilUnlock} 天`;

  return {
    capsule,
    isUnlocked,
    daysUntilUnlock,
    statusBadge,
  };
}

export function buildLifeHeatmapGrid(input: {
  endDay: string;
  totalDays?: number;
  weightDays: ReadonlySet<string>;
  trainingCountByDay: ReadonlyMap<string, number>;
  studyMinutesByDay: ReadonlyMap<string, number>;
  habitCountByDay: ReadonlyMap<string, number>;
  milestoneByMonthDay?: ReadonlyMap<string, string>;
}): {
  cells: HeatmapCell[];
  activeDaysCount: number;
  perfectDaysCount: number;
  totalScore: number;
} {
  const totalDays = Math.max(28, Math.min(365, input.totalDays ?? 140));
  const cells: HeatmapCell[] = [];
  let activeDaysCount = 0;
  let perfectDaysCount = 0;
  let totalScore = 0;

  for (let i = totalDays - 1; i >= 0; i -= 1) {
    const dayKey = addDaysToLocalDay(input.endDay, -i);
    const hasWeight = input.weightDays.has(dayKey);
    const trainingCount = input.trainingCountByDay.get(dayKey) ?? 0;
    const studyMinutes = input.studyMinutesByDay.get(dayKey) ?? 0;
    const habitCount = input.habitCountByDay.get(dayKey) ?? 0;
    const mmdd = dayKey.slice(5);
    const milestoneTitle = input.milestoneByMonthDay?.get(mmdd) ?? null;

    let score = 0;
    if (hasWeight) score += 1;
    if (trainingCount > 0) score += 1;
    if (studyMinutes >= 30) score += 1;
    if (studyMinutes >= 90 || habitCount >= 2) score += 1;

    const level = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
    if (score > 0) activeDaysCount += 1;
    if (level === 4) perfectDaysCount += 1;
    totalScore += score;

    cells.push({
      localDay: dayKey,
      level,
      score,
      hasWeight,
      trainingCount,
      studyMinutes,
      habitCount,
      milestoneTitle,
    });
  }

  return {
    cells,
    activeDaysCount,
    perfectDaysCount,
    totalScore,
  };
}

export function computeBodyFocusCorrelation(input: {
  endDay: string;
  windowDays?: number;
  weightDays: ReadonlySet<string>;
  trainingCountByDay: ReadonlyMap<string, number>;
  studyMinutesByDay: ReadonlyMap<string, number>;
  timeBlocks: readonly TimeBlockItem[];
}): BodyFocusCorrelationSummary {
  const windowDays = Math.max(7, input.windowDays ?? 28);
  let trainingDaysCount = 0;
  let restDaysCount = 0;
  let trainingFocusSum = 0;
  let restFocusSum = 0;
  let activeSynergyDays = 0;

  for (let i = 0; i < windowDays; i += 1) {
    const dayKey = addDaysToLocalDay(input.endDay, -i);
    const tCount = input.trainingCountByDay.get(dayKey) ?? 0;
    const sMins = input.studyMinutesByDay.get(dayKey) ?? 0;
    const hasW = input.weightDays.has(dayKey);

    if (tCount > 0 || sMins > 0 || hasW) {
      if ((tCount > 0 && sMins > 0) || (hasW && sMins > 0)) {
        activeSynergyDays += 1;
      }
    }

    if (tCount > 0) {
      trainingDaysCount += 1;
      trainingFocusSum += sMins;
    } else if (sMins > 0 || hasW) {
      restDaysCount += 1;
      restFocusSum += sMins;
    }
  }

  const avgFocusOnTrainingDayMins =
    trainingDaysCount > 0 ? Math.round(trainingFocusSum / trainingDaysCount) : 0;
  const avgFocusOnRestDayMins =
    restDaysCount > 0 ? Math.round(restFocusSum / restDaysCount) : 0;

  let trainingFocusBoostPct: number | null = null;
  if (trainingDaysCount > 0 && avgFocusOnRestDayMins > 0) {
    trainingFocusBoostPct = Math.round(
      ((avgFocusOnTrainingDayMins - avgFocusOnRestDayMins) / avgFocusOnRestDayMins) * 100,
    );
  }

  // Analyze golden focus hour from 24H time blocks (study + deep-work)
  const hourBuckets = new Array<number>(24).fill(0);
  for (const block of input.timeBlocks) {
    if (block.category !== 'study' && block.category !== 'deep-work') continue;
    const startH = Math.max(0, Math.min(23, Math.floor(block.startMinute / 60)));
    const endH = Math.max(startH, Math.min(23, Math.floor((block.endMinute - 1) / 60)));
    for (let h = startH; h <= endH; h += 1) {
      const segStart = Math.max(block.startMinute, h * 60);
      const segEnd = Math.min(block.endMinute, (h + 1) * 60);
      if (segEnd > segStart) {
        hourBuckets[h]! += segEnd - segStart;
      }
    }
  }

  let bestHour = 9;
  let bestHourMins = 0;
  hourBuckets.forEach((mins, hour) => {
    if (mins > bestHourMins) {
      bestHourMins = mins;
      bestHour = hour;
    }
  });

  const goldenHourLabel =
    bestHourMins > 0
      ? `${String(bestHour).padStart(2, '0')}:00–${String(Math.min(24, bestHour + 2)).padStart(2, '0')}:00`
      : '待记录专注时间块';

  const loggedDays = trainingDaysCount + restDaysCount;
  const synergyScore =
    loggedDays === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (activeSynergyDays / Math.max(1, Math.min(windowDays, loggedDays))) * 70 +
              Math.min(30, (trainingDaysCount + (bestHourMins > 0 ? 2 : 0)) * 5),
          ),
        );

  let insightHeadline = '继续记录训练与专注时间块，解锁你的个人身心节律相关性';
  let insightDetail =
    '系统会自动对比你在「训练日」与「非训练日」的深度专注时长，并从 24H 时间块矩阵中定位你的黄金心流时段。';

  if (trainingDaysCount > 0 && avgFocusOnTrainingDayMins > 0) {
    if (trainingFocusBoostPct !== null && trainingFocusBoostPct > 0) {
      insightHeadline = `训练日平均专注 ${avgFocusOnTrainingDayMins} 分钟，比非训练日高出 +${trainingFocusBoostPct}%`;
      insightDetail = `数据表明力量/有氧训练对你的认知专注有正向激活效应；黄金心流集中在 ${goldenHourLabel}。`;
    } else {
      insightHeadline = `近 ${windowDays} 天已完成 ${trainingDaysCount} 个训练日，训练日均专注 ${avgFocusOnTrainingDayMins} 分钟`;
      insightDetail = `建议将高强度训练安排在黄金心流时段（${goldenHourLabel}）之后，兼顾认知产出与体能恢复。`;
    }
  }

  return {
    synergyScore,
    trainingDaysCount,
    restDaysCount,
    avgFocusOnTrainingDayMins,
    avgFocusOnRestDayMins,
    trainingFocusBoostPct,
    goldenHourLabel,
    goldenHourMinutes: bestHourMins,
    insightHeadline,
    insightDetail,
  };
}

export function formatMenuBarCapsuleTitle(input: {
  timerRunning: boolean;
  timerTitle: string;
  timerElapsedSeconds: number;
  nearestMilestoneTitle?: string | null;
  nearestMilestoneDays?: number | null;
  wishVaultCny: number;
}): string {
  const parts: string[] = [];
  if (input.timerRunning) {
    const mins = Math.floor(input.timerElapsedSeconds / 60);
    const secs = input.timerElapsedSeconds % 60;
    const clock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const shortTitle = input.timerTitle.trim().slice(0, 8) || '专注';
    parts.push(`⏱ ${shortTitle} ${clock}`);
  } else {
    parts.push('✦ 星途');
  }

  if (
    input.nearestMilestoneTitle &&
    typeof input.nearestMilestoneDays === 'number' &&
    input.nearestMilestoneDays >= 0 &&
    input.nearestMilestoneDays <= 30
  ) {
    const shortMs = input.nearestMilestoneTitle.slice(0, 6);
    parts.push(
      input.nearestMilestoneDays === 0 ? `🎉 ${shortMs}今日` : `${shortMs} ${input.nearestMilestoneDays}d`,
    );
  } else {
    parts.push(`心愿池 ¥${Math.round(input.wishVaultCny)}`);
  }

  return parts.join(' · ');
}
