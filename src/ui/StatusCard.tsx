import { Pressable } from 'react-native';

import { Card } from './Card';
import { Text } from './Text';

/** Tappable summary. The accessible name is the summary, for example `深蹲 4 组 · 卧推 3 组`. */
export function StatusCard({ summary, onPress }: { summary: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={summary} onPress={onPress}>
      <Card>
        <Text variant="heading">{summary}</Text>
      </Card>
    </Pressable>
  );
}
