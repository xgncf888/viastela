# Progress

## Week 1

Shipped in the skeleton:

- Expo Router shell for web, iOS, and Android, with 今日 / 趋势 / 我的 and a centered `+ 记录` sheet.
- Wide web layout uses a sidebar. Narrow screens and native use the bottom bar.
- Email OTP login through Supabase.
- Weight log from input to `weight_records`, with a 7-day average (hidden until 4 days of data) and an EMA trend chart.
- Client UUID, `recorded_at`, `tz`, frozen `local_day`, `updated_at`, and nullable `deleted_at`.
- Weight reads use a `local_day` window. Delete calls `soft_delete_weight_record`.
- Optimistic save, error toast, and retry on the same id.
- One-tap `再记` of the last weight. Empty states say `先记第一笔`.
- Day-switch setting on 我的, default 04:00, applied only to new rows.
- Jest coverage for the day boundary, history stability, Singapore to Tokyo, and dedupe.
- pgTAP coverage that each user can only read and write their own profile and weight rows, anon is denied, and every public table has RLS.
- GitHub Actions, a Playwright smoke test of the web export, and a pre-push hook.

Stubbed:

- 训练, 学习, and 时间块 are visible in the record sheet and do not save.
- No offline queue.
- No EAS build, no store binaries, and no real EAS project id.
- No hosted Supabase project in the repo.

Owner still needs to:

- Install Docker and run `npx supabase start` for local login, or create a Supabase project and fill `.env.local`.
- Run `eas init` later if EAS Update should point at a real project. Replace the placeholder updates URL.
- Apple Developer and Google Play accounts are only needed when building store binaries. Expo Go and web do not need them.
