import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { bottomPadding, scrollClearance } from '@/ui/Content';
import { theme } from '@/ui/theme';

/** `Content` does not report scroll position. Uses `contentWide` (1080px) so desktop workspace pages never look like a narrow 680px phone strip. */
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
      style={scrollClearance(inset)}
      contentContainerStyle={[
        {
          width: '100%',
          maxWidth: theme.layout.contentWide,
          alignSelf: 'center',
          paddingHorizontal: theme.space.xl,
          paddingTop: theme.space.xl,
          paddingBottom: theme.space.lg,
          gap: theme.space.md,
        },
        bottomPadding(inset),
      ]}
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
