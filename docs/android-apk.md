# Android preview APK

The installable package is an EAS preview build. The workflow is manual. It does not run on pull requests. Signing stays on EAS: this repo has no keystore, no `credentials.json`, and no token value.

## Run the workflow

GitHub → Actions → Android APK → Run workflow.

The job builds with:

```bash
npx eas-cli build --platform android --profile preview --non-interactive
```

`preview` in `eas.json` is an internal distribution on the `preview` channel, with `android.buildType` set to `apk`. The workflow uploads the APK and `sha256.txt`, and writes the sha256 in the job summary.

If the `EXPO_TOKEN` secret is missing, the build job is skipped and the workflow stays green. That secret is only read as an environment variable for the build step. Do not print it.

## What to set before the first green build

GitHub Actions, repository settings:

| Name | Kind | Value |
| --- | --- | --- |
| `EXPO_TOKEN` | Secret | Expo access token for the account that owns the project |
| `EXPO_OWNER` | Variable | Expo account slug. The workflow input `expo_owner` overrides it for one run |
| `EAS_PROJECT_ID` | Variable | Project UUID from `eas init` |
| `EXPO_PUBLIC_SUPABASE_URL` | Variable | Hosted `https` project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Variable | Public anon key. Not the service role |
| `EXPO_PUBLIC_EAS_UPDATE_URL` | Variable, optional | `https://u.expo.dev/<project-uuid>` once updates should reach the APK |

The check script fails the build job before `eas build` when the owner, slug (`viastela`), package (`com.viastela.app`), project id, auth App Link, anon-key role, or asset-link fingerprint is wrong.

The same public values must also exist on the EAS **preview** environment (`eas env:set --environment preview --visibility plaintext`). The build worker reads that environment, not the GitHub runner. Client values (`EXPO_PUBLIC_*`) have to be plaintext or sensitive. Secret visibility is not embedded in the app. Do not put `EXPO_TOKEN` or the service role in EAS env.

`eas.json` sets the preview profile's `environment` to `preview`, so the worker loads those variables. `app.config.js` reads `EXPO_OWNER` and `EAS_PROJECT_ID` from the environment. Neither value is committed.

## versionCode

`cli.appVersionSource` is `remote`. The preview profile sets `autoIncrement`. EAS stores `android.versionCode` and increases it on each preview build. The first build with no local `versionCode` starts at 1. Later preview builds are 2, 3, and so on. The user-facing `version` in `app.config.js` stays `1.0.0` until someone edits it. `autoIncrement` does not change that string. The counter is not a file in git, so a pull request cannot reset it, and the workflow token only has `contents: read`.

The production profile does not auto-increment yet. Turn that on before a store build so a production binary does not reuse the last preview `versionCode`.

## Fingerprint

`public/.well-known/assetlinks.json` ships with the placeholder `REPLACE_WITH_EAS_UPLOAD_KEY_SHA256`. The APK workflow fails while that placeholder is present, so it will not call `eas build` until the real fingerprint is committed. Normal CI does not run that check.

Create the keystore once, from a machine that has `EXPO_TOKEN` in the environment (do not commit the output):

```bash
npx eas-cli credentials -p android
```

Choose the preview profile and let EAS generate the keystore. Copy the SHA-256 certificate fingerprint (32 colon-separated uppercase hex bytes) into `sha256_cert_fingerprints`, commit `assetlinks.json`, and then run the workflow. That fingerprint is the upload certificate. It is not the APK file hash.

`https://viastela.vercel.app/.well-known/assetlinks.json` is a real file under `public/`. `vercel.json` sets `Content-Type: application/json` for `/.well-known/*` and has no redirect for that path. The host serves an existing file before the `/(.*)` rewrite to `index.html`.

## Auth App Link

The intent filter is `autoVerify` for exactly:

`https://viastela.vercel.app/auth/callback`

That path is `brand.authCallbackPath` (`/auth/callback`), the same path as the planned custom-scheme redirect `viastela://auth/callback`. The filter does not use a wildcard host or a path prefix.

This repository does not change the hosted Supabase redirect allow list. Add this exact URL there (no wildcard):

- `https://viastela.vercel.app/auth/callback`

## In-app update

On Android, the app fetches `https://viastela.vercel.app/version.json`. The shape is `{ versionCode, versionName, url, sha256 }`. A remote `versionCode` greater than the installed one shows a dismissible download prompt. The same or an older code shows nothing. A failed request or a body that does not match the shape shows nothing and does not crash. Web and iOS do not ask.

`public/version.json` starts at `versionCode` 0 with an empty url and sha256, so nobody is prompted before a real release.

After a workflow run:

1. Read `versionCode`, `versionName`, and the sha256 from the job summary. Confirm the sha256 with `sha256sum` on the artifact.
2. Put the APK at a stable `https` URL. The EAS artifact URL expires; do not leave that temporary URL in `version.json`.
3. Commit `public/version.json` with that `versionCode`, `versionName` (`1.0.0` until `app.config.js` changes), the stable URL, and the sha256. `versionCode` must be the one EAS just built, which is greater than the previous published value.
4. Deploy the site. The file is served as `application/json` with `Cache-Control: no-cache`.

## Reminders

Native builds do not show a reminder entry. That behavior is already on main (PR 20, merge `6852e82`). This APK setup does not change it.
