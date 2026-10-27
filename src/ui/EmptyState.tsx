import { StyleSheet, View } from 'react-native';

import { Stack } from './layout';
import { Text } from './Text';
import { theme } from './theme';

export function EmptyState({
  title = '先记第一笔',
  description = '记下体重后，这里会显示近 7 日均重。',
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Stack gap="xs">
        <Text variant="heading">{title}</Text>
        {description ? <Text variant="muted">{description}</Text> : null}
      </Stack>
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
