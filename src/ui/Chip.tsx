import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { cardSurfaceStyle } from './Card';
import { washPressStyle } from './press';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { useReducedMotion } from './use-reduced-motion';

export function Chip({
  label,
  selected,
  segmented = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  segmented?: boolean;
  onPress: () => void;
}) {
  const { color, press } = useTheme();
  const reducedMotion = useReducedMotion() === true;
  const [hovered, setHovered] = useState(false);

  if (segmented) {
    return (
      <Pressable
        accessibilityRole="button"
        aria-selected={selected}
        accessibilityState={{ selected }}
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          styles.segmentedChip,
          washPressStyle(pressed, reducedMotion, press, color.pressed, Platform.OS === 'web'),
          selected ? cardSurfaceStyle(color.card, color.line) : null,
          {
            backgroundColor: pressed
              ? color.pressed
              : selected
                ? color.card
                : hovered
                  ? color.fill
                  : 'transparent',
          },
        ]}
      >
        <View
          style={[
            styles.segDot,
            { backgroundColor: selected ? color.accent : 'transparent' },
          ]}
        />
        <Text
          variant="caption"
          tone={selected ? 'ink' : 'muted'}
          style={selected ? styles.segmentedSelectedLabel : styles.segmentedLabel}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

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
  segmentedChip: {
    flex: 1,
    minHeight: 30,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  segDot: {
    width: 5,
    height: 5,
    borderRadius: theme.radius.pill,
  },
  label: {
    fontWeight: theme.fontWeight.regular,
  },
  selectedLabel: {
    fontWeight: theme.fontWeight.medium,
  },
  segmentedLabel: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: theme.fontWeight.medium,
  },
  segmentedSelectedLabel: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: theme.fontWeight.semibold,
  },
});
