import { defineConfig, devices, type Project } from '@playwright/test';

/**
 * DESIGN §14 「截图测试」: five screenshot viewports. They run only when SCREENSHOTS=1
 * (`npm run test:screenshots`, the non-gating screenshot workflow). Plain `playwright test`
 * keeps the one default project, so the e2e suite and its count do not change.
 */
export const SCREENSHOT_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

const screenshotProjects: Project[] = SCREENSHOT_VIEWPORTS.map(({ width, height }) => ({
  name: `screenshot-${width}x${height}`,
  testMatch: /screenshots\.spec\.ts$/,
  use: {
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'zh-CN',
    timezoneId: 'UTC',
  },
}));

const screenshots = process.env.SCREENSHOTS === '1';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
  },
  // Baselines come only from the CI Playwright container (§14). Local PNGs stay out of git.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  projects: screenshots
    ? screenshotProjects
    : [{ testIgnore: /screenshots\.spec\.ts$/ }],
  webServer: {
    command: 'node scripts/serve-web.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
