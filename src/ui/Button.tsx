import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  tone,
  disabled = false,
  loading = false,
  fill = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Ghost buttons stay accent unless this asks for danger text. */
  tone?: 'danger';
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the column so stacked buttons share one width. */
  fill?: boolean;
}) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  const inactive = disabled || loading;
  const hot = hovered && !inactive;
  const background =
    variant === 'primary'
      ? hot
        ? theme.color.accentHover
        : theme.color.accent
      : variant === 'danger'
        ? theme.color.dangerFill
        : variant === 'secondary'
          ? hot
            ? theme.color.fill
            : 'transparent'
          : hot
            ? tone === 'danger'
              ? theme.color.dangerSoft
              : theme.color.accentSoft
            : 'transparent';
  const labelTone =
    variant === 'primary'
      ? 'onAccent'
      : variant === 'danger'
        ? 'inverse'
        : variant === 'ghost'
          ? tone === 'danger'
            ? 'danger'
            : 'accent'
          : 'ink';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderColor: variant === 'secondary' ? theme.color.line : 'transparent',
          transform: pressed && !inactive ? [{ translateY: 1 }] : undefined,
        },
        variant === 'primary' && !inactive
          ? {
              shadowColor: theme.color.accent,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.25,
              shadowRadius: 2,
              elevation: 1,
            }
          : null,
        inactive ? styles.inactive : null,
        fill ? styles.fill : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary'
              ? theme.color.accentInk
              : variant === 'danger'
                ? theme.color.onToast
                : tone === 'danger'
                  ? theme.color.danger
                  : theme.color.accent
          }
        />
      ) : (
        <Text variant="body" tone={labelTone} style={styles.label}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: baseTheme.layout.control,
    borderRadius: baseTheme.radius.sm,
    borderWidth: baseTheme.border.width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: baseTheme.space.md,
    paddingVertical: baseTheme.space.sm,
    minWidth: baseTheme.layout.control,
  },
  label: { fontWeight: '500' },
  inactive: { opacity: 0.55 },
  fill: { alignSelf: 'stretch', width: '100%' },
});
