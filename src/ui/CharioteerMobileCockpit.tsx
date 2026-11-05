import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { router } from 'expo-router';

import { createId } from '@/core/id';
import { parseOmnibarCommand, type OmnibarIntent } from '@/core/omnibar';
import { computeExpenseLifeHours } from '@/core/time-pricing';
import { addLedgerTransaction } from '@/data/bookkeeping';
import { recordPledgeReward } from '@/data/life-gamification';
import { readEffectiveTimePricing } from '@/data/time-pricing';
import { openRecordSheet, type RecordSheetKind } from '@/features/record/record-sheet-store';

import { cardSurfaceStyle } from './Card';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { StudioMatrixBentoCard } from './IsometricStudioStage';
import { useI18n } from './use-i18n';

export type MobileLifeScope = 'all' | 'body' | 'ledger' | 'study';

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
    recordPledgeReward(`晨重打卡 ${intent.weightKg}kg`, localDay, 10);
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
    recordPledgeReward(`训练打卡 ${intent.exercise}`, localDay, 15);
    showToast({ text: t(`✓ 已记入训练：${intent.summaryZh}`, `✓ Logged workout: ${intent.summaryEn}`) });
    return;
  }
  if (intent.kind === 'study') {
    handlers.onSaveStudy({
      topic: intent.topic,
      durationMinutes: intent.durationMinutes,
      note: intent.note,
    });
    recordPledgeReward(`专注打卡 ${intent.topic}`, localDay, 15);
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
    recordPledgeReward(`记账 ${intent.note}`, localDay, 10);
    showToast({ text: t(`✓ 已入账：${intent.summaryZh}`, `✓ Logged ledger: ${intent.summaryEn}`) });
  }
}

/**
 * 星途移动端仪表盘（暖纸与黑金双模视觉、0.5px 细线、Squircle 状态角标与高密度双行卡片，
 * 摒弃对话气泡与冗余装饰，聚焦个人节律、健身、记账与精读工具感）：
 * 1. 顶部分段筛选器（全部 · 身体 · 账本 · 学习）+ 主「记录」胶囊按钮
 * 2. 左侧 2.5px 陶土色强调线「今日节律总览卡」+ 顶部深色胶囊实时进度抽屉
 * 3. 四维高密度双行仪表卡（晨重与均线、抗阻训练、家庭合池账本、深度精读）+ 一键快记胶囊
 * 4. 内嵌单行 Spotlight 式极简速记槽（回车直接入账/打卡）
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
  const [scope, setScope] = useState<MobileLifeScope>('all');
  const [quickInput, setQuickInput] = useState('');

  const loggedCount =
    (hasWeightToday ? 1 : 0) + (trainingSetsCount > 0 ? 1 : 0) + (studyMinutesToday > 0 ? 1 : 0);

  const parsedIntent = useMemo(() => parseOmnibarCommand(quickInput), [quickInput]);

  const triggerSheet = (kind: RecordSheetKind = 'weight') => {
    if (onOpenSheet) {
      onOpenSheet(kind);
    } else {
      openRecordSheet(kind === 'weight' ? (latestWeightKg ?? undefined) : undefined, kind);
    }
  };

  function handleQuickLogSubmit() {
    if (!parsedIntent) {
      if (quickInput.trim()) {
        showToast({
          text: t(
            '格式提示：可输入「72.4kg」「卧推 60kg 8x4」「读 DDIA 45m」或「瑞幸 18 微信」',
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
    setQuickInput('');
  }

  const remainingBudgetCny = Math.max(0, monthlyBudgetCny - monthlyExpenseCny);
  const budgetUsedPct =
    monthlyBudgetCny > 0 ? Math.min(100, Math.round((monthlyExpenseCny / monthlyBudgetCny) * 100)) : 0;
  const quickWeightVal = latestWeightKg ? Number(latestWeightKg.toFixed(1)) : 65.0;
  const timePricing = readEffectiveTimePricing();
  const monthlyExpenseLifeHours = computeExpenseLifeHours(
    monthlyExpenseCny,
    timePricing.breakdown.trueNetHourlyCny,
  );
  const studyValueTodayCny =
    Math.round(((studyMinutesToday / 60) * timePricing.breakdown.focusCompoundHourlyCny) * 10) / 10;

  const showBody = scope === 'all' || scope === 'body';
  const showLedger = scope === 'all' || scope === 'ledger';
  const showStudy = scope === 'all' || scope === 'study';

  return (
    <View style={styles.container} testID="charioteer-mobile-cockpit">
      {/* 1. 顶部毛玻璃感分段筛选栏 + 主「记录」按钮 */}
      <View style={styles.topScopeHeader}>
        <View style={[styles.scopeTrack, { backgroundColor: color.surface, borderColor: color.line }]}>
          {(
            [
              { id: 'all', label: t('全部概览', 'Overview'), dot: null },
              {
                id: 'body',
                label: t('身体节律', 'Body'),
                dot: hasWeightToday && trainingSetsCount > 0 ? '#10B981' : '#F59E0B',
              },
              {
                id: 'ledger',
                label: t('家庭账本', 'Ledger'),
                dot: budgetUsedPct > 85 ? '#F59E0B' : '#10B981',
              },
              {
                id: 'study',
                label: t('深度学习', 'Study'),
                dot: studyMinutesToday > 0 ? '#10B981' : '#3B82F6',
              },
            ] as const
          ).map((seg) => {
            const active = scope === seg.id;
            return (
              <Pressable
                key={seg.id}
                accessibilityRole="button"
                accessibilityLabel={seg.label}
                onPress={() => setScope(seg.id)}
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="记录"
          onPress={() => triggerSheet('weight')}
          style={({ pressed }) => [
            styles.primaryLogBtn,
            {
              backgroundColor: color.ink,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text variant="caption" style={[styles.primaryLogBtnText, { color: color.paper }]}>
            {t('＋ 记录', '＋ Log')}
          </Text>
        </Pressable>
      </View>

      {/* 2. 左侧陶土强调线「今日节律总览卡」+ 灵动岛式进度胶囊 */}
      <View
        style={[
          styles.summaryCard,
          cardSurfaceStyle(color.card, color.line),
          {
            borderLeftColor: color.accent,
            borderLeftWidth: 2.5,
          },
        ]}
      >
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryMain}>
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
            <View style={styles.summaryTextCol}>
              <View style={styles.summaryTitleRow}>
                <Text variant="label" style={styles.summaryTitle}>
                  {t('今日节律总览', 'Daily Rhythm Summary')}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: loggedCount === 3 ? color.greenSoft : color.accentSoft,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.badgeLed,
                      { backgroundColor: loggedCount === 3 ? color.green : color.accent },
                    ]}
                  />
                  <Text
                    variant="caption"
                    style={[
                      styles.badgeMono,
                      { color: loggedCount === 3 ? color.green : color.accent },
                    ]}
                  >
                    {loggedCount === 3 ? t('3/3 已完成', '3/3 Done') : t(`${loggedCount}/3 进行中`, `${loggedCount}/3 Active`)}
                  </Text>
                </View>
              </View>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {latestWeightKg === null
                  ? t('先记第一笔 · 开启 7 日均重与每日节律追踪', 'Log first entry to start 7D EMA')
                  : t(
                      `晨重 ${latestWeightKg.toFixed(1)}kg · 训练 ${trainingSetsCount}组 · 专注 ${studyMinutesToday}m · 月余 ¥${Math.round(remainingBudgetCny)}`,
                      `Weight ${latestWeightKg.toFixed(1)}kg · ${trainingSetsCount} sets · ${studyMinutesToday}m · Left ¥${Math.round(remainingBudgetCny)}`,
                    )}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('展开四维进度面板', 'Toggle 4D progress drawer')}
            onPress={() => setIslandOpen((prev) => !prev)}
            style={({ pressed }) => [
              styles.dynamicIslandPill,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.islandLeft}>
              <View style={styles.liveLedDot} />
              <Text variant="caption" style={styles.islandMonoText}>
                {islandOpen ? t('收起 ▴', 'Hide ▴') : `${loggedCount}/3 ▾`}
              </Text>
            </View>
          </Pressable>
        </View>

        {islandOpen ? (
          <View style={styles.islandDrawer}>
            <View style={styles.islandDrawerHeader}>
              <Text variant="caption" style={styles.islandHeaderText}>
                {t('今日四维直达面板', 'DAILY QUICK ACCESS')}
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
                  {`⚖️ ${t('晨重打卡', 'Weight')}`}
                </Text>
                <Text variant="caption" style={styles.islandItemValue}>
                  {hasWeightToday && latestWeightKg ? `${latestWeightKg.toFixed(1)} kg` : t('立即记录 →', 'Log →')}
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
                  {`🏋️ ${t('健身训练', 'Fitness')}`}
                </Text>
                <Text variant="caption" style={styles.islandItemValue}>
                  {trainingSetsCount > 0 ? `${trainingSetsCount} 组` : t('去训练 →', 'Open →')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIslandOpen(false);
                  router.replace('/ledger');
                }}
                style={styles.islandItem}
              >
                <Text variant="caption" style={styles.islandItemTitle}>
                  {`¥ ${t('家庭账本', 'Ledger')}`}
                </Text>
                <Text variant="caption" style={styles.islandItemValue}>
                  {`-¥${Math.round(monthlyExpenseCny)}`}
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
            </View>
          </View>
        ) : null}
      </View>

      {/* 3. Spotlight 式单行速记栏（干净的工具条，无对话气泡） */}
      <View
        style={[
          styles.quickSpotBar,
          cardSurfaceStyle(color.card, color.line),
          parsedIntent ? { borderColor: color.accent } : null,
        ]}
      >
        <View style={styles.quickSpotInputRow}>
          <Text variant="caption" style={{ color: color.accent, fontFamily: theme.fontFamily.mono, fontWeight: theme.fontWeight.semibold }}>
            ⚡
          </Text>
          <TextInput
            value={quickInput}
            onChangeText={setQuickInput}
            onSubmitEditing={handleQuickLogSubmit}
            returnKeyType="done"
            placeholder={t(
              '速记槽：输入 72.4kg / 卧推 60kg 8x4 / 瑞幸 18 回车即记…',
              'Quick log: "72.4kg", "bench 60kg 8x4", "coffee 18"…',
            )}
            placeholderTextColor={color.textFaint}
            style={[
              styles.quickSpotInput,
              { color: color.ink },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
            ]}
          />
          {quickInput.trim().length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('确认速记', 'Save quick log')}
              onPress={() => {
                void createId();
                handleQuickLogSubmit();
              }}
              style={[styles.spotSaveBtn, { backgroundColor: parsedIntent ? color.accent : color.ink }]}
            >
              <Text variant="caption" style={{ color: color.paper, fontSize: 10.5, fontWeight: theme.fontWeight.semibold }}>
                {t('记入', 'Save')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {parsedIntent ? (
          <View style={[styles.intentPreviewRow, { backgroundColor: color.accentSoft }]}>
            <Text variant="caption" style={[styles.intentPreviewText, { color: color.accent }]} numberOfLines={1}>
              {locale === 'en'
                ? `${parsedIntent.badgeEn}: ${parsedIntent.summaryEn}`
                : `${parsedIntent.badgeZh} · ${parsedIntent.summaryZh}`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 4. 高密度双行精致仪表卡片流（纯粹的个人量化卡片，无终端命令行） */}
      <View style={styles.cardsGrid}>
        {/* 卡片 A：晨重与抗阻训练（身体节律） */}
        {showBody ? (
          <View style={[styles.metricCard, cardSurfaceStyle(color.card, color.line)]}>
            <View style={styles.metricTop}>
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

              <View style={styles.metricInfo}>
                <View style={styles.metricLine1}>
                  <Text variant="label" style={styles.metricName}>
                    {t('晨重与抗阻训练', 'Weight & Strength')}
                  </Text>
                  <Text variant="caption" style={[styles.metricPrimaryMono, { color: color.ink }]}>
                    {latestWeightKg ? `${latestWeightKg.toFixed(1)} kg` : t('先记第一笔', 'First entry')}
                  </Text>
                </View>
                <View style={styles.metricLine2}>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {hasWeightToday
                      ? t(`今日晨重已打卡 · 训练 ${trainingSetsCount} 组 (${Math.round(trainingVolumeKg)}kg)`, `Weight logged · ${trainingSetsCount} sets`)
                      : t('今日晨重待打卡 · 保持 7 日均重连续', 'Morning weight pending today')}
                  </Text>
                </View>
              </View>
            </View>

            {/* 底部快捷动作栏（干净的胶囊按钮，替代终端命令行） */}
            <View style={[styles.metricFooterBar, { backgroundColor: color.surface, borderColor: color.lineSoft }]}>
              <Text variant="caption" tone="muted" style={styles.footerMetaMono}>
                {trainingSetsCount > 0
                  ? t(`今日容量 ${Math.round(trainingVolumeKg)} kg`, `Vol ${Math.round(trainingVolumeKg)} kg`)
                  : t('一键快速打卡', '1-Tap Quick Log')}
              </Text>
              <View style={styles.footerActionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(`一键记晨重 ${quickWeightVal.toFixed(1)}kg`, `Quick log ${quickWeightVal.toFixed(1)}kg`)}
                  onPress={() => {
                    onSaveWeight(quickWeightVal);
                    showToast({ text: t(`✓ 已记晨重 ${quickWeightVal.toFixed(1)} kg`, `✓ Logged ${quickWeightVal.toFixed(1)} kg`) });
                  }}
                  style={[styles.actionPill, { backgroundColor: color.accentSoft }]}
                >
                  <Text variant="caption" style={[styles.actionPillText, { color: color.accent }]}>
                    {hasWeightToday ? t(`↻ ${quickWeightVal.toFixed(1)}kg`, `↻ ${quickWeightVal.toFixed(1)}kg`) : t(`⚡ 记 ${quickWeightVal.toFixed(1)}kg`, `⚡ ${quickWeightVal.toFixed(1)}kg`)}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('一键记俯卧撑 20次', 'Quick log 20 pushups')}
                  onPress={() => {
                    onSaveWorkout({ exercise: '俯卧撑', reps: 20, weightKg: null, setsCount: 1 });
                    showToast({ text: t('✓ 已记训练：俯卧撑 × 20', '✓ Logged 20 pushups') });
                  }}
                  style={[styles.actionPill, { backgroundColor: color.card, borderColor: color.line, borderWidth: 0.5 }]}
                >
                  <Text variant="caption" style={styles.actionPillText}>
                    {t('＋俯卧撑×20', '＋20 Pushups')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => triggerSheet('training')}
                  style={[styles.actionPill, { backgroundColor: color.card, borderColor: color.line, borderWidth: 0.5 }]}
                >
                  <Text variant="caption" tone="muted" style={styles.actionPillText}>
                    {t('更多训练 ›', 'More ›')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* 卡片 B：家庭合池账本（预算进度槽 + 快捷记账） */}
        {showLedger ? (
          <View style={[styles.metricCard, cardSurfaceStyle(color.card, color.line)]}>
            <View style={styles.metricTop}>
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
                  ¥
                </Text>
                <View
                  style={[
                    styles.tileStatusDot,
                    {
                      backgroundColor: budgetUsedPct > 85 ? '#F59E0B' : '#10B981',
                      borderColor: color.card,
                    },
                  ]}
                />
              </View>

              <View style={styles.metricInfo}>
                <View style={styles.metricLine1}>
                  <Text variant="label" style={styles.metricName}>
                    {t('家庭合池账本', 'Family Pool Ledger')}
                  </Text>
                  <Text variant="caption" style={[styles.metricPrimaryMono, { color: color.ink }]}>
                    {`-¥${Math.round(monthlyExpenseCny)}`}
                  </Text>
                </View>
                <View style={styles.metricLine2}>
                  <Text variant="caption" tone="muted">
                    {t(
                      `本月已用 ${budgetUsedPct}% · 剩余 ¥${Math.round(remainingBudgetCny)}${timePricing.breakdown.trueNetHourlyCny > 0 ? ` · 折合 ${monthlyExpenseLifeHours.totalHours.toFixed(1)}h 生命工时` : ''}`,
                      `${budgetUsedPct}% used · ¥${Math.round(remainingBudgetCny)} left`,
                    )}
                  </Text>
                </View>
              </View>
            </View>

            {/* 紧凑进度槽 + 一键记账胶囊 */}
            <View style={[styles.metricFooterBar, { backgroundColor: color.surface, borderColor: color.lineSoft }]}>
              <View style={[styles.progressTrack, { backgroundColor: color.line }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(4, budgetUsedPct)}%`,
                      backgroundColor: budgetUsedPct > 85 ? color.accent : color.green,
                    },
                  ]}
                />
              </View>
              <View style={styles.footerActionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    addLedgerTransaction({
                      kind: 'expense',
                      amountCny: 18,
                      categoryId: 'coffee',
                      accountId: 'wechat',
                      owner: 'me',
                      note: '手冲咖啡',
                      localDay,
                    });
                    showToast({ text: t('✓ 已记账：手冲咖啡 ¥18', '✓ Logged coffee ¥18') });
                  }}
                  style={[styles.actionPill, { backgroundColor: color.card, borderColor: color.line, borderWidth: 0.5 }]}
                >
                  <Text variant="caption" style={styles.actionPillText}>
                    {t('☕ 咖啡 ¥18', '☕ ¥18')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace('/ledger')}
                  style={[styles.actionPill, { backgroundColor: color.accentSoft }]}
                >
                  <Text variant="caption" style={[styles.actionPillText, { color: color.accent }]}>
                    {t('账本明细 ›', 'Ledger ›')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* 卡片 C：深度学习与知识图谱闪卡 */}
        {showStudy ? (
          <View style={[styles.metricCard, cardSurfaceStyle(color.card, color.line)]}>
            <View style={styles.metricTop}>
              <View
                style={[
                  styles.brandTile,
                  {
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(59, 130, 246, 0.11)',
                    borderColor: 'rgba(59, 130, 246, 0.24)',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: '#2563EB', fontFamily: theme.fontFamily.mono, fontWeight: theme.fontWeight.semibold }}>
                  📚
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

              <View style={styles.metricInfo}>
                <View style={styles.metricLine1}>
                  <Text variant="label" style={styles.metricName}>
                    {t('深度学习与闪卡', 'Deep Study & FSRS')}
                  </Text>
                  <Text variant="caption" style={[styles.metricPrimaryMono, { color: color.ink }]}>
                    {`${studyMinutesToday} min`}
                  </Text>
                </View>
                <View style={styles.metricLine2}>
                  <Text variant="caption" tone="muted">
                    {studyMinutesToday > 0
                      ? t(
                          `今日已专注 ${studyMinutesToday} 分钟${studyValueTodayCny > 0 ? ` · 复利价值 +¥${studyValueTodayCny}` : ' · 保持心智复利'}`,
                          `${studyMinutesToday}m logged today`,
                        )
                      : t('今日尚未记录专注 · 满 30m 触发心愿金奖励', 'Log 30m+ focus to earn wish reward')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.metricFooterBar, { backgroundColor: color.surface, borderColor: color.lineSoft }]}>
              <Text variant="caption" tone="muted" style={styles.footerMetaMono}>
                FSRS · 17 Chapters
              </Text>
              <View style={styles.footerActionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onSaveStudy({ topic: 'AI Infra & 架构精读', durationMinutes: 45, note: '今日深度精读打卡' });
                    showToast({ text: t('✓ 已记专注 45 分钟', '✓ Logged 45m focus') });
                  }}
                  style={[styles.actionPill, { backgroundColor: color.accentSoft }]}
                >
                  <Text variant="caption" style={[styles.actionPillText, { color: color.accent }]}>
                    {t('⚡ 记精读 45m', '⚡ +45m')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace('/study')}
                  style={[styles.actionPill, { backgroundColor: color.card, borderColor: color.line, borderWidth: 0.5 }]}
                >
                  <Text variant="caption" style={styles.actionPillText}>
                    {t('学习角 ›', 'Academy ›')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* 5. ✦ 星途专业工作室矩阵 · Studio Drawer (2x2 黑金浮雕插画 Bento 矩阵) */}
      <StudioMatrixBentoCard />
    </View>
  );
}

export { StudioMatrixBentoCard } from './IsometricStudioStage';
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
  primaryLogBtn: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  primaryLogBtnText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: theme.fontWeight.semibold,
  },
  summaryCard: {
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 8,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryMain: {
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
  summaryTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  summaryTitle: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: theme.fontWeight.semibold,
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
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 7,
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
    paddingVertical: 6.5,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  islandItemTitle: {
    fontSize: 11.2,
    lineHeight: 15,
    color: '#F4F4F6',
    fontWeight: theme.fontWeight.medium,
  },
  islandItemValue: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.2,
    lineHeight: 14,
    color: '#34D399',
  },
  quickSpotBar: {
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 6.5,
    gap: 4,
  },
  quickSpotInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickSpotInput: {
    flex: 1,
    minHeight: 24,
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 1,
  },
  spotSaveBtn: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intentPreviewRow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  intentPreviewText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  cardsGrid: {
    gap: 7,
  },
  metricCard: {
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 9.5,
    gap: 6.5,
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8.5,
  },
  metricInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metricLine1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  metricName: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: theme.fontWeight.semibold,
  },
  metricPrimaryMono: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: theme.fontWeight.semibold,
  },
  metricLine2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricFooterBar: {
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 7,
    borderWidth: 0.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerMetaMono: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 13,
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  actionPill: {
    height: 22,
    paddingHorizontal: 7.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {
    fontSize: 10.2,
    lineHeight: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: 110,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
