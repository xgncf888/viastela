import { StyleSheet, View } from 'react-native';

import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

export function Card({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.color.card, borderColor: theme.color.line },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: baseTheme.color.card,
    borderRadius: baseTheme.radius.lg,
    borderWidth: baseTheme.border.width,
    borderColor: baseTheme.color.line,
    padding: baseTheme.space.md,
    gap: baseTheme.space.sm,
  },
});
