import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? color.accentSoft : color.paper,
          borderColor: selected ? color.accent : color.line,
        },
      ]}
    >
      <Text variant="body" tone={selected ? 'accent' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: theme.layout.control,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.md,
    borderWidth: theme.border.width,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
