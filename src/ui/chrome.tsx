import { createElement, useRef, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from './BrandMark';
import { cardSurfaceStyle } from './Card';
import { layoutClassForWidth, type LayoutClass } from './layout-class';
import { createNavPress } from './nav-press';
import { washPressStyle } from './press';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { useReducedMotion } from './use-reduced-motion';

export type NavIconKind = 'today' | 'assets' | 'trend' | 'timeline' | 'me';
export type NavBadgeTone = 'live' | 'alert' | 'neutral' | 'shortcut';

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

export function SidebarFrame({
  title,
  badgeLabel = '星途 OS',
  onQuickAction,
  onOpenPalette,
  panel,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  onQuickAction?: () => void;
  onOpenPalette?: () => void;
  panel?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { color } = useTheme();
  const layout = useLayoutClass();
  const width = layout === 'medium' ? theme.layout.sidebarCompact : theme.layout.sidebar;
  return (
    <View style={[styles.sidebar, { width, backgroundColor: color.paperDeep, borderRightColor: color.line }]}>
      {/* Top window bar: reserves space on the left for native macOS traffic lights without drawing duplicate fake dots */}
      <View style={styles.windowBar}>
        <View style={styles.trafficLightReserve} aria-hidden />
        {onOpenPalette ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开指令面板"
            onPress={onOpenPalette}
            style={({ pressed }) => [
              styles.windowTag,
              {
                borderColor: color.line,
                backgroundColor: pressed ? color.pressed : color.surface,
              },
            ]}
          >
            <Text variant="caption" tone="muted" style={styles.monoSmall}>
              ⌘P
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <View style={[styles.brandSquircle, { backgroundColor: color.card, borderColor: color.line }]}>
            <BrandMark size={16} />
          </View>
          <Text variant="heading" style={styles.brandWordmark} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={[styles.brandBadge, { backgroundColor: color.accentSoft }]}>
          <Text variant="caption" style={[styles.brandBadgeText, { color: color.accent }]} numberOfLines={1}>
            {badgeLabel}
          </Text>
        </View>
      </View>

      {onQuickAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开快速记录面板"
          onPress={onQuickAction}
          style={({ pressed }) => [
            styles.quickActionBtn,
            cardSurfaceStyle(pressed ? color.pressed : color.card, color.line),
            { borderColor: color.line },
          ]}
        >
          <Text variant="label" style={styles.quickActionText}>
            ＋ 快速记录
          </Text>
          <View style={[styles.kbdChip, { backgroundColor: color.pill }]}>
            <Text variant="caption" tone="muted" style={styles.monoSmall}>
              ⌘K
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.sideNav}>{children}</View>
      {panel}
      {footer ? <View style={[styles.footer, { borderTopColor: color.line }]}>{footer}</View> : null}
    </View>
  );
}

export function NavGroupLabel({ label }: { label: string }) {
  return (
    <View style={styles.groupHeader} aria-hidden>
      <Text variant="caption" tone="muted" style={styles.groupHeaderText}>
        {label}
      </Text>
    </View>
  );
}

function NavStrokeIcon({ kind, stroke }: { kind: NavIconKind; stroke: string }) {
  const d =
    kind === 'today'
      ? 'M4 6l4 4-4 4M10 14h6'
      : kind === 'assets'
        ? 'M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9ZM3 8.5h14M12.5 12h2'
        : kind === 'trend'
          ? 'M4 15.5V9.5M8 15.5V5.5M12 15.5v-5M16 15.5V7'
          : kind === 'timeline'
            ? 'M4 5h12v8H9l-4 3v-3H4V5Z'
            : 'M10 2.5 15.5 4.5v4.5c0 3.3-2.3 5.9-5.5 7.1-3.2-1.2-5.5-3.8-5.5-7.1V4.5L10 2.5Z';

  if (Platform.OS === 'web') {
    return createElement(
      'svg',
      { width: 15, height: 15, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
      createElement('path', {
        d,
        stroke,
        strokeWidth: 1.65,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: Svg, Path } = require('react-native-svg') as typeof import('react-native-svg');
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 15, height: 15 }}>
      <Svg width={15} height={15} viewBox="0 0 20 20" fill="none">
        <Path d={d} stroke={stroke} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
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
  icon,
  badge,
  badgeTone = 'neutral',
  selected,
  onPress,
  placement = 'side',
}: {
  label: string;
  icon?: NavIconKind;
  badge?: string;
  badgeTone?: NavBadgeTone;
  selected: boolean;
  onPress: () => void;
  placement?: 'side' | 'tab';
}) {
  const { color, press } = useTheme();
  const reducedMotion = useReducedMotion() === true;
  const side = placement === 'side';
  const presses = useRef(createNavPress());

  const badgeColors =
    badgeTone === 'live'
      ? { bg: color.greenSoft, fg: color.green, weight: theme.fontWeight.semibold }
      : badgeTone === 'alert'
        ? { bg: color.accentSoft, fg: color.accent, weight: theme.fontWeight.semibold }
        : badgeTone === 'shortcut'
          ? { bg: 'transparent', fg: color.textFaint, weight: theme.fontWeight.regular }
          : { bg: color.pill, fg: color.muted, weight: theme.fontWeight.medium };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
        side && selected && !pressed ? cardSurfaceStyle(color.card, color.line) : null,
      ]}
    >
      <View style={side ? styles.sideMain : styles.tabMain}>
        <View
          style={[
            side ? styles.sideIndicator : styles.tabIndicator,
            { backgroundColor: selected ? (side ? color.accent : color.ink) : 'transparent' },
          ]}
        />
        {side && icon ? (
          <NavStrokeIcon kind={icon} stroke={selected ? color.accent : color.muted} />
        ) : null}
        <Text variant="tab" tone={selected ? 'ink' : 'muted'} style={selected ? styles.navSelected : undefined}>
          {label}
        </Text>
      </View>
      {side && badge ? (
        <View style={[styles.navBadgePill, { backgroundColor: badgeColors.bg }]}>
          <Text
            variant="caption"
            style={[
              styles.badgeText,
              { color: badgeColors.fg, fontWeight: badgeColors.weight },
            ]}
            numberOfLines={1}
          >
            {badge}
          </Text>
        </View>
      ) : null}
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
    paddingHorizontal: theme.space.ms,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.ms,
    gap: theme.space.xs,
    borderRightWidth: theme.border.width,
  },
  windowBar: {
    height: 28,
    paddingHorizontal: theme.space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trafficLightReserve: {
    width: 64,
    height: 14,
  },
  windowTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.pill,
    borderWidth: theme.border.width,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.xs,
    paddingVertical: 6,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    flex: 1,
    minWidth: 0,
  },
  brandSquircle: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: theme.border.width,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandWordmark: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: theme.fontWeight.semibold,
    flexShrink: 1,
  },
  brandBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    flexShrink: 0,
  },
  brandBadgeText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  quickActionBtn: {
    height: 36,
    paddingHorizontal: theme.space.ms,
    borderRadius: theme.radius.button,
    borderWidth: theme.border.width,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  quickActionText: {
    fontWeight: theme.fontWeight.medium,
  },
  kbdChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  groupHeader: {
    paddingTop: theme.space.sm,
    paddingBottom: 2,
    paddingHorizontal: theme.space.sm,
  },
  groupHeaderText: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.6,
  },
  sideNav: { gap: 2, flex: 1 },
  footer: {
    paddingTop: theme.space.sm,
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
    minHeight: 36,
    paddingHorizontal: theme.space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navSide: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    borderRadius: theme.radius.sm,
  },
  sideMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  tabMain: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTab: {
    flex: 1,
    flexDirection: 'column',
    minHeight: theme.layout.tabBar,
    paddingHorizontal: theme.space.xs,
  },
  sideIndicator: {
    width: theme.border.indicator,
    height: 16,
    borderRadius: theme.radius.pill,
  },
  tabIndicator: {
    width: 28,
    height: theme.border.indicator,
    marginBottom: theme.space.xs,
  },
  navSelected: { fontWeight: theme.fontWeight.semibold },
  navBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.pill,
  },
  badgeText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  monoSmall: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    lineHeight: 14,
  },
});
