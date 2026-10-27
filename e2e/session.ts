import type { Page, Route } from '@playwright/test';

export const userId = '11111111-1111-4111-8111-111111111111';

function unsignedJwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
}

export function authSession() {
  return {
    access_token: unsignedJwt({
      sub: userId,
      email: 'yifeng@example.com',
      role: 'authenticated',
      exp: 4_000_000_000,
    }),
    refresh_token: 'refresh-token',
    expires_at: 4_000_000_000,
    expires_in: 3_600,
    token_type: 'bearer',
    user: {
      id: userId,
      aud: 'authenticated',
      email: 'yifeng@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2026-10-24T00:00:00.000Z',
    },
  };
}

export function accountingDay(now = new Date()): string {
  const clock = new Date(now.getTime());
  if (clock.getUTCHours() < 4) clock.setUTCDate(clock.getUTCDate() - 1);
  return clock.toISOString().slice(0, 10);
}

export type WeightRow = {
  id: string;
  weight_kg: number;
  recorded_at: string;
  tz: string;
  local_day: string;
  updated_at: string;
};

export function weightRow(id: string, day: string, kilograms: number, hour = 8): WeightRow {
  const recordedAt = `${day}T${String(hour).padStart(2, '0')}:15:00.000Z`;
  return {
    id,
    weight_kg: kilograms,
    recorded_at: recordedAt,
    tz: 'UTC',
    local_day: day,
    updated_at: recordedAt,
  };
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'content-type': 'application/json',
};

export async function installApi(
  page: Page,
  options: { weights: WeightRow[]; onWrite?: (route: Route) => Promise<void> },
): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const api = url.includes('127.0.0.1:54321') || url.includes('localhost:54321');
    if (!api) {
      await route.continue();
      return;
    }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (url.includes('/rest/v1/weight_records') && request.method() !== 'GET') {
      if (options.onWrite) {
        await options.onWrite(route);
        return;
      }
      await route.fulfill({ status: 201, headers: cors, body: '[]' });
      return;
    }
    if (url.includes('/rest/v1/weight_records')) {
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(options.weights) });
      return;
    }
    if (url.includes('/rest/v1/profiles')) {
      await route.fulfill({
        status: 200,
        headers: cors,
        body: JSON.stringify({ user_id: userId, day_switch: '04:00:00' }),
      });
      return;
    }
    if (url.includes('/auth/v1/user')) {
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(authSession().user) });
      return;
    }
    if (url.includes('/auth/v1/token')) {
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(authSession()) });
      return;
    }
    await route.fulfill({ status: 200, headers: cors, body: '{}' });
  });
}

export async function signIn(page: Page): Promise<void> {
  await page.addInitScript((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, authSession());
}
