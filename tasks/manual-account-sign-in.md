# Same email, one account

- Status: manual
- Owner directory: src/features/auth
- Platform files touched: no

## Outcome

Email OTP and a later Google or GitHub sign-in for the same verified email are one backend user, with the same profile and weight rows. Cancelling or failing the provider returns to login with an error line, and the typed email is still in the field.

Provider buttons are not in this change. Run this after those buttons exist. Do not treat a missing button as a failure of the deletion or privacy pages.

## Steps

1. Sign in with an email OTP. On 我的, confirm the email. If you already have weight rows, note one value.
2. Sign out.
3. On the hosted project, enable Google or GitHub, then start that provider with the same email.
4. In the database, confirm `auth.users` has one row for that email and `auth.identities` lists both the email provider and Google or GitHub.
5. Confirm `public.profiles` and `public.weight_records` for that email still use the same `user_id` as before the second sign-in. A second auth user, or rows that moved to a new id, fails the case.

## Cancelled or failed provider

1. On the login screen, type an email and do not clear it.
2. Start Google or GitHub, then cancel the provider or force it to fail.
3. You are back on the login screen.
4. An error line is visible.
5. The email field still shows the address you typed.

## Done when

- [ ] One `auth.users` row for the email
- [ ] Profile and weight rows still belong to that user
- [ ] Cancel or failure returns to login with an error line and the typed email kept

## Out of scope

- Building the Google and GitHub buttons. Those follow the shared UI rewrite.
- Deploying `delete-account`.
