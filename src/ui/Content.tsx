import { Platform, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

import { theme, type SpaceName } from './theme';

export function Content({
  children,
  inset = 0,
  align = 'start',
  gap = 'lg',
}: {
  children: React.ReactNode;
  inset?: number;
  align?: 'start' | 'center';
  gap?: SpaceName;
}) {
  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { gap: theme.space[gap] },
        bottomPadding(inset),
        align === 'center' ? styles.center : null,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

function bottomPadding(inset: number): ViewStyle | null {
  if (inset <= 0) return null;
  // The shell inset is the tab bar plus a small gap. On the installed web app that gap
  // has to grow with the home indicator, which the web safe-area context reports as 0.
  if (Platform.OS === 'web' && inset >= theme.layout.tabBar) {
    return {
      paddingBottom: `calc(${theme.layout.tabBar}px + max(${theme.space.sm}px, env(safe-area-inset-bottom)))` as unknown as number,
    };
  }
  return { paddingBottom: inset };
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: theme.layout.content,
    alignSelf: 'center',
    padding: theme.space.lg,
  },
  center: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
