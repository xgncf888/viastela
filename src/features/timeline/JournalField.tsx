import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/ui/Text';
import { theme as baseTheme } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

/** Multiline body. The shared TextField is a single line and src/ui is left unchanged. */
export function JournalField({
  label,
  value,
  onChangeText,
  error,
  count,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  count?: string | null;
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
        multiline
        placeholderTextColor={theme.color.textFaint}
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
      {count ? <Text variant="muted">{count}</Text> : null}
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
    minHeight: baseTheme.layout.tabBar,
    borderRadius: baseTheme.radius.sm,
    borderWidth: baseTheme.border.width,
    fontSize: baseTheme.font.md,
    paddingHorizontal: baseTheme.space.md,
    paddingVertical: baseTheme.space.sm,
    fontVariant: ['tabular-nums'],
    textAlignVertical: 'top',
  },
});
