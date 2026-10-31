import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { bottomPadding, scrollClearance } from '@/ui/Content';
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
      style={scrollClearance(inset)}
      contentContainerStyle={[
        {
          width: '100%',
          maxWidth: theme.layout.content,
          alignSelf: 'center',
          padding: theme.space.lg,
          gap: theme.space.lg,
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
