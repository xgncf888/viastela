import { deleteAccountProductionOrigin } from './delete-account-origin';

/** Public manifest the installed Android app reads. The site serves `public/version.json`. */
export const appUpdateManifestUrl = `${deleteAccountProductionOrigin}/version.json`;

export type AppRelease = {
  versionCode: number;
  versionName: string;
  url: string;
  sha256: string;
};

export type AppUpdateFetcher = (url: string) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

const VERSION_NAME = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$/;
const SHA256 = /^[0-9a-f]{64}$/i;
const MAX_VERSION_CODE = 2_100_000_000;

function versionCode(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_VERSION_CODE) return null;
  return value;
}

function downloadUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** A release the app can offer. Incomplete or malformed JSON is not a release. */
export function parseAppRelease(value: unknown): AppRelease | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const code = versionCode(body.versionCode);
  const url = downloadUrl(body.url);
  if (code === null || url === null) return null;
  if (typeof body.versionName !== 'string' || !VERSION_NAME.test(body.versionName)) return null;
  if (typeof body.sha256 !== 'string' || !SHA256.test(body.sha256)) return null;
  return {
    versionCode: code,
    versionName: body.versionName,
    url,
    sha256: body.sha256.toLowerCase(),
  };
}

/**
 * The installed build's versionCode. Android reports it as a decimal string.
 * Anything else means "do not prompt".
 */
export function installedAndroidVersionCode(value: unknown): number | null {
  if (typeof value === 'number') return versionCode(value);
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  return versionCode(Number(value));
}

/** Prompt only when the remote versionCode is strictly newer. */
export function appUpdateRelease(installedVersionCode: number, remote: unknown): AppRelease | null {
  const installed = versionCode(installedVersionCode);
  const release = parseAppRelease(remote);
  if (installed === null || release === null || release.versionCode <= installed) return null;
  return release;
}

export function appUpdateMessage(release: AppRelease): string {
  return `有新版本 ${release.versionName}，可以下载安装。`;
}

export function checksAndroidAppUpdate(os: string): boolean {
  return os === 'android';
}

/** Network and JSON failures return null. They do not throw. */
export async function fetchAppUpdate(
  installed: number,
  fetchImpl: AppUpdateFetcher = (url) => fetch(url),
): Promise<AppRelease | null> {
  try {
    const response = await fetchImpl(appUpdateManifestUrl);
    if (!response.ok) return null;
    return appUpdateRelease(installed, await response.json());
  } catch {
    return null;
  }
}
