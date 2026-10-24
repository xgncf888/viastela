# Decisions

- One Expo application, not a monorepo, targets web, iOS, and Android.
- The client is Expo SDK 58, Expo Router, and react-native-web.
- The backend is Supabase Postgres with row level security and email OTP, and there is no second backend.
- EAS Update uses the fingerprint `runtimeVersion` policy; preview and production channels are set in `eas.json`; week 1 does not run EAS builds.
- The display name and icon paths live only in `src/config/brand.ts`; the bundle ids `com.personal.lifeapp` and the URL scheme `lifeapp` are neutral and configured in that same file.
- UI copy is Chinese.
- Routes live in `app/`, feature UI in `src/features/`, business rules in `src/core/`, Supabase calls in `src/data/`, and tokens plus shared components in `src/ui/`.
- ESLint rejects raw colors and raw sizes in `app/` and `src/features/`.
- Each record type has its own table; week 1 only creates `weight_records`.
- A weight row's id is a client-generated UUID, and a resubmit upserts that id.
- `local_day` is computed in `src/core` at write time from the record's IANA timezone and the user's day-switch, default `04:00`.
- Changing the day-switch or the device timezone does not rewrite stored `local_day` values.
- The 7-day average uses the earliest row of each `local_day` and divides by the number of days that have a row; later rows that day are notes.
- Between 00:00 and the day-switch, the 今日 header and the save toast say which accounting date the entry uses, for example `已记入 10月23日`.
- Week 1 has no offline queue.
- CI on every push and pull request runs `tsc`, ESLint, Jest, pgTAP against the local Supabase stack, and a Playwright smoke test of the web export.
- The pre-push hook runs typecheck and Jest.
