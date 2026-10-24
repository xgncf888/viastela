# Viastela

Personal life-management app for Yifeng. One Expo codebase runs on the web, in Expo Go on iOS and Android, and later as store binaries. Week 1 is the shell, email login, and weight tracking.

## Stack

Expo SDK 58, Expo Router, react-native-web, Supabase (Postgres, row level security, email OTP). EAS Update is configured with the fingerprint runtime version and `preview` / `production` channels in `eas.json`. Week 1 does not run an EAS build.

## Prerequisites

- Node.js 22.13 or newer
- A phone with Expo Go, for device testing
- Docker, only if you want the local Supabase stack

## Install

```bash
npm install
cp .env.example .env.local
```

`npm install` points Git at `.githooks`. The pre-push hook runs `npm run typecheck` and `npm test`.

## Run the web app

```bash
npx expo start --web
```

The dev server defaults to http://localhost:8081. Without Supabase env vars the login screen still opens and explains how to finish setup.

## Run in Expo Go

```bash
npx expo start
```

Scan the QR code with Expo Go. A physical phone cannot reach `http://127.0.0.1` on your computer. For device login, either use a hosted Supabase project or put your computer's LAN address in `.env.local` (Android emulators typically use `http://10.0.2.2:54321`). The iOS simulator on the same machine can use `127.0.0.1`.

Restart Expo after changing `EXPO_PUBLIC_*` variables. They are inlined into the bundle.

## Local Supabase

```bash
npx supabase start
npx supabase status
```

Copy the API URL and the anon key into `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
```

Do not put the service role key in the app or in git.

Sign-in emails stay on the machine. Open the local mail UI at http://127.0.0.1:54324, enter your email in the app, and type the 6-digit code. The first sign-in creates the account.

Useful commands:

```bash
npm test                 # src/core unit tests
npm run typecheck
npm run lint
npm run test:rls         # starts local Postgres and runs pgTAP
npm run export:web && npm run test:e2e
```

## Use a hosted Supabase project

1. Create a project at https://supabase.com.
2. In the SQL editor, run `supabase/migrations/20261024120000_init.sql` (or `npx supabase link` and `npx supabase db push` once the CLI is logged in).
3. Under Authentication, keep email OTP enabled.
4. Put the project URL and the anon key in `.env.local`.
5. Add `http://localhost:8081` to the auth redirect allow list if you also use magic links. The app signs in with the 6-digit code, so a redirect is not required for the OTP form.

The anon key is public. The service role key stays on the server and out of this repo.

## EAS Update later

`app.config.js` sets `runtimeVersion.policy` to `fingerprint`. `eas.json` binds the preview and production build profiles to the `preview` and `production` channels. There is no EAS project yet. When you want over-the-air updates:

```bash
npx eas init
```

Put the project id in `EAS_PROJECT_ID` and the updates URL in `EXPO_PUBLIC_EAS_UPDATE_URL` if you do not want the placeholder `https://u.expo.dev/00000000-0000-0000-0000-000000000000`. Do not run a store build until the Apple Developer and Google Play accounts exist.

## Layout

`AGENTS.md` says which directory each agent may edit. `DECISIONS.md` is the decision log. `PROGRESS.md` says what week 1 finished and what is still stubbed.
