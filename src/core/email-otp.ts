/**
 * Email OTP decisions for the login screen.
 *
 * GoTrue returns one code, `otp_expired` ("Token has expired or is invalid"),
 * for a wrong code, a used code, an unknown email, and a code past `otp_expiry`.
 * The screen tells those apart with the time it sent the code. That timestamp
 * stays in component state and is replaced on every successful send.
 *
 * Expiry is `OTP_EXPIRY_SECONDS` (600). At 600 seconds the copy is already
 * "已过期". GoTrue's own check is `time.After(sentAt + expiry)`, so the server
 * still accepts a code at the exact 600 second mark and rejects it a moment
 * later. The copy follows the product rule, not that one-second gap.
 */

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_SECONDS = 600;
export const OTP_RESEND_SECONDS = 60;

export const otpWrongMessage = '验证码不对，再检查一下';
export const otpExpiredMessage = '验证码已过期，请重新发送';
export const otpTooManyMessage = '尝试次数太多，请重新获取验证码';
export const otpNetworkMessage = '网络不太稳，稍后再试';
export const otpSentTitle = '验证码已发送，请查收邮箱';

export type OtpAuthFailure = {
  code: string | null;
  status: number | null;
  name: string | null;
};

export type OtpFailureKind =
  | 'wrong_code'
  | 'expired_code'
  | 'too_many_attempts'
  | 'send_too_frequent'
  | 'network'
  | 'unavailable';

export type OtpFailureDecision = {
  kind: OtpFailureKind;
  message: string;
  disableCodeInput: boolean;
};

export type SentAtEvent = 'sent' | 'back' | 'email-edited' | 'rate-limited';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPlausibleEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export function sanitizeOtpCode(value: string, length = OTP_LENGTH): string {
  return value.replace(/\D/g, '').slice(0, length);
}

export function isCompleteOtp(value: string, length = OTP_LENGTH): boolean {
  return value.length === length && new RegExp(`^\\d{${length}}$`).test(value);
}

/** First character of the local part, then three stars, then the full domain. */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return '***';
  const local = Array.from(trimmed.slice(0, at));
  const domain = trimmed.slice(at + 1);
  return `${local[0] ?? '*'}***@${domain}`;
}

export function otpSentLine(email: string): string {
  return `验证码已发到 ${maskEmail(email)}`;
}

export function otpResendWaitLabel(seconds: number): string {
  return `${seconds} 秒后可重发`;
}

export function otpSendTooFrequentMessage(seconds: number): string {
  return `发送太频繁，请 ${Math.max(0, seconds)} 秒后再试`;
}

export function remainingSeconds(anchorMs: number, nowMs: number, windowSeconds: number): number {
  if (!Number.isFinite(anchorMs) || !Number.isFinite(nowMs) || windowSeconds <= 0) return 0;
  const elapsed = Math.floor((nowMs - anchorMs) / 1000);
  return Math.max(0, windowSeconds - Math.max(0, elapsed));
}

/** True once `expirySeconds` have passed, including the exact boundary. */
export function isOtpExpired(sentAtMs: number, nowMs: number, expirySeconds = OTP_EXPIRY_SECONDS): boolean {
  return nowMs - sentAtMs >= expirySeconds * 1000;
}

/**
 * Successful send replaces the anchor. Going back or editing the address
 * does not. A rate-limit response keeps a countdown that is still running.
 */
export function nextSentAt(
  anchorMs: number | null,
  event: SentAtEvent,
  nowMs: number,
  windowSeconds = OTP_RESEND_SECONDS,
): number | null {
  if (event === 'back' || event === 'email-edited') return anchorMs;
  if (event === 'sent') return nowMs;
  if (anchorMs !== null && remainingSeconds(anchorMs, nowMs, windowSeconds) > 0) return anchorMs;
  return nowMs;
}

export function readOtpAuthFailure(error: unknown): OtpAuthFailure {
  if (typeof error !== 'object' || error === null) {
    return { code: null, status: null, name: error instanceof Error ? error.name : null };
  }
  const record = error as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name : error instanceof Error ? error.name : null;
  return {
    code: typeof record.code === 'string' ? record.code : null,
    status: typeof record.status === 'number' ? record.status : null,
    name,
  };
}

export function isServiceFailure(failure: OtpAuthFailure): boolean {
  if (
    failure.code === 'otp_expired' ||
    failure.code === 'over_request_rate_limit' ||
    failure.code === 'over_email_send_rate_limit'
  ) {
    return false;
  }
  if (failure.name === 'AuthRetryableFetchError' || failure.name === 'AuthUnknownError') return true;
  if (failure.status === 0) return true;
  if (typeof failure.status === 'number' && failure.status >= 500) return true;
  if (failure.name === 'TypeError' && failure.code == null) return true;
  return false;
}

export function classifyOtpFailure(
  failure: OtpAuthFailure,
  context: {
    sentAtMs: number | null;
    nowMs: number;
    resendRemainingSeconds: number;
    expirySeconds?: number;
  },
): OtpFailureDecision {
  if (failure.code === 'over_request_rate_limit') {
    return { kind: 'too_many_attempts', message: otpTooManyMessage, disableCodeInput: true };
  }
  if (failure.code === 'over_email_send_rate_limit') {
    return {
      kind: 'send_too_frequent',
      message: otpSendTooFrequentMessage(context.resendRemainingSeconds),
      disableCodeInput: false,
    };
  }
  if (failure.code === 'otp_expired') {
    const expired = context.sentAtMs !== null && isOtpExpired(context.sentAtMs, context.nowMs, context.expirySeconds);
    return expired
      ? { kind: 'expired_code', message: otpExpiredMessage, disableCodeInput: false }
      : { kind: 'wrong_code', message: otpWrongMessage, disableCodeInput: false };
  }
  if (isServiceFailure(failure)) {
    return { kind: 'network', message: otpNetworkMessage, disableCodeInput: false };
  }
  return { kind: 'unavailable', message: '登录没有完成，请重试', disableCodeInput: false };
}
