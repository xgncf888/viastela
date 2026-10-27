import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Row } from './layout';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';

/** One timeline row. Detail may include a MaskedAmount. The clock is HH:mm. */
export function TimelineItem({ title, detail, time }: { title: string; detail?: ReactNode; time: string }) {
  const { color } = useTheme();
  return (
    <Row align="start" justify="between">
      <View style={[styles.icon, { backgroundColor: color.fill }]} />
      <View style={styles.copy}>
        <Text variant="body">{title}</Text>
        {typeof detail === 'string' ? <Text variant="muted">{detail}</Text> : detail}
      </View>
      <Text variant="muted">{time}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: theme.space.lg,
    height: theme.space.lg,
    borderRadius: theme.radius.pill,
  },
  copy: { flex: 1, gap: theme.space.xs },
});
