import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  computeKnowledgeGraphStats,
  readKnowledgeGraphState,
} from '@/core/knowledge-graph-corner';
import { computeLocalDay, formatMonthDay } from '@/core/local-day';
import { studyDetail, studyRecordsOnDay } from '@/core/study';
import { incrementOrAddTimeBlock } from '@/data/time-block-tracker';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useShellInset } from '@/features/shell/AppShell';
import { useStudy } from '@/features/study/StudyProvider';
import { excludePending } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { Card } from '@/ui/Card';
import { useLayoutClass } from '@/ui/chrome';
import { Content } from '@/ui/Content';
import { KnowledgeGraphCornerHub } from '@/ui/KnowledgeGraphCornerHub';
import { Divider, Row, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { SetRow } from '@/ui/SetRow';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';
import { showToast } from '@/ui/toast';
import { useI18n } from '@/ui/use-i18n';
import { CockpitHeaderBar, CockpitPillButton, TagChip } from '@/ui/WorkbenchConsole';

export function StudyScreen() {
  const { daySwitch, timeZone } = useWeight();
  const study = useStudy();
  const inset = useShellInset();
  const layout = useLayoutClass();
  const { color, scheme } = useTheme();
  const { t } = useI18n();
  const isDark = scheme === 'dark';

  const localDay = computeLocalDay(new Date(), timeZone, daySwitch);
  const countedStudy = useMemo(
    () => excludePending(study.records, study.pendingDeleteIds),
    [study.records, study.pendingDeleteIds],
  );
  const todayStudy = useMemo(
    () => studyRecordsOnDay(countedStudy, localDay),
    [countedStudy, localDay],
  );

  const [quickTopic, setQuickTopic] = useState('AI Infra · Transformer 与 PagedAttention');
  const [quickMinutes, setQuickMinutes] = useState('45');
  const [showStudyHistory, setShowStudyHistory] = useState(false);

  const kgStats = useMemo(() => computeKnowledgeGraphStats(readKnowledgeGraphState()), []);
  const todayMinutes = todayStudy.reduce((sum, r) => sum + r.durationMinutes, 0);
  const totalLoggedMinutes = countedStudy.reduce((sum, r) => sum + r.durationMinutes, 0);
  const combinedStudyMinutes = Math.max(totalLoggedMinutes, kgStats.totalStudyMinutes);
  const combinedHours = (combinedStudyMinutes / 60).toFixed(1);
  const masteryPct = Math.min(100, Number(((combinedStudyMinutes / 60 / 10000) * 100).toFixed(2)));

  const openDesktopBridge = (action: 'palette' | 'scope') => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const bridge = (
      window as unknown as {
        __viastelaDesktop?: {
          openCommandPalette?: () => void;
          openScopeModal?: () => void;
        };
      }
    ).__viastelaDesktop;
    if (action === 'palette') bridge?.openCommandPalette?.();
    else bridge?.openScopeModal?.();
  };

  const handleLogStudy = (topic: string, mins: number) => {
    const cleanTopic = topic.trim() || 'AI 交互式研习';
    const validMins = Math.max(5, Math.min(480, Math.round(mins)));
    void study.saveRecord({
      topic: cleanTopic,
      durationMinutes: validMins,
      note: '来自学习角知识图谱研习打卡',
    });
    incrementOrAddTimeBlock({
      localDay,
      category: 'study',
      title: cleanTopic,
      deltaMinutes: validMins,
      goalId: null,
    });
  };

  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader
          kicker={t('学习角 · Academy', 'Academy · Knowledge Graph')}
          title={t('AI 交互式动画讲堂与个人知识图谱', 'Interactive AI Lab & Knowledge Graph')}
          trailing={
            layout !== 'compact' ? (
              <CockpitHeaderBar
                hudText={t(
                  `今日研习 ${todayMinutes}m · 累计 ${combinedHours}h · 已掌握 ${kgStats.masteredCount}/${kgStats.totalNodes} 节点`,
                  `Today ${todayMinutes}m · Total ${combinedHours}h · Mastered ${kgStats.masteredCount}/${kgStats.totalNodes}`,
                )}
                onOpenRecord={() => openRecordSheet(undefined, 'study')}
                onOpenPalette={() => openDesktopBridge('palette')}
                onOpenScope={() => openDesktopBridge('scope')}
              />
            ) : undefined
          }
          subtitle={{
            description: t(
              '内建 6 大 AI Infra 交互式 SVG 动画实验室、2D 技能树 + Obsidian [[双向链接]] 知识图谱与零膨胀按需离线章节包。',
              '6 interactive AI Infra SVG animation labs, 2D DAG + [[WikiLink]] knowledge graph, and zero-bloat offline chapter packs.',
            ),
            timeZone,
            onRetry: () => void study.reload(),
          }}
        />

        <Stack gap="md">
          {/* 1. Top 10,000-Hour Mastery & Quick Study Session Bar */}
          <Card>
            <Stack gap="sm">
              <Row justify="between" align="center" gap="sm" wrap>
                <Row gap="sm" align="center" wrap>
                  <Text variant="label" style={{ fontWeight: theme.fontWeight.semibold }}>
                    {t('一万小时定律 · 深度学习控制台', '10,000-Hour Mastery & Quick Study Log')}
                  </Text>
                  <TagChip
                    label={t(
                      `今日 ${todayMinutes} min · 累计 ${combinedHours} / 10,000 h (${masteryPct}%)`,
                      `Today ${todayMinutes}m · Total ${combinedHours}h`,
                    )}
                    tone={todayMinutes > 0 ? 'exec' : 'pod'}
                  />
                  <TagChip
                    label={t(
                      `离线包沙箱 ${kgStats.cachedSizeKb} KB`,
                      `Offline Sandbox ${kgStats.cachedSizeKb} KB`,
                    )}
                    tone="owner"
                  />
                </Row>

                <Row gap="xs" align="center" wrap>
                  {[25, 45, 60].map((m) => (
                    <CockpitPillButton
                      key={m}
                      label={`＋${m}m 番茄钟`}
                      onPress={() => {
                        handleLogStudy(quickTopic, m);
                        showToast({
                          text: t(`✓ 已记录专注研习「${quickTopic}」+${m} 分钟`, `✓ Logged +${m}m study`),
                        });
                      }}
                    />
                  ))}
                  <CockpitPillButton
                    label={
                      showStudyHistory
                        ? t(`收起今日记录 (${todayStudy.length}) ▲`, 'Hide Logs ▲')
                        : t(`今日学习台账 (${todayStudy.length}) ▼`, 'Today Logs ▼')
                    }
                    active={showStudyHistory}
                    onPress={() => setShowStudyHistory((v) => !v)}
                  />
                </Row>
              </Row>

              {/* Quick Custom Topic & Duration Input Row */}
              <View style={styles.quickRow}>
                <TextInput
                  value={quickTopic}
                  onChangeText={setQuickTopic}
                  placeholder={t('输入当前研习课题，如：FlashAttention 分块推导', 'Study topic...')}
                  placeholderTextColor={color.muted}
                  style={[
                    styles.topicInput,
                    {
                      color: color.ink,
                      backgroundColor: isDark ? '#141311' : color.surface,
                      borderColor: color.lineSoft,
                    },
                  ]}
                />
                {study.recentTopics.slice(0, 3).map((tp) => (
                  <Pressable
                    key={tp}
                    onPress={() => setQuickTopic(tp)}
                    style={[
                      styles.topicChip,
                      {
                        borderColor: quickTopic === tp ? color.accent : color.lineSoft,
                        backgroundColor: color.surface,
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ fontSize: 10.5 }}>
                      {tp}
                    </Text>
                  </Pressable>
                ))}
                <TextInput
                  value={quickMinutes}
                  onChangeText={setQuickMinutes}
                  keyboardType="numeric"
                  placeholder="45"
                  placeholderTextColor={color.muted}
                  style={[
                    styles.minInput,
                    {
                      color: color.ink,
                      backgroundColor: isDark ? '#141311' : color.surface,
                      borderColor: color.lineSoft,
                    },
                  ]}
                />
                <CockpitPillButton
                  label={t('✓ 记入今日学习', '✓ Save Study Log')}
                  active
                  onPress={() => {
                    const mins = Number.parseInt(quickMinutes, 10) || 30;
                    handleLogStudy(quickTopic, mins);
                  }}
                />
              </View>

              {showStudyHistory ? (
                <Stack gap="xs">
                  <Divider />
                  {todayStudy.length === 0 ? (
                    <Text variant="caption" tone="muted">
                      {t(
                        `${formatMonthDay(localDay)} 还没有学习打卡，点击上方番茄钟或下方章节「⏱ 打卡 +25m」即可记录。`,
                        'No study sessions logged today yet.',
                      )}
                    </Text>
                  ) : (
                    todayStudy.map((rec) => (
                      <SetRow
                        key={rec.id}
                        title={rec.topic}
                        detail={studyDetail(rec)}
                        onDelete={() => study.scheduleDelete(rec.id)}
                      />
                    ))
                  )}
                </Stack>
              ) : null}
            </Stack>
          </Card>

          {/* 2. Full-Screen Interactive AI Animation & Personal Knowledge Graph Workbench */}
          <KnowledgeGraphCornerHub
            localDay={localDay}
            totalStudyMinutesLive={combinedStudyMinutes}
            onLogStudyMinutes={(title, mins) => handleLogStudy(title, mins)}
            fullScreen
          />
        </Stack>
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicInput: {
    flex: 1,
    minWidth: 210,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    fontSize: 12.5,
  },
  minInput: {
    width: 68,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    fontSize: 12.5,
    textAlign: 'center',
  },
  topicChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
});
