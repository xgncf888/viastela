import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { router, usePathname } from 'expo-router';

import { brand } from '@/config/brand';
import {
  buildCharioteerPluginManifest,
  type CharioteerCommandContribution,
  type CharioteerPluginManifest,
  detectRuntimeHostMode,
  type RuntimeHostMode,
} from '@/core/charioteer-plugin';
import { computeLocalDay, formatMonthDay } from '@/core/local-day';
import { studyRecordsOnDay } from '@/core/study';
import { trainingSetsOnDay } from '@/core/training';
import { formatKg, latestRecord, recordsOnDay } from '@/core/weight-stats';
import {
  closeRecordSheet,
  getRecordSheetSnapshot,
  openRecordSheet,
  type RecordSheetKind,
} from '@/features/record/record-sheet-store';
import { RecordSheet } from '@/features/record/RecordSheet';
import { useStudy } from '@/features/study/StudyProvider';
import { useTraining } from '@/features/training/TrainingProvider';
import { excludePending } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import {
  type NavBadgeTone,
  NavGroupLabel,
  type NavIconKind,
  NavItem,
  ShellFrame,
  SidebarFrame,
  TabBar,
  useLayoutClass,
  useShellInset,
} from '@/ui/chrome';
import { DeletedRecordNotice } from '@/ui/deleted-record';
import { showToast, ToastHost } from '@/ui/toast';
import {
  WorkbenchCommandPalette,
  WorkbenchScopeModal,
  WorkbenchSidebarPanel,
} from '@/ui/WorkbenchConsole';

const TABS: readonly {
  id: 'today' | 'assets' | 'trend' | 'timeline' | 'me';
  href: '/' | '/assets' | '/trend' | '/timeline' | '/me';
  label: string;
  icon: NavIconKind;
  shortcut: string;
}[] = [
  { id: 'today', href: '/', label: '今日', icon: 'today', shortcut: '⌘1' },
  { id: 'assets', href: '/assets', label: '资产', icon: 'assets', shortcut: '⌘2' },
  { id: 'trend', href: '/trend', label: '趋势', icon: 'trend', shortcut: '⌘3' },
  { id: 'timeline', href: '/timeline', label: '时间线', icon: 'timeline', shortcut: '⌘4' },
  { id: 'me', href: '/me', label: '我的', icon: 'me', shortcut: '⌘5' },
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
  openCommandPalette: () => void;
  openScopeModal: () => void;
};

type CharioteerPluginRuntimeBridge = {
  manifest: CharioteerPluginManifest;
  mode: RuntimeHostMode;
  activate: (hostContext?: unknown) => { status: 'activated'; pluginId: string };
  executeCommand: (commandId: string) => boolean;
};

export function AppShell({ children }: { children: ReactNode }) {
  const layout = useLayoutClass();
  const side = layout !== 'compact';
  const routeTab = currentTab(usePathname());
  const [armed, setArmed] = useState<{ id: TabId; route: TabId } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [hostAttached, setHostAttached] = useState(false);
  const current = armed && armed.route === routeTab ? armed.id : routeTab;

  const weight = useWeight();
  const training = useTraining();
  const study = useStudy();

  const accountingDay = computeLocalDay(new Date(), weight.timeZone, weight.daySwitch);
  const countedWeights = excludePending(weight.records, weight.pendingDeleteIds);
  const countedTraining = excludePending(training.sets, training.pendingDeleteIds);
  const countedStudy = excludePending(study.records, study.pendingDeleteIds);

  const todayWeights = recordsOnDay(countedWeights, accountingDay);
  const todayTraining = trainingSetsOnDay(countedTraining, accountingDay);
  const todayStudy = studyRecordsOnDay(countedStudy, accountingDay);
  const lastWeight = latestRecord(countedWeights);

  const weightLogged = todayWeights.length > 0;
  const trainingLogged = todayTraining.length > 0;
  const studyLogged = todayStudy.length > 0;
  const loggedCount = (weightLogged ? 1 : 0) + (trainingLogged ? 1 : 0) + (studyLogged ? 1 : 0);

  const todayBadge = loggedCount > 0 ? `${loggedCount}/3` : formatMonthDay(accountingDay);
  const trendBadge = lastWeight ? `${formatKg(lastWeight.weightKg)}kg` : '⌘3';

  const manifest = useMemo(
    () =>
      buildCharioteerPluginManifest({
        today: todayBadge,
        assets: 'USD',
        trend: trendBadge,
        timeline: '台账',
      }),
    [todayBadge, trendBadge],
  );

  const runtimeMode: RuntimeHostMode = useMemo(() => {
    if (hostAttached) return 'charioteer-host';
    if (Platform.OS !== 'web' || typeof window === 'undefined') return 'standalone';
    const win = window as unknown as {
      __charioteerHost?: unknown;
      __charioteerPluginRegistry?: unknown;
      location?: { search?: string };
    };
    return detectRuntimeHostMode({
      hasHostGlobal: Boolean(win.__charioteerHost || win.__charioteerPluginRegistry),
      search: win.location?.search ?? '',
    });
  }, [hostAttached]);

  const executeCommandById = useCallback((commandId: string): boolean => {
    if (commandId.endsWith('.quickRecordWeight')) {
      openRecordSheet(undefined, 'weight');
      return true;
    }
    if (commandId.endsWith('.quickRecordTraining')) {
      openRecordSheet(undefined, 'training');
      return true;
    }
    if (commandId.endsWith('.quickRecordStudy')) {
      openRecordSheet(undefined, 'study');
      return true;
    }
    if (commandId.endsWith('.quickRecordJournal')) {
      openRecordSheet(undefined, 'block');
      return true;
    }
    if (commandId.endsWith('.navigateToday')) {
      router.replace('/');
      return true;
    }
    if (commandId.endsWith('.navigateAssets')) {
      router.replace('/assets');
      return true;
    }
    if (commandId.endsWith('.navigateTrend')) {
      router.replace('/trend');
      return true;
    }
    if (commandId.endsWith('.navigateTimeline')) {
      router.replace('/timeline');
      return true;
    }
    if (commandId.endsWith('.navigateMe')) {
      router.replace('/me');
      return true;
    }
    return false;
  }, []);

  function go(tab: (typeof TABS)[number]) {
    if (tab.id === current) return;
    setArmed({ id: tab.id, route: routeTab });
    router.replace(tab.href);
  }

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const hostWindow = window as unknown as {
      __viastelaDesktop?: DesktopBridge;
      __charioteerPlugin?: CharioteerPluginRuntimeBridge;
      __charioteerPluginRegistry?: {
        registerPlugin?: (m: CharioteerPluginManifest, rt: unknown) => void;
      };
    };

    hostWindow.__viastelaDesktop = {
      openRecord: (kind = 'weight') => openRecordSheet(undefined, kind),
      closeRecord: () => closeRecordSheet(),
      navigate: (tabId) => {
        const target = TABS.find((item) => item.id === tabId);
        if (target) router.replace(target.href);
      },
      openCommandPalette: () => setPaletteOpen(true),
      openScopeModal: () => setScopeOpen(true),
    };

    const pluginRuntime: CharioteerPluginRuntimeBridge = {
      manifest,
      mode: runtimeMode,
      activate: () => {
        setHostAttached(true);
        return { status: 'activated', pluginId: manifest.id };
      },
      executeCommand: executeCommandById,
    };
    hostWindow.__charioteerPlugin = pluginRuntime;

    try {
      hostWindow.__charioteerPluginRegistry?.registerPlugin?.(manifest, pluginRuntime);
    } catch {
      // Standalone mode if host registry is not attached.
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        commandId?: string;
      } | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'charioteer:host-handshake') {
        setHostAttached(true);
        event.source?.postMessage?.(
          {
            source: manifest.id,
            type: 'charioteer:plugin-ready',
            manifest,
          },
          { targetOrigin: '*' },
        );
      } else if (data.type === 'charioteer:invoke-command' && typeof data.commandId === 'string') {
        executeCommandById(data.commandId);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (scopeOpen) {
          event.preventDefault();
          setScopeOpen(false);
          return;
        }
        if (paletteOpen) {
          event.preventDefault();
          setPaletteOpen(false);
          return;
        }
        if (getRecordSheetSnapshot().open) {
          event.preventDefault();
          closeRecordSheet();
          return;
        }
      }
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.altKey) {
        const lower = event.key.toLowerCase();
        if (!event.shiftKey && lower === 'k') {
          event.preventDefault();
          if (getRecordSheetSnapshot().open) closeRecordSheet();
          else openRecordSheet();
          return;
        }
        if (lower === 'p') {
          event.preventDefault();
          setPaletteOpen((open) => !open);
          return;
        }
        if (!event.shiftKey && lower === 'b') {
          event.preventDefault();
          setScopeOpen((open) => !open);
          return;
        }
        if (event.shiftKey && lower === 't') {
          event.preventDefault();
          openRecordSheet(undefined, 'training');
          return;
        }
        if (event.shiftKey && lower === 'l') {
          event.preventDefault();
          openRecordSheet(undefined, 'study');
          return;
        }
        if (event.shiftKey && lower === 'j') {
          event.preventDefault();
          openRecordSheet(undefined, 'block');
          return;
        }
        if (!event.shiftKey) {
          const index = Number.parseInt(event.key, 10) - 1;
          if (index >= 0 && index < TABS.length) {
            const target = TABS[index];
            if (target) {
              event.preventDefault();
              router.replace(target.href);
            }
          }
        }
      }
    };

    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('keydown', onKeyDown);
      delete hostWindow.__viastelaDesktop;
      delete hostWindow.__charioteerPlugin;
    };
  }, [executeCommandById, manifest, paletteOpen, runtimeMode, scopeOpen]);

  function badgeForTab(tabId: TabId): { text: string; tone: NavBadgeTone } {
    if (tabId === 'today') {
      return {
        text: todayBadge,
        tone: loggedCount === 3 ? 'live' : loggedCount > 0 ? 'alert' : 'neutral',
      };
    }
    if (tabId === 'trend') {
      return {
        text: trendBadge,
        tone: lastWeight ? 'neutral' : 'shortcut',
      };
    }
    if (tabId === 'assets') return { text: 'USD', tone: 'neutral' };
    if (tabId === 'timeline') return { text: '⌘4', tone: 'shortcut' };
    return { text: 'v1.0', tone: 'live' };
  }

  async function copyPluginManifest() {
    const json = JSON.stringify(manifest, null, 2);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(json);
      showToast({ text: '已复制 Charioteer 插件清单 (charioteer-plugin.json)' });
      setPaletteOpen(false);
      setScopeOpen(false);
    }
  }

  return (
    <ShellFrame
      sidebar={
        side ? (
          <SidebarFrame
            title={brand.slug}
            badgeLabel={runtimeMode === 'charioteer-host' ? 'Plugin' : `${brand.webName} OS`}
            onQuickAction={() => openRecordSheet()}
            onOpenPalette={() => setPaletteOpen(true)}
            panel={
              <WorkbenchSidebarPanel
                mode={runtimeMode}
                weightLogged={weightLogged}
                trainingLogged={trainingLogged}
                studyLogged={studyLogged}
                timeZone={weight.timeZone}
                onQuickRecord={() => openRecordSheet()}
                onOpenPalette={() => setPaletteOpen(true)}
                onOpenScope={() => setScopeOpen(true)}
              />
            }
          >
            <NavGroupLabel label="WORKBENCH · 核心视图" />
            {TABS.map((tab) => {
              const badge = badgeForTab(tab.id);
              return (
                <NavItem
                  key={tab.id}
                  label={tab.label}
                  icon={tab.icon}
                  badge={badge.text}
                  badgeTone={badge.tone}
                  selected={current === tab.id}
                  onPress={() => go(tab)}
                />
              );
            })}
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
      <WorkbenchCommandPalette
        visible={paletteOpen}
        mode={runtimeMode}
        manifest={manifest}
        onClose={() => setPaletteOpen(false)}
        onExecuteCommand={(cmd: CharioteerCommandContribution) => {
          setPaletteOpen(false);
          executeCommandById(cmd.id);
        }}
        onCopyManifest={() => void copyPluginManifest()}
      />
      <WorkbenchScopeModal
        visible={scopeOpen}
        mode={runtimeMode}
        manifest={manifest}
        onClose={() => setScopeOpen(false)}
        onCopyManifest={() => void copyPluginManifest()}
      />
      <DeletedRecordNotice
        visible={weight.deletedNotice || training.deletedNotice || study.deletedNotice}
        onClose={() => {
          weight.dismissDeletedNotice();
          training.dismissDeletedNotice();
          study.dismissDeletedNotice();
        }}
      />
      <ToastHost />
    </ShellFrame>
  );
}

export { useShellInset };
