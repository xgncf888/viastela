import { router } from 'expo-router';

import { computeLocalDay } from '@/core/local-day';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useShellInset } from '@/features/shell/AppShell';
import { useStudy } from '@/features/study/StudyProvider';
import { useWeight } from '@/features/weight/WeightProvider';
import { useLayoutClass } from '@/ui/chrome';
import { Content } from '@/ui/Content';
import { Row, ScreenHeader, Stack } from '@/ui/layout';
import { ResearchBrowserHub } from '@/ui/ResearchBrowserHub';
import { Screen } from '@/ui/Screen';
import { useI18n } from '@/ui/use-i18n';
import { CockpitHeaderBar } from '@/ui/WorkbenchConsole';

export function BrowserScreen() {
  const { daySwitch, timeZone } = useWeight();
  const study = useStudy();
  const inset = useShellInset();
  const layout = useLayoutClass();
  const { t } = useI18n();

  const localDay = computeLocalDay(new Date(), timeZone, daySwitch);

  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader
          kicker={t('全网探索浏览器 · 多源直搜工作台', 'Multi-Engine Research Browser')}
          title={t('🌐 独立探索浏览器 · ArXiv / GitHub / Google / 百科聚合直搜', '🌐 Research Browser · ArXiv, GitHub, Google & Wiki')}
          trailing={
            layout !== 'compact' ? (
              <Row gap="xs" align="center" wrap>
                <CockpitHeaderBar
                  hudText={t('7 大引擎直连 · 纸书净读', '7 Engines · Reader Mode')}
                  onOpenRecord={() => openRecordSheet(undefined, 'study')}
                />
              </Row>
            ) : null
          }
          subtitle={{
            description: t(
              '支持 ArXiv 论文、GitHub 开源仓库、Google / Bing 网页、维基百科、HackerNews 与本地知识库一键聚合直搜；支持「纸书净读模式」与「网页原貌窗口」自由切换。',
              'Direct search across ArXiv, GitHub, Google/Bing, Wikipedia, HackerNews, and local knowledge base with Reader Mode & Web View.',
            ),
            timeZone,
            onRetry: () => void study.reload(),
          }}
        />

        <Stack gap="md">
          <ResearchBrowserHub
            localDay={localDay}
            onSaveStudyRecord={(topic, durationMinutes, note) => {
              void study.saveRecord({ topic, durationMinutes, note });
            }}
            onJumpToStudyTab={() => router.replace('/study')}
          />
        </Stack>
      </Content>
    </Screen>
  );
}
