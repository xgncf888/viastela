import { router } from 'expo-router';

import { Button } from '@/ui/Button';
import { Content } from '@/ui/Content';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';

export default function NotFound() {
  return (
    <Screen>
      <Content>
        <EmptyState
          title="找不到这一页"
          description=""
          action={<Button label="回到今日" onPress={() => router.replace('/')} />}
        />
      </Content>
    </Screen>
  );
}
