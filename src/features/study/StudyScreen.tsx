import { useMemo, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

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
import { CockpitHeaderBar, CockpitPillButton } from '@/ui/WorkbenchConsole';

export function StudyScreen() {
  const { daySwitch, timeZone } = useWeight();
  const study = useStudy();
  const inset = useShellInset();
  const layout = useLayoutClass();
  const { color } = useTheme();
  const { t } = useI18n();

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
  const [quickTopic, setQuickTopic] = useState('《AI 从零到架构师》精读笔记');
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
    const cleanTopic = topic.trim() || '《AI 从零到架构师》章节阅读';
    const validMins = Math.max(5, Math.min(480, Math.round(mins)));
    void study.saveRecord({
      topic: cleanTopic,
      durationMinutes: validMins,
      note: '来自学习角书院阅读打卡',
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
          kicker={t('学习角 · 个人书房', 'Academy · Reading Sanctuary')}
          title={t('《AI 从零到架构师 · 交互式插图读本》', 'The Illustrated Interactive Book of AI')}
          trailing={
            <Row gap="xs" align="center" wrap>
              <CockpitPillButton
                label={
                  showCustomLogger
                    ? t('收起读书计时 ▲', 'Hide Reading Log ▲')
                    : t(`📖 今日已读 ${todayMinutes}m · 累计 ${combinedHours}h ▼`, `📖 Today ${todayMinutes}m · ${combinedHours}h ▼`)
                }
                active={showCustomLogger}
                onPress={() => setShowCustomLogger((v) => !v)}
              />
              {layout !== 'compact' ? (
                <CockpitHeaderBar
                  hudText={t(
                    `已读完 ${kgStats.masteredCount}/${kgStats.totalNodes} 章`,
                    `Read ${kgStats.masteredCount}/${kgStats.totalNodes} Ch`,
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
              '像翻开一本带有活动插图的精装书：一页开篇故事、一页可拨动的书中插图、一页划线旁批、一页掩卷手札。',
              'Read like an illustrated hardcover book: Narrative intro, interactive figure, margin notes, and reflection.',
            ),
            timeZone,
            onRetry: () => void study.reload(),
          }}
        />

        <Stack gap="md">
          {showCustomLogger ? (
            <Card>
              <Stack gap="sm">
                <Row justify="between" align="center" gap="sm" wrap>
                  <Text variant="caption" style={{ fontWeight: theme.fontWeight.semibold }}>
                    {t('⏱ 补记今日读书时长', '⏱ Log Custom Reading Session')}
                  </Text>
                  <Row gap="xs" align="center">
                    {[25, 45].map((m) => (
                      <CockpitPillButton
                        key={m}
                        label={`＋${m}m 读书打卡`}
                        onPress={() => {
                          handleLogStudy(quickTopic, m);
                          showToast({ text: t(`✓ 已记录阅读时长 +${m} 分钟`, `✓ Logged +${m}m`) });
                        }}
                      />
                    ))}
                  </Row>
                </Row>
                <View style={styles.quickRow}>
                  <TextInput
                    value={quickTopic}
                    onChangeText={setQuickTopic}
                    placeholder={t('输入所读书籍或章节名', 'Book or chapter title...')}
                    placeholderTextColor={color.muted}
                    style={[
                      styles.topicInput,
                      {
                        color: color.ink,
                        backgroundColor: color.surface,
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
                        backgroundColor: color.surface,
                        borderColor: color.lineSoft,
                      },
                    ]}
                  />
                  <CockpitPillButton
                    label={t('✓ 记入书房台账', '✓ Save')}
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
                    {t(`${formatMonthDay(localDay)} 暂无单独记录，在下方书页第 4 页盖下「已阅藏书印」也会自动记入 +25 分钟。`, 'Stamping a chapter as Read on Page 4 automatically logs +25m.')}
                  </Text>
                )}
              </Stack>
            </Card>
          ) : null}

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
    gap: theme.space.sm,
  },
  topicInput: {
    flex: 1,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  minInput: {
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    textAlign: 'center',
  },
});
