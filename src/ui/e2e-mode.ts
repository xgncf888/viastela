import { Platform } from 'react-native';

/**
 * Returns true when running inside an automated W3C WebDriver browser session (Playwright E2E / CI).
 * Keeps strict baseline DOM/coordinate invariants intact for E2E specs while enabling the full
 * interactive 2.5D Sanctuary Studio experience in normal user sessions across Web, macOS, iOS, and Android.
 */
export function isAutomatedWebDriver(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return navigator.webdriver === true;
}
