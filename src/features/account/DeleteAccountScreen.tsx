import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { router, usePreventRemove } from 'expo-router';

import { accountDeletionPhrase, deletionFacts, reauthBeforeDeleteMessage } from '@/core/account-policy';
import { amrClaim, identityProvider, isRecentSignIn, reauthChannel } from '@/core/recent-sign-in';
import { deleteOwnAccount, isReauthRequired } from '@/data/account';
import {
  currentAccessToken,
  requestEmailOtp,
  signInWithProvider,
  signOutLocal,
  verifyEmailOtp,
} from '@/data/auth';
import { useAuth } from '@/features/auth/AuthProvider';
import { Button } from '@/ui/Button';
import { Content } from '@/ui/Content';
import { Callout } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { theme } from '@/ui/theme';

import { markAccountDeleted } from './deletion-state';

type Phase = 'checking' | 'reauth' | 'code' | 'confirm' | 'processing' | 'leaving';

function messageFrom(error: unknown, fallback: string): string {
  const text = error instanceof Error ? error.message.toLowerCase() : '';
  if (text.includes('rate') || text.includes('once')) return '发送太频繁，请稍后再试';
  return fallback;
}

export function DeleteAccountScreen() {
  const { session } = useAuth();
  const [phrase, setPhrase] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('checking');
  const [amr, setAmr] = useState<unknown>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const disablePrevention = usePreventRemove(phase === 'processing');
  const confirmed = phrase.trim() === accountDeletionPhrase;
  const email = session?.email ?? '';

  useEffect(() => {
    let active = true;
    void currentAccessToken()
      .then((token) => {
        if (!active) return;
        const claim = token ? amrClaim(token) : null;
        const nextProvider = token ? identityProvider(token) : null;
        setAmr(claim);
        setProvider(nextProvider);
        setPhase(isRecentSignIn(claim, Date.now()) ? 'confirm' : 'reauth');
      })
      .catch(() => {
        if (active) setPhase('reauth');
      });
    return () => {
      active = false;
    };
  }, []);

  function leaveSignedIn() {
    router.replace('/me');
  }

  async function startReauth() {
    const channel = reauthChannel(amr, Platform.OS, provider);
    setFailure(null);
    if (channel === 'google' || channel === 'github') {
      setSending(true);
      try {
        await signInWithProvider(channel, '/account/delete');
      } catch (providerError) {
        setFailure(messageFrom(providerError, '登录没有完成，请重试'));
      } finally {
        setSending(false);
      }
      return;
    }
    if (!email) {
      setFailure('无法发送验证码，请稍后再试');
      return;
    }
    setSending(true);
    try {
      await requestEmailOtp(email);
      setPhase('code');
    } catch (sendError) {
      setFailure(messageFrom(sendError, '发送失败，请稍后再试'));
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code.trim())) {
      setFailure('请输入 6 位验证码');
      return;
    }
    if (!email) {
      setFailure('无法发送验证码，请稍后再试');
      return;
    }
    setSending(true);
    setFailure(null);
    try {
      await verifyEmailOtp(email, code.trim());
      setCode('');
      setPhase('confirm');
    } catch (verifyError) {
      setFailure(messageFrom(verifyError, '验证码不正确或已过期'));
    } finally {
      setSending(false);
    }
  }

  async function onDelete() {
    if (!confirmed || phase !== 'confirm') return;
    setFailure(null);
    setPhase('processing');
    try {
      await deleteOwnAccount();
    } catch (error) {
      if (isReauthRequired(error)) {
        setPhase('reauth');
        return;
      }
      setPhase('confirm');
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

  if (phase === 'processing' || phase === 'leaving') {
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

  if (phase === 'checking') {
    return (
      <Screen>
        <Content inset={theme.space.xxl}>
          <Text variant="title" accessibilityRole="header">
            删除账号
          </Text>
          <ActivityIndicator color={theme.color.accent} accessibilityLabel="读取中" />
        </Content>
      </Screen>
    );
  }

  if (phase === 'reauth') {
    return (
      <Screen>
        <Content inset={theme.space.xxl}>
          <Text variant="title" accessibilityRole="header">
            删除账号
          </Text>
          <Callout message={reauthBeforeDeleteMessage} />
          {failure ? (
            <Text variant="body" tone="danger">
              {failure}
            </Text>
          ) : null}
          <Button label="重新登录" onPress={() => void startReauth()} loading={sending} />
          <Button label="取消" variant="ghost" onPress={leaveSignedIn} />
        </Content>
      </Screen>
    );
  }

  if (phase === 'code') {
    return (
      <Screen keyboard>
        <Content inset={theme.space.xxl}>
          <Text variant="title" accessibilityRole="header">
            删除账号
          </Text>
          <Text variant="muted">验证码已发送至 {email}</Text>
          <TextField
            label="验证码"
            value={code}
            onChangeText={setCode}
            placeholder="6 位数字"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            error={failure}
          />
          <Button label="验证并进入" onPress={() => void verifyCode()} loading={sending} />
          <Button label="取消" variant="ghost" onPress={leaveSignedIn} />
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
        <Button label="取消" variant="ghost" onPress={leaveSignedIn} />
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { gap: theme.space.md },
  body: { lineHeight: theme.space.lg },
});
