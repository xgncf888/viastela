# Same email, one account

- Status: manual
- Owner directory: src/features/auth
- Platform files touched: no

## Outcome

Email OTP and a later Google or GitHub sign-in for the same verified email are one backend user, with the same profile and weight rows. The Google and GitHub buttons are in this change, on the web login screen. Cancelling or failing the provider returns to that screen with the banner 登录没有完成，请重试 above the provider buttons, and the typed email is still in the field.

## Steps

1. Sign in with an email OTP. On 我的, confirm the email. If you already have weight rows, note one value.
2. Sign out.
3. On the web login screen, complete a full Google sign-in with 使用 Google 登录. Confirm the app opens.
4. Sign out. Complete a full GitHub sign-in with 使用 GitHub 登录. Confirm the app opens.
5. On the hosted project, the same verified email from the OTP and from each provider is one user.
6. In the database, confirm `auth.users` has one row for that email and `auth.identities` lists the email provider, Google, and GitHub.
7. Confirm `public.profiles` and `public.weight_records` for that email still use the same `user_id` as before the provider sign-ins. A second auth user, or rows that moved to a new id, fails the case.

## Cancelled or failed provider

1. On the login screen, type an email and do not clear it.
2. Start Google or GitHub, then cancel the provider or force it to fail.
3. You are back on the login screen.
4. The banner 登录没有完成，请重试 is visible above the Google and GitHub buttons, separate from the email field.
5. The email field still shows the address you typed.

## Done when

- [ ] A full Google sign-in and a full GitHub sign-in both open the app on web
- [ ] One `auth.users` row for the email
- [ ] Profile and weight rows still belong to that user
- [ ] Cancel or failure returns to login with the banner above the provider buttons and the typed email kept

## Out of scope

- Native OAuth. That uses `WebBrowser.openAuthSessionAsync` and `exchangeCodeForSession`, with redirect `viastela://auth/callback`. Sign in with Apple is required before the iOS release.
- Deploying `delete-account`.
