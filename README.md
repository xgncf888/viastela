# Personal life management

Personal life-management app for Yifeng. The display name lives only in `src/config/brand.ts`. One Expo codebase runs on the web, in Expo Go on iOS and Android, and later as store binaries. Week 1 is the shell, email login, and weight tracking.

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
2. Migrations are applied only through the Supabase connector, after review. The init migration is already on the hosted project as version `20261027051825` (`supabase/migrations/20261027051825_init.sql`); do not edit it. Later changes belong in a new file. After the connector applies one, rename the local file to that hosted version. This repository does not apply migrations to the hosted project.
3. Under Authentication, keep email OTP enabled.
4. Put the project URL and the anon key in `.env.local`.
5. Add `http://localhost:8081` to the auth redirect allow list if you also use magic links. The app signs in with the 6-digit code, so a redirect is not required for the OTP form.

The anon key is public. The service role key stays on the server and out of this repo. The `delete-account` Edge Function reads `SUPABASE_SERVICE_ROLE_KEY` from the runtime environment and is the only place that uses it. Do not deploy that function from CI. Deploy it after review. Do not apply new migrations to the hosted project from this repository.

## Account and privacy

`/privacy` lists the stored data: weight, training sets, study records, and the account email, name, and avatar. It says the data is not sold, not used for advertising, and not sent to an AI service in this version. The contact address is xgncf888@gmail.com.

`/account/delete` explains that weight records, training sets, study records, and the profile are deleted, and that this cannot be undone. Both pages use `backupPurgeDays` for the backup purge window. The button stays off until the person types 删除. A failure returns to that explanation. Success opens 账号已删除, and 好的 returns to login.

`profiles.user_id` and `weight_records.user_id` already reference `auth.users` with `on delete cascade`. pgTAP checks that catalog rule and that deleting a test user leaves no `user_id` row in `public`.

## EAS Update later

`app.config.js` sets `runtimeVersion.policy` to `fingerprint`. `eas.json` binds the preview and production build profiles to the `preview` and `production` channels. There is no EAS project yet. When you want over-the-air updates:

```bash
npx eas init
```

Put the project id in `EAS_PROJECT_ID` and the updates URL in `EXPO_PUBLIC_EAS_UPDATE_URL` if you do not want the placeholder `https://u.expo.dev/00000000-0000-0000-0000-000000000000`. Do not run a store build until the Apple Developer and Google Play accounts exist.

## Record tables

Each record type gets its own table. Do not add a generic log table. A record table has:

- `id uuid primary key` — client-generated, no database default, so a retry upserts the same id
- `user_id uuid not null` references `auth.users`
- `recorded_at timestamptz not null` — UTC instant
- `tz text not null` — IANA zone at write time
- `local_day date not null` — accounting day frozen at write time by `src/core` from `tz` and the user's day-switch. The database rejects a value that is not the civil date of `recorded_at` in `tz` or the previous civil date (`enforce_record_local_day`)
- `updated_at timestamptz not null default now()` — maintained by the `touch_updated_at` trigger, including soft deletes
- `deleted_at timestamptz` — null while the row is live. The app reads through `liveRows`, which adds `deleted_at is null`. Select policies do not. Soft delete is `update set deleted_at = now()` and the update asks for `id` back; zero rows is a failed delete. `forbid_update_deleted` on every record table raises `P0001` `record deleted` if that row is updated again. The client treats that as `record deleted` only when the code is `P0001` and the message is exactly `record deleted`. It does not retry that id, and shows `这条记录已在其他设备删除` with only 关闭. Any other error, including `P0001` with a different message, is retried. `DELETE` is revoked. Keep `soft_delete_weight_record` until the app no longer calls it.
- row level security so an authenticated user can only read and write their own rows, with pgTAP covering that matrix and the anon role
- a check constraint for any numeric range, such as `weight_kg > 0 and weight_kg < 500`

Money columns, when a record type needs them, are an integer count of minor units, an ISO currency code, and an FX snapshot (rate, quote currency, and the time of the rate) stored at write time. Do not store money as a float.

## Native modules already installed

These are in the app now so the first EAS development build's fingerprint already contains them:

- `expo-sqlite` — the offline queue is not built yet, and SQLite is native
- `expo-notifications` — a weigh-in reminder needs the notifications module and the iOS entitlement
- `expo-localization` — device locale and timezone for later accounting-day work
- `react-native-svg` — the trend chart can move from view bars to vector drawing

## Layout

`AGENTS.md` says which directory each agent may edit. `DECISIONS.md` is the decision log. `PROGRESS.md` says what week 1 finished and what is still stubbed.
