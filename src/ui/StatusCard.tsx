import { Children, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { useLayoutClass } from './chrome';
import { Card } from './Card';
import { Stack } from './layout';
import { pressTransition } from './press';
import { Text } from './Text';
import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';
import { useReducedMotion } from './use-reduced-motion';

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
  const theme = useTheme();
  const reducedMotion = useReducedMotion() === true;
  const content = (
    <>
      {title ? <Text variant="muted">{title}</Text> : null}
      <Text variant="heading">{summary}</Text>
      {hint ? <Text variant="muted">{hint}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.frame}>
        <Card>{content}</Card>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={summary}
      onPress={onPress}
      style={({ pressed }) => [
        styles.frame,
        styles.pressCard,
        {
          backgroundColor: pressed ? theme.color.pressed : theme.color.card,
          borderColor: theme.color.line,
        },
        pressTransition(pressed, reducedMotion, theme.press, Platform.OS === 'web'),
      ]}
    >
      {content}
    </Pressable>
  );
}

/** Three status cards: a column below desktop, a row from the desktop breakpoint up. */
export function CardRow({ children }: { children: ReactNode }) {
  const layout = useLayoutClass();
  const items = Children.toArray(children);
  if (layout !== 'expanded') return <Stack gap="md">{items}</Stack>;
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
  pressCard: {
    borderRadius: baseTheme.radius.md,
    borderWidth: baseTheme.border.width,
    padding: baseTheme.space.md,
    gap: baseTheme.space.sm,
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
