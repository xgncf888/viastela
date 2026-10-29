import type { Page, Route } from '@playwright/test';

export const userId = '11111111-1111-4111-8111-111111111111';

function unsignedJwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
}

export function authSession(person?: { userId?: string; email?: string }) {
  const id = person?.userId ?? userId;
  const email = person?.email ?? 'yifeng@example.com';
  return {
    access_token: unsignedJwt({
      sub: id,
      email,
      role: 'authenticated',
      exp: 4_000_000_000,
    }),
    refresh_token: 'refresh-token',
    expires_at: 4_000_000_000,
    expires_in: 3_600,
    token_type: 'bearer',
    user: {
      id,
      aud: 'authenticated',
      email,
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

export type StudyRow = {
  id: string;
  topic: string;
  duration_minutes: number;
  note: string | null;
  recorded_at: string;
  tz: string;
  local_day: string;
  updated_at: string;
};

export type TrainingRow = {
  id: string;
  exercise: string;
  reps: number;
  weight_kg: number | null;
  band_level: string | null;
  recorded_at: string;
  tz: string;
  local_day: string;
  updated_at: string;
};

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

function idFromEq(url: string): string | null {
  const match = /(?:\?|&)id=eq\.([^&]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

function rememberStudy(rows: StudyRow[], body: string): void {
  try {
    const parsed = JSON.parse(body) as Partial<StudyRow> | Partial<StudyRow>[];
    const row = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!row?.id || !row.topic || !row.local_day) return;
    const next: StudyRow = {
      id: row.id,
      topic: row.topic,
      duration_minutes: row.duration_minutes ?? 0,
      note: row.note ?? null,
      recorded_at: row.recorded_at ?? new Date().toISOString(),
      tz: row.tz ?? 'UTC',
      local_day: row.local_day,
      updated_at: row.updated_at ?? row.recorded_at ?? new Date().toISOString(),
    };
    const index = rows.findIndex((item) => item.id === next.id);
    if (index === -1) rows.push(next);
    else rows[index] = next;
  } catch {
    // The spec still records the raw body when JSON is not a study record.
  }
}

function rememberTraining(rows: TrainingRow[], body: string): void {
  try {
    const parsed = JSON.parse(body) as Partial<TrainingRow> | Partial<TrainingRow>[];
    const row = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!row?.id || !row.exercise || !row.local_day) return;
    const next: TrainingRow = {
      id: row.id,
      exercise: row.exercise,
      reps: row.reps ?? 0,
      weight_kg: row.weight_kg ?? null,
      band_level: row.band_level ?? null,
      recorded_at: row.recorded_at ?? new Date().toISOString(),
      tz: row.tz ?? 'UTC',
      local_day: row.local_day,
      updated_at: row.updated_at ?? row.recorded_at ?? new Date().toISOString(),
    };
    const index = rows.findIndex((item) => item.id === next.id);
    if (index === -1) rows.push(next);
    else rows[index] = next;
  } catch {
    // The spec still records the raw body when JSON is not a set.
  }
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'content-type': 'application/json',
};

export async function installApi(
  page: Page,
  options: {
    weights: WeightRow[];
    training?: TrainingRow[];
    study?: StudyRow[];
    onWrite?: (route: Route) => Promise<void>;
    onSoftDelete?: (body: string) => void;
    onTrainingWrite?: (route: Route) => Promise<void>;
    onTrainingDelete?: (body: string) => void;
    onStudyWrite?: (route: Route) => Promise<void>;
    onStudyDelete?: (body: string) => void;
    emptyTrainingDelete?: boolean;
    emptyStudyDelete?: boolean;
  },
): Promise<void> {
  const trainingRows: TrainingRow[] = [...(options.training ?? [])];
  const studyRows: StudyRow[] = [...(options.study ?? [])];
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
      const body = request.postData() ?? '';
      if (request.method() === 'PATCH' && body.includes('deleted_at')) {
        options.onSoftDelete?.(`${url}\n${body}`);
        const id = idFromEq(url);
        await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(id ? [{ id }] : []) });
        return;
      }
      if (options.onWrite) {
        await options.onWrite(route);
        return;
      }
      await route.fulfill({ status: 201, headers: cors, body: '[]' });
      return;
    }
    if (url.includes('/rest/v1/weight_records')) {
      const single =
        (request.headers().accept ?? '').includes('vnd.pgrst.object') || url.includes('limit=1');
      const body = single
        ? JSON.stringify(
            [...options.weights].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0] ?? null,
          )
        : JSON.stringify(options.weights);
      await route.fulfill({ status: 200, headers: cors, body });
      return;
    }
    if (url.includes('/rest/v1/training_sets') && request.method() !== 'GET') {
      const body = request.postData() ?? '';
      if (request.method() === 'PATCH' && body.includes('deleted_at')) {
        options.onTrainingDelete?.(`${url}\n${body}`);
        const id = idFromEq(url);
        if (!options.emptyTrainingDelete && id) {
          const index = trainingRows.findIndex((row) => row.id === id);
          if (index >= 0) trainingRows.splice(index, 1);
        }
        const rows = options.emptyTrainingDelete || !id ? [] : [{ id }];
        await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(rows) });
        return;
      }
      rememberTraining(trainingRows, body);
      if (options.onTrainingWrite) {
        await options.onTrainingWrite(route);
        return;
      }
      await route.fulfill({ status: 201, headers: cors, body: '[]' });
      return;
    }
    if (url.includes('/rest/v1/training_sets')) {
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(trainingRows) });
      return;
    }
    if (url.includes('/rest/v1/study_records') && request.method() !== 'GET') {
      const body = request.postData() ?? '';
      if (request.method() === 'PATCH' && body.includes('deleted_at')) {
        options.onStudyDelete?.(`${url}\n${body}`);
        const id = idFromEq(url);
        if (!options.emptyStudyDelete && id) {
          const index = studyRows.findIndex((row) => row.id === id);
          if (index >= 0) studyRows.splice(index, 1);
        }
        const rows = options.emptyStudyDelete || !id ? [] : [{ id }];
        await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(rows) });
        return;
      }
      rememberStudy(studyRows, body);
      if (options.onStudyWrite) {
        await options.onStudyWrite(route);
        return;
      }
      await route.fulfill({ status: 201, headers: cors, body: '[]' });
      return;
    }
    if (url.includes('/rest/v1/study_records')) {
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(studyRows) });
      return;
    }
    if (url.includes('/rest/v1/push_subscriptions') && request.method() === 'GET') {
      await route.fulfill({ status: 200, headers: cors, body: '[]' });
      return;
    }
    if (url.includes('/rest/v1/account_balances') && request.method() === 'GET') {
      await route.fulfill({ status: 200, headers: cors, body: '[]' });
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
