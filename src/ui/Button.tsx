import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { theme } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[styles.base, styles[variant], inactive && styles.inactive]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.color.accentInk : theme.color.accent} />
      ) : (
        <Text variant="body" tone={variant === 'primary' ? 'inverse' : variant === 'ghost' ? 'accent' : 'ink'}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.layout.control,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  primary: { backgroundColor: theme.color.accent },
  secondary: {
    backgroundColor: theme.color.card,
    borderWidth: theme.border.width,
    borderColor: theme.color.line,
  },
  ghost: { backgroundColor: 'transparent' },
  inactive: { opacity: 0.55 },
});
