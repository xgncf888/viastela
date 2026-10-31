import { Platform, ScrollView, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';

import { useLayoutClass } from './chrome';
import { theme, type SpaceName } from './theme';

export function Content({
  children,
  inset = 0,
  align = 'start',
  gap = 'lg',
  measure = 'page',
  width = 'content',
}: {
  children: React.ReactNode;
  inset?: number;
  align?: 'start' | 'center';
  gap?: SpaceName;
  /** `auth` is full width on phones and 360 wide on larger web. */
  measure?: 'page' | 'auth';
  /** `wide` is the desktop column (`layout.contentWide`). Documents stay on `content`. */
  width?: 'content' | 'wide';
}) {
  const layout = useLayoutClass();
  const { width: windowWidth } = useWindowDimensions();
  const padY = layout === 'compact' ? theme.space.md : theme.space.xl;
  const padX = layout === 'compact' ? theme.space.page : theme.space.xl;
  const maxWidth =
    measure === 'auth'
      ? windowWidth <= theme.layout.authFull
        ? '100%'
        : theme.layout.auth
      : width === 'wide'
        ? theme.layout.contentWide
        : theme.layout.content;
  return (
    <ScrollView
      style={scrollClearance(inset)}
      contentContainerStyle={[
        styles.content,
        {
          gap: theme.space[gap],
          maxWidth,
          paddingTop: padY,
          paddingHorizontal: padX,
          paddingBottom: padY,
        },
        bottomPadding(inset),
        align === 'center' ? styles.center : null,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/**
 * The tab bar (on compact) and the toast above the bottom edge cover the bottom
 * of the scrollport. `scroll-padding` makes scroll-into-view stop above both,
 * so the last card can be pressed on both mobile and 1280 desktop.
 */
export function scrollClearance(inset: number): ViewStyle | undefined {
  if (Platform.OS !== 'web' || inset <= 0) return undefined;
  if (inset >= theme.layout.tabBar) {
    return {
      scrollPaddingBottom: `calc(${theme.layout.tabBar}px + ${theme.layout.control}px + ${theme.space.md}px + env(safe-area-inset-bottom))`,
    } as ViewStyle;
  }
  return {
    scrollPaddingBottom: `calc(${theme.space.lg}px + ${theme.layout.control}px + ${theme.space.md}px + env(safe-area-inset-bottom))`,
  } as ViewStyle;
}

export function bottomPadding(inset: number): ViewStyle | null {
  if (inset <= 0) return null;
  if (inset >= theme.layout.tabBar) {
    if (Platform.OS === 'web') {
      return {
        paddingBottom: `calc(${theme.layout.tabBar}px + ${theme.layout.control}px + ${theme.space.md}px + env(safe-area-inset-bottom))` as unknown as number,
      };
    }
    return { paddingBottom: inset + theme.layout.control };
  }
  if (Platform.OS === 'web') {
    return {
      paddingBottom: `calc(${theme.space.lg}px + ${theme.layout.control}px + ${theme.space.md}px + env(safe-area-inset-bottom))` as unknown as number,
    };
  }
  return { paddingBottom: theme.space.lg + theme.layout.control + theme.space.md };
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    alignSelf: 'center',
  },
  center: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
