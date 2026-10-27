import { ScrollView, StyleSheet } from 'react-native';

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
        inset > 0 ? { paddingBottom: inset } : null,
        align === 'center' ? styles.center : null,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
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
