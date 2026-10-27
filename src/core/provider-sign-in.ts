/** Google and GitHub buttons, and the divider under them, are web-only. */
export function showProviderSignIn(os: string): boolean {
  return os === 'web';
}
