import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from './Text';
import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

export function TextField({
  label,
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
  return (
    <View style={styles.wrap}>
      <Text variant="muted">{label}</Text>
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
          {
            borderColor: error ? theme.color.danger : focused ? theme.color.accent : theme.color.line,
            backgroundColor: theme.color.surface,
            color: theme.color.ink,
          },
        ]}
      />
      {error ? (
        <Text variant="muted" tone="danger">
          {error}
        </Text>
      ) : null}
      {!error && helper ? <Text variant="muted">{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: baseTheme.space.sm },
  input: {
    minHeight: baseTheme.layout.control,
    borderRadius: baseTheme.radius.sm,
    borderWidth: baseTheme.border.width,
    fontSize: baseTheme.font.md,
    paddingHorizontal: baseTheme.space.md,
    fontVariant: ['tabular-nums'],
  },
});
