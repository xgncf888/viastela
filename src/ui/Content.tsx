import { ScrollView, StyleSheet } from 'react-native';

import { theme } from './theme';

export function Content({ children, inset }: { children: React.ReactNode; inset: number }) {
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: inset }]} keyboardShouldPersistTaps="handled">
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
    gap: theme.space.lg,
  },
});
