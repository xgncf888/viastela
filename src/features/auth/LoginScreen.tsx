import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { brand } from '@/config/brand';
import { isSupabaseConfigured } from '@/config/env';
import { requestEmailOtp, signInWithProvider, verifyEmailOtp } from '@/data/auth';
import { captureOAuthFailure, clearOAuthFailureMessage, type OAuthProvider } from '@/data/oauth';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Content } from '@/ui/Content';
import { Callout, Row, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const savedEmailKey = 'login-email';

function rememberedEmail(): string {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem(savedEmailKey) ?? '';
}

function rememberEmail(value: string) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(savedEmailKey, value);
}

function messageFrom(error: unknown, fallback: string): string {
  const text = error instanceof Error ? error.message.toLowerCase() : '';
  if (text.includes('rate') || text.includes('once')) return '发送太频繁，请稍后再试';
  if (text.includes('otp') || text.includes('token') || text.includes('expired') || text.includes('invalid')) {
    return '验证码不正确或已过期';
  }
  if (text.includes('not configured') || text.includes('supabase')) return '尚未配置 Supabase';
  return fallback;
}

export function LoginScreen() {
  const configured = isSupabaseConfigured();
  const showProviders = Platform.OS === 'web';
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(rememberedEmail);
  const [code, setCode] = useState('');
  const [providerNotice, setProviderNotice] = useState<string | null>(captureOAuthFailure);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    clearOAuthFailureMessage();
  }, []);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<OAuthProvider | null>(null);

  function onEmailChange(value: string) {
    setEmail(value);
    rememberEmail(value);
  }

  async function startProvider(next: OAuthProvider) {
    if (!configured) {
      setProviderNotice('尚未配置 Supabase');
      return;
    }
    setBusy(true);
    setProvider(next);
    setProviderNotice(null);
    try {
      await signInWithProvider(next);
      clearOAuthFailureMessage();
      setProviderNotice(null);
    } catch (providerError) {
      setProviderNotice(messageFrom(providerError, '登录没有完成，请重试'));
      setBusy(false);
      setProvider(null);
    }
  }

  async function sendCode() {
    const nextEmail = email.trim();
    if (!EMAIL.test(nextEmail)) {
      setError('请输入有效邮箱');
      return;
    }
    if (!configured) {
      setError('尚未配置 Supabase');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestEmailOtp(nextEmail);
      setEmail(nextEmail);
      setPhase('code');
    } catch (sendError) {
      setError(messageFrom(sendError, '发送失败，请稍后再试'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('请输入 6 位验证码');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email, code.trim());
      clearOAuthFailureMessage();
      setProviderNotice(null);
    } catch (verifyError) {
      setError(messageFrom(verifyError, '验证码不正确或已过期'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard edges={['top', 'right', 'bottom', 'left']}>
      <Content align="center" gap="md">
        <ScreenHeader
          kicker="生活记录"
          title={brand.displayName}
          detail="用邮箱登录。我们发送 6 位验证码，不使用密码。"
        />
        {!configured ? (
          <Card>
            <Text variant="body">还没有接上 Supabase。把 .env.example 复制为 .env.local，填入本地或云端项目的地址和 anon key，然后重启。</Text>
          </Card>
        ) : null}
        {phase === 'email' ? (
          <Stack gap="md">
            {showProviders ? (
              <>
                {providerNotice ? <Callout message={providerNotice} tone="danger" /> : null}
                <Button
                  label="使用 Google 登录"
                  variant="secondary"
                  onPress={() => void startProvider('google')}
                  loading={provider === 'google'}
                  disabled={busy && provider !== 'google'}
                />
                <Button
                  label="使用 GitHub 登录"
                  variant="secondary"
                  onPress={() => void startProvider('github')}
                  loading={provider === 'github'}
                  disabled={busy && provider !== 'github'}
                />
                <Row justify="center">
                  <Text variant="muted">或</Text>
                </Row>
              </>
            ) : null}
            <TextField
              label="邮箱"
              value={email}
              onChangeText={onEmailChange}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoComplete="email"
              error={error}
            />
            <Button label="发送验证码" onPress={() => void sendCode()} loading={busy && provider === null} disabled={busy} />
          </Stack>
        ) : (
          <Stack gap="md">
            <Text variant="muted">验证码已发送至 {email}</Text>
            <TextField
              label="验证码"
              value={code}
              onChangeText={setCode}
              placeholder="6 位数字"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              error={error}
            />
            <Button label="验证并进入" onPress={() => void verifyCode()} loading={busy} />
            <Button label="重新发送" variant="secondary" onPress={() => void sendCode()} disabled={busy} />
            <Button
              label="换一个邮箱"
              variant="ghost"
              onPress={() => {
                setPhase('email');
                setCode('');
                setError(null);
              }}
            />
          </Stack>
        )}
        <Button label="隐私政策" variant="ghost" onPress={() => router.push('/privacy')} />
      </Content>
    </Screen>
  );
}
