# Agent rules

This is Yifeng's personal life-management app. The product name lives only in `src/config/brand.ts`. These rules apply to every coding agent.

## Ownership

Edit only the directory you own. If a change needs another directory, stop and hand it to that owner.

| Path | Owner |
| --- | --- |
| `app/` | shell |
| `src/features/today/` | today |
| `src/features/trend/` | trend |
| `src/features/me/` | me |
| `src/features/record/` | record |
| `src/features/auth/` | auth |
| `src/features/weight/` | weight |
| `src/features/shell/` | shell |
| `src/core/` | core |
| `src/data/` | data |
| `src/ui/` | ui |
| `src/config/` | platform |
| `supabase/tests/` | data |

The platform agent is the only agent that edits `package.json`, `package-lock.json`, `app.config.js`, `eas.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `eslint.config.js`, `eslint/`, `jest.config.js`, `playwright.config.ts`, `.github/`, `.githooks/`, `scripts/`, and `supabase/migrations/`. Other agents do not add dependencies, change the Expo config, or write migrations. Ask the platform agent instead.

## Git

- Start from an up-to-date `main`: `git pull --rebase origin main`.
- Keep commits small and limited to the directory you own.
- Before pushing, `git pull --rebase origin main` again.
- If `main` CI is red, stop feature work and fix `main` first.

## Product boundaries

- `src/core` is pure TypeScript. No React, React Native, Expo, or Supabase.
- `src/data` is the only place that calls Supabase.
- Screens and feature UI take colors and sizes from `src/ui/theme.ts`. Do not write raw colors or sizes there.
- The product name and icon paths live in `src/config/brand.ts`. Do not hardcode the display name anywhere else.
- Record ids are client UUIDs. Retries reuse the same id.
- `local_day` is written once. Do not recompute history when the day-switch or timezone changes.
- No offline queue unless a task says so.
- Do not edit a migration that has already been applied. Add a new file under `supabase/migrations/`. The init migration is hosted version `20261027051825` (`supabase/migrations/20261027051825_init.sql`). After the connector applies a migration, rename the local file to that hosted version.
- UI copy is Chinese.
