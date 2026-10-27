# Progress

## Week 1

Shipped in the skeleton:

- Expo Router shell for web, iOS, and Android, with 今日 / 趋势 / 我的 and a centered `+ 记录` sheet.
- Wide web layout uses a sidebar. Narrow screens and native use the bottom bar.
- Email OTP login through Supabase.
- Weight log from input to `weight_records`, with a 7-day average (hidden until 4 days of data) and a 28-day EMA trend chart (alpha 0.1).
- Client UUID, `recorded_at`, `tz`, frozen `local_day`, `updated_at`, and nullable `deleted_at`.
- Weight reads use a `local_day` window. Delete is a plain update of `deleted_at`. `soft_delete_weight_record` 已删除.
- Optimistic save, error toast, and retry on the same id.
- One-tap `再记` of the last weight. Empty states say `先记第一笔`.
- Day-switch setting on 我的, default 04:00, applied only to new rows.
- Jest coverage for the day boundary, history stability, Singapore to Tokyo, and dedupe.
- pgTAP coverage that each user can only read and write their own profile and weight rows, anon is denied, and every public table has RLS.
- GitHub Actions, a Playwright smoke test of the web export, and a pre-push hook.
- Account deletion through the `delete-account` Edge Function, with pgTAP coverage that a deleted user's public rows are gone and that every `user_id` foreign key cascades. Deletion requires the session's newest `amr` timestamp to be within 10 minutes (exactly 10:00 passes).
- Web privacy policy and account-deletion pages. Google and GitHub buttons are on the web login screen.
- 训练 records sets on 今日, including the six home exercises when there is no history. `完成` confirms when a load field is unsaved. 学习 records a topic, a duration, and an optional note. 今日 shows a study card whose `记一笔` opens that form.

Stubbed:

- 时间块 is visible in the record sheet and does not save.
- No offline queue.
- No EAS build, no store binaries, and no real EAS project id.
- No hosted Supabase project in the repo.
- Native Google and GitHub OAuth, and Sign in with Apple before the iOS release.

Owner still needs to:

- `delete-account` has been on the hosted project since merge `97c2810`. This repository does not deploy it. After review, the coordinator redeploys it and sets `DELETE_ACCOUNT_ALLOWED_ORIGINS` to `https://viastela.vercel.app`. Do not put `http://localhost:8081` or `http://localhost:19006` in that hosted value. For Google or GitHub re-authentication, also allow `https://viastela.vercel.app/account/delete` on the auth redirect list.
- Install Docker and run `npx supabase start` for local login, or create a Supabase project and fill `.env.local`.
- Run `eas init` later if EAS Update should point at a real project. Replace the placeholder updates URL.
- Apple Developer and Google Play accounts are only needed when building store binaries. Expo Go and web do not need them.
