import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from './Text';
import { theme } from './theme';

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
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
  error?: string | null;
  helper?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text variant="muted">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.faint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        autoComplete={autoComplete}
        style={styles.input}
      />
      {error ? <Text variant="muted" tone="danger">{error}</Text> : null}
      {!error && helper ? <Text variant="muted">{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.sm },
  input: {
    minHeight: theme.layout.control,
    borderRadius: theme.radius.md,
    borderWidth: theme.border.width,
    borderColor: theme.color.line,
    backgroundColor: theme.color.card,
    color: theme.color.ink,
    fontSize: theme.font.lg,
    paddingHorizontal: theme.space.md,
  },
});
