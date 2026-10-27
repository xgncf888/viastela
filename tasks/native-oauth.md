# Native provider sign-in

- Status: todo
- Owner directory: src/features/auth
- Platform files touched: yes

## Outcome

iOS and Android sign in with Google and GitHub through an auth session, and iOS also offers Sign in with Apple before release. Web keeps `signInWithOAuth` and is unchanged.

## Steps

1. Start the provider with `WebBrowser.openAuthSessionAsync`.
2. Finish with `exchangeCodeForSession`.
3. Use the redirect `viastela://auth/callback`.
4. Add Sign in with Apple before the iOS release. It is required for that release.

## Done when

- [ ] Google and GitHub complete on iOS and Android and return to the app
- [ ] A cancelled session stays on login without creating a user
- [ ] Sign in with Apple is on the iOS login screen before release

## Out of scope

- Web provider buttons. Those already use `signInWithOAuth`.
- Deploying `delete-account`.
