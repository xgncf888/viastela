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
 * Charioteer Mobile Cockpit Hub:
 * 1. Interactive Dynamic Island Live Activity Bar (`.ios-island` + `.island-expanded-drawer`)
 * 2. Left-accent Chief Row (`.m-chief-row`) with squircle brand tile & live status dot
 * 3. Two-Tier Floating Capsule Omnibar Composer (`.m-composer` inspired by Claude iOS / ChatGPT iOS)
 */
export function CharioteerMobileCockpit({
  localDay,
  latestWeightKg,
  hasWeightToday,
  trainingSetsCount,
  studyMinutesToday,
  monthlyExpenseCny,
  onSaveWeight,
  onSaveWorkout,
  onSaveStudy,
  onOpenSheet,
}: {
  localDay: string;
  latestWeightKg: number | null;
  hasWeightToday: boolean;
  trainingSetsCount: number;
  studyMinutesToday: number;
  monthlyExpenseCny: number;
  onSaveWeight: (kg: number) => void;
  onSaveWorkout: (input: { exercise: string; reps: number; weightKg: number | null; setsCount: number }) => void;
  onSaveStudy: (input: { topic: string; durationMinutes: number; note: string | null }) => void;
  onOpenSheet?: (kind?: RecordSheetKind) => void;
}) {
  const { color, scheme } = useTheme();
  const { locale, t } = useI18n();
  const isDark = scheme === 'dark';
  const [islandOpen, setIslandOpen] = useState(false);
  const [omnibarText, setOmnibarText] = useState('');

  const loggedCount =
    (hasWeightToday ? 1 : 0) + (trainingSetsCount > 0 ? 1 : 0) + (studyMinutesToday > 0 ? 1 : 0);

  const parsedIntent = useMemo(() => parseOmnibarCommand(omnibarText), [omnibarText]);

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
        (onOpenSheet ?? ((k) => openRecordSheet(latestWeightKg ?? undefined, k)))('weight');
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

  const quickExamples = [
    {
      label: latestWeightKg ? `${latestWeightKg.toFixed(1)}kg` : '72.4kg',
      cmd: latestWeightKg ? `${latestWeightKg.toFixed(1)}kg` : '72.4kg',
    },
    { label: t('卧推 60kg 8x3', 'Bench 60kg 8x3'), cmd: '卧推 60kg 8x3' },
    { label: t('读 AI 45m', 'Study AI 45m'), cmd: '读 AI Infra 45m' },
    { label: t('手冲咖啡 18 微信', 'Coffee 18'), cmd: '手冲咖啡 18 微信' },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Charioteer iOS Dynamic Island Live Activity Bar + Chief Telemetry Row */}
      <View
        style={[
          styles.chiefCard,
          cardSurfaceStyle(color.card, color.line),
          {
            borderLeftColor: color.accent,
            borderLeftWidth: 3,
          },
        ]}
      >
        <View style={styles.chiefTopRow}>
          <View style={styles.chiefMain}>
            <View
              style={[
                styles.brandTile,
                {
                  backgroundColor: isDark ? 'rgba(229, 169, 60, 0.16)' : 'rgba(204, 120, 92, 0.13)',
                  borderColor: isDark ? 'rgba(229, 169, 60, 0.35)' : 'rgba(204, 120, 92, 0.26)',
                },
              ]}
            >
              <Text
                variant="caption"
                style={{
                  fontFamily: theme.fontFamily.mono,
                  fontSize: 12,
                  fontWeight: theme.fontWeight.semibold,
                  color: color.accent,
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
                  {t('星途 · 个人节律驾驶舱', 'Personal Rhythm Cockpit')}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        loggedCount === 3 ? color.greenSoft : color.accentSoft,
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
                    {loggedCount === 3 ? '3/3 SYNCED' : `${loggedCount}/3 ACTIVE`}
                  </Text>
                </View>
              </View>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {t(
                  `晨重 ${latestWeightKg ? `${latestWeightKg.toFixed(1)}kg` : '待记'} · 训练 ${trainingSetsCount}组 · 专注 ${studyMinutesToday}m · 本月 -¥${Math.round(monthlyExpenseCny)}`,
                  `Weight ${latestWeightKg ? `${latestWeightKg.toFixed(1)}kg` : '—'} · ${trainingSetsCount} sets · ${studyMinutesToday}m focus`,
                )}
              </Text>
            </View>
          </View>

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
                  (onOpenSheet ?? ((k) => openRecordSheet(latestWeightKg ?? undefined, k)))('weight');
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

      {/* 2. Charioteer Two-Tier Floating Capsule Composer (Omnibar) */}
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
                  ? '0 8px 24px rgba(0, 0, 0, 0.45), 0 0 0 0.5px rgba(245, 185, 66, 0.22)'
                  : '0 6px 24px rgba(28, 26, 22, 0.06), 0 1px 3px rgba(28, 26, 22, 0.04)',
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

        {/* Tier 2: Left Capsule Action Chips + Right Circular Send Button */}
        <View style={[styles.composerBottomTier, { borderTopColor: color.lineSoft }]}>
          <View style={styles.composerChipsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('打开完整记录抽屉', 'Open full record sheet')}
              onPress={() =>
                (onOpenSheet ?? ((k) => openRecordSheet(latestWeightKg ?? undefined, k)))('weight')
              }
              style={({ pressed }) => [
                styles.capsuleChip,
                {
                  backgroundColor: pressed ? color.pressed : color.surface,
                  borderColor: color.line,
                },
              ]}
            >
              <Text variant="caption" style={styles.capsuleChipText}>
                {t('＋ 面板', '＋ Sheet')}
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
  chiefCard: {
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 8,
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
    width: 28,
    height: 28,
    borderRadius: 7.5,
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
    width: 7.5,
    height: 7.5,
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
    fontSize: 12.5,
    lineHeight: 16,
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
    fontSize: 9.8,
    lineHeight: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  dynamicIslandPill: {
    height: 26,
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
  composerDock: {
    borderRadius: 16,
    borderWidth: theme.border.width,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
  },
  composerTopTier: {
    gap: 4,
  },
  composerInput: {
    minHeight: 28,
    fontSize: 13,
    lineHeight: 18,
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
    height: 25,
    paddingHorizontal: 8.5,
    borderRadius: 999,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleChipText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: theme.fontWeight.medium,
  },
  sendCircleBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
