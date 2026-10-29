import { StyleSheet, View } from 'react-native';

import { Stack } from './layout';
import { Text } from './Text';
import { theme } from './theme';

/** Every caller writes its own title; there is no default copy (§5). At most one `secondary` action. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Stack gap="xs">
        <Text variant="body" style={styles.title}>
          {title}
        </Text>
        {description ? <Text variant="muted">{description}</Text> : null}
      </Stack>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.space.md,
    paddingVertical: theme.space.md,
  },
  title: { fontWeight: theme.fontWeight.medium },
});
