import { StyleSheet, View } from 'react-native';

import { formatMonthDay } from '@/core/local-day';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';

export function TrendChart({ days }: { days: readonly { localDay: string; ema: number | null }[] }) {
  const present = days.flatMap((day) => (day.ema === null ? [] : [day.ema]));
  const min = present.length > 0 ? Math.min(...present) : 0;
  const max = present.length > 0 ? Math.max(...present) : 1;
  const span = max - min || 1;

  return (
    <View style={styles.row}>
      {days.map((day) => {
        const value = day.ema;
        const ratio = value === null ? null : 0.28 + ((value - min) / span) * 0.72;
        const barHeight = ratio === null ? theme.space.xs : Math.max(theme.space.sm, ratio * theme.layout.chart);
        const dayNumber = day.localDay.slice(-2).replace(/^0/, '');
        return (
          <View key={day.localDay} style={styles.column} accessibilityLabel={`${formatMonthDay(day.localDay)} ${value ?? '无记录'}`}>
            <View style={styles.track}>
              <View style={[styles.bar, value === null ? styles.gap : styles.fill, { height: barHeight }]} />
            </View>
            <Text variant="muted">{dayNumber}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.sm, height: theme.layout.chart + theme.space.lg },
  column: { flex: 1, alignItems: 'center', gap: theme.space.sm },
  track: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '56%', borderRadius: theme.radius.sm },
  fill: { backgroundColor: theme.color.accent },
  gap: { backgroundColor: theme.color.line },
});
