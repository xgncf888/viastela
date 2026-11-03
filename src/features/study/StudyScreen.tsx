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
import { useTheme } from '@/ui/ThemeProvider';
import { showToast } from '@/ui/toast';
import { useI18n } from '@/ui/use-i18n';
import { CockpitHeaderBar, CockpitPillButton } from '@/ui/WorkbenchConsole';

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

  const [showCustomLogger, setShowCustomLogger] = useState(false);
  const [quickTopic, setQuickTopic] = useState('AI 交互式研习');
  const [quickMinutes, setQuickMinutes] = useState('25');

  const kgStats = useMemo(() => computeKnowledgeGraphStats(readKnowledgeGraphState()), []);
  const todayMinutes = todayStudy.reduce((sum, r) => sum + r.durationMinutes, 0);
  const totalLoggedMinutes = countedStudy.reduce((sum, r) => sum + r.durationMinutes, 0);
  const combinedStudyMinutes = Math.max(totalLoggedMinutes, kgStats.totalStudyMinutes);
  const combinedHours = (combinedStudyMinutes / 60).toFixed(1);

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
      note: '来自学习角闯关打卡',
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
          kicker={t('学习角 · Academy', 'Academy · Guided Learning')}
          title={t('从零看懂 AI · 一步一卡交互讲堂', 'Step-by-Step Interactive AI Academy')}
          trailing={
            <Row gap="xs" align="center" wrap>
              <CockpitPillButton
                label={
                  showCustomLogger
                    ? t('收起计时器 ▲', 'Hide Timer ▲')
                    : t(`⏱ 今日已学 ${todayMinutes}m · 累计 ${combinedHours}h ▼`, `⏱ Today ${todayMinutes}m · ${combinedHours}h ▼`)
                }
                active={showCustomLogger}
                onPress={() => setShowCustomLogger((v) => !v)}
              />
              {layout !== 'compact' ? (
                <CockpitHeaderBar
                  hudText={t(
                    `已掌握 ${kgStats.masteredCount}/${kgStats.totalNodes} 课`,
                    `Mastered ${kgStats.masteredCount}/${kgStats.totalNodes}`,
                  )}
                  onOpenRecord={() => openRecordSheet(undefined, 'study')}
                  onOpenPalette={() => openDesktopBridge('palette')}
                  onOpenScope={() => openDesktopBridge('scope')}
                />
              ) : null}
            </Row>
          }
          subtitle={{
            description: t(
              '每次只聚焦 1 张卡片：先听生活比喻 → 再动手点动画 → 看 3 句话总结 → 做 1 道题通关。',
              'One focused card at a time: Analogy → Interactive Animation → 3 Key Takeaways → 1 Quiz.',
            ),
            timeZone,
            onRetry: () => void study.reload(),
          }}
        />

        <Stack gap="md">
          {/* Optional Collapsible Study Time Logger Drawer (Hidden by default to keep screen calm!) */}
          {showCustomLogger ? (
            <Card>
              <Stack gap="sm">
                <Row justify="between" align="center" gap="sm" wrap>
                  <Text variant="caption" style={{ fontWeight: '700' }}>
                    {t('⏱ 快速补记今日自定义学习时长', '⏱ Quick Log Custom Study Session')}
                  </Text>
                  <Row gap="xs" align="center">
                    {[25, 45].map((m) => (
                      <CockpitPillButton
                        key={m}
                        label={`＋${m}m 番茄钟`}
                        onPress={() => {
                          handleLogStudy(quickTopic, m);
                          showToast({ text: t(`✓ 已记录专注研习 +${m} 分钟`, `✓ Logged +${m}m`) });
                        }}
                      />
                    ))}
                  </Row>
                </Row>
                <View style={styles.quickRow}>
                  <TextInput
                    value={quickTopic}
                    onChangeText={setQuickTopic}
                    placeholder={t('输入研习课题', 'Study topic...')}
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
                  <TextInput
                    value={quickMinutes}
                    onChangeText={setQuickMinutes}
                    keyboardType="numeric"
                    placeholder="25"
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
                    label={t('✓ 保存记录', '✓ Save')}
                    active
                    onPress={() => {
                      const mins = Number.parseInt(quickMinutes, 10) || 25;
                      handleLogStudy(quickTopic, mins);
                    }}
                  />
                </View>
                {todayStudy.length > 0 ? (
                  <Stack gap="xs">
                    <Divider />
                    {todayStudy.map((rec) => (
                      <SetRow
                        key={rec.id}
                        title={rec.topic}
                        detail={studyDetail(rec)}
                        onDelete={() => study.scheduleDelete(rec.id)}
                      />
                    ))}
                  </Stack>
                ) : (
                  <Text variant="caption" tone="muted">
                    {t(`${formatMonthDay(localDay)} 暂无单独打卡，每通关一节课程也会自动为你记入 +25 分钟。`, 'Completing any lesson below automatically logs +25m.')}
                  </Text>
                )}
              </Stack>
            </Card>
          ) : null}

          {/* Main Focused Step-by-Step Guided Academy */}
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
    minWidth: 200,
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
});
