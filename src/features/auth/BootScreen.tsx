import { StyleSheet, View } from 'react-native';

import { brand } from '@/config/brand';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';

export function BootScreen() {
  return (
    <View style={styles.screen}>
      <Text variant="title">{brand.displayName}</Text>
      <Text variant="muted">正在打开</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
  },
});
