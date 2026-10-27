import { readFileSync } from 'node:fs';

import { devices, expect, test, type Page } from '@playwright/test';

import { pngCorner } from '../scripts/render-pwa-icons.js';
import { brand } from '../src/config/brand';
import { pwaIcons, pwaManifest, pwaSplashes } from '../src/config/pwa';
import { darkColor, theme } from '../src/ui/theme';
import { accountingDay, authSession, installApi, signIn, weightRow } from './session';

const shell = 'http://127.0.0.1:4173';

test.use({ serviceWorkers: 'allow' });

test('manifest, icons, and the service worker are served as files', async ({ page }) => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    rewrites: { source: string; destination: string }[];
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  const swHeader = vercel.headers.find((item) => item.source === '/sw.js');
  expect(swHeader?.headers).toEqual(
    expect.arrayContaining([
      { key: 'Cache-Control', value: 'no-cache' },
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
    ]),
  );
  const iconHeader = vercel.headers.find((item) => item.headers.some((header) => header.value === 'image/png'));
  expect(iconHeader?.source).toBe('/icons/(.*\\.png$)');
  const pngOnly = new RegExp(String.raw`^/icons(?:/(.*\.png$))$`);
  expect(pngOnly.test('/icons/icon-192.png')).toBe(true);
  expect(pngOnly.test('/icons/maskable.json')).toBe(false);
  expect(pngOnly.test('/icons/.stamp')).toBe(false);
  const staticHeader = vercel.headers.find((item) => item.source === '/_expo/static/(.*)');
  expect(staticHeader?.headers).toEqual([
    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
  ]);
  const wellKnownHeader = vercel.headers.find((item) => item.source === '/.well-known/(.*)');
  expect(wellKnownHeader?.headers).toEqual([
    { key: 'Content-Type', value: 'application/json; charset=utf-8' },
  ]);

  const manifestResponse = await page.request.get('/manifest.webmanifest');
  expect(manifestResponse.status()).toBe(200);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  expect(manifestResponse.headers()['cache-control']).toContain('no-cache');
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject(pwaManifest);
  expect(manifest.name).toBe(brand.homeScreenName);
  expect(manifest.short_name).toBe(brand.homeScreenShortName);
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toBe(theme.color.paper);
  expect(manifest.background_color).toBe(theme.color.paper);
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png', purpose: 'maskable' }),
    ]),
  );

  const paperRgb = [
    Number.parseInt(theme.color.paper.slice(1, 3), 16),
    Number.parseInt(theme.color.paper.slice(3, 5), 16),
    Number.parseInt(theme.color.paper.slice(5, 7), 16),
    255,
  ];
  for (const icon of [pwaIcons.any192, pwaIcons.any512, pwaIcons.maskable512, pwaIcons.appleTouch]) {
    const iconResponse = await page.request.get(icon);
    expect(iconResponse.status(), icon).toBe(200);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
    expect(pngCorner(`public${icon}`), icon).toEqual(paperRgb);
  }
  const maskableReport = await page.request.get('/icons/maskable.json');
  expect(maskableReport.status()).toBe(200);
  expect(maskableReport.headers()['content-type']).toContain('application/json');
  expect(maskableReport.headers()['content-type']).not.toContain('image/png');

  const worker = await page.request.get('/sw.js');
  expect(worker.status()).toBe(200);
  expect(worker.headers()['content-type']).toContain('javascript');
  expect(worker.headers()['cache-control']).toContain('no-cache');
  const source = await worker.text();
  expect(source).toContain('skipWaiting');
  expect(source).toContain('CLEAR_RUNTIME_CACHE');
  expect(source).toContain('/.well-known/');
  expect(source.match(/const CACHE_NAME = '([^']+)'/)?.[1]).toMatch(/^shell-static-[0-9a-f]{12}$/);

  const assetLinks = await page.request.get('/.well-known/assetlinks.json');
  expect(assetLinks.status()).toBe(200);
  expect(assetLinks.headers()['content-type']).toContain('application/json');
  expect(await assetLinks.json()).toEqual([]);
  const association = await page.request.get('/.well-known/apple-app-site-association');
  expect(association.status()).toBe(200);
  expect(association.headers()['content-type'] ?? '').not.toContain('text/html');
  expect(JSON.parse(await association.text())).toMatchObject({ applinks: { details: [] } });

  const html = await (await page.request.get('/')).text();
  expect(html).toContain('apple-mobile-web-app-capable');
  expect(html).toContain('apple-mobile-web-app-status-bar-style');
  expect(html).toContain('content="default"');
  expect(html).toContain('viewport-fit=cover');
  expect(html).toContain('/manifest.webmanifest');
  expect(html).toContain('apple-touch-startup-image');
  expect(html).toContain(`content="${theme.color.paper}"`);
  expect(html).toContain(`content="${darkColor.paper}"`);
  expect(html).toContain('media="(prefers-color-scheme: light)"');
  expect(html).toContain('media="(prefers-color-scheme: dark)"');
  expect(html.match(/<meta[^>]*name="theme-color"/g)).toHaveLength(2);
  expect(html.match(/<meta name="apple-mobile-web-app-capable"/g)).toHaveLength(1);
  expect(html.match(/<link rel="manifest"/g)).toHaveLength(1);
  expect(html.match(/rel="icon"/g)).toHaveLength(1);
  expect(html.match(/src="\/pwa-head.js"/g)).toHaveLength(1);

  await page.goto('/');
  await expect(page.getByText('用邮箱登录')).toBeVisible();
  await expect.poll(async () => page.locator('meta[name="theme-color"]:not([media])').count()).toBe(0);
  expect(await page.locator('meta[name="theme-color"]').count()).toBe(2);
  expect(await page.locator('meta[name="apple-mobile-web-app-capable"]').count()).toBe(1);
  expect(await page.locator('link[rel="manifest"]').count()).toBe(1);
  expect(await page.locator('link[rel="apple-touch-startup-image"]').count()).toBe(pwaSplashes.length);

  await signIn(page);
  await installApi(page, { weights: [] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/me');
  await expect(page.getByText('在浏览器菜单里选择「添加到主屏幕」')).toBeVisible();
  const padding = await page.getByRole('button', { name: '今日' }).evaluate((node) => {
    let current: HTMLElement | null = node.parentElement;
    while (current) {
      if (current.style.paddingBottom.includes('safe-area-inset-bottom')) return current.style.paddingBottom;
      current = current.parentElement;
    }
    return '';
  });
  expect(padding).toContain('safe-area-inset-bottom');
});

test('iPhone explains the Safari share sheet', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 13'], baseURL: shell });
  const page = await context.newPage();
  await signIn(page);
  await installApi(page, { weights: [] });
  await page.goto('/me');
  await expect(page.getByText('在 Safari 点分享 → 添加到主屏幕')).toBeVisible();
  await context.close();
});

test('standalone hides the install row', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (query.includes('display-mode: standalone')) {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return false;
          },
        } as MediaQueryList;
      }
      return original(query);
    };
  });
  await signIn(page);
  await installApi(page, { weights: [] });
  await page.goto('/me');
  await expect(page.getByText('日切时间')).toBeVisible();
  await expect(page.getByText('添加到主屏幕')).toHaveCount(0);
});

test('supabase responses stay out of Cache Storage, and sign-out hides the previous person offline', async ({ page, context }) => {
  const day = accountingDay();
  const weights = [weightRow('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', day, 47.3)];
  let person = authSession();
  await installApi(page, { weights });
  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/logout')) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (url.includes('/user')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(person.user) });
      return;
    }
    if (url.includes('/token')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(person) });
      return;
    }
    await route.fallback();
  });
  await page.route('https://project.supabase.co/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'yifeng@example.com', weight_kg: 47.3 }),
    });
  });

  await page.goto('/');
  await page.evaluate((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, person);
  await page.reload();
  await expect(page.getByText('47.3').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.reload();
  await expect(page.getByText('47.3').first()).toBeVisible();

  const cacheName = (await (await page.request.get('/sw.js')).text()).match(/const CACHE_NAME = '([^']+)'/)?.[1];
  expect(cacheName).toMatch(/^shell-static-[0-9a-f]{12}$/);
  const cachedUrls = await page.evaluate(async (name) => {
    await fetch('/icons/icon-192.png?auth-probe=1', { headers: { Authorization: 'Bearer probe' } });
    await fetch('https://project.supabase.co/rest/v1/weight_records', {
      headers: { Authorization: 'Bearer probe', apikey: 'public' },
    });
    await fetch('/.well-known/assetlinks.json');
    const cache = await caches.open(name);
    await cache.put('/__user_probe', new Response('yifeng@example.com 47.3'));
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const opened = await caches.open(name);
      for (const request of await opened.keys()) urls.push(request.url);
    }
    return urls;
  }, cacheName);
  expect(cachedUrls.join('\n')).not.toMatch(/:54321|supabase\.co|auth-probe|\/\.well-known\//);

  await page.getByRole('button', { name: '我的' }).click();
  await expect(page.getByText('yifeng@example.com')).toBeVisible();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByText('用邮箱登录')).toBeVisible();
  await expect.poll(async () => cacheText(page)).not.toContain('__user_probe');
  await expect.poll(async () => cacheText(page)).not.toContain('yifeng@example.com');

  person = authSession({ userId: '22222222-2222-4222-8222-222222222222', email: 'bei@example.com' });
  weights.splice(0, weights.length, weightRow('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', day, 52.8));
  await page.evaluate((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, person);
  await page.goto('/');
  await expect(page.getByText('52.8').first()).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('body')).not.toContainText('47.3');
  await expect(page.locator('body')).not.toContainText('yifeng@example.com');
});

async function cacheText(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const found: string[] = [];
    for (const name of await caches.keys()) {
      const opened = await caches.open(name);
      for (const request of await opened.keys()) {
        found.push(`${request.url}\n${(await (await opened.match(request))?.text()) ?? ''}`);
      }
    }
    return found.join('\n');
  });
}
