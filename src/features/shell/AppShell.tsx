import { useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { router, usePathname } from 'expo-router';

import { brand } from '@/config/brand';
import {
  closeRecordSheet,
  getRecordSheetSnapshot,
  openRecordSheet,
  type RecordSheetKind,
} from '@/features/record/record-sheet-store';
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

type DesktopBridge = {
  openRecord: (kind?: RecordSheetKind) => void;
  closeRecord: () => void;
  navigate: (tabId: TabId) => void;
};

export function AppShell({ children }: { children: ReactNode }) {
  const layout = useLayoutClass();
  const side = layout !== 'compact';
  const routeTab = currentTab(usePathname());
  const [armed, setArmed] = useState<{ id: TabId; route: TabId } | null>(null);
  const current = armed && armed.route === routeTab ? armed.id : routeTab;

  function go(tab: (typeof TABS)[number]) {
    if (tab.id === current) return;
    setArmed({ id: tab.id, route: routeTab });
    router.replace(tab.href);
  }

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const hostWindow = window as unknown as { __viastelaDesktop?: DesktopBridge };
    hostWindow.__viastelaDesktop = {
      openRecord: (kind = 'weight') => openRecordSheet(undefined, kind),
      closeRecord: () => closeRecordSheet(),
      navigate: (tabId) => {
        const target = TABS.find((item) => item.id === tabId);
        if (target) router.replace(target.href);
      },
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && getRecordSheetSnapshot().open) {
        event.preventDefault();
        closeRecordSheet();
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.shiftKey && !event.altKey) {
        const lower = event.key.toLowerCase();
        if (lower === 'k') {
          event.preventDefault();
          if (getRecordSheetSnapshot().open) closeRecordSheet();
          else openRecordSheet();
          return;
        }
        const index = Number.parseInt(event.key, 10) - 1;
        if (index >= 0 && index < TABS.length) {
          const target = TABS[index];
          if (target) {
            event.preventDefault();
            router.replace(target.href);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      delete hostWindow.__viastelaDesktop;
    };
  }, []);

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
              <NavItem key={tab.id} label={tab.label} selected={current === tab.id} onPress={() => go(tab)} />
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
                onPress={() => go(tab)}
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
