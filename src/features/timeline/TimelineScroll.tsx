import { Platform, ScrollView, StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { theme } from '@/ui/theme';

/** `Content` does not report scroll position. This column uses the same tokens and loads the next page near the end. */
export function TimelineScroll({
  children,
  inset,
  onNearEnd,
}: {
  children: React.ReactNode;
  inset: number;
  onNearEnd: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, bottomPadding(inset)]}
      keyboardShouldPersistTaps="handled"
      onScroll={(event) => {
        if (nearEnd(event)) onNearEnd();
      }}
    >
      {children}
    </ScrollView>
  );
}

function nearEnd(event: NativeSyntheticEvent<NativeScrollEvent>): boolean {
  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
  return contentSize.height - layoutMeasurement.height - contentOffset.y < theme.space.xxl;
}

function bottomPadding(inset: number): { paddingBottom: number } | null {
  if (inset <= 0) return null;
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
    gap: theme.space.lg,
  },
});
