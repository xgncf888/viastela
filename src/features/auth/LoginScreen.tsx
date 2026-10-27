import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { brand } from '@/config/brand';
import { isSupabaseConfigured } from '@/config/env';
import { requestEmailOtp, verifyEmailOtp } from '@/data/auth';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { theme } from '@/ui/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    } catch (verifyError) {
      setError(messageFrom(verifyError, '验证码不正确或已过期'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.column}>
          <Text variant="muted">生活记录</Text>
          <Text variant="title" accessibilityRole="header">
            {brand.displayName}
          </Text>
          <Text variant="body">用邮箱登录。我们发送 6 位验证码，不使用密码。</Text>
          {!configured ? (
            <Card>
              <Text variant="body">还没有接上 Supabase。把 .env.example 复制为 .env.local，填入本地或云端项目的地址和 anon key，然后重启。</Text>
            </Card>
          ) : null}
          {phase === 'email' ? (
            <View style={styles.form}>
              <TextField
                label="邮箱"
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoComplete="email"
                error={error}
              />
              <Button label="发送验证码" onPress={() => void sendCode()} loading={busy} />
            </View>
          ) : (
            <View style={styles.form}>
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
              <Button
                label="重新发送"
                variant="secondary"
                onPress={() => void sendCode()}
                disabled={busy}
              />
              <Button
                label="换一个邮箱"
                variant="ghost"
                onPress={() => {
                  setPhase('email');
                  setCode('');
                  setError(null);
                }}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.paper },
  flex: { flex: 1 },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: theme.layout.content,
    alignSelf: 'center',
    justifyContent: 'center',
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  form: { gap: theme.space.md },
});
