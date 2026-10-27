import { brand } from '@/config/brand';
import { Center } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export function BootScreen() {
  return (
    <Screen>
      <Center>
        <Text variant="title">{brand.displayName}</Text>
        <Text variant="muted">正在打开</Text>
      </Center>
    </Screen>
  );
}
