import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Row } from './layout';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';

/** One timeline row (§5, §14). Time sits in the left column in single-line tabular numerals with a subtle vertical timeline node. */
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
  const { color } = useTheme();
  return (
    <View style={styles.rowWrap}>
      <Row align="center" gap="md" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.timeBadge, { backgroundColor: color.paperDeep, borderColor: color.lineSoft }]}>
        <View style={[styles.nodeDot, { backgroundColor: color.accent }]} />
        <Text variant="caption" tone="muted" style={styles.time}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    paddingVertical: 4,
  },
  timeBadge: {
    minWidth: theme.layout.timeColumn,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  nodeDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontWeight: theme.fontWeight.medium,
  },
  time: {
    fontVariant: ['tabular-nums', 'lining-nums'],
  },
});
