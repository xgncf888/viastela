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

export type StudioPerspective = 'iso' | 'floorplan' | 'ledger';
export type StudioNodeKey = 'body' | 'cognition' | 'wealth';

type WaterfallStep = {
  id: string;
  node: StudioNodeKey;
  actor: string;
  label: string;
  durationMs: number;
  offsetPct: number;
  widthPct: number;
  barTone: 'emerald' | 'terracotta' | 'amber';
  thinking: string;
  diffLines: string[];
  payload: Record<string, unknown>;
};

function IsometricWorkstationSvg({
  accentColor,
  variant,
}: {
  accentColor: string;
  variant: 'body' | 'cognition' | 'wealth';
}) {
  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          width: 220,
          height: 120,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: accentColor,
          backgroundColor: '#15171E',
        }}
      />
    );
  }

  const gradTopId = `isoTop_${variant}`;
  const gradSideId = `isoSide_${variant}`;

  return createElement(
    'svg',
    {
      width: 248,
      height: 154,
      viewBox: '0 0 265 172',
      fill: 'none',
      style: {
        overflow: 'visible',
        filter: 'drop-shadow(0 14px 22px rgba(0, 0, 0, 0.55))',
      },
    },
    createElement(
      'defs',
      null,
      createElement(
        'linearGradient',
        { id: gradTopId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: '#262934' }),
        createElement('stop', { offset: '100%', stopColor: '#171920' }),
      ),
      createElement(
        'linearGradient',
        { id: gradSideId, x1: '0', y1: '0', x2: '0', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: '#15171e' }),
        createElement('stop', { offset: '100%', stopColor: '#0b0c10' }),
      ),
    ),
    // 2.5D Isometric Base Platform Top & Extruded Side Bevels (Charioteer Reference 2)
    createElement('polygon', {
      points: '132,148 246,102 132,58 18,102',
      fill: `url(#${gradTopId})`,
      stroke: 'rgba(255,255,255,0.18)',
      strokeWidth: 1,
    }),
    createElement('polygon', {
      points: '18,102 132,148 132,166 18,120',
      fill: `url(#${gradSideId})`,
      stroke: 'rgba(255,255,255,0.08)',
      strokeWidth: 1,
    }),
    createElement('polygon', {
      points: '246,102 132,148 132,166 246,120',
      fill: '#0e1015',
      stroke: 'rgba(255,255,255,0.1)',
      strokeWidth: 1,
    }),
    // Glowing Neon Inner Rim
    createElement('polygon', {
      points: '132,138 224,101 132,66 40,101',
      fill: 'none',
      stroke: accentColor,
      strokeWidth: 2.2,
      strokeOpacity: 0.9,
    }),
    // Isometric Workstation Desk
    createElement('polygon', {
      points: '132,114 176,96 132,79 88,96',
      fill: '#2d313e',
      stroke: 'rgba(255,255,255,0.22)',
      strokeWidth: 1,
    }),
    createElement('polygon', {
      points: '94,98 94,116 102,119 102,101',
      fill: '#181a22',
    }),
    createElement('polygon', {
      points: '162,98 162,116 170,119 170,101',
      fill: '#181a22',
    }),
    // Glowing Isometric Monitor Screen
    createElement('polygon', {
      points: '112,66 154,51 154,77 112,92',
      fill: '#0b0d12',
      stroke: accentColor,
      strokeWidth: 1.4,
    }),
    createElement('line', {
      x1: 118,
      y1: 71,
      x2: 144,
      y2: 62,
      stroke: accentColor,
      strokeWidth: 1.6,
      strokeLinecap: 'round',
    }),
    createElement('line', {
      x1: 118,
      y1: 77,
      x2: 138,
      y2: 70,
      stroke: 'rgba(255,255,255,0.48)',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
    }),
    createElement('line', {
      x1: 118,
      y1: 83,
      x2: 148,
      y2: 72,
      stroke: '#4ade80',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
    }),
    // Variant-specific 2.5D hardware module on platform
    variant === 'body'
      ? createElement(
          'g',
          null,
          // Isometric Smart Scale Pad & BLE Telemetry Tower
          createElement('polygon', {
            points: '78,108 106,97 106,105 78,116',
            fill: '#161922',
            stroke: accentColor,
            strokeWidth: 1.1,
          }),
          createElement('circle', { cx: 92, cy: 103, r: 2.5, fill: '#4ade80' }),
        )
      : variant === 'wealth'
        ? createElement(
            'g',
            null,
            // Isometric Quant Vault & Server Blade Rack
            createElement('polygon', {
              points: '172,62 204,50 204,78 172,90',
              fill: '#161922',
              stroke: 'rgba(255,255,255,0.22)',
              strokeWidth: 1,
            }),
            createElement('circle', { cx: 180, cy: 68, r: 2.2, fill: accentColor }),
            createElement('circle', { cx: 180, cy: 76, r: 2.2, fill: '#4ade80' }),
          )
        : createElement(
            'g',
            null,
            // Isometric 24H Astrolabe Time Cube
            createElement('polygon', {
              points: '170,66 196,56 196,80 170,90',
              fill: '#181b24',
              stroke: accentColor,
              strokeWidth: 1.1,
            }),
            createElement('circle', { cx: 183, cy: 73, r: 2.5, fill: '#f5b942' }),
          ),
  );
}

function IsometricFiberBridgesSvg({
  activeBeamLabel,
  timerRunning,
}: {
  activeBeamLabel: string;
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
        { id: 'vsIsoFiberGrad', x1: '0', y1: '0', x2: '1', y2: '0' },
        createElement('stop', { offset: '0%', stopColor: '#cc785c', stopOpacity: '0.9' }),
        createElement('stop', { offset: '50%', stopColor: '#4ade80', stopOpacity: '0.95' }),
        createElement('stop', { offset: '100%', stopColor: '#e5a93c', stopOpacity: '0.9' }),
      ),
    ),
    // Left-to-Center Fiber Bridge
    createElement('path', {
      d: 'M 210 218 C 310 262, 400 262, 500 215',
      fill: 'none',
      stroke: 'rgba(204, 120, 92, 0.20)',
      strokeWidth: 6,
    }),
    createElement('path', {
      d: 'M 210 218 C 310 262, 400 262, 500 215',
      fill: 'none',
      stroke: 'url(#vsIsoFiberGrad)',
      strokeWidth: 2.2,
      strokeDasharray: '8 8',
    }),
    // Center-to-Right Fiber Bridge
    createElement('path', {
      d: 'M 500 215 C 600 262, 690 262, 790 218',
      fill: 'none',
      stroke: 'rgba(74, 222, 128, 0.18)',
      strokeWidth: 6,
    }),
    createElement('path', {
      d: 'M 500 215 C 600 262, 690 262, 790 218',
      fill: 'none',
      stroke: 'url(#vsIsoFiberGrad)',
      strokeWidth: 2.2,
      strokeDasharray: timerRunning ? '6 6' : '8 8',
    }),
    // Center Floating Bus Badge
    createElement('rect', {
      x: 390,
      y: 236,
      width: 220,
      height: 24,
      rx: 12,
      fill: '#12141c',
      stroke: 'rgba(204, 120, 92, 0.55)',
      strokeWidth: 1,
    }),
    createElement(
      'text',
      {
        x: 500,
        y: 252,
        textAnchor: 'middle',
        fill: '#e2e8f0',
        fontSize: '10.5',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      activeBeamLabel,
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
  const [perspective, setPerspective] = useState<StudioPerspective>('iso');
  const [selectedNode, setSelectedNode] = useState<StudioNodeKey>('cognition');
  const [inspectorTab, setInspectorTab] = useState<'trace' | 'payload'>('trace');
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [quickTaskInput, setQuickTaskInput] = useState('');

  // Cross-module live states
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

  const steps: WaterfallStep[] = [
    {
      id: 'step-cognition',
      node: 'cognition',
      actor: '24H Time-Block',
      label: timer.isRunning
        ? `Focusing · ${formatTimerClock(timerElapsedSeconds)}`
        : `Tracked ${trackedMinsToday}m / 1440m`,
      durationMs: Math.max(12, trackedMinsToday),
      offsetPct: 0,
      widthPct: 38,
      barTone: 'terracotta',
      thinking: `24H 分钟级时间轴与 10,000 小时定律引擎在线。\n当前专注状态: ${timer.isRunning ? `正在计时「${timer.title}」` : '待命'} · 今日已切入 ${todayBlocks.length} 个时间块（共 ${trackedMinsToday} 分钟）。`,
      diffLines: [
        `+ [24H Matrix] 今日有效专注与学习累计: ${trackedMinsToday} / 1440 分钟`,
        `+ [10,000h Rule] 长期精进目标活跃数: ${objectives.length + 3} 项`,
        timer.isRunning
          ? `+ [Live Timer] 正在追踪: ${timer.title} (${formatTimerClock(timerElapsedSeconds)})`
          : `- [Idle Gap] 待记录空闲时段可通过顶部指令栏或 24H 矩阵快速切入`,
      ],
      payload: {
        node: 'cognition-studio',
        localDay,
        timerRunning: timer.isRunning,
        timerTitle: timer.title,
        trackedMinsToday,
        blocksCount: todayBlocks.length,
      },
    },
    {
      id: 'step-body',
      node: 'body',
      actor: 'BLE & Body Pod',
      label:
        latestWeightKg !== null && latestWeightKg !== undefined
          ? `${latestWeightKg.toFixed(1)} kg · ${trainingSetsCount} sets`
          : `BLE Standby · ${trainingSetsCount} sets`,
      durationMs: Math.max(8, activeWeightDays * 10 + trainingSetsCount * 5),
      offsetPct: 22,
      widthPct: 42,
      barTone: 'emerald',
      thinking: `CoreBluetooth (0x181D/0x180D) 与 Keep / Apple Health 同步总线就绪。\n近 7 日有效晨重 ${activeWeightDays}/7 天 · 今日训练负荷 ${Math.round(trainingVolumeKg)} kg (${trainingSetsCount} 组)。`,
      diffLines: [
        latestWeightKg
          ? `+ [Weight Sensor] 最新真实晨重读数: ${latestWeightKg.toFixed(1)} kg`
          : `- [Weight Sensor] 今日尚未收到体脂秤广播，可踏上体脂秤或点击快记`,
        `+ [Training Load] 今日训练组数: ${trainingSetsCount} 组 (累计容量 ${Math.round(trainingVolumeKg)} kg)`,
        `+ [7D Rhythm] 近 7 日晨重打卡完整度: ${activeWeightDays}/7 天`,
      ],
      payload: {
        node: 'body-ble-pod',
        bleServices: ['0x181D', '0x181B', '0x180D'],
        latestWeightKg: latestWeightKg ?? null,
        trainingSetsCount,
        trainingVolumeKg,
      },
    },
    {
      id: 'step-wealth',
      node: 'wealth',
      actor: 'OKR & Wish Vault',
      label: `OKR ${avgOkrPct}% · Vault ¥${vault.wishBalanceCny}`,
      durationMs: Math.max(15, avgOkrPct),
      offsetPct: 46,
      widthPct: 48,
      barTone: 'amber',
      thinking: `OKR 关键结果与自律对赌心愿金库已建立实时双向绑定。\n每次完成每日习惯 (${habitsDoneToday}/${habits.length}) 或推进 KR 自动入账 +¥${vault.config.checkInRewardCny}。`,
      diffLines: [
        `+ [Wish Vault] 自律心愿奖励金库余额: ¥${vault.wishBalanceCny} (定投惩罚池: ¥${vault.penaltyDcaPoolCny})`,
        `+ [OKR Engine] 季度目标平均完成度: ${avgOkrPct}% · 今日习惯打卡 ${habitsDoneToday}/${habits.length}`,
        nearestMs
          ? `+ [Milestone Radar] 距离「${nearestMs.item.title}」: ${nearestMs.badgeText}`
          : `+ [Milestone Radar] 纪念日雷达监控中`,
      ],
      payload: {
        node: 'wealth-okr-vault',
        okrAvgProgressPct: avgOkrPct,
        habitsToday: `${habitsDoneToday}/${habits.length}`,
        wishBalanceCny: vault.wishBalanceCny,
        penaltyDcaPoolCny: vault.penaltyDcaPoolCny,
        nearestMilestone: nearestMs?.item.title ?? null,
      },
    },
  ];

  const activeStep = steps[activeStepIdx] ?? steps[0]!;

  function onDispatchTask() {
    const raw = quickTaskInput.trim();
    if (!raw) {
      onQuickWeight();
      return;
    }
    // Check if input is a quick time block or reward command
    const minMatch = raw.match(/(\d+)\s*(m|min|分钟)/i);
    if (minMatch) {
      const mins = Math.max(5, Math.min(360, Number.parseInt(minMatch[1]!, 10)));
      const now = new Date();
      const endMin = now.getHours() * 60 + now.getMinutes();
      const startMin = Math.max(0, endMin - mins);
      const title = raw.replace(minMatch[0], '').trim() || '专注时间块';
      setTimeBlocks(
        addTimeBlock({
          localDay,
          startMinute: startMin,
          endMinute: Math.max(startMin + 1, endMin),
          category: 'study',
          title,
          goalId: 'goal-ai-infra',
        }),
      );
      const v = recordPledgeReward(`2.5D 工位派发专注：${title} (${mins}m)`, localDay);
      setVault(v);
      setQuickTaskInput('');
      setSelectedNode('cognition');
      setActiveStepIdx(0);
      showToast({
        text: `已派发至 2.5D 专注工位：${title} (${mins} 分钟) · 心愿金库 +¥${v.config.checkInRewardCny}`,
      });
      return;
    }

    const v = recordPledgeReward(`工位指令执行：${raw}`, localDay);
    setVault(v);
    setQuickTaskInput('');
    showToast({
      text: `指令已派发至 2.5D 节点：「${raw}」· 心愿金库 +¥${v.config.checkInRewardCny}`,
    });
  }

  return (
    <View style={styles.stageCard}>
      {/* Top Frosted Cockpit Bar (Charioteer .studio-topbar) */}
      <View style={styles.studioTopbar}>
        <View style={styles.topbarLeft}>
          <Text variant="label" style={styles.studioTitle}>
            Charioteer × 星途 · 2.5D Isometric Personal Studio
          </Text>
          <View style={styles.perspBar}>
            {(
              [
                { id: 'iso', label: '2.5D Isometric Studio' },
                { id: 'floorplan', label: '2D Floorplan' },
                { id: 'ledger', label: '5-Col Ledger' },
              ] as const
            ).map((tab) => {
              const active = perspective === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  accessibilityLabel={`切换视角 ${tab.label}`}
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
            value={quickTaskInput}
            onChangeText={setQuickTaskInput}
            onSubmitEditing={onDispatchTask}
            placeholder="派发指令给 2.5D 工位 (例如: AI 架构深潜 60m / 复盘 OKR)…"
            placeholderTextColor="#9ca3af"
            style={[
              styles.studioTaskInput,
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="派发执行"
            onPress={onDispatchTask}
            style={({ pressed }) => [
              styles.dispatchBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text variant="caption" style={styles.dispatchBtnText}>
              派发执行 →
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Perspective 1: 2.5D Isometric Compute & Life Studio (Reference 2) */}
      {perspective === 'iso' ? (
        <View style={styles.stageGridBg}>
          <IsometricFiberBridgesSvg
            activeBeamLabel={`local://viastela · ${loggedCount}/3 Logged · Vault ¥${vault.wishBalanceCny}`}
            timerRunning={timer.isRunning}
          />

          <View style={styles.isoCanvas}>
            {/* Node 1: Body & BLE Sensor Pod */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="2.5D 体态与硬件节点"
              onPress={() => {
                setSelectedNode('body');
                setActiveStepIdx(1);
              }}
              style={[
                styles.isoNodeColumn,
                selectedNode === 'body' ? styles.isoNodeSelected : null,
              ]}
            >
              <View
                style={[
                  styles.isoHudCard,
                  selectedNode === 'body' ? styles.isoHudCardSelected : null,
                ]}
              >
                <View style={styles.isoHudHead}>
                  <Text variant="caption" style={styles.isoHudNodeTag}>
                    NODE 01 · BODY &amp; BLE SENSOR
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
                        { color: latestWeightKg ? '#4ade80' : '#9ca3af' },
                      ]}
                    >
                      {`● ${latestWeightKg ? `${latestWeightKg.toFixed(1)} kg` : 'BLE Ready'}`}
                    </Text>
                  </View>
                </View>
                <Text variant="label" style={styles.isoHudFile} numberOfLines={1}>
                  {`近 7 日晨重 ${activeWeightDays}/7 · 今日训练 ${trainingSetsCount} 组`}
                </Text>
                <View style={styles.isoHudCmd}>
                  <Text variant="caption" style={styles.isoHudCmdText} numberOfLines={1}>
                    {`$ ble --gatt 0x181D/0x180D · load ${Math.round(trainingVolumeKg)}kg`}
                  </Text>
                </View>
              </View>

              <IsometricWorkstationSvg accentColor="#4ade80" variant="body" />

              <Text variant="caption" style={styles.isoCaption}>
                Body &amp; BLE Scale Pod · CoreBluetooth
              </Text>
            </Pressable>

            {/* Node 2: 24H Time-Block & 10,000h Mastery Studio */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="2.5D 专注与 24H 时间块工位"
              onPress={() => {
                setSelectedNode('cognition');
                setActiveStepIdx(0);
              }}
              style={[
                styles.isoNodeColumn,
                selectedNode === 'cognition' ? styles.isoNodeSelected : null,
              ]}
            >
              <View
                style={[
                  styles.isoHudCard,
                  selectedNode === 'cognition' ? styles.isoHudCardSelected : null,
                ]}
              >
                <View style={styles.isoHudHead}>
                  <Text variant="caption" style={styles.isoHudNodeTag}>
                    NODE 02 · 24H TIME-BLOCK &amp; 10,000H
                  </Text>
                  <View
                    style={[
                      styles.isoStatusPill,
                      timer.isRunning ? styles.pillRunning : styles.pillThinking,
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
                        ? `● ${formatTimerClock(timerElapsedSeconds)}`
                        : `● ${trackedMinsToday}m Tracked`}
                    </Text>
                  </View>
                </View>
                <Text variant="label" style={styles.isoHudFile} numberOfLines={1}>
                  {timer.isRunning ? `正在计时：${timer.title}` : `今日已切入 ${todayBlocks.length} 个时间块 (${trackedMinsToday}/1440m)`}
                </Text>
                <View style={styles.isoHudCmd}>
                  <Text variant="caption" style={styles.isoHudCmdText} numberOfLines={1}>
                    {`$ tracker --24h-matrix --10000h-mastery (${studyCount} 项学习)`}
                  </Text>
                </View>
              </View>

              <IsometricWorkstationSvg accentColor="#cc785c" variant="cognition" />

              <Text variant="caption" style={styles.isoCaption}>
                24H Time-Block &amp; 10,000h Studio
              </Text>
            </Pressable>

            {/* Node 3: Market Pulse, OKR & Wish Vault Pod */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="2.5D 资产、OKR 与纪念日心愿金库节点"
              onPress={() => {
                setSelectedNode('wealth');
                setActiveStepIdx(2);
              }}
              style={[
                styles.isoNodeColumn,
                selectedNode === 'wealth' ? styles.isoNodeSelected : null,
              ]}
            >
              <View
                style={[
                  styles.isoHudCard,
                  selectedNode === 'wealth' ? styles.isoHudCardSelected : null,
                ]}
              >
                <View style={styles.isoHudHead}>
                  <Text variant="caption" style={styles.isoHudNodeTag}>
                    NODE 03 · OKR, MILESTONE &amp; VAULT
                  </Text>
                  <View style={[styles.isoStatusPill, styles.pillThinking]}>
                    <Text
                      variant="caption"
                      style={[styles.isoStatusText, { color: '#f5b942' }]}
                    >
                      {`● OKR ${avgOkrPct}%`}
                    </Text>
                  </View>
                </View>
                <Text variant="label" style={styles.isoHudFile} numberOfLines={1}>
                  {`心愿金库 ¥${vault.wishBalanceCny} · ${nearestMs ? `${nearestMs.item.title} (${nearestMs.badgeText})` : '纪念日雷达在线'}`}
                </Text>
                <View style={styles.isoHudCmd}>
                  <Text variant="caption" style={styles.isoHudCmdText} numberOfLines={1}>
                    {`$ vault --wish ¥${vault.wishBalanceCny} --dca-penalty ¥${vault.penaltyDcaPoolCny}`}
                  </Text>
                </View>
              </View>

              <IsometricWorkstationSvg accentColor="#e5a93c" variant="wealth" />

              <Text variant="caption" style={styles.isoCaption}>
                OKR, Anniversary &amp; Wish Vault Pod
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Perspective 2: 2D Architectural Studio Floorplan (Reference 1) */}
      {perspective === 'floorplan' ? (
        <View style={styles.stageGridBg}>
          <View style={styles.floorplanCanvas}>
            <View style={styles.fpRoom}>
              <View style={styles.fpRoomHeader}>
                <Text variant="caption" style={styles.fpHeaderText}>
                  ROOM 01 · BODY &amp; 24H FOCUS DESK
                </Text>
                <Text variant="caption" style={styles.fpHeaderText}>
                  {`${loggedCount}/3 LOGGED`}
                </Text>
              </View>
              <Pressable
                onPress={() => setActiveStepIdx(0)}
                style={[styles.fpDeskCard, styles.fpDeskSelected]}
              >
                <Text variant="label" style={{ color: '#f3f4f6' }}>
                  {`24H 时间块矩阵 · 已追踪 ${trackedMinsToday} 分钟`}
                </Text>
                <View style={styles.fpPeephole}>
                  <View style={styles.fpDotsRow}>
                    <View style={[styles.fpTrafficDot, { backgroundColor: '#ff5f57' }]} />
                    <View style={[styles.fpTrafficDot, { backgroundColor: '#febc2e' }]} />
                    <View style={[styles.fpTrafficDot, { backgroundColor: '#28c840' }]} />
                    <Text variant="caption" style={styles.fpTerminalLabel}>
                      live-peephole · 24h-tracker
                    </Text>
                  </View>
                  <Text variant="caption" style={styles.fpTerminalBody}>
                    {`$晨重: ${latestWeightKg ? `${latestWeightKg}kg` : '待称重'} | 训练: ${trainingSetsCount}组 | 专注: ${trackedMinsToday}m`}
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.fpGatewayPillar}>
              <Text variant="label" style={{ color: '#f3f4f6', fontFamily: theme.fontFamily.mono }}>
                local://viastela
              </Text>
              <Text variant="caption" style={{ color: '#9ca3af' }}>
                Outbox &amp; CoreBluetooth Bus
              </Text>
              <View style={styles.fpGatewayBadge}>
                <Text variant="caption" style={{ color: '#4ade80', fontFamily: theme.fontFamily.mono }}>
                  {mode === 'charioteer-host' ? '● Charioteer Mounted' : '● Native Standalone'}
                </Text>
              </View>
            </View>

            <View style={styles.fpRoom}>
              <View style={styles.fpRoomHeader}>
                <Text variant="caption" style={styles.fpHeaderText}>
                  ROOM 02 · OKR &amp; WISH VAULT POD
                </Text>
                <Text variant="caption" style={styles.fpHeaderText}>
                  {`OKR ${avgOkrPct}%`}
                </Text>
              </View>
              <Pressable
                onPress={() => setActiveStepIdx(2)}
                style={[styles.fpDeskCard, styles.fpDeskExec]}
              >
                <Text variant="label" style={{ color: '#f3f4f6' }}>
                  {`心愿金库 ¥${vault.wishBalanceCny} · 习惯 ${habitsDoneToday}/${habits.length}`}
                </Text>
                <View style={styles.fpPeephole}>
                  <View style={styles.fpDotsRow}>
                    <View style={[styles.fpTrafficDot, { backgroundColor: '#ff5f57' }]} />
                    <View style={[styles.fpTrafficDot, { backgroundColor: '#febc2e' }]} />
                    <View style={[styles.fpTrafficDot, { backgroundColor: '#28c840' }]} />
                    <Text variant="caption" style={styles.fpTerminalLabel}>
                      vault-pledge · milestone-radar
                    </Text>
                  </View>
                  <Text variant="caption" style={styles.fpTerminalBody}>
                    {nearestMs
                      ? `${nearestMs.item.title}: ${nearestMs.badgeText} (${nearestMs.subtitleText})`
                      : '纪念日雷达在线'}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Perspective 3: Classic 5-Col Ledger Strip */}
      {perspective === 'ledger' ? (
        <View style={styles.ledgerGrid}>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              TODAY RHYTHM
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
              7D CONSISTENCY
            </Text>
            <Text variant="heading" style={{ color: '#f3f4f6' }}>
              {`${activeWeightDays} / 7 天`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              近 7 日有效早安称
            </Text>
          </View>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              TRAINING LOAD
            </Text>
            <Text variant="heading" style={{ color: '#f3f4f6' }}>
              {`${trainingSetsCount} 组`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              {`累计负荷 ${Math.round(trainingVolumeKg)} kg`}
            </Text>
          </View>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              24H FOCUS TIME
            </Text>
            <Text variant="heading" style={{ color: '#f3f4f6' }}>
              {`${trackedMinsToday} min`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              {`已完成 ${studyCount} 项主题`}
            </Text>
          </View>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              WISH VAULT &amp; OKR
            </Text>
            <Text variant="heading" style={{ color: '#4ade80' }}>
              {`¥${vault.wishBalanceCny} · ${avgOkrPct}%`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              自律心愿池与季度目标
            </Text>
          </View>
        </View>
      ) : null}

      {/* Bottom Auxiliary Dock: Waterfall Timeline + Live <think> & State Diff Inspector (Charioteer Reference 3) */}
      <View style={styles.studioAuxDock}>
        <View style={styles.studioAuxPane}>
          <View style={styles.studioAuxHead}>
            <Text variant="caption" style={styles.auxHeadTitle}>
              Multi-Domain Telemetry Waterfall Timeline
            </Text>
            <Text variant="caption" style={styles.auxHeadMeta}>
              {`${steps.length} nodes · Live Sync`}
            </Text>
          </View>
          <View style={{ gap: 5 }}>
            {steps.map((step, idx) => {
              const isSelected = idx === activeStepIdx;
              const barBg =
                step.barTone === 'emerald'
                  ? '#2e9e73'
                  : step.barTone === 'terracotta'
                    ? '#cc785c'
                    : '#d99b32';
              return (
                <Pressable
                  key={step.id}
                  accessibilityRole="button"
                  accessibilityLabel={`检视瀑布流节点 ${step.actor}`}
                  onPress={() => {
                    setActiveStepIdx(idx);
                    setSelectedNode(step.node);
                  }}
                  style={[styles.wfRow, isSelected ? styles.wfRowSelected : null]}
                >
                  <Text variant="caption" style={styles.wfActor} numberOfLines={1}>
                    {step.actor}
                  </Text>
                  <View style={styles.wfTrack}>
                    <View
                      style={[
                        styles.wfBar,
                        {
                          left: `${step.offsetPct}%`,
                          width: `${step.widthPct}%`,
                          backgroundColor: barBg,
                        },
                      ]}
                    >
                      <Text variant="caption" style={styles.wfBarText} numberOfLines={1}>
                        {step.label}
                      </Text>
                    </View>
                  </View>
                  <Text variant="caption" style={styles.wfMs}>
                    {`${step.durationMs}ms`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.studioAuxPane}>
          <View style={styles.studioAuxHead}>
            <Text variant="caption" style={styles.auxHeadTitle} numberOfLines={1}>
              {`Inspector · ${activeStep.actor} → ${activeStep.label}`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Pressable
                onPress={() => setInspectorTab('trace')}
                style={[
                  styles.inspTabBtn,
                  inspectorTab === 'trace' ? styles.inspTabBtnActive : null,
                ]}
              >
                <Text variant="caption" style={styles.inspTabText}>
                  &lt;think&gt; &amp; Diff
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setInspectorTab('payload')}
                style={[
                  styles.inspTabBtn,
                  inspectorTab === 'payload' ? styles.inspTabBtnActive : null,
                ]}
              >
                <Text variant="caption" style={styles.inspTabText}>
                  Payload JSON
                </Text>
              </Pressable>
            </View>
          </View>

          {inspectorTab === 'payload' ? (
            <Text variant="caption" style={styles.inspectorCodeText}>
              {JSON.stringify(activeStep.payload, null, 2)}
            </Text>
          ) : (
            <View style={{ gap: 4 }}>
              <Text variant="caption" style={styles.inspectorThinkText}>
                {`<think> ${activeStep.thinking} </think>`}
              </Text>
              {activeStep.diffLines.map((line, i) => {
                const isAdd = line.startsWith('+');
                return (
                  <View
                    key={`${activeStep.id}-diff-${i}`}
                    style={isAdd ? styles.diffAddRow : styles.diffDelRow}
                  >
                    <Text
                      variant="caption"
                      style={isAdd ? styles.diffAddText : styles.diffDelText}
                    >
                      {line}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Bottom Quick Dispatch Bar (Preserves all keyboard shortcut triggers) */}
      <View style={styles.quickDispatchBar}>
        <View style={styles.quickDispatchLeft}>
          <Text variant="caption" style={{ color: '#9ca3af', fontWeight: '600' }}>
            Quick Dispatch (工作台快记)
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
              Workspace Scope (⌘B) →
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
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: '#111216',
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
    backgroundColor: '#16181f',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  studioTitle: {
    color: '#f3f4f6',
    fontSize: 13,
    fontWeight: '600',
  },
  perspBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    gap: 3,
  },
  perspPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  perspPillOn: {
    backgroundColor: '#262934',
  },
  perspPillText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  perspPillTextOn: {
    color: '#f3f4f6',
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
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: '#0b0c10',
    color: '#f4f3ef',
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
    minHeight: 330,
    backgroundColor: '#12141b',
  },
  isoCanvas: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 22,
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
    backgroundColor: 'rgba(24, 26, 33, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 5,
  },
  isoHudCardSelected: {
    borderColor: '#cc785c',
  },
  isoHudHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  isoHudNodeTag: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    color: '#9ca3af',
    letterSpacing: 0.4,
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
  pillThinking: {
    backgroundColor: 'rgba(229, 169, 60, 0.16)',
    borderColor: 'rgba(229, 169, 60, 0.38)',
  },
  pillIdle: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  isoStatusText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    fontWeight: '600',
  },
  isoHudFile: {
    color: '#f3f4f6',
    fontSize: 12,
    fontWeight: '600',
  },
  isoHudCmd: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#0b0c10',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  isoHudCmdText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    color: '#cbd5e1',
  },
  isoCaption: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    color: '#cbd5e1',
  },
  floorplanCanvas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    padding: 18,
    alignItems: 'stretch',
  },
  fpRoom: {
    flex: 1,
    minWidth: 250,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: 'rgba(20, 22, 28, 0.85)',
    padding: 12,
    gap: 10,
  },
  fpRoomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  fpHeaderText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    color: '#9ca3af',
  },
  fpDeskCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#1b1d25',
    padding: 10,
    gap: 8,
  },
  fpDeskSelected: {
    borderColor: '#cc785c',
  },
  fpDeskExec: {
    borderColor: 'rgba(74, 222, 128, 0.55)',
  },
  fpPeephole: {
    borderRadius: 7,
    backgroundColor: '#0b0c10',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 8,
    gap: 6,
  },
  fpDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fpTrafficDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  fpTerminalLabel: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 4,
  },
  fpTerminalBody: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 11,
    color: '#d1d5db',
  },
  fpGatewayPillar: {
    width: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#101217',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fpGatewayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(74, 222, 128, 0.14)',
  },
  ledgerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#12141b',
  },
  ledgerCol: {
    flex: 1,
    minWidth: 150,
    padding: 14,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.06)',
    gap: 4,
  },
  ledgerKey: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    color: '#9ca3af',
  },
  ledgerSub: {
    fontSize: 11,
    color: '#9ca3af',
  },
  studioAuxDock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 12,
    backgroundColor: '#13151b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  studioAuxPane: {
    flex: 1,
    minWidth: 280,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0d0f14',
    padding: 10,
    gap: 8,
  },
  studioAuxHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  auxHeadTitle: {
    color: '#e5e7eb',
    fontSize: 11.5,
    fontWeight: '600',
  },
  auxHeadMeta: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    color: '#9ca3af',
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
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  wfActor: {
    width: 105,
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    color: '#cbd5e1',
  },
  wfTrack: {
    flex: 1,
    height: 18,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
  },
  wfMs: {
    width: 44,
    textAlign: 'right',
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    color: '#9ca3af',
  },
  inspTabBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
  },
  inspTabBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  inspTabText: {
    fontSize: 10.5,
    color: '#e5e7eb',
  },
  inspectorThinkText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 16,
  },
  inspectorCodeText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 11,
    color: '#d1d5db',
    lineHeight: 16,
  },
  diffAddRow: {
    backgroundColor: 'rgba(46, 160, 67, 0.18)',
    borderLeftWidth: 2,
    borderLeftColor: '#3fb950',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  diffAddText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    color: '#7ee787',
  },
  diffDelRow: {
    backgroundColor: 'rgba(248, 81, 73, 0.18)',
    borderLeftWidth: 2,
    borderLeftColor: '#f85149',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  diffDelText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    color: '#ffa198',
  },
  quickDispatchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#16181f',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: '#222530',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  quickPillText: {
    color: '#f3f4f6',
    fontSize: 11.5,
    fontWeight: '500',
  },
});
