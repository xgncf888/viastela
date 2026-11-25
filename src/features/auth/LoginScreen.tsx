import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { brand } from '@/config/brand';
import { isSupabaseConfigured, readStoredSupabaseDraft } from '@/config/env';
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
import { OAUTH_UNSAVED_BODY, OAUTH_UNSAVED_CANCEL, OAUTH_UNSAVED_PROCEED, unsavedOAuthTitle, unsavedRecordCount } from '@/core/unsaved-login-copy';
import { showProviderSignIn } from '@/core/provider-sign-in';
import { validateSupabaseConfig } from '@/core/supabase-config';
import {
  applyCustomSupabaseConfig,
  enterLocalMode,
  requestEmailOtp,
  signInWithProvider,
  verifyEmailOtp,
} from '@/data/auth';
import { captureOAuthFailure, clearOAuthFailureMessage, type OAuthProvider } from '@/data/oauth';
import { BrandMark } from '@/ui/BrandMark';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CodeInput } from '@/ui/CodeInput';
import { Content } from '@/ui/Content';
import { Dialog } from '@/ui/Dialog';
import { Callout, LabeledDivider, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { showToast } from '@/ui/toast';
import { useOptionalStudy } from '@/features/study/StudyProvider';
import { useOptionalTraining } from '@/features/training/TrainingProvider';
import { useOptionalWeight } from '@/features/weight/WeightProvider';

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
  const storedSupabase = __DEV__ ? readStoredSupabaseDraft() : { url: '', anonKey: '' };
  const storedVerdict =
    storedSupabase.url || storedSupabase.anonKey
      ? validateSupabaseConfig(storedSupabase.url, storedSupabase.anonKey)
      : null;
  const [showCloudConfig, setShowCloudConfig] = useState(false);
  const [customUrl, setCustomUrl] = useState(storedSupabase.url);
  const [customKey, setCustomKey] = useState(storedSupabase.anonKey);
  const [urlError, setUrlError] = useState<string | null>(
    storedVerdict && !storedVerdict.ok ? storedVerdict.urlError : null,
  );
  const [keyError, setKeyError] = useState<string | null>(
    storedVerdict && !storedVerdict.ok ? storedVerdict.keyError : null,
  );
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);
  const weight = useOptionalWeight();
  const training = useOptionalTraining();
  const study = useOptionalStudy();
  const unsavedCount = unsavedRecordCount([
    weight?.failedIds ?? new Set<string>(),
    training?.failedIds ?? new Set<string>(),
    study?.failedIds ?? new Set<string>(),
  ]);
  const verifying = useRef(false);
  const sending = useRef(false);
  const busy = action !== null || provider !== null;

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

  function dismissProviderFailure() {
    clearOAuthFailureMessage();
    setProviderNotice(null);
  }

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
    if (unsavedCount > 0) {
      setPendingProvider(next);
      return;
    }
    await runProvider(next);
  }

  async function runProvider(next: OAuthProvider) {
    dismissProviderFailure();
    if (!configured) {
      setProviderNotice(notConfiguredMessage);
      return;
    }
    setProvider(next);
    try {
      await signInWithProvider(next);
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
    dismissProviderFailure();
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

  function onEnterLocalOnly() {
    enterLocalMode();
    router.replace('/');
  }

  function onSaveCloudConfig() {
    const verdict = validateSupabaseConfig(customUrl, customKey);
    if (!verdict.ok) {
      setUrlError(verdict.urlError);
      setKeyError(verdict.keyError);
      return;
    }
    const saved = applyCustomSupabaseConfig(verdict.url, verdict.anonKey);
    if (!saved) {
      setUrlError('只接受 https 地址');
      setKeyError('只接受 sb_publishable_ 或 anon 公钥');
      return;
    }
    setUrlError(null);
    setKeyError(null);
    setShowCloudConfig(false);
    showToast({ text: '已保存云端 Supabase 配置' });
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
                  {providerNotice ? (
                    <Callout
                      message={providerNotice}
                      tone="danger"
                      action={
                        <Button
                          label="知道了"
                          accessibilityLabel="关闭提示"
                          variant="ghost"
                          onPress={dismissProviderFailure}
                        />
                      }
                    />
                  ) : null}
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
        {__DEV__ ? (
          <Stack gap="sm">
            <Button label="先不登录，直接用" variant="ghost" onPress={onEnterLocalOnly} />
            <Text variant="muted">数据只存在这台设备上，不会同步。清除浏览器数据或卸载后无法恢复。</Text>
            <Button
              label={showCloudConfig ? '收起云端连接配置' : '配置云端 Supabase 地址与 Key'}
              variant="ghost"
              onPress={() => setShowCloudConfig((prev) => !prev)}
            />
            {showCloudConfig ? (
              <Stack gap="sm">
                <TextField
                  label="SUPABASE URL"
                  value={customUrl}
                  onChangeText={(next) => {
                    setCustomUrl(next);
                    setUrlError(null);
                  }}
                  placeholder="https://your-project.supabase.co"
                  autoCapitalize="none"
                  error={urlError}
                />
                <TextField
                  label="SUPABASE ANON KEY"
                  value={customKey}
                  onChangeText={(next) => {
                    setCustomKey(next);
                    setKeyError(null);
                  }}
                  placeholder="sb_publishable_…"
                  autoCapitalize="none"
                  secureTextEntry
                  error={keyError}
                />
                <Button label="保存云端配置" variant="secondary" fill onPress={onSaveCloudConfig} />
              </Stack>
            ) : null}
          </Stack>
        ) : null}
        <Button label="隐私政策" variant="ghost" fill onPress={() => router.push('/privacy')} />
        <Dialog
          visible={pendingProvider !== null}
          title={unsavedOAuthTitle(unsavedCount)}
          body={OAUTH_UNSAVED_BODY}
          onClose={() => setPendingProvider(null)}
        >
          <Button
            label={OAUTH_UNSAVED_PROCEED}
            variant="ghost"
            tone="danger"
            onPress={() => {
              const next = pendingProvider;
              setPendingProvider(null);
              if (next) void runProvider(next);
            }}
          />
          <Button label={OAUTH_UNSAVED_CANCEL} variant="secondary" onPress={() => setPendingProvider(null)} />
        </Dialog>
      </Content>
    </Screen>
  );
}
