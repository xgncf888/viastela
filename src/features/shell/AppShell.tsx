import type { ReactNode } from 'react';
import { router, usePathname } from 'expo-router';

import { brand } from '@/config/brand';
import { RecordSheet } from '@/features/record/RecordSheet';
import { useStudy } from '@/features/study/StudyProvider';
import { useTraining } from '@/features/training/TrainingProvider';
import { useWeight } from '@/features/weight/WeightProvider';
import { NavItem, ShellFrame, SidebarFrame, TabBar, useLayoutClass, useShellInset } from '@/ui/chrome';
import { DeletedRecordNotice } from '@/ui/deleted-record';
import { Text } from '@/ui/Text';
import { ToastHost } from '@/ui/toast';

const TABS = [
  { id: 'today', href: '/', label: '今日' },
  { id: 'assets', href: '/assets', label: '资产' },
  { id: 'trend', href: '/trend', label: '趋势' },
  { id: 'timeline', href: '/timeline', label: '时间线' },
  { id: 'me', href: '/me', label: '我的' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function currentTab(pathname: string): TabId {
  if (pathname.startsWith('/assets')) return 'assets';
  if (pathname.startsWith('/trend')) return 'trend';
  if (pathname.startsWith('/timeline')) return 'timeline';
  if (pathname.startsWith('/me')) return 'me';
  return 'today';
}

function go(href: (typeof TABS)[number]['href']) {
  router.replace(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const layout = useLayoutClass();
  const side = layout !== 'compact';
  const current = currentTab(usePathname());
  const { deletedNotice, dismissDeletedNotice } = useWeight();
  const trainingDeleted = useTraining();
  const studyDeleted = useStudy();
  return (
    <ShellFrame
      sidebar={
        side ? (
          <SidebarFrame
            title={brand.webName}
            footer={<Text variant="muted">{`${brand.webName} v1`}</Text>}
          >
            {TABS.map((tab) => (
              <NavItem key={tab.id} label={tab.label} selected={current === tab.id} onPress={() => go(tab.href)} />
            ))}
          </SidebarFrame>
        ) : null
      }
      bar={
        side ? null : (
          <TabBar>
            {TABS.map((tab) => (
              <NavItem
                key={tab.id}
                placement="tab"
                label={tab.label}
                selected={current === tab.id}
                onPress={() => go(tab.href)}
              />
            ))}
          </TabBar>
        )
      }
    >
      {children}
      <RecordSheet />
      <DeletedRecordNotice
        visible={deletedNotice || trainingDeleted.deletedNotice || studyDeleted.deletedNotice}
        onClose={() => {
          dismissDeletedNotice();
          trainingDeleted.dismissDeletedNotice();
          studyDeleted.dismissDeletedNotice();
        }}
      />
      <ToastHost />
    </ShellFrame>
  );
}

export { useShellInset };
