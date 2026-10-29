import { describe, expect, it } from '@jest/globals';

import { brand } from '@/config/brand';

import { deleteAccountProductionOrigin } from './delete-account-origin';
import {
  androidAuthCallbackPath,
  androidAuthLinkHost,
  androidConfigProblems,
  assetLinksPlaceholder,
  assetLinksProblems,
  easBuildFailure,
  expectedAndroidPackage,
  expectedExpoSlug,
  parseJsonStdout,
  readEasApkArtifact,
  supabasePublicEnvProblems,
  updateUrlProblem,
  vercelHostingProblems,
  type ResolvedExpoConfig,
} from './android-apk-preflight';

declare const require: (id: string) => { readFileSync: (path: string, encoding: 'utf8') => string };
declare const __dirname: string;

const { readFileSync } = require('node:fs');

const root = `${__dirname}/../..`;
const projectId = '11111111-2222-4333-8444-555555555555';
const fingerprint = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

function config(overrides: Partial<ResolvedExpoConfig> = {}): ResolvedExpoConfig {
  return {
    owner: 'expo-owner',
    slug: expectedExpoSlug,
    android: {
      package: expectedAndroidPackage,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: androidAuthLinkHost, path: androidAuthCallbackPath }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    extra: { eas: { projectId } },
    ...overrides,
  };
}

const privilegedRole = ['service', 'role'].join('_');

function jwt(role: string): string {
  const encode = (value: string) =>
    btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return `${encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${encode(JSON.stringify({ role }))}.signature`;
}

describe('android apk preflight', () => {
  it('locks the callback path to the production origin and the brand ids', () => {
    expect(brand.slug).toBe(expectedExpoSlug);
    expect(brand.androidPackage).toBe(expectedAndroidPackage);
    expect(brand.authCallbackPath).toBe(androidAuthCallbackPath);
    expect(brand.authCallbackPath.includes('*')).toBe(false);
    const url = new URL(brand.authCallbackPath, deleteAccountProductionOrigin);
    expect(url.origin).toBe(deleteAccountProductionOrigin);
    expect(url.host).toBe(androidAuthLinkHost);
    expect(url.pathname).toBe(androidAuthCallbackPath);
  });

  it('fails when owner, slug, package, project id, or the auth link is wrong', () => {
    expect(androidConfigProblems(config(), { owner: 'expo-owner', projectId })).toEqual([]);
    expect(androidConfigProblems(config(), { owner: '', projectId }).join('\n')).toContain('EXPO_OWNER');
    expect(androidConfigProblems(config({ owner: 'other' }), { owner: 'expo-owner', projectId }).join('\n')).toContain('owner');
    expect(androidConfigProblems(config({ slug: 'other' }), { owner: 'expo-owner', projectId }).join('\n')).toContain('slug');
    expect(
      androidConfigProblems(config({ android: { package: 'com.example.app', intentFilters: config().android?.intentFilters } }), {
        owner: 'expo-owner',
        projectId,
      }).join('\n'),
    ).toContain('android.package');
    expect(androidConfigProblems(config(), { owner: 'expo-owner', projectId: '00000000-0000-0000-0000-000000000000' }).join('\n')).toContain(
      'EAS_PROJECT_ID',
    );
    const widened = config();
    widened.android = {
      package: expectedAndroidPackage,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: '*.vercel.app', pathPrefix: '/' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    };
    const widenedProblems = androidConfigProblems(widened, { owner: 'expo-owner', projectId }).join('\n');
    expect(widenedProblems).toContain('exact path');
    expect(widenedProblems).toContain(androidAuthLinkHost);
  });

  it('rejects the fingerprint placeholder and accepts one real fingerprint', () => {
    const placeholder = [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: expectedAndroidPackage,
          sha256_cert_fingerprints: [assetLinksPlaceholder],
        },
      },
    ];
    expect(assetLinksProblems(placeholder).join('\n')).toContain('placeholder');
    expect(
      assetLinksProblems([
        {
          ...placeholder[0],
          target: { ...placeholder[0].target, sha256_cert_fingerprints: [fingerprint] },
        },
      ]),
    ).toEqual([]);
    expect(assetLinksProblems([{ ...placeholder[0], target: { ...placeholder[0].target, package_name: 'com.other' } }]).join('\n')).toContain(
      'package_name',
    );

    const committed = JSON.parse(readFileSync(`${root}/public/.well-known/assetlinks.json`, 'utf8')) as {
      target: { package_name: string; sha256_cert_fingerprints: string[] };
    }[];
    expect(committed[0].target.package_name).toBe(expectedAndroidPackage);
    const committedProblems = assetLinksProblems(committed);
    if (committed[0].target.sha256_cert_fingerprints[0] === assetLinksPlaceholder) {
      expect(committedProblems.join('\n')).toContain('placeholder');
    } else {
      expect(committedProblems).toEqual([]);
    }
  });

  it('requires JSON hosting without a redirect of the well-known file', () => {
    const vercel = JSON.parse(readFileSync(`${root}/vercel.json`, 'utf8')) as unknown;
    expect(vercelHostingProblems(vercel)).toEqual([]);
    expect(
      vercelHostingProblems({
        redirects: [{ source: '/.well-known/assetlinks.json', destination: '/' }],
        headers: [],
      }).join('\n'),
    ).toContain('must not redirect');
  });

  it('requires the public anon key and a real update URL when one is set', () => {
    expect(supabasePublicEnvProblems({ url: 'https://example.supabase.co', anonKey: jwt('anon') })).toEqual([]);
    expect(supabasePublicEnvProblems({ url: 'http://127.0.0.1:54321', anonKey: jwt('anon') }).join('\n')).toContain(
      'EXPO_PUBLIC_SUPABASE_URL',
    );
    expect(supabasePublicEnvProblems({ url: 'https://example.supabase.co', anonKey: jwt(privilegedRole) }).join('\n')).toContain('anon');
    expect(supabasePublicEnvProblems({ url: 'https://example.supabase.co', anonKey: '' }).join('\n')).not.toContain('eyJ');
    expect(updateUrlProblem(undefined)).toBeNull();
    expect(updateUrlProblem(`https://u.expo.dev/${projectId}`)).toBeNull();
    expect(updateUrlProblem('https://u.expo.dev/00000000-0000-0000-0000-000000000000')).toContain('EXPO_PUBLIC_EAS_UPDATE_URL');
  });

  it('parses expo config JSON and a finished APK build', () => {
    expect(parseJsonStdout('{"slug":"viastela"}')).toEqual({ slug: 'viastela' });
    expect(parseJsonStdout('env: loaded\n{"slug":"viastela"}\n')).toEqual({ slug: 'viastela' });
    expect(parseJsonStdout('queued\n[{"id":"build-1"}]\n')).toEqual([{ id: 'build-1' }]);
    const finished = {
      id: 'build-1',
      status: 'FINISHED',
      platform: 'ANDROID',
      appVersion: '1.0.0',
      appBuildVersion: '2',
      artifacts: {
        applicationArchiveUrl: 'https://expo.dev/artifacts/eas/app.apk',
        buildUrl: 'https://expo.dev/artifacts/eas/other.apk',
      },
    };
    expect(readEasApkArtifact([finished])?.archiveUrl).toBe('https://expo.dev/artifacts/eas/app.apk');
    expect(readEasApkArtifact({ ...finished, artifacts: { buildUrl: 'https://expo.dev/artifacts/eas/app.apk' } })?.appBuildVersion).toBe(
      '2',
    );
    expect(readEasApkArtifact({ ...finished, status: 'ERRORED' })).toBeNull();
    expect(easBuildFailure({ id: 'build-1', status: 'ERRORED' })).toContain('build-1');
    expect(easBuildFailure({ id: 'build-1', status: 'ERRORED' })).not.toContain('https://');
  });

  it('keeps the APK workflow manual and does not print the token', () => {
    const workflow = readFileSync(`${root}/.github/workflows/android-apk.yml`, 'utf8');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/^ {2}(push|pull_request):/m);
    expect(workflow).toContain('secrets.EXPO_TOKEN');
    expect(workflow).not.toMatch(/echo\s+.*\$EXPO_TOKEN/);
    expect(workflow).not.toMatch(/echo\s+.*secrets\.EXPO_TOKEN/);
    expect(workflow.indexOf('check-android-config.mjs')).toBeLessThan(workflow.indexOf('eas-cli'));
    expect(workflow).toContain("needs.gate.outputs.token == 'true'");
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).not.toMatch(/actions:\s*write/);
    const ignore = readFileSync(`${root}/.gitignore`, 'utf8');
    expect(ignore).toMatch(/^\*\.jks$/m);
    expect(ignore).toMatch(/^\*\.keystore$/m);
    expect(ignore).toMatch(/^credentials\.json$/m);
  });
});
