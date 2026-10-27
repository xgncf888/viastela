import type { ReactNode } from 'react';
import { router, usePathname } from 'expo-router';

import { brand } from '@/config/brand';
import { RecordSheet } from '@/features/record/RecordSheet';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { useWeight } from '@/features/weight/WeightProvider';
import { NavItem, RecordButton, ShellFrame, SidebarFrame, TabBar, useShellInset, useWideWeb } from '@/ui/chrome';
import { DeletedRecordNotice } from '@/ui/deleted-record';
import { ToastHost } from '@/ui/toast';

const TABS = [
  { id: 'today', href: '/', label: '今日' },
  { id: 'trend', href: '/trend', label: '趋势' },
  { id: 'me', href: '/me', label: '我的' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function currentTab(pathname: string): TabId {
  if (pathname.startsWith('/trend')) return 'trend';
  if (pathname.startsWith('/me')) return 'me';
  return 'today';
}

function go(href: '/' | '/trend' | '/me') {
  router.replace(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const wide = useWideWeb();
  const current = currentTab(usePathname());
  const { deletedNotice, dismissDeletedNotice } = useWeight();
  return (
    <ShellFrame
      sidebar={
        wide ? (
          <SidebarFrame title={brand.displayName} footer={<RecordButton onPress={() => openRecordSheet()} />}>
            {TABS.map((tab) => (
              <NavItem key={tab.id} label={tab.label} selected={current === tab.id} onPress={() => go(tab.href)} />
            ))}
          </SidebarFrame>
        ) : null
      }
      bar={
        wide ? null : (
          <TabBar action={<RecordButton floating onPress={() => openRecordSheet()} />}>
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
      <DeletedRecordNotice visible={deletedNotice} onClose={dismissDeletedNotice} />
      <ToastHost />
    </ShellFrame>
  );
}

export { useShellInset, useWideWeb };
