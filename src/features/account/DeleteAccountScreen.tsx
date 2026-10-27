import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, usePreventRemove } from 'expo-router';

import { accountDeletionPhrase, deletionFacts } from '@/core/account-policy';
import { deleteOwnAccount } from '@/data/account';
import { signOutLocal } from '@/data/auth';
import { Button } from '@/ui/Button';
import { Content } from '@/ui/Content';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { theme } from '@/ui/theme';

import { markAccountDeleted } from './deletion-state';

type Phase = 'explain' | 'processing' | 'leaving';

export function DeleteAccountScreen() {
  const [phrase, setPhrase] = useState('');
  const [phase, setPhase] = useState<Phase>('explain');
  const [failure, setFailure] = useState<string | null>(null);
  const disablePrevention = usePreventRemove(phase === 'processing');
  const confirmed = phrase.trim() === accountDeletionPhrase;
  const busy = phase !== 'explain';

  async function onDelete() {
    if (!confirmed || busy) return;
    setFailure(null);
    setPhase('processing');
    try {
      await deleteOwnAccount();
    } catch {
      setPhase('explain');
      setFailure('删除失败，请重试');
      return;
    }
    setPhase('leaving');
    disablePrevention();
    markAccountDeleted();
    router.replace('/account/deleted');
    try {
      await signOutLocal();
    } catch {
      // The account is already deleted. Local sign-out still drops this device's session.
    }
  }

  if (busy) {
    return (
      <Screen>
        <Content inset={theme.space.xxl}>
          <Text variant="title" accessibilityRole="header">
            正在删除账号
          </Text>
          <ActivityIndicator color={theme.color.accent} accessibilityLabel="正在删除" />
          <Text variant="body" style={styles.body}>
            请稍候。这个过程不能取消。
          </Text>
        </Content>
      </Screen>
    );
  }

  return (
    <Screen>
      <Content inset={theme.space.xxl}>
        <Text variant="title" accessibilityRole="header">
          删除账号
        </Text>
        <View style={styles.copy}>
          {deletionFacts().map((fact) => (
            <Text key={fact} variant="body" style={styles.body}>
              {fact}
            </Text>
          ))}
        </View>
        {failure ? (
          <Text variant="body" tone="danger" style={styles.body}>
            {failure}
          </Text>
        ) : null}
        <TextField
          label="确认"
          value={phrase}
          onChangeText={setPhrase}
          placeholder={accountDeletionPhrase}
          autoComplete="off"
          helper="输入“删除”后才能继续"
          error={null}
        />
        <Button label="删除账号" variant="danger" disabled={!confirmed} onPress={() => void onDelete()} />
        <Button label="取消" variant="ghost" onPress={() => router.replace('/me')} />
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { gap: theme.space.md },
  body: { lineHeight: theme.space.lg },
});
