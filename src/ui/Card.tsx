import { StyleSheet, View } from 'react-native';

import { theme } from './theme';

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    borderWidth: theme.border.width,
    borderColor: theme.color.line,
    padding: theme.space.lg,
    gap: theme.space.sm,
  },
});
