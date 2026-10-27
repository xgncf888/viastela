import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';

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

export function ShellFrame({
  sidebar,
  bar,
  children,
}: {
  sidebar?: ReactNode;
  bar?: ReactNode;
  children: ReactNode;
}) {
  const { color } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: color.paper }]}>
      {sidebar}
      <View style={styles.main}>{children}</View>
      {bar}
    </View>
  );
}

export function SidebarFrame({ title, footer, children }: { title: string; footer: ReactNode; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.sidebar, { backgroundColor: color.paperDeep, borderRightColor: color.line }]}>
      <Text variant="heading">{title}</Text>
      <View style={styles.sideNav}>{children}</View>
      {footer}
    </View>
  );
}

export function TabBar({ action, children }: { action: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom:
            Platform.OS === 'web'
              ? (`max(${theme.space.sm}px, env(safe-area-inset-bottom))` as unknown as number)
              : Math.max(insets.bottom, theme.space.sm),
          backgroundColor: color.card,
          borderTopColor: color.line,
        },
      ]}
    >
      <View style={styles.plusWrap}>{action}</View>
      <View style={styles.tabs}>{children}</View>
    </View>
  );
}

export function NavItem({
  label,
  selected,
  onPress,
  placement = 'side',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  placement?: 'side' | 'tab';
}) {
  const { color } = useTheme();
  const highlighted = selected && placement === 'side';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.nav,
        placement === 'tab' ? styles.navFill : null,
        { backgroundColor: highlighted ? color.accentSoft : 'transparent' },
      ]}
    >
      <Text variant="body" tone={selected ? 'accent' : placement === 'tab' ? 'muted' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

export function RecordButton({ onPress, floating = false }: { onPress: () => void; floating?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="记录"
      onPress={onPress}
      style={[
        styles.record,
        floating ? styles.recordFloating : null,
        {
          backgroundColor: color.accent,
          borderColor: floating ? color.card : 'transparent',
        },
      ]}
    >
      <Text variant="body" tone="onAccent" style={styles.recordLabel}>
        + 记录
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  main: { flex: 1 },
  sidebar: {
    width: theme.layout.sidebar,
    padding: theme.space.lg,
    gap: theme.space.lg,
    borderRightWidth: theme.border.width,
  },
  sideNav: { gap: theme.space.sm, flex: 1 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: theme.border.width,
  },
  plusWrap: { alignItems: 'center', marginTop: -theme.space.lg },
  tabs: { flexDirection: 'row' },
  nav: {
    minHeight: theme.layout.control,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navFill: { flex: 1 },
  record: {
    minHeight: theme.layout.control,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    paddingHorizontal: theme.space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordFloating: { borderRadius: theme.radius.pill },
  recordLabel: { fontWeight: '500' },
});
