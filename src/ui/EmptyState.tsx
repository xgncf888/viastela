import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { theme } from './theme';

export function EmptyState({ title = '先记第一笔', action }: { title?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.wrap}>
      <Text variant="body">{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.space.md,
    paddingVertical: theme.space.lg,
  },
});
