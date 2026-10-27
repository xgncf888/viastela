import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { useWideWeb } from './chrome';
import { Card } from './Card';
import { Stack } from './layout';
import { Text } from './Text';
import { theme as baseTheme } from './theme';

/** Summary card. A pressable card's accessible name is the summary, for example `深蹲 4 组 · 卧推 3 组`. */
export function StatusCard({
  title,
  summary,
  hint,
  actionLabel,
  onPress,
  onAction,
}: {
  title?: string;
  summary: string;
  hint?: string;
  actionLabel?: string;
  onPress?: () => void;
  onAction?: () => void;
}) {
  const body = (
    <Card>
      {title ? <Text variant="muted">{title}</Text> : null}
      <Text variant="heading">{summary}</Text>
      {hint ? <Text variant="muted">{hint}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </Card>
  );
  if (!onPress) return <View style={styles.frame}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={summary} onPress={onPress} style={styles.frame}>
      {body}
    </Pressable>
  );
}

/** Three status cards: a column below 960, a row from 960 up. */
export function CardRow({ children }: { children: ReactNode }) {
  const wide = useWideWeb();
  const items = Children.toArray(children);
  if (!wide) return <Stack gap="md">{items}</Stack>;
  return (
    <View style={styles.row}>
      {items.map((child, index) => (
        <View key={index} style={styles.cell}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    minHeight: baseTheme.space.xxl * 2,
    flexGrow: 1,
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: baseTheme.space.md,
  },
  cell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: baseTheme.space.xxl,
  },
});
