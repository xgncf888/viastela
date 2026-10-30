import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { washPressStyle } from './press';
import { Text } from './Text';
import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';
import { useReducedMotion } from './use-reduced-motion';

/**
 * One ledger row (§5). Left: the item in `body` 500 with an optional `muted` subtitle.
 * Right: the value (tabular, right-aligned) with its unit in `muted`, then meta, then one action.
 * Rows inside one Card are split by a 1px `line`; pass `last` on the final row to drop it.
 */
export function ListRow({
  label,
  subtitle,
  value,
  unit,
  meta,
  action,
  last = false,
  indent = false,
  onPress,
  expanded,
  accessibilityLabel,
}: {
  label: string;
  subtitle?: string;
  /** A string renders as `body` 500. Pass a node (e.g. `MaskedAmount`) to draw it yourself. */
  value?: ReactNode;
  unit?: string;
  meta?: string;
  /** At most one, e.g. a ghost button or `<Button size="mini" />`. */
  action?: ReactNode;
  last?: boolean;
  /** Child row under an expanded row, e.g. one set or a re-weigh. */
  indent?: boolean;
  /** Makes the whole row toggle, e.g. 「查看每组」. Keep `action` empty when you pass this. */
  onPress?: () => void;
  expanded?: boolean;
  /** Summary read by screen readers, e.g. `深蹲 4 组 · 卧推 3 组`. */
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion() === true;
  const body = (
    <>
      <View style={styles.item}>
        <Text variant="body" style={styles.strong}>
          {label}
        </Text>
        {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
      </View>
      {value != null || unit ? (
        <View style={styles.value}>
          {typeof value === 'string' || typeof value === 'number' ? (
            <Text variant="body" style={[styles.strong, styles.end]}>
              {value}
            </Text>
          ) : (
            value
          )}
          {unit ? <Text variant="muted">{unit}</Text> : null}
        </View>
      ) : null}
      {meta ? (
        <Text variant="muted" style={styles.end}>
          {meta}
        </Text>
      ) : null}
      {action ?? null}
    </>
  );
  const frame = [
    styles.row,
    { borderBottomColor: last ? 'transparent' : theme.color.line },
    indent ? styles.indent : null,
  ];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={expanded == null ? undefined : { expanded }}
        aria-expanded={expanded}
        onPress={onPress}
        style={({ pressed }) => [
          ...frame,
          washPressStyle(pressed, reducedMotion, theme.press, theme.color.pressed, Platform.OS === 'web'),
        ]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View accessible={accessibilityLabel ? true : undefined} accessibilityLabel={accessibilityLabel} style={frame}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: baseTheme.layout.row,
    paddingVertical: baseTheme.space.ms,
    borderBottomWidth: baseTheme.border.width,
    flexDirection: 'row',
    alignItems: 'center',
    gap: baseTheme.space.ms,
  },
  indent: { paddingLeft: baseTheme.space.lg },
  item: { flex: 1, minWidth: 0 },
  value: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: baseTheme.space.xs,
  },
  strong: { fontWeight: baseTheme.fontWeight.medium },
  end: { textAlign: 'right' },
});
