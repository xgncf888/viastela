import { useRef, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from './BrandMark';
import { layoutClassForWidth, type LayoutClass } from './layout-class';
import { createNavPress } from './nav-press';
import { washPressStyle } from './press';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { useReducedMotion } from './use-reduced-motion';

/** Width only. Phones, split iPad, and a dragged browser window all follow the same cuts. */
export function useLayoutClass(): LayoutClass {
  const { width } = useWindowDimensions();
  return layoutClassForWidth(width);
}

export function useShellInset(): number {
  const layout = useLayoutClass();
  const insets = useSafeAreaInsets();
  if (layout !== 'compact') return theme.space.xl;
  return theme.layout.tabBar + theme.space.md + insets.bottom;
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
  const layout = useLayoutClass();
  return (
    <View style={[styles.root, { backgroundColor: color.paper }]}>
      {sidebar}
      <View style={styles.main}>
        <View style={layout === 'compact' ? styles.compactMain : styles.wideMain}>{children}</View>
      </View>
      {bar}
    </View>
  );
}

export function SidebarFrame({ title, footer, children }: { title: string; footer?: ReactNode; children: ReactNode }) {
  const { color } = useTheme();
  const layout = useLayoutClass();
  const width = layout === 'medium' ? theme.layout.sidebarCompact : theme.layout.sidebar;
  return (
    <View style={[styles.sidebar, { width, backgroundColor: color.paperDeep, borderRightColor: color.line }]}>
      <View style={[styles.brandRow, { borderBottomColor: color.line }]}>
        <BrandMark />
        <Text variant="title">{title}</Text>
      </View>
      <View style={styles.sideNav}>{children}</View>
      {footer ? <View style={[styles.footer, { borderTopColor: color.line }]}>{footer}</View> : null}
    </View>
  );
}

export function TabBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom:
            Platform.OS === 'web'
              ? (`env(safe-area-inset-bottom)` as unknown as number)
              : insets.bottom,
          backgroundColor: color.bar,
          borderTopColor: color.line,
        },
      ]}
    >
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
  const { color, press } = useTheme();
  const reducedMotion = useReducedMotion() === true;
  const side = placement === 'side';
  const presses = useRef(createNavPress());
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      aria-selected={Platform.OS === 'web' ? selected : undefined}
      onPressIn={() => {
        if (!selected) presses.current.pressIn(onPress);
      }}
      onPress={() => {
        if (!selected) presses.current.press(onPress);
      }}
      onPressOut={() => {
        presses.current.cancel();
      }}
      style={({ pressed }) => [
        styles.nav,
        side ? styles.navSide : styles.navTab,
        washPressStyle(pressed, reducedMotion, press, color.pressed, Platform.OS === 'web'),
        side && selected && !pressed ? { backgroundColor: color.fill } : null,
      ]}
    >
      <View
        style={[
          side ? styles.sideIndicator : styles.tabIndicator,
          { backgroundColor: selected ? color.ink : 'transparent' },
        ]}
      />
      <Text variant="tab" tone={selected ? 'ink' : 'muted'} style={selected ? styles.navSelected : undefined}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  main: { flex: 1 },
  compactMain: { flex: 1, width: '100%' },
  wideMain: {
    flex: 1,
    width: '100%',
    maxWidth: theme.layout.contentWide,
    alignSelf: 'center',
  },
  sidebar: {
    padding: theme.space.lg,
    gap: theme.space.md,
    borderRightWidth: theme.border.width,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingBottom: theme.space.md,
    borderBottomWidth: theme.border.width,
  },
  sideNav: { gap: theme.space.xs, flex: 1 },
  footer: {
    paddingTop: theme.space.md,
    borderTopWidth: theme.border.width,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: theme.border.width,
  },
  tabs: { flexDirection: 'row', height: theme.layout.tabBar },
  nav: {
    minHeight: theme.layout.control,
    paddingHorizontal: theme.space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navSide: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    gap: theme.space.sm,
    borderRadius: theme.radius.sm,
  },
  navTab: {
    flex: 1,
    flexDirection: 'column',
    minHeight: theme.layout.tabBar,
    paddingHorizontal: theme.space.xs,
  },
  sideIndicator: {
    width: theme.border.indicator,
    height: theme.lineHeight.tab,
  },
  tabIndicator: {
    width: 28,
    height: theme.border.indicator,
    marginBottom: theme.space.xs,
  },
  navSelected: { fontWeight: theme.fontWeight.semibold },
});
