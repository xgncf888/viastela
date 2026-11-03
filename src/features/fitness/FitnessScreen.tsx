import { useMemo } from 'react';

import { computeLocalDay } from '@/core/local-day';
import { trainingSetsOnDay } from '@/core/training';
import { latestRecord } from '@/core/weight-stats';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useShellInset } from '@/features/shell/AppShell';
import { useTraining } from '@/features/training/TrainingProvider';
import { excludePending } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { useLayoutClass } from '@/ui/chrome';
import { Content } from '@/ui/Content';
import { FitnessStudioHub } from '@/ui/FitnessStudioHub';
import { Row, ScreenHeader } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { useI18n } from '@/ui/use-i18n';
import { CockpitHeaderBar } from '@/ui/WorkbenchConsole';

export function FitnessScreen() {
  const weight = useWeight();
  const training = useTraining();
  const inset = useShellInset();
  const layout = useLayoutClass();
  const { t } = useI18n();

  const localDay = computeLocalDay(new Date(), weight.timeZone, weight.daySwitch);
  const countedSets = useMemo(
    () => excludePending(training.sets, training.pendingDeleteIds),
    [training.sets, training.pendingDeleteIds],
  );
  const todaySets = useMemo(
    () => trainingSetsOnDay(countedSets, localDay),
    [countedSets, localDay],
  );
  const countedWeights = useMemo(
    () => excludePending(weight.records, weight.pendingDeleteIds),
    [weight.records, weight.pendingDeleteIds],
  );
  const latestWeightRec = useMemo(() => latestRecord(countedWeights), [countedWeights]);

  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader
          kicker={t('力量与体能训练舱 · 独立健身工作台', 'Strength & Conditioning Cockpit')}
          title={t('💪 健身中心 · 分化训练、肌群热力与 1RM 负荷追踪', '💪 Fitness Studio · Splits, Volume & 1RM Tracker')}
          trailing={
            layout !== 'compact' ? (
              <Row gap="xs" align="center" wrap>
                <CockpitHeaderBar
                  hudText={t(`今日已完成 ${todaySets.length} 组`, `Today ${todaySets.length} sets`)}
                  onOpenRecord={() => openRecordSheet(undefined, 'training')}
                />
              </Row>
            ) : null
          }
          subtitle={{
            description: t(
              '涵盖推/拉/腿/心肺四大分化训练模板、Epley 1RM 极限力量估算、全身肌群激活度追踪与组间休息倒计时。',
              'Push/Pull/Legs/Cardio workout splits, Epley 1RM estimation, muscle activation heatmap, and rest timer.',
            ),
            timeZone: weight.timeZone,
            onRetry: () => void training.reload(),
          }}
        />

        <FitnessStudioHub
          localDay={localDay}
          todaySets={todaySets}
          allSets={countedSets}
          latestWeightKg={latestWeightRec?.weightKg ?? null}
          onSaveSet={(input) => {
            void training.saveSet(input);
          }}
          onDeleteSet={(id) => {
            training.scheduleDelete(id);
          }}
        />
      </Content>
    </Screen>
  );
}
