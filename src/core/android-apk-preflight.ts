export const expectedExpoSlug = 'viastela';
export const expectedAndroidPackage = 'com.viastela.app';
export const androidAuthCallbackPath = '/auth/callback';
export const androidAuthLinkHost = 'viastela.vercel.app';
export const assetLinksPlaceholder = 'REPLACE_WITH_EAS_UPLOAD_KEY_SHA256';

const NIL_PROJECT_ID = '00000000-0000-0000-0000-000000000000';
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINGERPRINT = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/;
const UPDATE_URL = /^https:\/\/u\.expo\.dev\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResolvedExpoConfig = {
  owner?: unknown;
  slug?: unknown;
  android?: {
    package?: unknown;
    intentFilters?: unknown;
  };
  extra?: {
    eas?: {
      projectId?: unknown;
    };
  };
};

function shown(value: unknown): string {
  if (value == null || value === '') return '(missing)';
  if (typeof value === 'string') return value;
  return '(invalid)';
}

function dataEntries(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter((item) => item && typeof item === 'object') as Record<string, unknown>[];
  if (data && typeof data === 'object') return [data as Record<string, unknown>];
  return [];
}

function authLinkProblems(intentFilters: unknown): string[] {
  if (!Array.isArray(intentFilters) || intentFilters.length !== 1) {
    return ['android.intentFilters must contain one https auth callback filter.'];
  }
  const filter = intentFilters[0];
  if (!filter || typeof filter !== 'object') return ['android auth intent filter is missing.'];
  const record = filter as Record<string, unknown>;
  const problems: string[] = [];
  if (record.action !== 'VIEW') problems.push('android auth intent filter action must be VIEW.');
  if (record.autoVerify !== true) problems.push('android auth intent filter must set autoVerify.');
  const categories = Array.isArray(record.category) ? record.category : [record.category];
  if (!categories.includes('BROWSABLE') || !categories.includes('DEFAULT')) {
    problems.push('android auth intent filter categories must include BROWSABLE and DEFAULT.');
  }
  const entries = dataEntries(record.data);
  if (entries.length !== 1) {
    problems.push('android auth intent filter must list one data element.');
    return problems;
  }
  const data = entries[0];
  if (data.scheme !== 'https') problems.push('android auth intent filter scheme must be https.');
  if (data.host !== androidAuthLinkHost) problems.push(`android auth intent filter host must be ${androidAuthLinkHost}.`);
  if (data.path !== androidAuthCallbackPath) {
    problems.push(`android auth intent filter path must be ${androidAuthCallbackPath}.`);
  }
  if ('pathPrefix' in data || 'pathPattern' in data || 'pathAdvancedPattern' in data) {
    problems.push('android auth intent filter must use an exact path, not a prefix or pattern.');
  }
  if (typeof data.host === 'string' && (data.host.includes('*') || data.host.startsWith('.'))) {
    problems.push('android auth intent filter host must be exact.');
  }
  return problems;
}

export function androidConfigProblems(
  config: ResolvedExpoConfig,
  expected: { owner: string; projectId: string },
): string[] {
  const problems: string[] = [];
  const owner = expected.owner.trim();
  if (!owner) {
    problems.push('EXPO_OWNER is required. Set the EXPO_OWNER repository variable or the expo_owner workflow input.');
  } else if (config.owner !== owner) {
    problems.push(`owner is ${shown(config.owner)}; expected ${owner}.`);
  }
  if (config.slug !== expectedExpoSlug) {
    problems.push(`slug is ${shown(config.slug)}; expected ${expectedExpoSlug}.`);
  }
  if (config.android?.package !== expectedAndroidPackage) {
    problems.push(`android.package is ${shown(config.android?.package)}; expected ${expectedAndroidPackage}.`);
  }
  const projectId = expected.projectId.trim();
  if (!PROJECT_ID.test(projectId) || projectId.toLowerCase() === NIL_PROJECT_ID) {
    problems.push('EAS_PROJECT_ID must be the Expo project UUID. Set the EAS_PROJECT_ID repository variable.');
  } else if (config.extra?.eas?.projectId !== projectId) {
    problems.push('extra.eas.projectId does not match the EAS_PROJECT_ID repository variable.');
  }
  problems.push(...authLinkProblems(config.android?.intentFilters));
  return problems;
}

export function assetLinksProblems(document: unknown): string[] {
  if (!Array.isArray(document) || document.length !== 1) return ['assetlinks.json must contain one statement.'];
  const statement = document[0];
  if (!statement || typeof statement !== 'object') return ['assetlinks.json statement is missing.'];
  const record = statement as Record<string, unknown>;
  const target = record.target as Record<string, unknown> | undefined;
  const problems: string[] = [];
  const relation = record.relation;
  if (!Array.isArray(relation) || relation.length !== 1 || relation[0] !== 'delegate_permission/common.handle_all_urls') {
    problems.push('assetlinks relation must be delegate_permission/common.handle_all_urls.');
  }
  if (target?.namespace !== 'android_app') problems.push('assetlinks namespace must be android_app.');
  if (target?.package_name !== expectedAndroidPackage) {
    problems.push(`assetlinks package_name must be ${expectedAndroidPackage}.`);
  }
  const prints = target?.sha256_cert_fingerprints;
  if (!Array.isArray(prints) || prints.length !== 1 || typeof prints[0] !== 'string') {
    problems.push('assetlinks.json must list one sha256_cert_fingerprints entry.');
    return problems;
  }
  const fingerprint = prints[0];
  if (fingerprint === assetLinksPlaceholder || fingerprint.includes('REPLACE_WITH')) {
    problems.push(
      'assetlinks.json still has the placeholder SHA-256 fingerprint. After EAS creates the Android keystore, replace it with that certificate fingerprint.',
    );
    return problems;
  }
  if (!FINGERPRINT.test(fingerprint)) {
    problems.push('sha256_cert_fingerprints[0] must be 32 colon-separated uppercase hex bytes.');
  }
  return problems;
}

type HeaderDoc = {
  redirects?: { source?: string }[];
  headers?: { source?: string; headers?: { key?: string; value?: string }[] }[];
};

function headerValue(headers: HeaderDoc['headers'], source: string, key: string): string | null {
  const block = headers?.find((item) => item.source === source);
  const header = block?.headers?.find((item) => item.key === key);
  return header?.value ?? null;
}

export function vercelHostingProblems(vercel: unknown): string[] {
  if (!vercel || typeof vercel !== 'object') return ['vercel.json is missing.'];
  const doc = vercel as HeaderDoc;
  const problems: string[] = [];
  for (const redirect of doc.redirects ?? []) {
    const source = redirect.source ?? '';
    if (source.includes('well-known') || source.includes('assetlinks') || source.includes('version.json')) {
      problems.push('vercel.json must not redirect assetlinks.json or version.json.');
    }
  }
  const assetType = headerValue(doc.headers, '/.well-known/(.*)', 'Content-Type');
  if (!assetType?.toLowerCase().includes('application/json')) {
    problems.push('vercel.json must set Content-Type application/json for /.well-known/(.*).');
  }
  const versionType = headerValue(doc.headers, '/version.json', 'Content-Type');
  if (!versionType?.toLowerCase().includes('application/json')) {
    problems.push('vercel.json must set Content-Type application/json for /version.json.');
  }
  if (headerValue(doc.headers, '/version.json', 'Cache-Control') !== 'no-cache') {
    problems.push('vercel.json must set Cache-Control no-cache on /version.json.');
  }
  return problems;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = globalThis.atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
    const payload = JSON.parse(json) as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function supabasePublicEnvProblems(env: { url?: string; anonKey?: string }): string[] {
  const problems: string[] = [];
  const url = env.url?.trim() ?? '';
  let parsed: URL | null = null;
  try {
    parsed = url ? new URL(url) : null;
  } catch {
    parsed = null;
  }
  if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hostname === 'localhost') {
    problems.push(
      'EXPO_PUBLIC_SUPABASE_URL must be the hosted https URL. Set the GitHub variable and the EAS preview environment. Do not commit the value.',
    );
  }
  const payload = env.anonKey ? decodeJwtPayload(env.anonKey.trim()) : null;
  if (payload?.role !== 'anon') {
    problems.push(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY must be a JWT whose role is anon. Set the GitHub variable and the EAS preview environment. Do not commit the value.',
    );
  }
  return problems;
}

export function updateUrlProblem(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  if (!UPDATE_URL.test(trimmed) || trimmed.toLowerCase().endsWith(NIL_PROJECT_ID)) {
    return 'EXPO_PUBLIC_EAS_UPDATE_URL, when set, must be https://u.expo.dev/<project-uuid>.';
  }
  return null;
}

/** Parse a CLI stdout that is JSON, or logs followed by one JSON value. */
export function parseJsonStdout(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error('command printed nothing');
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    for (let index = trimmed.length - 1; index >= 0; index -= 1) {
      const char = trimmed[index];
      if (char !== '{' && char !== '[') continue;
      try {
        return JSON.parse(trimmed.slice(index)) as unknown;
      } catch {
        // A brace inside a log line is not the payload.
      }
    }
    throw new Error('command did not print JSON');
  }
}

export type EasApkArtifact = {
  id: string;
  archiveUrl: string;
  appVersion: string | null;
  appBuildVersion: string | null;
};

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('https://')) return null;
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readEasApkArtifact(payload: unknown): EasApkArtifact | null {
  const builds = Array.isArray(payload) ? payload : [payload];
  for (const item of builds) {
    const build = asRecord(item);
    if (!build) continue;
    if (build.platform != null && String(build.platform).toUpperCase() !== 'ANDROID') continue;
    if (String(build.status).toUpperCase() !== 'FINISHED') continue;
    if (typeof build.id !== 'string' || build.id.length === 0) continue;
    const artifacts = asRecord(build.artifacts);
    const archiveUrl = httpsUrl(artifacts?.applicationArchiveUrl) ?? httpsUrl(artifacts?.buildUrl);
    if (!archiveUrl) continue;
    return {
      id: build.id,
      archiveUrl,
      appVersion: typeof build.appVersion === 'string' ? build.appVersion : null,
      appBuildVersion: typeof build.appBuildVersion === 'string' ? build.appBuildVersion : null,
    };
  }
  return null;
}

export function easBuildFailure(payload: unknown): string {
  const builds = Array.isArray(payload) ? payload : [payload];
  const descriptions = builds.map((item) => {
    const build = asRecord(item);
    if (!build) return 'unreadable build result';
    const id = typeof build.id === 'string' ? build.id : '(missing id)';
    const status = typeof build.status === 'string' ? build.status : '(missing status)';
    const artifacts = asRecord(build.artifacts);
    const keys = artifacts ? Object.keys(artifacts).join(', ') : '(no artifacts)';
    return `build ${id} status ${status}; artifact fields: ${keys}`;
  });
  return `EAS did not return a finished Android APK. ${descriptions.join(' ')}`;
}
