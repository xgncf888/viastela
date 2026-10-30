import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Row } from './layout';
import { Text } from './Text';
import { theme } from './theme';

/** One timeline row (§5, §14). Time sits in the 44pt left column in tabular numerals; no placeholder circle. */
export function TimelineItem({
  title,
  detail,
  time,
  accessibilityLabel,
}: {
  title: string;
  detail?: ReactNode;
  time: string;
  accessibilityLabel?: string;
}) {
  return (
    <Row align="start" gap="ms" accessibilityLabel={accessibilityLabel}>
      <View style={styles.timeCol}>
        <Text variant="muted" style={styles.time}>
          {time}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text variant="body" style={styles.title}>
          {title}
        </Text>
        {typeof detail === 'string' ? <Text variant="muted">{detail}</Text> : detail}
      </View>
    </Row>
  );
}

const styles = StyleSheet.create({
  timeCol: {
    width: theme.layout.timeColumn,
    paddingTop: theme.border.indicator,
  },
  copy: {
    flex: 1,
    gap: theme.space.xs,
  },
  title: {
    fontWeight: theme.fontWeight.medium,
  },
  time: {
    fontVariant: ['tabular-nums', 'lining-nums'],
  },
});
