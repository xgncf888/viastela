import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { OTP_LENGTH, sanitizeOtpCode } from '@/core/email-otp';

import { Text } from './Text';
import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

export function CodeInput({
  label = '验证码',
  value,
  onChangeText,
  onComplete,
  error,
  disabled = false,
  autoFocus = false,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Called once when the field reaches 6 digits, including a paste. */
  onComplete?: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  function onChange(raw: string) {
    const clean = sanitizeOtpCode(raw);
    onChangeText(clean);
    if (!disabled && clean.length === OTP_LENGTH && clean !== value) onComplete?.(clean);
  }

  return (
    <View style={styles.wrap}>
      <Text variant="muted">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        selectionColor={theme.color.accent}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          {
            borderColor: error ? theme.color.danger : focused ? theme.color.accent : theme.color.line,
            backgroundColor: theme.color.surface,
            color: theme.color.ink,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      />
      {error ? (
        <Text variant="muted" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: baseTheme.space.sm },
  input: {
    minHeight: baseTheme.layout.control,
    borderRadius: baseTheme.radius.sm,
    borderWidth: baseTheme.border.width,
    fontSize: baseTheme.font.xl,
    letterSpacing: baseTheme.space.md,
    textAlign: 'center',
    paddingHorizontal: baseTheme.space.md,
    fontFamily: Platform.select({
      web: baseTheme.fontFamily.mono,
      ios: 'Menlo',
      default: 'monospace',
    }),
    fontVariant: ['tabular-nums'],
  },
});
