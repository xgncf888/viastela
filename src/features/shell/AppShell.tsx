import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '@/config/brand';
import { RecordSheet } from '@/features/record/RecordSheet';
import { openRecordSheet } from '@/features/record/record-sheet-store';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';
import { ToastHost } from '@/ui/toast';

const TABS = [
  { id: 'today', href: '/', label: '今日' },
  { id: 'trend', href: '/trend', label: '趋势' },
  { id: 'me', href: '/me', label: '我的' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function useWideWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= theme.layout.wide;
}

export function useShellInset(): number {
  const wide = useWideWeb();
  const insets = useSafeAreaInsets();
  if (wide) return theme.space.xl;
  return theme.layout.tabBar + Math.max(insets.bottom, theme.space.sm);
}

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
  return (
    <View style={styles.root}>
      {wide ? <Sidebar current={current} /> : null}
      <View style={styles.main}>{children}</View>
      {wide ? null : <BottomBar current={current} />}
      <RecordSheet />
      <ToastHost />
    </View>
  );
}

function Sidebar({ current }: { current: TabId }) {
  return (
    <View style={styles.sidebar}>
      <Text variant="heading">{brand.displayName}</Text>
      <View style={styles.sideNav}>
        {TABS.map((tab) => {
          const selected = current === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => go(tab.href)}
              style={[styles.sideItem, selected && styles.sideItemOn]}
            >
              <Text variant="body" tone={selected ? 'accent' : 'ink'}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="记录" onPress={openRecordSheet} style={styles.sideRecord}>
        <Text variant="body" tone="inverse">
          + 记录
        </Text>
      </Pressable>
    </View>
  );
}

function BottomBar({ current }: { current: TabId }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, theme.space.sm) }]}>
      <View style={styles.plusWrap}>
        <Pressable accessibilityRole="button" accessibilityLabel="记录" onPress={openRecordSheet} style={styles.plus}>
          <Text variant="body" tone="inverse">
            + 记录
          </Text>
        </Pressable>
      </View>
      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const selected = current === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => go(tab.href)}
              style={styles.tab}
            >
              <Text variant="body" tone={selected ? 'accent' : 'muted'}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: theme.color.paper },
  main: { flex: 1 },
  sidebar: {
    width: theme.layout.sidebar,
    backgroundColor: theme.color.paperDeep,
    padding: theme.space.lg,
    gap: theme.space.lg,
    borderRightWidth: theme.border.width,
    borderRightColor: theme.color.line,
  },
  sideNav: { gap: theme.space.sm, flex: 1 },
  sideItem: {
    borderRadius: theme.radius.md,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
  },
  sideItemOn: { backgroundColor: theme.color.accentSoft },
  sideRecord: {
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius.md,
    minHeight: theme.layout.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.color.card,
    borderTopWidth: theme.border.width,
    borderTopColor: theme.color.line,
  },
  plusWrap: { alignItems: 'center', marginTop: -theme.space.lg },
  plus: {
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius.pill,
    minHeight: theme.layout.control,
    paddingHorizontal: theme.space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.border.width,
    borderColor: theme.color.card,
  },
  tabs: { flexDirection: 'row' },
  tab: {
    flex: 1,
    minHeight: theme.layout.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
