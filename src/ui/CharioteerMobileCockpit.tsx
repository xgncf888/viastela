import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { router } from 'expo-router';

import { createId } from '@/core/id';
import { parseOmnibarCommand, type OmnibarIntent } from '@/core/omnibar';
import { addLedgerTransaction } from '@/data/bookkeeping';
import { recordPledgeReward } from '@/data/life-gamification';
import { openRecordSheet, type RecordSheetKind } from '@/features/record/record-sheet-store';

import { cardSurfaceStyle } from './Card';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { useI18n } from './use-i18n';

export type MobilePodScope = 'all' | 'body' | 'mind' | 'wealth';
export type MobileInlineSheet = 'none' | 'diff' | 'side';

export function executeParsedOmnibarIntent(
  intent: OmnibarIntent,
  localDay: string,
  handlers: {
    onSaveWeight: (kg: number) => void;
    onSaveWorkout: (input: { exercise: string; reps: number; weightKg: number | null; setsCount: number }) => void;
    onSaveStudy: (input: { topic: string; durationMinutes: number; note: string | null }) => void;
  },
  t: (zh: string, en: string) => string,
): void {
  if (intent.kind === 'weight') {
    handlers.onSaveWeight(intent.weightKg);
    recordPledgeReward(`Omnibar 晨重打卡 ${intent.weightKg}kg`, localDay, 10);
    showToast({ text: t(`✓ ${intent.summaryZh}`, `✓ ${intent.summaryEn}`) });
    return;
  }
  if (intent.kind === 'training') {
    handlers.onSaveWorkout({
      exercise: intent.exercise,
      reps: intent.reps,
      weightKg: intent.weightKg,
      setsCount: intent.setsCount,
    });
    recordPledgeReward(`Omnibar 训练打卡 ${intent.exercise}`, localDay, 15);
    showToast({ text: t(`✓ 已记入训练：${intent.summaryZh}`, `✓ Logged workout: ${intent.summaryEn}`) });
    return;
  }
  if (intent.kind === 'study') {
    handlers.onSaveStudy({
      topic: intent.topic,
      durationMinutes: intent.durationMinutes,
      note: intent.note,
    });
    recordPledgeReward(`Omnibar 专注打卡 ${intent.topic}`, localDay, 15);
    showToast({ text: t(`✓ 已记入专注：${intent.summaryZh}`, `✓ Logged focus: ${intent.summaryEn}`) });
    return;
  }
  if (intent.kind === 'ledger') {
    addLedgerTransaction({
      kind: intent.entryKind,
      amountCny: intent.amountCny,
      categoryId: intent.categoryId,
      accountId: intent.accountId,
      owner: intent.owner,
      note: intent.note,
      localDay,
    });
    recordPledgeReward(`Omnibar 记账 ${intent.note}`, localDay, 10);
    showToast({ text: t(`✓ 已入账：${intent.summaryZh}`, `✓ Logged ledger: ${intent.summaryEn}`) });
  }
}

/**
 * Charioteer Mobile Cockpit V2 (After Optimization):
 * - Eliminates redundant stacked cards (`OneTapSmartFlowCard` merged into `.m-sess-card` roster)
 * - Adds `.m-scope-track` segmented pod bar (`All Pods · 4`, `Body`, `Mind`, `Wealth`)
 * - Adds `.m-sess-card` with `.m-cmd-bar` terminal execution bar & `.m-tree-box` sub-telemetry
 * - Adds Open-Canvas `.m-thought-details` reasoning disclosure fold
 * - Adds `.m-sheet` inline half-screen drawers (`Diff 台账补丁` & `/side 旁路快问`)
 * - Preserves `accessibilityLabel="记录"` and `先记第一笔` empty-state cues for 100% E2E compatibility
 */
export function CharioteerMobileCockpit({
  localDay,
  latestWeightKg,
  hasWeightToday,
  trainingSetsCount,
  trainingVolumeKg = 0,
  studyMinutesToday,
  monthlyExpenseCny,
  monthlyBudgetCny = 8000,
  onSaveWeight,
  onSaveWorkout,
  onSaveStudy,
  onOpenSheet,
}: {
  localDay: string;
  latestWeightKg: number | null;
  hasWeightToday: boolean;
  trainingSetsCount: number;
  trainingVolumeKg?: number;
  studyMinutesToday: number;
  monthlyExpenseCny: number;
  monthlyBudgetCny?: number;
  onSaveWeight: (kg: number) => void;
  onSaveWorkout: (input: { exercise: string; reps: number; weightKg: number | null; setsCount: number }) => void;
  onSaveStudy: (input: { topic: string; durationMinutes: number; note: string | null }) => void;
  onOpenSheet?: (kind?: RecordSheetKind) => void;
}) {
  const { color, scheme } = useTheme();
  const { locale, t } = useI18n();
  const isDark = scheme === 'dark';
  const [islandOpen, setIslandOpen] = useState(false);
  const [podScope, setPodScope] = useState<MobilePodScope>('all');
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState<MobileInlineSheet>('none');
  const [omnibarText, setOmnibarText] = useState('');

  const loggedCount =
    (hasWeightToday ? 1 : 0) + (trainingSetsCount > 0 ? 1 : 0) + (studyMinutesToday > 0 ? 1 : 0);

  const parsedIntent = useMemo(() => parseOmnibarCommand(omnibarText), [omnibarText]);

  const triggerSheet = (kind: RecordSheetKind = 'weight') => {
    if (onOpenSheet) {
      onOpenSheet(kind);
    } else {
      openRecordSheet(kind === 'weight' ? (latestWeightKg ?? undefined) : undefined, kind);
    }
  };

  function handleExecuteOmnibar() {
    if (!parsedIntent) {
      if (omnibarText.trim()) {
        showToast({
          text: t(
            '格式提示：输入如「72.4kg」「卧推 60kg 8x4」「读 DDIA 45m」或「瑞幸 18 微信」',
            'Try "72.4kg", "bench 60kg 8x4", "study DDIA 45m", or "coffee 18"',
          ),
        });
      } else {
        triggerSheet('weight');
      }
      return;
    }
    executeParsedOmnibarIntent(
      parsedIntent,
      localDay,
      {
        onSaveWeight,
        onSaveWorkout,
        onSaveStudy,
      },
      t,
    );
    setOmnibarText('');
  }

  const remainingBudgetCny = Math.max(0, monthlyBudgetCny - monthlyExpenseCny);
  const quickWeightVal = latestWeightKg ? Number(latestWeightKg.toFixed(1)) : 65.0;

  const quickExamples = [
    {
      label: `${quickWeightVal.toFixed(1)}kg`,
      cmd: `${quickWeightVal.toFixed(1)}kg`,
    },
    { label: t('卧推 60kg 8x3', 'Bench 60kg 8x3'), cmd: '卧推 60kg 8x3' },
    { label: t('读 AI 45m', 'Study AI 45m'), cmd: '读 AI Infra 45m' },
    { label: t('手冲咖啡 18 微信', 'Coffee 18'), cmd: '手冲咖啡 18 微信' },
  ];

  const showBody = podScope === 'all' || podScope === 'body';
  const showMind = podScope === 'all' || podScope === 'mind';
  const showWealth = podScope === 'all' || podScope === 'wealth';

  return (
    <View style={styles.container} testID="charioteer-mobile-cockpit">
      {/* 1. Mobile Top Scope Bar (`.m-scope-track`) + Primary Quick Action */}
      <View style={styles.topScopeHeader}>
        <View style={[styles.scopeTrack, { backgroundColor: color.surface, borderColor: color.line }]}>
          {(
            [
              { id: 'all', label: t('All Pods · 4', 'All Pods · 4'), dot: null },
              {
                id: 'body',
                label: t(`身体 · ${(hasWeightToday ? 1 : 0) + (trainingSetsCount > 0 ? 1 : 0)}/2`, 'Body'),
                dot: hasWeightToday && trainingSetsCount > 0 ? '#10B981' : '#F59E0B',
              },
              {
                id: 'mind',
                label: t(`心智 · ${studyMinutesToday}m`, `Mind · ${studyMinutesToday}m`),
                dot: studyMinutesToday > 0 ? '#10B981' : '#3B82F6',
              },
              {
                id: 'wealth',
                label: t(`账本 · ¥${Math.round(monthlyExpenseCny)}`, 'Ledger'),
                dot: '#C6613F',
              },
            ] as const
          ).map((seg) => {
            const active = podScope === seg.id;
            return (
              <Pressable
                key={seg.id}
                accessibilityRole="button"
                accessibilityLabel={seg.label}
                onPress={() => setPodScope(seg.id)}
                style={[
                  styles.scopeSeg,
                  active
                    ? {
                        backgroundColor: color.card,
                        borderColor: color.line,
                        borderWidth: 0.5,
                      }
                    : null,
                ]}
              >
                {seg.dot ? <View style={[styles.podLed, { backgroundColor: seg.dot }]} /> : null}
                <Text
                  variant="caption"
                  style={[
                    styles.scopeSegText,
                    {
                      color: active ? color.ink : color.muted,
                      fontWeight: active ? theme.fontWeight.semibold : theme.fontWeight.medium,
                    },
                  ]}
                >
                  {seg.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Primary "记录" button matching E2E `recordButton(page)` selector */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="记录"
          onPress={() => triggerSheet('weight')}
          style={({ pressed }) => [
            styles.primaryNewBtn,
            {
              backgroundColor: color.ink,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text variant="caption" style={[styles.primaryNewBtnText, { color: color.paper }]}>
            {t('记录', 'Log')}
          </Text>
        </Pressable>
      </View>

      {/* 2. Charioteer Chief Row (`.m-chief-row`) + iOS Dynamic Island Live Activity */}
      <View
        style={[
          styles.chiefCard,
          cardSurfaceStyle(color.card, color.line),
          {
            borderLeftColor: color.accent,
            borderLeftWidth: 2.5,
          },
        ]}
      >
        <View style={styles.chiefTopRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('展开今日节律思考链', 'Toggle daily rhythm reasoning')}
            onPress={() => setThoughtOpen((prev) => !prev)}
            style={styles.chiefMain}
          >
            <View style={[styles.brandTile, { backgroundColor: color.ink }]}>
              <Text
                variant="caption"
                style={{
                  fontFamily: theme.fontFamily.mono,
                  fontSize: 12,
                  fontWeight: theme.fontWeight.semibold,
                  color: color.paper,
                }}
              >
                ✦
              </Text>
              <View
                style={[
                  styles.tileStatusDot,
                  {
                    backgroundColor: loggedCount === 3 ? '#10B981' : '#F59E0B',
                    borderColor: color.card,
                  },
                ]}
              />
            </View>
            <View style={styles.chiefTextCol}>
              <View style={styles.chiefTitleRow}>
                <Text variant="label" style={styles.chiefTitle}>
                  Chief
                </Text>
                <Text variant="caption" tone="muted" style={{ fontSize: 10.5 }}>
                  {t('Personal Rhythm Orchestrator', 'Rhythm Orchestrator')}
                </Text>
              </View>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {latestWeightKg === null
                  ? t('先记第一笔 · 开启 7 日 EMA 均重与四维脉冲追踪', 'Log first entry to start 7D EMA')
                  : t(
                      `晨重 ${latestWeightKg.toFixed(1)}kg · 训练 ${trainingSetsCount}组 · 专注 ${studyMinutesToday}m`,
                      `Weight ${latestWeightKg.toFixed(1)}kg · ${trainingSetsCount} sets · ${studyMinutesToday}m`,
                    )}
              </Text>
            </View>
          </Pressable>

          {/* Dynamic Island Pill Trigger */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('展开灵动岛实时状态抽屉', 'Toggle Live Activity Dynamic Island')}
            onPress={() => setIslandOpen((prev) => !prev)}
            style={({ pressed }) => [
              styles.dynamicIslandPill,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.islandLeft}>
              <View style={styles.liveLedDot} />
              <Text variant="caption" style={styles.islandMonoText}>
                {islandOpen ? t('收起 ▴', 'Hide ▴') : `${loggedCount}/3 live ▾`}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Open-Canvas Reasoning Disclosure (`.m-thought-details`) */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setThoughtOpen((prev) => !prev)}
          style={styles.thoughtSummaryRow}
        >
          <Text variant="caption" tone="muted" style={styles.thoughtSummaryText}>
            {thoughtOpen
              ? t('▾ Thought for 0.8s · 收起今日节律诊断', '▾ Thought for 0.8s · Hide diagnosis')
              : t('› Thought for 0.8s · 查看今日四维节律编排建议', '› Thought for 0.8s · View daily synthesis')}
          </Text>
        </Pressable>
        {thoughtOpen ? (
          <View style={[styles.thoughtBody, { borderLeftColor: color.line }]}>
            <Text variant="caption" tone="muted" style={styles.thoughtProse}>
              {t(
                `检查 ${localDay} 四维遥测：${hasWeightToday ? '晨重已归档' : '晨重待打卡（建议空腹测量）'}；${trainingSetsCount > 0 ? `已完成 ${trainingSetsCount} 组抗阻训练（容量 ${Math.round(trainingVolumeKg)}kg）` : '今日尚未记录训练组'}；本月共享池剩余可用预算 ¥${Math.round(remainingBudgetCny)}。`,
                `Telemetry for ${localDay}: ${hasWeightToday ? 'Weight logged' : 'Weight pending'}; ${trainingSetsCount} workout sets (${Math.round(trainingVolumeKg)}kg volume); ¥${Math.round(remainingBudgetCny)} monthly budget remaining.`,
              )}
            </Text>
          </View>
        ) : null}

        {/* Expanded iOS Live Activity Drawer */}
        {islandOpen ? (
          <View style={styles.islandDrawer}>
            <View style={styles.islandDrawerHeader}>
              <Text variant="caption" style={styles.islandHeaderText}>
                {t('LIVE ACTIVITY · 今日四维脉冲直达', 'LIVE ACTIVITY · 4D TELEMETRY')}
              </Text>
              <Text variant="caption" style={styles.islandHeaderText}>
                {localDay}
              </Text>
            </View>
            <View style={styles.islandGrid}>
              <Pressable
                onPress={() => {
                  setIslandOpen(false);
                  triggerSheet('weight');
                }}
                style={styles.islandItem}
              >
                <Text variant="caption" style={styles.islandItemTitle}>
                  {`⚖️ ${t('晨重', 'Weight')}`}
                </Text>
                <Text variant="caption" style={styles.islandItemValue}>
                  {hasWeightToday && latestWeightKg ? `${latestWeightKg.toFixed(1)} kg` : t('点击秒记 →', 'Log →')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIslandOpen(false);
                  router.replace('/fitness');
                }}
                style={styles.islandItem}
              >
                <Text variant="caption" style={styles.islandItemTitle}>
                  {`🏋️ ${t('健身舱', 'Fitness')}`}
                </Text>
                <Text variant="caption" style={styles.islandItemValue}>
                  {trainingSetsCount > 0 ? `${trainingSetsCount} sets` : t('去训练 →', 'Open →')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIslandOpen(false);
                  router.replace('/study');
                }}
                style={styles.islandItem}
              >
                <Text variant="caption" style={styles.islandItemTitle}>
                  {`📚 ${t('学习角', 'Academy')}`}
                </Text>
                <Text variant="caption" style={styles.islandItemValue}>
                  {studyMinutesToday > 0 ? `${studyMinutesToday} min` : t('去精读 →', 'Read →')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIslandOpen(false);
                  router.replace('/browser');
                }}
                style={styles.islandItem}
              >
                <Text variant="caption" style={styles.islandItemTitle}>
                  {`🌐 ${t('浏览器', 'Browser')}`}
                </Text>
                <Text variant="caption" style={styles.islandItemValue}>
                  {t('ArXiv / GitHub →', 'Search →')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* 3. Charioteer Working Radar Roster Cards (`.m-sess-card` + `.m-cmd-bar` + `.m-tree-box`) */}
      <View style={styles.groupHead}>
        <View style={styles.groupTitleRow}>
          <View style={[styles.liveLedDot, { width: 5, height: 5 }]} />
          <Text variant="caption" tone="muted" style={styles.groupTitleText}>
            {t(`WORKING PODS · ${loggedCount}/3 SYNCED`, `WORKING PODS · ${loggedCount}/3 SYNCED`)}
          </Text>
        </View>
        <Text variant="caption" tone="muted" style={styles.groupMetaText}>
          Local-First SQLite
        </Text>
      </View>

      <View style={styles.rosterList}>
        {/* Pod 1: Body (Weight & Training) */}
        {showBody ? (
          <View
            style={[
              styles.sessCard,
              cardSurfaceStyle(color.card, color.line),
              !hasWeightToday ? { borderColor: color.accent, borderWidth: 1 } : null,
            ]}
          >
            <View style={styles.sessTop}>
              <View
                style={[
                  styles.brandTile,
                  {
                    backgroundColor: isDark ? 'rgba(16, 163, 127, 0.16)' : 'rgba(16, 163, 127, 0.11)',
                    borderColor: 'rgba(16, 163, 127, 0.25)',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: '#0E8A6B', fontFamily: theme.fontFamily.mono, fontWeight: theme.fontWeight.semibold }}>
                  ⚖
                </Text>
                <View
                  style={[
                    styles.tileStatusDot,
                    {
                      backgroundColor: hasWeightToday ? '#10B981' : '#F59E0B',
                      borderColor: color.card,
                    },
                  ]}
                />
              </View>

              <View style={styles.sessInfo}>
                <View style={styles.sessLine1}>
                  <Text variant="label" style={styles.sessName} numberOfLines={1}>
                    body-pod-1{' '}
                    <Text variant="caption" tone="muted">
                      {t('· 晨重与抗阻训练', '· Weight & Strength')}
                    </Text>
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: hasWeightToday ? color.greenSoft : color.accentSoft,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.badgeLed,
                        { backgroundColor: hasWeightToday ? color.green : color.accent },
                      ]}
                    />
                    <Text
                      variant="caption"
                      style={[
                        styles.badgeMono,
                        { color: hasWeightToday ? color.green : color.accent },
                      ]}
                    >
                      {hasWeightToday ? 'Synced' : 'Sign-off'}
                    </Text>
                  </View>
                </View>

                <View style={styles.sessLine2}>
                  <Text variant="caption" tone="muted" style={styles.sessEnv}>
                    {latestWeightKg === null
                      ? t('先记第一笔 · 尚未建立基准体重', 'No weight logged yet')
                      : `${latestWeightKg.toFixed(1)} kg · ${trainingSetsCount} sets (${Math.round(trainingVolumeKg)} kg)`}
                  </Text>
                  <View style={[styles.subagentPill, { backgroundColor: color.accentSoft }]}>
                    <Text variant="caption" style={[styles.subagentPillText, { color: color.accent }]}>
                      2 metrics
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Terminal Command Bar (`.m-cmd-bar`) */}
            <View style={[styles.cmdBar, { backgroundColor: color.surface, borderColor: color.lineSoft }]}>
              <Text variant="caption" style={[styles.cmdBarText, { color: color.ink }]} numberOfLines={1}>
                {`$ log weight ${quickWeightVal.toFixed(1)}kg && workout --sets ${trainingSetsCount}`}
              </Text>
              <View style={styles.cmdQuickActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(`一键打卡晨重 ${quickWeightVal.toFixed(1)}kg`, `Quick log ${quickWeightVal.toFixed(1)}kg`)}
                  onPress={() => {
                    onSaveWeight(quickWeightVal);
                    showToast({ text: t(`✓ 已记晨重 ${quickWeightVal.toFixed(1)} kg`, `✓ Logged ${quickWeightVal.toFixed(1)} kg`) });
                  }}
                  style={[styles.inlineCmdBtn, { backgroundColor: color.accentSoft }]}
                >
                  <Text variant="caption" style={[styles.inlineCmdBtnText, { color: color.accent }]}>
                    {hasWeightToday ? t(`↻ ${quickWeightVal.toFixed(1)}kg`, `↻ ${quickWeightVal.toFixed(1)}kg`) : t(`⚡ 记 ${quickWeightVal.toFixed(1)}kg`, `⚡ ${quickWeightVal.toFixed(1)}kg`)}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('一键打卡俯卧撑 20次', 'Quick log 20 pushups')}
                  onPress={() => {
                    onSaveWorkout({ exercise: '俯卧撑', reps: 20, weightKg: null, setsCount: 1 });
                    showToast({ text: t('✓ 已记训练：俯卧撑 × 20', '✓ Logged 20 pushups') });
                  }}
                  style={[styles.inlineCmdBtn, { backgroundColor: color.card, borderColor: color.line, borderWidth: 0.5 }]}
                >
                  <Text variant="caption" style={styles.inlineCmdBtnText}>
                    {t('＋训练', '＋Set')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Subagent Tree Box (`.m-tree-box`) */}
            <View style={[styles.treeBox, { backgroundColor: color.surface }]}>
              <View style={styles.treeRow}>
                <Text variant="caption" tone="muted" style={styles.treeMono}>
                  ├─ weight-ema7 · {latestWeightKg ? `${latestWeightKg.toFixed(1)} kg` : t('先记第一笔', 'First entry')}
                </Text>
                <Text variant="caption" style={[styles.treeMono, { color: hasWeightToday ? color.green : color.muted }]}>
                  {hasWeightToday ? 'recorded' : 'pending'}
                </Text>
              </View>
              <View style={styles.treeRow}>
                <Text variant="caption" tone="muted" style={styles.treeMono}>
                  └─ strength-vol · {trainingSetsCount > 0 ? `${trainingSetsCount} 组 / ${Math.round(trainingVolumeKg)} kg` : t('今日待训练', '0 sets')}
                </Text>
                <Text variant="caption" style={[styles.treeMono, { color: trainingSetsCount > 0 ? color.green : color.muted }]}>
                  {trainingSetsCount > 0 ? 'active' : 'idle'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Pod 2: Mind & Wealth Compact Dual Card */}
        {showMind || showWealth ? (
          <View style={[styles.sessCard, cardSurfaceStyle(color.card, color.line)]}>
            <View style={styles.sessTop}>
              <View
                style={[
                  styles.brandTile,
                  {
                    backgroundColor: isDark ? 'rgba(198, 97, 63, 0.18)' : 'rgba(198, 97, 63, 0.13)',
                    borderColor: 'rgba(198, 97, 63, 0.25)',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: color.accent, fontFamily: theme.fontFamily.mono, fontWeight: theme.fontWeight.semibold }}>
                  ⌘
                </Text>
                <View
                  style={[
                    styles.tileStatusDot,
                    {
                      backgroundColor: studyMinutesToday > 0 ? '#10B981' : '#3B82F6',
                      borderColor: color.card,
                    },
                  ]}
                />
              </View>

              <View style={styles.sessInfo}>
                <View style={styles.sessLine1}>
                  <Text variant="label" style={styles.sessName} numberOfLines={1}>
                    mind-ledger-2{' '}
                    <Text variant="caption" tone="muted">
                      {t('· 深度学习与人民币池', '· Study & CNY Pool')}
                    </Text>
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      onSaveStudy({ topic: 'AI Infra & 架构精读', durationMinutes: 45, note: 'Charioteer 随身雷达快记' });
                      showToast({ text: t('✓ 已记专注 45m', '✓ Logged 45m focus') });
                    }}
                    style={[styles.inlineCmdBtn, { backgroundColor: color.accentSoft }]}
                  >
                    <Text variant="caption" style={[styles.inlineCmdBtnText, { color: color.accent }]}>
                      {t('⚡ 专注 45m', '⚡ +45m')}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.sessLine2}>
                  <Text variant="caption" tone="muted" style={styles.sessEnv}>
                    {t(
                      `今日专注 ${studyMinutesToday}m · 本月支出 -¥${Math.round(monthlyExpenseCny)} (余 ¥${Math.round(remainingBudgetCny)})`,
                      `Focus ${studyMinutesToday}m · Spend -¥${Math.round(monthlyExpenseCny)}`,
                    )}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* 4. Pure CSS / Inline Half-Screen Bottom Sheets (`.m-sheet`: Diff & /side Chat) */}
      {activeSheet !== 'none' ? (
        <View style={[styles.inlineSheet, cardSurfaceStyle(color.card, color.line)]}>
          <View style={[styles.sheetGrabber, { backgroundColor: color.line }]} />
          <View style={styles.sheetHeader}>
            <Text variant="label" style={styles.sheetTitle}>
              {activeSheet === 'diff'
                ? t(`Artifact Patch · today_rhythm.log (+${loggedCount} −0)`, `Artifact Patch · today_rhythm.log (+${loggedCount} −0)`)
                : t('Side Chat (/side · 零上下文污染快问)', 'Side Chat (/side · Read-Only Snapshot)')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('关闭半屏抽屉', 'Close drawer')}
              onPress={() => setActiveSheet('none')}
              style={[styles.sheetCloseBtn, { backgroundColor: color.surface, borderColor: color.line }]}
            >
              <Text variant="caption">✕</Text>
            </Pressable>
          </View>

          {activeSheet === 'diff' ? (
            <View style={styles.diffCodeBlock}>
              <Text variant="caption" style={styles.diffHeaderLine}>
                {`sqlite://local-db/${localDay}.patch    +${loggedCount} −0`}
              </Text>
              <Text variant="caption" style={styles.diffAddLine}>
                {`+ weight_ema7 = ${latestWeightKg ? `${latestWeightKg.toFixed(1)} kg` : 'PENDING'} (${hasWeightToday ? 'synced' : 'awaiting input'})`}
              </Text>
              <Text variant="caption" style={styles.diffAddLine}>
                {`+ workout_sets = ${trainingSetsCount} sets (${Math.round(trainingVolumeKg)} kg total volume)`}
              </Text>
              <Text variant="caption" style={styles.diffAddLine}>
                {`+ deep_study_min = ${studyMinutesToday} min | cny_pool_left = ¥${Math.round(remainingBudgetCny)}`}
              </Text>
            </View>
          ) : (
            <View style={[styles.sideChatBox, { backgroundColor: color.surface, borderColor: color.lineSoft }]}>
              <Text variant="caption" tone="muted" style={styles.monoTiny}>
                SNAPSHOT ISOLATED · ZERO HISTORY POLLUTION
              </Text>
              <Text variant="caption" style={{ color: color.ink }}>
                {t(
                  `Q: 按当前进度，今天最值得优先补齐哪一项？`,
                  `Q: What is the highest-leverage action right now?`,
                )}
              </Text>
              <Text variant="caption" tone="muted">
                {!hasWeightToday
                  ? t(
                      'A: 今日晨重尚未打卡。建议点击上方「⚡ 记重」或在下方输入体重数值，补齐 7 日 EMA 连续曲线。',
                      'A: Morning weight is still unlogged. Tap quick weight or type in the Omnibar below.',
                    )
                  : studyMinutesToday < 30
                    ? t(
                        'A: 晨重已同步！今日深度专注还差 30m 即可触发「身心双修共振」奖励 (+15¥ 心愿金)。',
                        'A: Weight synced! 30m of deep study will unlock your Body×Mind resonance bonus.',
                      )
                    : t(
                        `A: 今日核心节律已达成 ${loggedCount}/3，本月共享预算剩余 ¥${Math.round(remainingBudgetCny)}，状态极佳。`,
                        `A: ${loggedCount}/3 pods synced and ¥${Math.round(remainingBudgetCny)} budget remaining.`,
                      )}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* 5. Charioteer Two-Tier Floating Capsule Composer (`.m-composer-card`) */}
      <View
        style={[
          styles.composerDock,
          {
            backgroundColor: color.card,
            borderColor: parsedIntent ? color.accent : color.line,
          },
          Platform.OS === 'web'
            ? ({
                boxShadow: isDark
                  ? '0 10px 28px rgba(0, 0, 0, 0.55), 0 0 0 0.5px rgba(255, 255, 255, 0.14)'
                  : '0 6px 22px rgba(28, 26, 22, 0.08), 0 1px 3px rgba(28, 26, 22, 0.04)',
              } as unknown as ViewStyle)
            : null,
        ]}
      >
        {/* Tier 1: Borderless Open-Canvas Input + Live Intent Recognition Badge */}
        <View style={styles.composerTopTier}>
          <TextInput
            value={omnibarText}
            onChangeText={setOmnibarText}
            onSubmitEditing={handleExecuteOmnibar}
            returnKeyType="send"
            placeholder={t(
              '一句话万用秒记：72.4kg / 卧推 60kg 8x4 / 读 DDIA 45m / 瑞幸 18 微信…',
              'Omnibar: "72.4kg", "卧推 60kg 8x4", "读 DDIA 45m", or "瑞幸 18 微信"…',
            )}
            placeholderTextColor={color.textFaint}
            style={[
              styles.composerInput,
              { color: color.ink },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
            ]}
          />
          {parsedIntent ? (
            <View style={[styles.intentPreviewPill, { backgroundColor: color.accentSoft }]}>
              <Text
                variant="caption"
                style={[styles.intentPreviewText, { color: color.accent }]}
                numberOfLines={1}
              >
                {locale === 'en'
                  ? `${parsedIntent.badgeEn}: ${parsedIntent.summaryEn}`
                  : `${parsedIntent.badgeZh} · ${parsedIntent.summaryZh}`}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Tier 2: Left Capsule Action Chips (including Side & Diff) + Right Circular Send Button */}
        <View style={[styles.composerBottomTier, { borderTopColor: color.lineSoft }]}>
          <View style={styles.composerChipsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('弹出 Side 旁路快问抽屉', 'Toggle Side Chat drawer')}
              onPress={() => setActiveSheet((prev) => (prev === 'side' ? 'none' : 'side'))}
              style={[
                styles.capsuleChip,
                {
                  backgroundColor: activeSheet === 'side' ? color.accentSoft : color.surface,
                  borderColor: activeSheet === 'side' ? color.accent : color.line,
                },
              ]}
            >
              <Text
                variant="caption"
                style={[
                  styles.capsuleChipText,
                  { color: activeSheet === 'side' ? color.accent : color.ink },
                ]}
              >
                Side
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('弹出 Diff 今日台账补丁抽屉', 'Toggle Diff Patch drawer')}
              onPress={() => setActiveSheet((prev) => (prev === 'diff' ? 'none' : 'diff'))}
              style={[
                styles.capsuleChip,
                {
                  backgroundColor: activeSheet === 'diff' ? color.greenSoft : color.surface,
                  borderColor: activeSheet === 'diff' ? color.green : color.line,
                },
              ]}
            >
              <Text
                variant="caption"
                style={[
                  styles.capsuleChipText,
                  { color: activeSheet === 'diff' ? color.green : color.ink },
                ]}
              >
                {`Diff +${loggedCount}`}
              </Text>
            </Pressable>

            {quickExamples.map((ex) => (
              <Pressable
                key={ex.cmd}
                accessibilityRole="button"
                accessibilityLabel={`填入指令 ${ex.cmd}`}
                onPress={() => setOmnibarText(ex.cmd)}
                style={({ pressed }) => [
                  styles.capsuleChip,
                  {
                    backgroundColor:
                      omnibarText === ex.cmd
                        ? color.accentSoft
                        : pressed
                          ? color.pressed
                          : color.surface,
                    borderColor: omnibarText === ex.cmd ? color.accent : color.line,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={[
                    styles.capsuleChipText,
                    { color: omnibarText === ex.cmd ? color.accent : color.muted },
                  ]}
                >
                  {ex.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('执行万用秒记指令', 'Execute omnibar command')}
            onPress={() => {
              void createId();
              handleExecuteOmnibar();
            }}
            style={({ pressed }) => [
              styles.sendCircleBtn,
              {
                backgroundColor: parsedIntent ? color.accent : color.ink,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: parsedIntent ? color.onToast : color.paper,
                fontSize: 13,
                fontWeight: theme.fontWeight.semibold,
              }}
            >
              ↑
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  topScopeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  scopeTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: 8.5,
    borderWidth: 0.5,
    gap: 2,
    flexWrap: 'wrap',
  },
  scopeSeg: {
    height: 22,
    paddingHorizontal: 7.5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  podLed: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  scopeSegText: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  primaryNewBtn: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  primaryNewBtnText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: theme.fontWeight.semibold,
  },
  chiefCard: {
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 6,
  },
  chiefTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chiefMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
    minWidth: 0,
  },
  brandTile: {
    width: 27,
    height: 27,
    borderRadius: 7,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  tileStatusDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 7,
    height: 7,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  chiefTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  chiefTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  chiefTitle: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: theme.fontWeight.semibold,
  },
  thoughtSummaryRow: {
    paddingTop: 2,
  },
  thoughtSummaryText: {
    fontSize: 11,
    lineHeight: 14,
  },
  thoughtBody: {
    paddingLeft: 10,
    paddingVertical: 2,
    borderLeftWidth: 1.5,
  },
  thoughtProse: {
    fontSize: 11,
    lineHeight: 16,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
    paddingTop: 2,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  groupTitleText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.5,
  },
  groupMetaText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 9.5,
    lineHeight: 12,
  },
  rosterList: {
    gap: 7,
  },
  sessCard: {
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 9.5,
    gap: 6.5,
  },
  sessTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8.5,
  },
  sessInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sessLine1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  sessName: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: theme.fontWeight.semibold,
    flex: 1,
  },
  sessLine2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sessEnv: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 14,
    flex: 1,
  },
  subagentPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  subagentPillText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: theme.fontWeight.medium,
  },
  cmdBar: {
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 7,
    borderWidth: 0.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cmdBarText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 14,
    flex: 1,
  },
  cmdQuickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineCmdBtn: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  inlineCmdBtnText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  treeBox: {
    paddingHorizontal: 8,
    paddingVertical: 5.5,
    borderRadius: 7,
    gap: 3,
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  treeMono: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 9.8,
    lineHeight: 13,
  },
  statusBadge: {
    height: 18,
    paddingHorizontal: 6.5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  badgeLed: {
    width: 4.5,
    height: 4.5,
    borderRadius: 999,
  },
  badgeMono: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  dynamicIslandPill: {
    height: 25,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#09090B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  islandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveLedDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  islandMonoText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 13,
    color: '#F4F4F5',
    fontWeight: theme.fontWeight.medium,
  },
  islandDrawer: {
    backgroundColor: '#111216',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  islandDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  islandHeaderText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 13,
    color: '#9CA3AF',
  },
  islandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  islandItem: {
    flexGrow: 1,
    minWidth: 135,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  islandItemTitle: {
    fontSize: 11.5,
    lineHeight: 15,
    color: '#F4F4F6',
    fontWeight: theme.fontWeight.medium,
  },
  islandItemValue: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    lineHeight: 14,
    color: '#34D399',
  },
  inlineSheet: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  sheetGrabber: {
    width: 34,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: theme.fontWeight.semibold,
  },
  sheetCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffCodeBlock: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#131418',
    gap: 3,
  },
  diffHeaderLine: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 14,
    color: '#93C5FD',
  },
  diffAddLine: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 14,
    color: '#6EE7B7',
  },
  sideChatBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 0.5,
    gap: 4,
  },
  monoTiny: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 9.5,
    lineHeight: 12,
  },
  composerDock: {
    borderRadius: 20,
    borderWidth: theme.border.width,
    paddingHorizontal: 12,
    paddingTop: 8.5,
    paddingBottom: 7.5,
    gap: 6.5,
  },
  composerTopTier: {
    gap: 4,
  },
  composerInput: {
    minHeight: 26,
    fontSize: 12.5,
    lineHeight: 17,
    paddingVertical: 2,
  },
  intentPreviewPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  intentPreviewText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: theme.fontWeight.semibold,
  },
  composerBottomTier: {
    paddingTop: 6,
    borderTopWidth: 0.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  composerChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    flex: 1,
  },
  capsuleChip: {
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleChipText: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: theme.fontWeight.medium,
  },
  sendCircleBtn: {
    width: 27,
    height: 27,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
