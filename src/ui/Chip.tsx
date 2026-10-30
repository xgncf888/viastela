import { Platform, Pressable, StyleSheet } from 'react-native';

import { washPressStyle } from './press';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { useReducedMotion } from './use-reduced-motion';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { color, press } = useTheme();
  const reducedMotion = useReducedMotion() === true;
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={selected}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? color.fill : color.surface,
          borderColor: selected ? color.ink : color.line,
        },
        washPressStyle(pressed, reducedMotion, press, color.pressed, Platform.OS === 'web'),
      ]}
    >
      <Text variant="body" tone={selected ? 'ink' : 'muted'} style={selected ? styles.selectedLabel : styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: theme.layout.control,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.md,
    borderWidth: theme.border.width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: theme.fontWeight.regular,
  },
  selectedLabel: {
    fontWeight: theme.fontWeight.medium,
  },
});
