import { StyleSheet, View } from 'react-native';

import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

/** 0 to 1. Masked draws the track only and reads as hidden. */
export function ProgressBar({ value, masked }: { value: number; masked: boolean }) {
  const theme = useTheme();
  const width = Math.min(1, Math.max(0, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={masked ? '已隐藏' : undefined}
      accessibilityValue={masked ? undefined : { min: 0, max: 100, now: Math.round(width * 100) }}
      style={[styles.track, { backgroundColor: theme.color.fill }]}
    >
      {masked ? null : <View style={[styles.bar, { width: `${width * 100}%`, backgroundColor: theme.color.accent }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: baseTheme.space.sm,
    borderRadius: baseTheme.radius.pill,
    overflow: 'hidden',
  },
  bar: {
    height: baseTheme.space.sm,
    borderRadius: baseTheme.radius.pill,
  },
});
