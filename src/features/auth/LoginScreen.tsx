import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { brand } from '@/config/brand';
import { isSupabaseConfigured } from '@/config/env';
import {
  OTP_RESEND_SECONDS,
  classifyOtpFailure,
  isCompleteOtp,
  isPlausibleEmail,
  isServiceFailure,
  nextSentAt,
  otpResendWaitLabel,
  otpSendTooFrequentMessage,
  otpSentLine,
  otpSentTitle,
  readOtpAuthFailure,
  remainingSeconds,
  type OtpFailureDecision,
} from '@/core/email-otp';
import { showProviderSignIn } from '@/core/provider-sign-in';
import { requestEmailOtp, signInWithProvider, verifyEmailOtp } from '@/data/auth';
import { captureOAuthFailure, clearOAuthFailureMessage, type OAuthProvider } from '@/data/oauth';
import { BrandMark } from '@/ui/BrandMark';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CodeInput } from '@/ui/CodeInput';
import { Content } from '@/ui/Content';
import { Callout, LabeledDivider, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

const savedEmailKey = 'login-email';
const notConfiguredMessage = '尚未配置 Supabase';

function rememberedEmail(): string {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem(savedEmailKey) ?? '';
}

function rememberEmail(value: string) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(savedEmailKey, value);
}

function isNotConfigured(error: unknown): boolean {
  return error instanceof Error && error.message === 'Supabase is not configured';
}

type Notice = { source: 'form'; message: string } | { source: 'auth'; decision: OtpFailureDecision };

function providerFailureMessage(error: unknown): string {
  if (isNotConfigured(error)) return notConfiguredMessage;
  if (isServiceFailure(readOtpAuthFailure(error))) return '网络不太稳，稍后再试';
  return '登录没有完成，请重试';
}

export function LoginScreen() {
  const configured = isSupabaseConfigured();
  const showProviders = showProviderSignIn(Platform.OS);
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(rememberedEmail);
  const [code, setCode] = useState('');
  const [providerNotice, setProviderNotice] = useState<string | null>(captureOAuthFailure);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [codeLocked, setCodeLocked] = useState(false);
  // Send time for this code. Component state only: a successful send replaces
  // it, going back does not, and it is never written to storage.
  const [sentAtMs, setSentAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [action, setAction] = useState<'send' | 'verify' | null>(null);
  const [provider, setProvider] = useState<OAuthProvider | null>(null);
  const verifying = useRef(false);
  const sending = useRef(false);
  const busy = action !== null || provider !== null;

  useEffect(() => {
    clearOAuthFailureMessage();
  }, []);

  useEffect(() => {
    if (sentAtMs === null) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sentAtMs]);

  const resendLeft = sentAtMs === null ? 0 : remainingSeconds(sentAtMs, nowMs, OTP_RESEND_SECONDS);
  const errorText =
    notice === null
      ? null
      : notice.source === 'form'
        ? notice.message
        : notice.decision.kind === 'send_too_frequent'
          ? resendLeft > 0
            ? otpSendTooFrequentMessage(resendLeft)
            : null
          : notice.decision.message;

  function onEmailChange(value: string) {
    setEmail(value);
    rememberEmail(value);
    setSentAtMs((current) => nextSentAt(current, 'email-edited', Date.now()));
    setNotice(null);
  }

  function useAnotherEmail() {
    setSentAtMs((current) => nextSentAt(current, 'back', Date.now()));
    setPhase('email');
    setCode('');
    setNotice(null);
  }

  async function startProvider(next: OAuthProvider) {
    if (!configured) {
      setProviderNotice(notConfiguredMessage);
      return;
    }
    setProvider(next);
    setProviderNotice(null);
    try {
      await signInWithProvider(next);
      clearOAuthFailureMessage();
      setProviderNotice(null);
    } catch (providerError) {
      setProviderNotice(providerFailureMessage(providerError));
      setProvider(null);
    }
  }

  async function sendCode() {
    const nextEmail = email.trim();
    if (!isPlausibleEmail(nextEmail)) {
      setNotice({ source: 'form', message: '请输入有效邮箱' });
      return;
    }
    if (!configured) {
      setNotice({ source: 'form', message: notConfiguredMessage });
      return;
    }
    if (sending.current) return;
    sending.current = true;
    setAction('send');
    setNotice(null);
    try {
      await requestEmailOtp(nextEmail);
      const now = Date.now();
      setSentAtMs(nextSentAt(sentAtMs, 'sent', now));
      setNowMs(now);
      setEmail(nextEmail);
      rememberEmail(nextEmail);
      setCode('');
      setCodeLocked(false);
      setPhase('code');
    } catch (sendError) {
      if (isNotConfigured(sendError)) {
        setNotice({ source: 'form', message: notConfiguredMessage });
        return;
      }
      const failure = readOtpAuthFailure(sendError);
      const now = Date.now();
      const anchor =
        failure.code === 'over_email_send_rate_limit' ? nextSentAt(sentAtMs, 'rate-limited', now) : sentAtMs;
      if (failure.code === 'over_email_send_rate_limit') {
        setSentAtMs(anchor);
        setNowMs(now);
      }
      const remaining = anchor === null ? OTP_RESEND_SECONDS : remainingSeconds(anchor, now, OTP_RESEND_SECONDS);
      const decision = classifyOtpFailure(failure, {
        sentAtMs: anchor,
        nowMs: now,
        resendRemainingSeconds: remaining,
      });
      setNotice({ source: 'auth', decision });
      if (decision.disableCodeInput) setCodeLocked(true);
    } finally {
      sending.current = false;
      setAction(null);
    }
  }

  async function verifyCode(token: string) {
    if (codeLocked || verifying.current) return;
    if (!isCompleteOtp(token)) {
      setNotice({ source: 'form', message: '请输入 6 位验证码' });
      return;
    }
    verifying.current = true;
    setAction('verify');
    setNotice(null);
    try {
      await verifyEmailOtp(email, token);
      clearOAuthFailureMessage();
      setProviderNotice(null);
    } catch (verifyError) {
      if (isNotConfigured(verifyError)) {
        setNotice({ source: 'form', message: notConfiguredMessage });
        return;
      }
      const now = Date.now();
      const decision = classifyOtpFailure(readOtpAuthFailure(verifyError), {
        sentAtMs,
        nowMs: now,
        resendRemainingSeconds: sentAtMs === null ? 0 : remainingSeconds(sentAtMs, now, OTP_RESEND_SECONDS),
      });
      setNotice({ source: 'auth', decision });
      if (decision.disableCodeInput) setCodeLocked(true);
    } finally {
      verifying.current = false;
      setAction(null);
    }
  }

  return (
    <Screen keyboard edges={['top', 'right', 'bottom', 'left']}>
      <Content align="center" gap="md" measure="auth">
        <ScreenHeader
          kicker="生活记录"
          title={phase === 'code' ? otpSentTitle : brand.displayName}
          trailing={<BrandMark />}
          detail={phase === 'email' ? '用邮箱登录。我们发送 6 位验证码，不使用密码。' : undefined}
        />
        {!configured ? (
          <Card>
            <Text variant="body">
              还没有接上 Supabase。把 .env.example 复制为 .env.local，填入本地或云端项目的地址和 anon key，然后重启。
            </Text>
          </Card>
        ) : null}
        <Card>
          {phase === 'email' ? (
            <Stack gap="md">
              {showProviders ? (
                <>
                  {providerNotice ? <Callout message={providerNotice} tone="danger" /> : null}
                  <Button
                    label="使用 Google 登录"
                    variant="secondary"
                    fill
                    onPress={() => void startProvider('google')}
                    loading={provider === 'google'}
                    disabled={busy && provider !== 'google'}
                  />
                  <Button
                    label="使用 GitHub 登录"
                    variant="secondary"
                    fill
                    onPress={() => void startProvider('github')}
                    loading={provider === 'github'}
                    disabled={busy && provider !== 'github'}
                  />
                  <LabeledDivider label="或" />
                </>
              ) : null}
              <TextField
                label="邮箱"
                value={email}
                onChangeText={onEmailChange}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoComplete="email"
                error={errorText}
              />
              <Button
                label="发送验证码"
                fill
                onPress={() => void sendCode()}
                loading={action === 'send'}
                disabled={busy}
              />
            </Stack>
          ) : (
            <Stack gap="md">
              <Text variant="muted">{otpSentLine(email)}</Text>
              <CodeInput
                value={code}
                onChangeText={(next) => {
                  setCode(next);
                  setNotice((current) =>
                    current?.source === 'form' || (current?.source === 'auth' && current.decision.kind === 'wrong_code')
                      ? null
                      : current,
                  );
                }}
                onComplete={(next) => void verifyCode(next)}
                error={errorText}
                disabled={codeLocked}
                autoFocus
              />
              <Button
                label="登录"
                fill
                onPress={() => void verifyCode(code)}
                loading={action === 'verify'}
                disabled={busy || codeLocked}
              />
              {resendLeft > 0 ? (
                <Text variant="muted">{otpResendWaitLabel(resendLeft)}</Text>
              ) : (
                <Button
                  label="重新发送"
                  variant="ghost"
                  fill
                  onPress={() => void sendCode()}
                  disabled={busy}
                  loading={action === 'send'}
                />
              )}
              <Button label="换个邮箱" variant="ghost" fill onPress={useAnotherEmail} disabled={busy} />
            </Stack>
          )}
        </Card>
        <Button label="隐私政策" variant="ghost" fill onPress={() => router.push('/privacy')} />
      </Content>
    </Screen>
  );
}
