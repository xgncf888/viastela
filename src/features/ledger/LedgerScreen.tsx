import { Platform } from 'react-native';

import { computeMonthlyBookkeepingSummary } from '@/core/bookkeeping';
import { computeLocalDay } from '@/core/local-day';
import { readBookkeepingState } from '@/data/bookkeeping';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useShellInset } from '@/features/shell/AppShell';
import { useWeight } from '@/features/weight/WeightProvider';
import { BookkeepingLedgerHub } from '@/ui/BookkeepingLedgerHub';
import { useLayoutClass } from '@/ui/chrome';
import { Content } from '@/ui/Content';
import { ScreenHeader } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { useI18n } from '@/ui/use-i18n';
import { CockpitHeaderBar } from '@/ui/WorkbenchConsole';

export function LedgerScreen() {
  const { daySwitch, timeZone } = useWeight();
  const inset = useShellInset();
  const layout = useLayoutClass();
  const { t } = useI18n();

  const localDay = computeLocalDay(new Date(), timeZone, daySwitch);
  const summary = computeMonthlyBookkeepingSummary(readBookkeepingState(), localDay);

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

  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader
          kicker={t('记账', 'Bookkeeping')}
          title={t('日常收支与预算账本', 'Daily Cashflow & Budget')}
          trailing={
            layout !== 'compact' ? (
              <CockpitHeaderBar
                hudText={t(
                  `今日可花 ¥${summary.dailySafeToSpendCny} · 本月已支 ¥${summary.totalExpenseCny.toFixed(0)}`,
                  `Safe ¥${summary.dailySafeToSpendCny}/d · Spent ¥${summary.totalExpenseCny.toFixed(0)}`,
                )}
                onOpenRecord={() => openRecordSheet()}
                onOpenPalette={() => openDesktopBridge('palette')}
                onOpenScope={() => openDesktopBridge('scope')}
              />
            ) : undefined
          }
          subtitle={{
            description: t(
              '支持一句话智能记账、一键高频闪记、分类算式键盘与 14 日消费脉搏，自动同步至全量备份。',
              '1-second natural language logging, 1-tap presets, category calculator pad, and 14-day spend pulse.',
            ),
            timeZone,
            onRetry: () => undefined,
          }}
        />
        <BookkeepingLedgerHub localDay={localDay} />
      </Content>
    </Screen>
  );
}
