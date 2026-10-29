import { describe, expect, it } from '@jest/globals';

import { deleteAccountProductionOrigin } from './delete-account-origin';
import {
  appUpdateManifestUrl,
  appUpdateMessage,
  appUpdateRelease,
  checksAndroidAppUpdate,
  fetchAppUpdate,
  installedAndroidVersionCode,
  parseAppRelease,
  type AppRelease,
  type AppUpdateFetcher,
} from './android-apk';

const release: AppRelease = {
  versionCode: 3,
  versionName: '1.0.0',
  url: 'https://viastela.vercel.app/releases/app.apk',
  sha256: 'ab'.repeat(32),
};

function fetcher(result: { ok?: boolean; body?: unknown; throw?: boolean }): AppUpdateFetcher {
  return async () => {
    if (result.throw) throw new Error('offline');
    return {
      ok: result.ok ?? true,
      json: async () => {
        if (result.body === Symbol.for('bad-json')) throw new SyntaxError('bad json');
        return result.body;
      },
    };
  };
}

describe('android app update', () => {
  it('reads the production version manifest', () => {
    expect(appUpdateManifestUrl).toBe(`${deleteAccountProductionOrigin}/version.json`);
    expect(checksAndroidAppUpdate('android')).toBe(true);
    expect(checksAndroidAppUpdate('ios')).toBe(false);
    expect(checksAndroidAppUpdate('web')).toBe(false);
  });

  it('prompts only when the remote versionCode is newer', () => {
    expect(appUpdateRelease(2, release)).toEqual(release);
    expect(appUpdateRelease(3, release)).toBeNull();
    expect(appUpdateRelease(4, release)).toBeNull();
    expect(appUpdateMessage(release)).toBe('有新版本，可以下载安装。');
  });

  it('stays quiet for a bad manifest or an unreadable installed version', () => {
    expect(parseAppRelease(null)).toBeNull();
    expect(parseAppRelease([])).toBeNull();
    expect(parseAppRelease({ ...release, versionCode: '3' })).toBeNull();
    expect(parseAppRelease({ ...release, versionCode: 1.5 })).toBeNull();
    expect(parseAppRelease({ ...release, url: '' })).toBeNull();
    expect(parseAppRelease({ ...release, url: 'http://viastela.vercel.app/app.apk' })).toBeNull();
    expect(parseAppRelease({ ...release, sha256: 'abc' })).toBeNull();
    expect(parseAppRelease({ ...release, versionName: '' })).toBeNull();
    expect(parseAppRelease({ ...release, sha256: release.sha256.toUpperCase() })?.sha256).toBe(release.sha256);
    expect(installedAndroidVersionCode('12')).toBe(12);
    expect(installedAndroidVersionCode(12)).toBe(12);
    expect(installedAndroidVersionCode('')).toBeNull();
    expect(installedAndroidVersionCode('1.0.0')).toBeNull();
    expect(installedAndroidVersionCode(null)).toBeNull();
    expect(appUpdateRelease(Number.NaN, release)).toBeNull();
  });

  it('swallows fetch failures and bad JSON', async () => {
    await expect(fetchAppUpdate(1, fetcher({ throw: true }))).resolves.toBeNull();
    await expect(fetchAppUpdate(1, fetcher({ ok: false, body: release }))).resolves.toBeNull();
    await expect(fetchAppUpdate(1, fetcher({ body: Symbol.for('bad-json') }))).resolves.toBeNull();
    await expect(fetchAppUpdate(1, fetcher({ body: { versionCode: 0, versionName: '0.0.0', url: '', sha256: '' } }))).resolves.toBeNull();
    await expect(fetchAppUpdate(1, fetcher({ body: release }))).resolves.toEqual(release);
    await expect(fetchAppUpdate(3, fetcher({ body: release }))).resolves.toBeNull();
  });
});
