import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { type RuntimeHostMode } from '@/core/charioteer-plugin';
import { type PledgeVaultState } from '@/core/life-gamification';
import {
  computeObjectiveProgressPct,
  type HabitItem,
  type LifeMilestone,
  type OkrObjective,
  sortMilestonesByUrgency,
} from '@/core/life-milestones-okr';
import {
  type ActiveTimerSession,
  formatMinuteOfDay,
  formatTimerClock,
  type TimeBlockItem,
} from '@/core/time-block-tracker';
import {
  readPledgeVault,
  recordPledgeReward,
  subscribeLifeGamificationStore,
} from '@/data/life-gamification';
import {
  readDailyHabits,
  readLifeMilestones,
  readOkrObjectives,
  subscribeLifeOkrStore,
} from '@/data/life-milestones-okr';
import { addTimeBlock, readActiveTimer, readTimeBlocks } from '@/data/time-block-tracker';

import { Text } from './Text';
import { theme } from './theme';
import { showToast } from './toast';

export type SanctuaryPerspective = 'sanctuary' | 'daycycle' | 'summary';
export type LifeZoneKey = 'focus' | 'vitality' | 'wishes';

/**
 * Bespoke 2.5D Isometric Illustrations for a Personal Time & Life Sanctuary:
 * - 'focus': Isometric Warm Study Loft (Wooden desk, warm glowing reading lamp, open notebook, 10,000h hourglass)
 * - 'vitality': Isometric Home Gym & Smart Scale Corner (Training mat, sculpted dumbbells, glowing smart scale)
 * - 'wishes': Isometric Milestone & Wish Pavilion (Celestial sundial, anniversary gift chest, floating Polaris star)
 */
function IsometricLifeZoneSvg({
  zone,
  active,
}: {
  zone: LifeZoneKey;
  active: boolean;
}) {
  const rimColor =
    zone === 'focus' ? '#cc785c' : zone === 'vitality' ? '#4ade80' : '#f5b942';

  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          width: 220,
          height: 120,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: rimColor,
          backgroundColor: '#1b1917',
        }}
      />
    );
  }

  const gradTopId = `lifeTop_${zone}`;
  const gradSideId = `lifeSide_${zone}`;
  const lampGlowId = `lampGlow_${zone}`;

  return createElement(
    'svg',
    {
      width: 244,
      height: 152,
      viewBox: '0 0 265 170',
      fill: 'none',
      style: {
        overflow: 'visible',
        filter: active
          ? 'drop-shadow(0 16px 26px rgba(0, 0, 0, 0.58))'
          : 'drop-shadow(0 12px 18px rgba(0, 0, 0, 0.42))',
      },
    },
    createElement(
      'defs',
      null,
      createElement(
        'linearGradient',
        { id: gradTopId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: '#2c2825' }),
        createElement('stop', { offset: '100%', stopColor: '#1b1917' }),
      ),
      createElement(
        'linearGradient',
        { id: gradSideId, x1: '0', y1: '0', x2: '0', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: '#1f1c19' }),
        createElement('stop', { offset: '100%', stopColor: '#110f0d' }),
      ),
      createElement(
        'radialGradient',
        { id: lampGlowId, cx: '50%', cy: '50%', r: '50%' },
        createElement('stop', { offset: '0%', stopColor: rimColor, stopOpacity: '0.38' }),
        createElement('stop', { offset: '100%', stopColor: rimColor, stopOpacity: '0' }),
      ),
    ),
    // Soft ambient floor aura
    createElement('ellipse', {
      cx: 132,
      cy: 106,
      rx: 88,
      ry: 36,
      fill: `url(#${lampGlowId})`,
    }),
    // 2.5D Isometric Sanctuary Tile Base (Warm Stone & Walnut Bevel)
    createElement('polygon', {
      points: '132,146 244,102 132,58 20,102',
      fill: `url(#${gradTopId})`,
      stroke: 'rgba(255,248,235,0.18)',
      strokeWidth: 1,
    }),
    createElement('polygon', {
      points: '20,102 132,146 132,163 20,119',
      fill: `url(#${gradSideId})`,
      stroke: 'rgba(255,248,235,0.08)',
      strokeWidth: 1,
    }),
    createElement('polygon', {
      points: '244,102 132,146 132,163 244,119',
      fill: '#141210',
      stroke: 'rgba(255,248,235,0.10)',
      strokeWidth: 1,
    }),
    // Inner Glowing Sanctuary Border Ring
    createElement('polygon', {
      points: '132,136 222,101 132,66 42,101',
      fill: 'none',
      stroke: rimColor,
      strokeWidth: active ? 2.4 : 1.6,
      strokeOpacity: active ? 0.92 : 0.65,
    }),

    // Zone 1: 心流书房 (Warm Study Desk + Glowing Lamp + Open Journal + Time Hourglass)
    zone === 'focus'
      ? createElement(
          'g',
          null,
          // Isometric Warm Walnut Study Desk
          createElement('polygon', {
            points: '132,113 182,93 132,74 82,93',
            fill: '#4a3528',
            stroke: '#cc785c',
            strokeWidth: 1.1,
          }),
          createElement('polygon', {
            points: '88,96 88,118 96,121 96,99',
            fill: '#2a1e17',
          }),
          createElement('polygon', {
            points: '168,96 168,118 176,121 176,99',
            fill: '#2a1e17',
          }),
          // Open Notebook / Book on Desk
          createElement('polygon', {
            points: '126,98 148,89 134,83 112,92',
            fill: '#f7f4ec',
            stroke: '#cc785c',
            strokeWidth: 0.9,
          }),
          // Warm Brass Desk Lamp & Light Cone
          createElement('line', {
            x1: 102,
            y1: 88,
            x2: 102,
            y2: 64,
            stroke: '#f5b942',
            strokeWidth: 2,
          }),
          createElement('polygon', {
            points: '94,64 114,58 118,68 92,72',
            fill: '#f5b942',
          }),
          createElement('polygon', {
            points: '96,70 116,66 130,92 86,94',
            fill: 'rgba(245, 185, 66, 0.18)',
          }),
          // 10,000-Hour Floating Time Sundial Ring
          createElement('circle', {
            cx: 158,
            cy: 66,
            r: 12,
            fill: '#1b1917',
            stroke: '#cc785c',
            strokeWidth: 1.6,
          }),
          createElement('path', {
            d: 'M158 60 L158 66 L163 69',
            stroke: '#fde68a',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
          }),
        )
      : null,

    // Zone 2: 活力健身角 (Isometric Yoga/Training Mat + Smart Scale + Dumbbells)
    zone === 'vitality'
      ? createElement(
          'g',
          null,
          // Isometric Training Mat
          createElement('polygon', {
            points: '118,122 184,96 154,83 88,109',
            fill: '#1f3a2e',
            stroke: '#4ade80',
            strokeWidth: 1.2,
          }),
          // Isometric Glass Smart Scale (左侧晨重秤)
          createElement('polygon', {
            points: '92,100 124,87 104,78 72,91',
            fill: '#162026',
            stroke: '#4ade80',
            strokeWidth: 1.4,
          }),
          // Digital Readout Bar on Smart Scale
          createElement('line', {
            x1: 93,
            y1: 87,
            x2: 105,
            y2: 82,
            stroke: '#4ade80',
            strokeWidth: 2.2,
            strokeLinecap: 'round',
          }),
          // Sculpted Pair of Dumbbells on Mat
          createElement('circle', { cx: 142, cy: 98, r: 4.5, fill: '#9ca3af' }),
          createElement('line', {
            x1: 142,
            y1: 98,
            x2: 156,
            y2: 92,
            stroke: '#e5e7eb',
            strokeWidth: 2.4,
          }),
          createElement('circle', { cx: 156, cy: 92, r: 4.5, fill: '#9ca3af' }),
          // Floating Heart / Vitality Pulse Badge
          createElement('circle', {
            cx: 132,
            cy: 64,
            r: 12,
            fill: '#14241b',
            stroke: '#4ade80',
            strokeWidth: 1.5,
          }),
          createElement('path', {
            d: 'M124 64 L129 64 L131 58 L134 70 L137 64 L140 64',
            stroke: '#4ade80',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }),
        )
      : null,

    // Zone 3: 星愿纪念台 (Celestial Astrolabe Sundial + Wish Treasure Box + Polaris Star)
    zone === 'wishes'
      ? createElement(
          'g',
          null,
          // Isometric Pedestal & Wish Vault Chest
          createElement('polygon', {
            points: '132,115 170,100 132,85 94,100',
            fill: '#3b2d1d',
            stroke: '#f5b942',
            strokeWidth: 1.3,
          }),
          createElement('polygon', {
            points: '94,100 132,115 132,127 94,112',
            fill: '#291f13',
            stroke: '#f5b942',
            strokeWidth: 0.9,
          }),
          createElement('polygon', {
            points: '170,100 132,115 132,127 170,112',
            fill: '#1f170e',
            stroke: '#f5b942',
            strokeWidth: 0.9,
          }),
          // Celestial Astrolabe Ring & Floating Polaris Star
          createElement('ellipse', {
            cx: 132,
            cy: 72,
            rx: 24,
            ry: 11,
            fill: 'none',
            stroke: '#f5b942',
            strokeWidth: 1.3,
            strokeDasharray: '3 3',
          }),
          createElement('path', {
            d: 'M132 52 L135 61 L144 64 L135 67 L132 76 L129 67 L120 64 L129 61 Z',
            fill: '#fde68a',
          }),
        )
      : null,
  );
}

/**
 * Flowing 24-Hour Time Stream connecting Focus Loft <-> Vitality Corner <-> Wish Pavilion
 */
function TimeStreamBridgesSvg({
  summaryLabel,
  timerRunning,
}: {
  summaryLabel: string;
  timerRunning: boolean;
}) {
  if (Platform.OS !== 'web') return null;

  return createElement(
    'svg',
    {
      viewBox: '0 0 1000 340',
      preserveAspectRatio: 'none',
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      },
    },
    createElement(
      'defs',
      null,
      createElement(
        'linearGradient',
        { id: 'vsTimeStreamGrad', x1: '0', y1: '0', x2: '1', y2: '0' },
        createElement('stop', { offset: '0%', stopColor: '#cc785c', stopOpacity: '0.88' }),
        createElement('stop', { offset: '50%', stopColor: '#4ade80', stopOpacity: '0.92' }),
        createElement('stop', { offset: '100%', stopColor: '#f5b942', stopOpacity: '0.88' }),
      ),
    ),
    createElement('path', {
      d: 'M 210 218 C 310 260, 400 260, 500 215',
      fill: 'none',
      stroke: 'rgba(204, 120, 92, 0.16)',
      strokeWidth: 5,
    }),
    createElement('path', {
      d: 'M 210 218 C 310 260, 400 260, 500 215',
      fill: 'none',
      stroke: 'url(#vsTimeStreamGrad)',
      strokeWidth: 2,
      strokeDasharray: timerRunning ? '6 6' : '8 8',
    }),
    createElement('path', {
      d: 'M 500 215 C 600 260, 690 260, 790 218',
      fill: 'none',
      stroke: 'rgba(245, 185, 66, 0.16)',
      strokeWidth: 5,
    }),
    createElement('path', {
      d: 'M 500 215 C 600 260, 690 260, 790 218',
      fill: 'none',
      stroke: 'url(#vsTimeStreamGrad)',
      strokeWidth: 2,
      strokeDasharray: '8 8',
    }),
    createElement('rect', {
      x: 370,
      y: 236,
      width: 260,
      height: 24,
      rx: 12,
      fill: '#1c1917',
      stroke: 'rgba(245, 185, 66, 0.45)',
      strokeWidth: 1,
    }),
    createElement(
      'text',
      {
        x: 500,
        y: 252,
        textAnchor: 'middle',
        fill: '#f5f5f4',
        fontSize: '10.5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
      },
      summaryLabel,
    ),
  );
}

export function IsometricStudioStage({
  mode,
  localDay,
  latestWeightKg,
  loggedCount,
  activeWeightDays,
  trainingSetsCount,
  trainingVolumeKg,
  studyMinutes,
  studyCount,
  onQuickWeight,
  onQuickTraining,
  onQuickStudy,
  onQuickJournal,
  onOpenScope,
}: {
  mode: RuntimeHostMode;
  localDay: string;
  latestWeightKg?: number | null;
  loggedCount: number;
  activeWeightDays: number;
  trainingSetsCount: number;
  trainingVolumeKg: number;
  studyMinutes: number;
  studyCount: number;
  onQuickWeight: () => void;
  onQuickTraining: () => void;
  onQuickStudy: () => void;
  onQuickJournal: () => void;
  onOpenScope?: () => void;
}) {
  const [perspective, setPerspective] = useState<SanctuaryPerspective>('sanctuary');
  const [selectedZone, setSelectedZone] = useState<LifeZoneKey>('focus');
  const [quickInput, setQuickInput] = useState('');

  // Live personal stores
  const [vault, setVault] = useState<PledgeVaultState>(readPledgeVault);
  const [milestones, setMilestones] = useState<LifeMilestone[]>(readLifeMilestones);
  const [objectives, setObjectives] = useState<OkrObjective[]>(readOkrObjectives);
  const [habits, setHabits] = useState<HabitItem[]>(readDailyHabits);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockItem[]>(readTimeBlocks);
  const [timer, setTimer] = useState<ActiveTimerSession>(readActiveTimer);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const u1 = subscribeLifeGamificationStore(() => setVault(readPledgeVault()));
    const u2 = subscribeLifeOkrStore(() => {
      setMilestones(readLifeMilestones());
      setObjectives(readOkrObjectives());
      setHabits(readDailyHabits());
    });
    const poll = setInterval(() => {
      setTimeBlocks(readTimeBlocks());
      setTimer(readActiveTimer());
      setNowMs(Date.now());
    }, 1500);
    return () => {
      u1();
      u2();
      clearInterval(poll);
    };
  }, []);

  const timerElapsedSeconds =
    timer.isRunning && timer.startedAtMs
      ? timer.accumulatedSeconds + Math.max(0, Math.floor((nowMs - timer.startedAtMs) / 1000))
      : timer.accumulatedSeconds;

  const todayBlocks = timeBlocks.filter((b) => b.localDay === localDay);
  const trackedMinsToday =
    todayBlocks.reduce((acc, b) => acc + b.durationMinutes, 0) + studyMinutes;

  const sortedMilestones = sortMilestonesByUrgency(milestones, localDay);
  const nearestMs = sortedMilestones[0] ?? null;

  const avgOkrPct =
    objectives.length > 0
      ? Math.round(
          objectives.reduce((acc, o) => acc + computeObjectiveProgressPct(o), 0) /
            objectives.length,
        )
      : 0;
  const habitsDoneToday = habits.filter((h) => h.completedDays.includes(localDay)).length;

  const rhythmBars: {
    key: LifeZoneKey;
    title: string;
    badge: string;
    pct: number;
    tone: 'terracotta' | 'emerald' | 'amber';
    summaryTitle: string;
    highlights: string[];
  }[] = [
    {
      key: 'focus',
      title: '心流书房 · 24H 时间块',
      badge: timer.isRunning
        ? `计时中 ${formatTimerClock(timerElapsedSeconds)}`
        : `${trackedMinsToday} / 240 min`,
      pct: Math.min(100, Math.round((trackedMinsToday / 240) * 100)),
      tone: 'terracotta',
      summaryTitle: '心流书房 · 今日时间块与一万小时精进',
      highlights: [
        timer.isRunning
          ? `⏱ 正在专注：「${timer.title}」，已持续 ${formatTimerClock(timerElapsedSeconds)}`
          : `✦ 今日已记录 ${todayBlocks.length} 个专注时间块，累计投入 ${trackedMinsToday} 分钟（占全天 1440 分钟的 ${Math.round((trackedMinsToday / 1440) * 100)}%）`,
        todayBlocks.length > 0
          ? `✦ 最近切入时段：${todayBlocks
              .slice(-2)
              .map((b) => `${formatMinuteOfDay(b.startMinute)}–${formatMinuteOfDay(b.endMinute)} ${b.title}`)
              .join(' · ')}`
          : '✦ 可以在上方输入框随手记一段专注（例如「系统设计 45m」），或下滑启动 24H 计时器',
      ],
    },
    {
      key: 'vitality',
      title: '活力健身角 · 晨重与训练',
      badge: `${latestWeightKg ? `${latestWeightKg.toFixed(1)} kg` : '待称重'} · ${trainingSetsCount} 组`,
      pct: Math.min(100, Math.round(((activeWeightDays / 7) * 50) + (Math.min(1, trainingSetsCount / 4) * 50))),
      tone: 'emerald',
      summaryTitle: '活力健身角 · 身体节律与运动负荷',
      highlights: [
        latestWeightKg
          ? `✦ 最新晨起体重 ${latestWeightKg.toFixed(1)} kg · 近 7 天已坚持记录 ${activeWeightDays}/7 天`
          : `✦ 近 7 天已记录晨重 ${activeWeightDays}/7 天 · 踏上蓝牙体脂秤或点击下方「＋ 晨重」即可记录今日体重`,
        trainingSetsCount > 0
          ? `✦ 今日已完成 ${trainingSetsCount} 组力量/有氧训练，累计训练容量 ${Math.round(trainingVolumeKg)} kg`
          : '✦ 今日尚未记录训练组，运动 30 分钟可显著激活专注心流',
      ],
    },
    {
      key: 'wishes',
      title: '星愿纪念台 · OKR 与心愿池',
      badge: `OKR ${avgOkrPct}% · ¥${vault.wishBalanceCny}`,
      pct: Math.min(100, Math.max(avgOkrPct, Math.round((habitsDoneToday / Math.max(1, habits.length)) * 100))),
      tone: 'amber',
      summaryTitle: '星愿纪念台 · 纪念日提醒、OKR 与自律心愿金库',
      highlights: [
        nearestMs
          ? `✦ 近期重要节点：「${nearestMs.item.title}」${nearestMs.badgeText}（${nearestMs.subtitleText}）`
          : '✦ 纪念日雷达运转中，不错过每一个周年与百日里程碑',
        `✦ 今日微习惯已打卡 ${habitsDoneToday}/${habits.length} 项 · 季度 OKR 总进度 ${avgOkrPct}% · 心愿奖励金库已攒 ¥${vault.wishBalanceCny}`,
      ],
    },
  ];

  const activeZoneDetail =
    rhythmBars.find((b) => b.key === selectedZone) ?? rhythmBars[0]!;

  function onQuickAddTimeNote() {
    const raw = quickInput.trim();
    if (!raw) {
      onQuickJournal();
      return;
    }
    const minMatch = raw.match(/(\d+)\s*(m|min|分钟)/i);
    const mins = minMatch ? Math.max(5, Math.min(360, Number.parseInt(minMatch[1]!, 10))) : 45;
    const now = new Date();
    const endMin = now.getHours() * 60 + now.getMinutes();
    const startMin = Math.max(0, endMin - mins);
    const cleanTitle = (minMatch ? raw.replace(minMatch[0], '') : raw).trim() || '专注时间块';

    setTimeBlocks(
      addTimeBlock({
        localDay,
        startMinute: startMin,
        endMinute: Math.max(startMin + 1, endMin),
        category: 'study',
        title: cleanTitle,
        goalId: 'goal-ai-infra',
      }),
    );
    const v = recordPledgeReward(`记录时间块：${cleanTitle} (${mins}分钟)`, localDay);
    setVault(v);
    setQuickInput('');
    setSelectedZone('focus');
    showToast({
      text: `已切入今日 24H 时间块：${cleanTitle} (${mins} 分钟) · 心愿金库 +¥${v.config.checkInRewardCny}`,
    });
  }

  return (
    <View style={styles.stageCard}>
      {/* Top Bar: Personal Life Sanctuary Perspective Switcher + Natural Time-Block Quick Input */}
      <View style={styles.studioTopbar}>
        <View style={styles.topbarLeft}>
          <Text variant="label" style={styles.studioTitle}>
            2.5D 个人时间与生活空间
          </Text>
          <View style={styles.perspBar}>
            {(
              [
                { id: 'sanctuary', label: '2.5D 生活三境沙盘' },
                { id: 'daycycle', label: '24H 昼夜节律环' },
                { id: 'summary', label: '今日精要看板' },
              ] as const
            ).map((tab) => {
              const active = perspective === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  accessibilityLabel={`切换视图 ${tab.label}`}
                  onPress={() => setPerspective(tab.id)}
                  style={[styles.perspPill, active ? styles.perspPillOn : null]}
                >
                  <Text
                    variant="caption"
                    style={[styles.perspPillText, active ? styles.perspPillTextOn : null]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.studioTaskbar}>
          <TextInput
            value={quickInput}
            onChangeText={setQuickInput}
            onSubmitEditing={onQuickAddTimeNote}
            placeholder="随手记下此刻在做什么 (例如: 系统设计精读 45m / 有氧慢跑 30m)…"
            placeholderTextColor="#a8a29e"
            style={[
              styles.studioTaskInput,
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="记入时间块"
            onPress={onQuickAddTimeNote}
            style={({ pressed }) => [
              styles.dispatchBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text variant="caption" style={styles.dispatchBtnText}>
              记入时间块 →
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Perspective 1: 2.5D Personal Life Sanctuary (心流书房 · 活力健身角 · 星愿纪念台) */}
      {perspective === 'sanctuary' ? (
        <View style={styles.stageGridBg}>
          <TimeStreamBridgesSvg
            summaryLabel={`今日已记 ${loggedCount}/3 · 专注 ${trackedMinsToday}m · 心愿池 ¥${vault.wishBalanceCny}`}
            timerRunning={timer.isRunning}
          />

          <View style={styles.isoCanvas}>
            {/* Zone 1: 心流书房 (Focus & 10,000h Study Loft) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="心流书房与 24H 时间块"
              onPress={() => setSelectedZone('focus')}
              style={[
                styles.isoNodeColumn,
                selectedZone === 'focus' ? styles.isoNodeSelected : null,
              ]}
            >
              <View
                style={[
                  styles.isoHudCard,
                  selectedZone === 'focus' ? styles.isoHudCardFocus : null,
                ]}
              >
                <View style={styles.isoHudHead}>
                  <Text variant="caption" style={styles.isoHudNodeTag}>
                    第一境 · 心流书房与 10,000 小时
                  </Text>
                  <View
                    style={[
                      styles.isoStatusPill,
                      timer.isRunning ? styles.pillRunning : styles.pillWarm,
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={[
                        styles.isoStatusText,
                        { color: timer.isRunning ? '#4ade80' : '#f5b942' },
                      ]}
                    >
                      {timer.isRunning
                        ? `● 专注中 ${formatTimerClock(timerElapsedSeconds)}`
                        : `● 今日 ${trackedMinsToday} 分钟`}
                    </Text>
                  </View>
                </View>
                <Text variant="label" style={styles.isoHudFile} numberOfLines={1}>
                  {timer.isRunning
                    ? `正在投入：${timer.title}`
                    : `今日已切入 ${todayBlocks.length} 个时间块 · 学习 ${studyCount} 项`}
                </Text>
                <View style={styles.isoHudSubBox}>
                  <Text variant="caption" style={styles.isoHudSubText} numberOfLines={1}>
                    {`全天 1440 分钟已点亮 ${Math.round((trackedMinsToday / 1440) * 100)}% · 点击检视明细`}
                  </Text>
                </View>
              </View>

              <IsometricLifeZoneSvg zone="focus" active={selectedZone === 'focus'} />

              <Text variant="caption" style={styles.isoCaption}>
                心流书房 · 24H 时间块与一万小时定律
              </Text>
            </Pressable>

            {/* Zone 2: 活力健身角 (Vitality, Weight & Smart Scale Corner) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="活力健身角与晨重管理"
              onPress={() => setSelectedZone('vitality')}
              style={[
                styles.isoNodeColumn,
                selectedZone === 'vitality' ? styles.isoNodeSelected : null,
              ]}
            >
              <View
                style={[
                  styles.isoHudCard,
                  selectedZone === 'vitality' ? styles.isoHudCardVitality : null,
                ]}
              >
                <View style={styles.isoHudHead}>
                  <Text variant="caption" style={styles.isoHudNodeTag}>
                    第二境 · 活力体态与硬件同步
                  </Text>
                  <View
                    style={[
                      styles.isoStatusPill,
                      latestWeightKg ? styles.pillRunning : styles.pillIdle,
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={[
                        styles.isoStatusText,
                        { color: latestWeightKg ? '#4ade80' : '#d6d3d1' },
                      ]}
                    >
                      {latestWeightKg ? `● ${latestWeightKg.toFixed(1)} kg` : '● 待称重'}
                    </Text>
                  </View>
                </View>
                <Text variant="label" style={styles.isoHudFile} numberOfLines={1}>
                  {`近 7 日晨重 ${activeWeightDays}/7 天 · 今日训练 ${trainingSetsCount} 组`}
                </Text>
                <View style={styles.isoHudSubBox}>
                  <Text variant="caption" style={styles.isoHudSubText} numberOfLines={1}>
                    {trainingVolumeKg > 0
                      ? `今日训练总负荷 ${Math.round(trainingVolumeKg)} kg · 蓝牙体脂秤/手环就绪`
                      : '支持蓝牙体脂秤自动称重与 Keep 手环运动同步'}
                  </Text>
                </View>
              </View>

              <IsometricLifeZoneSvg zone="vitality" active={selectedZone === 'vitality'} />

              <Text variant="caption" style={styles.isoCaption}>
                活力健身角 · 晨重趋势与运动负荷
              </Text>
            </Pressable>

            {/* Zone 3: 星愿纪念台 (Milestones, OKR & Wish Vault Pavilion) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="星愿纪念台与 OKR 心愿金库"
              onPress={() => setSelectedZone('wishes')}
              style={[
                styles.isoNodeColumn,
                selectedZone === 'wishes' ? styles.isoNodeSelected : null,
              ]}
            >
              <View
                style={[
                  styles.isoHudCard,
                  selectedZone === 'wishes' ? styles.isoHudCardWishes : null,
                ]}
              >
                <View style={styles.isoHudHead}>
                  <Text variant="caption" style={styles.isoHudNodeTag}>
                    第三境 · 纪念日雷达与 OKR 心愿台
                  </Text>
                  <View style={[styles.isoStatusPill, styles.pillWarm]}>
                    <Text
                      variant="caption"
                      style={[styles.isoStatusText, { color: '#fde68a' }]}
                    >
                      {`● 心愿池 ¥${vault.wishBalanceCny}`}
                    </Text>
                  </View>
                </View>
                <Text variant="label" style={styles.isoHudFile} numberOfLines={1}>
                  {nearestMs
                    ? `${nearestMs.item.title} · ${nearestMs.badgeText}`
                    : `季度 OKR 总进度 ${avgOkrPct}%`}
                </Text>
                <View style={styles.isoHudSubBox}>
                  <Text variant="caption" style={styles.isoHudSubText} numberOfLines={1}>
                    {`季度 OKR 完成 ${avgOkrPct}% · 今日习惯打卡 ${habitsDoneToday}/${habits.length}`}
                  </Text>
                </View>
              </View>

              <IsometricLifeZoneSvg zone="wishes" active={selectedZone === 'wishes'} />

              <Text variant="caption" style={styles.isoCaption}>
                星愿纪念台 · 纪念日、OKR 与对赌心愿池
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Perspective 2: 24H 昼夜节律环 (Morning -> Daytime -> Evening -> Night) */}
      {perspective === 'daycycle' ? (
        <View style={styles.stageGridBg}>
          <View style={styles.dayCycleGrid}>
            {[
              {
                phase: '06:00 – 09:00 · 晨间唤醒',
                title: '空腹晨重 & 目标校准',
                status: latestWeightKg ? `已记晨重 ${latestWeightKg.toFixed(1)} kg` : '待记录今日晨重',
                detail: '早起空腹称重最能反映真实体脂趋势，完成后自动点亮今日第一块基石。',
                accent: '#4ade80',
              },
              {
                phase: '09:00 – 18:00 · 日间心流',
                title: '深度专注 & 一万小时积累',
                status: `今日已投入 ${trackedMinsToday} 分钟`,
                detail: '将高难度学习与创造放在精力峰值时段，每一分钟都会沉淀进 10,000 小时定律。',
                accent: '#cc785c',
              },
              {
                phase: '18:00 – 21:00 · 晚间活力',
                title: '力量/有氧训练 & 身体恢复',
                status: trainingSetsCount > 0 ? `已完成 ${trainingSetsCount} 组 (${Math.round(trainingVolumeKg)} kg)` : '待开启今日运动',
                detail: '力量或有氧训练不仅塑造体态，还能为次日带来更高的深度专注时长。',
                accent: '#38bdf8',
              },
              {
                phase: '21:00 – 23:30 · 夜间复盘',
                title: '习惯打卡、纪念日与心愿蓄力',
                status: `习惯 ${habitsDoneToday}/${habits.length} · 心愿池 ¥${vault.wishBalanceCny}`,
                detail: nearestMs
                  ? `距离「${nearestMs.item.title}」${nearestMs.badgeText}，每一次打卡都在为心愿蓄力。`
                  : '睡前花 2 分钟完成习惯打卡与随手记，让一天有始有终。',
                accent: '#f5b942',
              },
            ].map((slot) => (
              <View
                key={slot.phase}
                style={[styles.dayCycleCard, { borderTopColor: slot.accent }]}
              >
                <Text variant="caption" style={{ color: slot.accent, fontWeight: '600' }}>
                  {slot.phase}
                </Text>
                <Text variant="label" style={{ color: '#f5f5f4', fontSize: 13 }}>
                  {slot.title}
                </Text>
                <View style={styles.isoHudSubBox}>
                  <Text variant="caption" style={{ color: '#fde68a', fontWeight: '600' }}>
                    {slot.status}
                  </Text>
                </View>
                <Text variant="caption" style={{ color: '#a8a29e', lineHeight: 16 }}>
                  {slot.detail}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Perspective 3: 今日精要看板 (5-Column Personal Summary) */}
      {perspective === 'summary' ? (
        <View style={styles.ledgerGrid}>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              今日三件事
            </Text>
            <Text variant="heading" style={{ color: loggedCount === 3 ? '#4ade80' : '#cc785c' }}>
              {`${loggedCount} / 3 已记`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              晨重 · 训练 · 学习
            </Text>
          </View>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              近 7 日晨重
            </Text>
            <Text variant="heading" style={{ color: '#f5f5f4' }}>
              {`${activeWeightDays} / 7 天`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              稳定追踪均重趋势
            </Text>
          </View>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              今日训练负荷
            </Text>
            <Text variant="heading" style={{ color: '#f5f5f4' }}>
              {`${trainingSetsCount} 组`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              {`累计容量 ${Math.round(trainingVolumeKg)} kg`}
            </Text>
          </View>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              今日专注时间块
            </Text>
            <Text variant="heading" style={{ color: '#f5f5f4' }}>
              {`${trackedMinsToday} 分钟`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              {`已完成 ${studyCount} 项学习`}
            </Text>
          </View>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              心愿池 &amp; OKR
            </Text>
            <Text variant="heading" style={{ color: '#fde68a' }}>
              {`¥${vault.wishBalanceCny} · ${avgOkrPct}%`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              {nearestMs ? `${nearestMs.item.title} ${nearestMs.badgeText}` : `习惯 ${habitsDoneToday}/${habits.length}`}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Bottom Life Rhythm Dock: Personal Progress Bars + Warm Life Companion Insight */}
      <View style={styles.studioAuxDock}>
        <View style={styles.studioAuxPane}>
          <View style={styles.studioAuxHead}>
            <Text variant="caption" style={styles.auxHeadTitle}>
              今日三境节律进度（点击切换检视）
            </Text>
            <Text variant="caption" style={styles.auxHeadMeta}>
              {`全天已点亮 ${Math.round((trackedMinsToday / 1440) * 100)}% 时间`}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            {rhythmBars.map((bar) => {
              const isSelected = bar.key === selectedZone;
              const barColor =
                bar.tone === 'emerald'
                  ? '#2e9e73'
                  : bar.tone === 'terracotta'
                    ? '#cc785c'
                    : '#d99b32';
              return (
                <Pressable
                  key={bar.key}
                  accessibilityRole="button"
                  accessibilityLabel={`检视 ${bar.title}`}
                  onPress={() => setSelectedZone(bar.key)}
                  style={[styles.wfRow, isSelected ? styles.wfRowSelected : null]}
                >
                  <Text variant="caption" style={styles.wfActor} numberOfLines={1}>
                    {bar.title}
                  </Text>
                  <View style={styles.wfTrack}>
                    <View
                      style={[
                        styles.wfBar,
                        {
                          left: '0%',
                          width: `${Math.max(18, bar.pct)}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    >
                      <Text variant="caption" style={styles.wfBarText} numberOfLines={1}>
                        {bar.badge}
                      </Text>
                    </View>
                  </View>
                  <Text variant="caption" style={styles.wfMs}>
                    {`${bar.pct}%`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.studioAuxPane}>
          <View style={styles.studioAuxHead}>
            <Text variant="caption" style={styles.auxHeadTitle} numberOfLines={1}>
              {activeZoneDetail.summaryTitle}
            </Text>
            <Text variant="caption" style={styles.auxHeadMeta}>
              实时生活伴侣
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            {activeZoneDetail.highlights.map((line, idx) => (
              <View key={`${activeZoneDetail.key}-${idx}`} style={styles.highlightRow}>
                <Text variant="caption" style={styles.highlightText}>
                  {line}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Bottom Quick Action Strip */}
      <View style={styles.quickDispatchBar}>
        <View style={styles.quickDispatchLeft}>
          <Text variant="caption" style={{ color: '#a8a29e', fontWeight: '600' }}>
            快捷记录
          </Text>
          <Pressable onPress={onQuickWeight} style={styles.quickPill}>
            <Text variant="caption" style={styles.quickPillText}>
              ＋ 晨重 ⌘K
            </Text>
          </Pressable>
          <Pressable onPress={onQuickTraining} style={styles.quickPill}>
            <Text variant="caption" style={styles.quickPillText}>
              ＋ 训练 ⇧⌘T
            </Text>
          </Pressable>
          <Pressable onPress={onQuickStudy} style={styles.quickPill}>
            <Text variant="caption" style={styles.quickPillText}>
              ＋ 学习 ⇧⌘L
            </Text>
          </Pressable>
          <Pressable onPress={onQuickJournal} style={styles.quickPill}>
            <Text variant="caption" style={styles.quickPillText}>
              ＋ 时间块 ⇧⌘J
            </Text>
          </Pressable>
        </View>
        {onOpenScope ? (
          <Pressable onPress={onOpenScope} style={styles.quickPill}>
            <Text variant="caption" style={styles.quickPillText}>
              {mode === 'charioteer-host' ? 'Charioteer 挂载态 (⌘B) →' : '工作台导览 (⌘B) →'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stageCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.12)',
    backgroundColor: '#161412',
    overflow: 'hidden',
  },
  studioTopbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1c1917',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 248, 235, 0.08)',
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  studioTitle: {
    color: '#f5f5f4',
    fontSize: 13,
    fontWeight: '600',
  },
  perspBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 248, 235, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.10)',
    gap: 3,
  },
  perspPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  perspPillOn: {
    backgroundColor: '#2e2925',
  },
  perspPillText: {
    color: '#a8a29e',
    fontSize: 11,
  },
  perspPillTextOn: {
    color: '#f5f5f4',
    fontWeight: '600',
  },
  studioTaskbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 260,
    maxWidth: 520,
  },
  studioTaskInput: {
    flex: 1,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.14)',
    backgroundColor: '#110f0e',
    color: '#f5f5f4',
    fontSize: 12,
  },
  dispatchBtn: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 7,
    backgroundColor: '#cc785c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '600',
  },
  stageGridBg: {
    position: 'relative',
    minHeight: 326,
    backgroundColor: '#161412',
  },
  isoCanvas: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  isoNodeColumn: {
    flex: 1,
    minWidth: 245,
    maxWidth: 320,
    alignItems: 'center',
    gap: 8,
  },
  isoNodeSelected: {
    transform: [{ translateY: -2 }],
  },
  isoHudCard: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(31, 28, 25, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.12)',
    gap: 5,
  },
  isoHudCardFocus: {
    borderColor: '#cc785c',
  },
  isoHudCardVitality: {
    borderColor: '#4ade80',
  },
  isoHudCardWishes: {
    borderColor: '#f5b942',
  },
  isoHudHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  isoHudNodeTag: {
    fontSize: 10.5,
    color: '#a8a29e',
    fontWeight: '600',
  },
  isoStatusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillRunning: {
    backgroundColor: 'rgba(52, 199, 89, 0.16)',
    borderColor: 'rgba(52, 199, 89, 0.38)',
  },
  pillWarm: {
    backgroundColor: 'rgba(245, 185, 66, 0.16)',
    borderColor: 'rgba(245, 185, 66, 0.38)',
  },
  pillIdle: {
    backgroundColor: 'rgba(255, 248, 235, 0.07)',
    borderColor: 'rgba(255, 248, 235, 0.14)',
  },
  isoStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  isoHudFile: {
    color: '#f5f5f4',
    fontSize: 12.5,
    fontWeight: '600',
  },
  isoHudSubBox: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#12100e',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.07)',
  },
  isoHudSubText: {
    fontSize: 11,
    color: '#d6d3d1',
  },
  isoCaption: {
    fontSize: 11,
    color: '#d6d3d1',
  },
  dayCycleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 18,
  },
  dayCycleCard: {
    flex: 1,
    minWidth: 210,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.10)',
    borderTopWidth: 3,
    backgroundColor: '#1f1c19',
    padding: 12,
    gap: 7,
  },
  ledgerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#161412',
  },
  ledgerCol: {
    flex: 1,
    minWidth: 150,
    padding: 14,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 248, 235, 0.06)',
    gap: 4,
  },
  ledgerKey: {
    fontSize: 11,
    color: '#a8a29e',
    fontWeight: '600',
  },
  ledgerSub: {
    fontSize: 11,
    color: '#a8a29e',
  },
  studioAuxDock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 12,
    backgroundColor: '#1a1715',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 248, 235, 0.08)',
  },
  studioAuxPane: {
    flex: 1,
    minWidth: 280,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.08)',
    backgroundColor: '#12100e',
    padding: 10,
    gap: 8,
  },
  studioAuxHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 248, 235, 0.06)',
  },
  auxHeadTitle: {
    color: '#f5f5f4',
    fontSize: 11.5,
    fontWeight: '600',
  },
  auxHeadMeta: {
    fontSize: 10.5,
    color: '#a8a29e',
  },
  wfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  wfRowSelected: {
    backgroundColor: 'rgba(255, 248, 235, 0.07)',
  },
  wfActor: {
    width: 132,
    fontSize: 11,
    color: '#e7e5e4',
  },
  wfTrack: {
    flex: 1,
    height: 18,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 248, 235, 0.06)',
    position: 'relative',
    overflow: 'hidden',
  },
  wfBar: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: 3,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  wfBarText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  wfMs: {
    width: 40,
    textAlign: 'right',
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    color: '#a8a29e',
  },
  highlightRow: {
    backgroundColor: 'rgba(204, 120, 92, 0.10)',
    borderLeftWidth: 2,
    borderLeftColor: '#cc785c',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  highlightText: {
    fontSize: 11.5,
    color: '#e7e5e4',
    lineHeight: 17,
  },
  quickDispatchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1c1917',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 248, 235, 0.08)',
  },
  quickDispatchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#292524',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.12)',
  },
  quickPillText: {
    color: '#f5f5f4',
    fontSize: 11.5,
    fontWeight: '500',
  },
});
