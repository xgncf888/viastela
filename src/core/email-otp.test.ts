import { describe, expect, it } from '@jest/globals';

import {
  OTP_EXPIRY_SECONDS,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  classifyOtpFailure,
  isCompleteOtp,
  isOtpExpired,
  isPlausibleEmail,
  isServiceFailure,
  maskEmail,
  nextSentAt,
  otpExpiredMessage,
  otpNetworkMessage,
  otpSendTooFrequentMessage,
  otpSentLine,
  otpTooManyMessage,
  otpWrongMessage,
  readOtpAuthFailure,
  remainingSeconds,
  sanitizeOtpCode,
} from './email-otp';

declare const require: (id: string) => { readFileSync: (path: string, encoding: 'utf8') => string };
declare const __dirname: string;

const { readFileSync } = require('node:fs');
const repoRoot = `${__dirname}/../..`;

const sentAt = 1_700_000_000_000;

function tomlSection(toml: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^\\[${escaped}\\]\\s*$`, 'm').exec(toml);
  if (!match) throw new Error(`missing [${name}]`);
  const rest = toml.slice(match.index + match[0].length);
  const next = rest.search(/^\[/m);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('email OTP config', () => {
  const toml = readFileSync(`${repoRoot}/supabase/config.toml`, 'utf8');
  const email = tomlSection(toml, 'auth.email');

  it('uses the same 600 second expiry as supabase/config.toml', () => {
    const match = /^otp_expiry\s*=\s*(\d+)\s*$/m.exec(email);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(OTP_EXPIRY_SECONDS);
    expect(OTP_EXPIRY_SECONDS).toBe(600);
  });

  it('asks for OTP_LENGTH digits and a 60 second send window', () => {
    expect(email).toMatch(new RegExp(`^otp_length\\s*=\\s*${OTP_LENGTH}\\s*$`, 'm'));
    expect(email).toMatch(/^max_frequency\s*=\s*"60s"\s*$/m);
    expect(OTP_RESEND_SECONDS).toBe(60);
  });

  it('points both email templates at a code-only body', () => {
    for (const name of ['auth.email.template.magic_link', 'auth.email.template.confirmation']) {
      const section = tomlSection(toml, name);
      expect(section).toContain('星途登录验证码：{{ .Token }}');
      expect(section).not.toContain('ConfirmationURL');
      const path = /content_path\s*=\s*"([^"]+)"/.exec(section)?.[1];
      expect(path).toBe('./supabase/templates/email-otp.html');
      const html = readFileSync(`${repoRoot}/${(path ?? '').replace(/^\.\//, '')}`, 'utf8');
      expect(html).toContain('{{ .Token }}');
      expect(html).toContain('10 分钟内有效');
      expect(html).toContain('不是你本人操作可以忽略');
      expect(html).not.toContain('ConfirmationURL');
      expect(html).not.toMatch(/href\s*=/i);
      expect(html).not.toMatch(/https?:/i);
    }
  });

  it('keeps hosted SMTP disabled and free of secret values', () => {
    const smtp = tomlSection(toml, 'auth.email.smtp');
    expect(smtp).toMatch(/^enabled\s*=\s*false\s*$/m);
    expect(smtp).toContain('env(RESEND_API_KEY)');
    expect(smtp).toContain('env(SMTP_ADMIN_EMAIL)');
    expect(smtp).not.toMatch(/pass\s*=\s*"(?!env\()/);
  });
});

describe('sanitizeOtpCode', () => {
  it('keeps digits and truncates to 6, including a pasted sentence', () => {
    expect(sanitizeOtpCode('12a3 45-6 789')).toBe('123456');
    expect(sanitizeOtpCode('验证码 123456')).toBe('123456');
    expect(sanitizeOtpCode('12')).toBe('12');
    expect(isCompleteOtp(sanitizeOtpCode('123456'))).toBe(true);
    expect(isCompleteOtp('12345')).toBe(false);
  });
});

describe('maskEmail', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
    expect(maskEmail('yifeng@example.com')).toBe('y***@example.com');
    expect(otpSentLine('a@example.com')).toBe('验证码已发到 a***@example.com');
    expect(maskEmail('not-an-email')).toBe('***');
  });
});

describe('isPlausibleEmail', () => {
  it('rejects a blank or incomplete address', () => {
    expect(isPlausibleEmail('a@b.c')).toBe(true);
    expect(isPlausibleEmail('  name@example.com ')).toBe(true);
    expect(isPlausibleEmail('name@example')).toBe(false);
    expect(isPlausibleEmail('')).toBe(false);
  });
});

describe('remainingSeconds', () => {
  it('counts down inside the 60 second window', () => {
    expect(remainingSeconds(sentAt, sentAt, OTP_RESEND_SECONDS)).toBe(60);
    expect(remainingSeconds(sentAt, sentAt + 15_000, OTP_RESEND_SECONDS)).toBe(45);
    expect(remainingSeconds(sentAt, sentAt + 59_900, OTP_RESEND_SECONDS)).toBe(1);
    expect(remainingSeconds(sentAt, sentAt + 60_000, OTP_RESEND_SECONDS)).toBe(0);
  });
});

describe('nextSentAt', () => {
  it('does not move the anchor when the person goes back or edits the address', () => {
    expect(nextSentAt(sentAt, 'back', sentAt + 15_000)).toBe(sentAt);
    expect(nextSentAt(sentAt, 'email-edited', sentAt + 15_000)).toBe(sentAt);
  });

  it('replaces the anchor on a successful send', () => {
    expect(nextSentAt(sentAt, 'sent', sentAt + 15_000)).toBe(sentAt + 15_000);
  });

  it('keeps a running countdown when the server says the send was too soon', () => {
    expect(nextSentAt(sentAt, 'rate-limited', sentAt + 15_000)).toBe(sentAt);
    expect(nextSentAt(sentAt, 'rate-limited', sentAt + 60_000)).toBe(sentAt + 60_000);
    expect(nextSentAt(null, 'rate-limited', sentAt)).toBe(sentAt);
  });
});

describe('classifyOtpFailure', () => {
  const otpExpired = { code: 'otp_expired', status: 403, name: 'AuthApiError' };

  it('calls a code wrong at 599 seconds and expired at 601 seconds', () => {
    const early = classifyOtpFailure(otpExpired, {
      sentAtMs: sentAt,
      nowMs: sentAt + 599 * 1000,
      resendRemainingSeconds: 0,
    });
    const late = classifyOtpFailure(otpExpired, {
      sentAtMs: sentAt,
      nowMs: sentAt + 601 * 1000,
      resendRemainingSeconds: 0,
    });
    expect(early).toEqual({ kind: 'wrong_code', message: otpWrongMessage, disableCodeInput: false });
    expect(early.message).toBe('验证码不对，再检查一下');
    expect(late).toEqual({ kind: 'expired_code', message: otpExpiredMessage, disableCodeInput: false });
    expect(late.message).toBe('验证码已过期，请重新发送');
    expect(isOtpExpired(sentAt, sentAt + 599 * 1000)).toBe(false);
    expect(isOtpExpired(sentAt, sentAt + 601 * 1000)).toBe(true);
  });

  it('treats the exact 600 second mark as expired', () => {
    const decision = classifyOtpFailure(otpExpired, {
      sentAtMs: sentAt,
      nowMs: sentAt + OTP_EXPIRY_SECONDS * 1000,
      resendRemainingSeconds: 0,
    });
    expect(decision.kind).toBe('expired_code');
    expect(isOtpExpired(sentAt, sentAt + OTP_EXPIRY_SECONDS * 1000)).toBe(true);
  });

  it('does not read the error message', () => {
    const read = readOtpAuthFailure({
      message: 'Token has expired or is invalid',
      code: 'otp_expired',
      status: 403,
      name: 'AuthApiError',
    });
    expect(read).toEqual(otpExpired);
    const misleading = readOtpAuthFailure({
      message: 'rate limit reached and network error',
      code: 'validation_failed',
      status: 400,
      name: 'AuthApiError',
    });
    const decision = classifyOtpFailure(misleading, {
      sentAtMs: sentAt,
      nowMs: sentAt + 1000,
      resendRemainingSeconds: 60,
    });
    expect(decision.kind).toBe('unavailable');
    expect(decision.message).not.toContain('频繁');
    expect(decision.message).not.toBe(otpNetworkMessage);
  });

  it('disables the input on the verify rate limit', () => {
    const decision = classifyOtpFailure(
      { code: 'over_request_rate_limit', status: 429, name: 'AuthApiError' },
      { sentAtMs: sentAt, nowMs: sentAt, resendRemainingSeconds: 40 },
    );
    expect(decision).toEqual({
      kind: 'too_many_attempts',
      message: otpTooManyMessage,
      disableCodeInput: true,
    });
    expect(decision.message).toBe('尝试次数太多，请重新获取验证码');
  });

  it('aligns the send rate-limit copy with the countdown', () => {
    const decision = classifyOtpFailure(
      { code: 'over_email_send_rate_limit', status: 429, name: 'AuthApiError' },
      { sentAtMs: sentAt, nowMs: sentAt + 15_000, resendRemainingSeconds: 45 },
    );
    expect(decision.kind).toBe('send_too_frequent');
    expect(decision.disableCodeInput).toBe(false);
    expect(decision.message).toBe(otpSendTooFrequentMessage(45));
    expect(decision.message).toBe('发送太频繁，请 45 秒后再试');
  });

  it('uses the network copy for a dropped request or a 500, and not for otp_expired', () => {
    expect(
      classifyOtpFailure(
        { code: null, status: 0, name: 'AuthRetryableFetchError' },
        { sentAtMs: sentAt, nowMs: sentAt, resendRemainingSeconds: 0 },
      ),
    ).toMatchObject({ kind: 'network', message: otpNetworkMessage, disableCodeInput: false });
    expect(
      classifyOtpFailure(
        { code: 'unexpected_failure', status: 500, name: 'AuthApiError' },
        { sentAtMs: sentAt, nowMs: sentAt, resendRemainingSeconds: 0 },
      ).message,
    ).toBe('网络不太稳，稍后再试');
    expect(isServiceFailure(otpExpired)).toBe(false);
    expect(isServiceFailure({ code: null, status: 503, name: 'AuthRetryableFetchError' })).toBe(true);
  });
});
