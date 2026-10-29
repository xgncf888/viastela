# Hosted email OTP

Settings to apply on the hosted project. Secret values stay in the dashboard. This repo does not contain API keys, SMTP passwords, or a service role key.

Local `supabase start` leaves `[auth.email.smtp]` disabled and delivers mail to Mailpit.

## SMTP

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: the Resend API key. Yifeng enters it in the dashboard.
- Sender: `星途 Viastela <noreply@<verified domain>>`
  - `<verified domain>` is the domain verified at Resend.

## Email OTP

- OTP expiration: `600` seconds. The allowed maximum is `86400`.
- OTP length: `6`.
- Minimum interval between OTP emails to the same address: `60` seconds.

## Rate limits

- Emails sent per hour: `30`, after custom SMTP is on.
- Leave the verify and OTP endpoint limits at their defaults: 30 requests per 5 minutes per IP, with a burst of 30.

## Templates

Copy `supabase/templates/email-otp.html` into both of these templates:

- Magic Link
- Confirm signup

Subject, both templates: `星途登录验证码：{{ .Token }}`

The body is the code, `10 分钟内有效`, and `不是你本人操作可以忽略`. It has no link and no `{{ .ConfirmationURL }}`.

## One account

Supabase links identities that share a verified email. Google, then email OTP with that same address, is one account.
