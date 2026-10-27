import { useState } from 'react';
import { Redirect, router, usePreventRemove } from 'expo-router';

import { signOutLocal } from '@/data/auth';
import { Button } from '@/ui/Button';
import { Content } from '@/ui/Content';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';

import { acknowledgeAccountDeleted, useAccountDeletedFlag } from './deletion-state';

export function AccountDeletedScreen() {
  const deleted = useAccountDeletedFlag();
  const [leaving, setLeaving] = useState(false);
  const disablePrevention = usePreventRemove(deleted && !leaving);

  async function onOk() {
    setLeaving(true);
    disablePrevention();
    try {
      await signOutLocal();
    } catch {
      // Local sign-out clears this device even when the auth server rejects the call.
    }
    acknowledgeAccountDeleted();
    router.replace('/login');
  }

  if (!deleted) return <Redirect href="/login" />;

  return (
    <Screen>
      <Content inset={theme.space.xxl}>
        <Text variant="title" accessibilityRole="header">
          账号已删除
        </Text>
        <Button label="好的" loading={leaving} onPress={() => void onOk()} />
      </Content>
    </Screen>
  );
}
