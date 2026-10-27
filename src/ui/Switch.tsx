import { Pressable, StyleSheet } from 'react-native';

import { Row } from './layout';
import { Text } from './Text';
import { theme as baseTheme } from './theme';

/** A 44pt row. The accessible name is the label; 开 / 关 is the visible state. */
export function Switch({
  label,
  value,
  disabled = false,
  onValueChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      aria-checked={value}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.hit, disabled ? styles.inactive : null]}
    >
      <Row justify="between">
        <Text variant="body">{label}</Text>
        <Text variant="body" tone={value && !disabled ? 'accent' : 'muted'}>
          {value ? '开' : '关'}
        </Text>
      </Row>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: baseTheme.layout.control,
    justifyContent: 'center',
  },
  inactive: { opacity: 0.55 },
});
