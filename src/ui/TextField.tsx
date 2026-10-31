import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextStyle } from 'react-native';

import { Text } from './Text';
import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

export function TextField({
  label,
  labelTrailing,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  autoFocus = false,
  error,
  helper,
}: {
  label: string;
  labelTrailing?: ReactNode;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences';
  autoComplete?: 'email' | 'one-time-code' | 'off';
  autoFocus?: boolean;
  error?: string | null;
  helper?: string;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const isNumeric = keyboardType === 'decimal-pad' || keyboardType === 'number-pad';

  const webFocusStyle: TextStyle | null =
    Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          boxShadow: error
            ? '0 0 0 3px rgba(154, 70, 62, 0.16)'
            : focused
              ? '0 0 0 3px rgba(204, 120, 92, 0.18)'
              : 'inset 0 1px 2px rgba(24, 24, 22, 0.03)',
          transition: 'border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease',
        } as unknown as TextStyle)
      : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="caption" style={styles.label}>
          {label}
        </Text>
        {labelTrailing}
      </View>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textFaint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        selectionColor={theme.color.accent}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          isNumeric ? styles.numericInput : null,
          {
            borderColor: error ? theme.color.danger : focused ? theme.color.accent : theme.color.line,
            backgroundColor: focused ? theme.color.card : theme.color.surface,
            color: theme.color.ink,
          },
          webFocusStyle,
        ]}
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
      {!error && helper ? (
        <Text variant="caption" tone="muted">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: baseTheme.space.sm,
  },
  label: {
    fontWeight: baseTheme.fontWeight.semibold,
    letterSpacing: 0.2,
  },
  input: {
    minHeight: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: baseTheme.border.width,
    fontSize: baseTheme.font.sm + 1,
    paddingHorizontal: baseTheme.space.ms,
    fontVariant: ['tabular-nums', 'lining-nums'],
  },
  numericInput: {
    fontFamily: baseTheme.fontFamily.mono,
    fontSize: baseTheme.font.md,
    fontWeight: baseTheme.fontWeight.medium,
  },
});
