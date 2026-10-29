// Expo compiles this file, not its TypeScript imports. The hook below loads
// src/config/brand.ts so the display name and icon paths stay in one module.
const fs = require('fs');
const Module = require('module');
const ts = require('typescript');

if (!Module._extensions['.ts']) {
  Module._extensions['.ts'] = function loadTypeScript(module, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveTypeScript(request, parent, isMain, options) {
  if (parent?.filename?.endsWith('.ts') && request.startsWith('.')) {
    try {
      return resolveFilename.call(this, `${request}.ts`, parent, isMain, options);
    } catch {
      // A relative import can still be a directory or a .js file.
    }
  }
  return resolveFilename.call(this, request, parent, isMain, options);
};

const path = require('path');

const { brand, webDocumentTitle } = require('./src/config/brand.ts');
const { deleteAccountProductionOrigin } = require('./src/core/delete-account-origin.ts');
const { theme } = require('./src/ui/theme.ts');
const { pwaManifest, pwaSplashes } = require('./src/config/pwa.ts');
const { renderPwaIcons } = require('./scripts/render-pwa-icons.js');

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });
renderPwaIcons({
  source: path.join(publicDir, 'icons', 'apple-touch-icon.png'),
  outDir: path.join(publicDir, 'icons'),
  splashes: pwaSplashes,
  paper: theme.color.paper,
});
fs.writeFileSync(path.join(publicDir, 'manifest.webmanifest'), `${JSON.stringify(pwaManifest, null, 2)}\n`);

const updateUrl =
  process.env.EXPO_PUBLIC_EAS_UPDATE_URL ?? 'https://u.expo.dev/00000000-0000-0000-0000-000000000000';

const expoOwner = typeof process.env.EXPO_OWNER === 'string' ? process.env.EXPO_OWNER.trim() : '';
const easProjectId = typeof process.env.EAS_PROJECT_ID === 'string' ? process.env.EAS_PROJECT_ID.trim() : '';

function androidAuthAppLink() {
  const callbackPath = brand.authCallbackPath;
  if (typeof callbackPath !== 'string' || !callbackPath.startsWith('/') || callbackPath.includes('*') || callbackPath.includes('?')) {
    throw new Error('brand.authCallbackPath must be an exact path');
  }
  const url = new URL(callbackPath, deleteAccountProductionOrigin);
  if (url.origin !== deleteAccountProductionOrigin || url.pathname !== callbackPath || url.search || url.hash) {
    throw new Error('Android auth App Link must stay on the production origin and the exact callback path');
  }
  return {
    scheme: 'https',
    host: url.host,
    path: url.pathname,
  };
}

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: brand.displayName,
  slug: brand.slug,
  ...(expoOwner ? { owner: expoOwner } : {}),
  scheme: brand.scheme,
  version: '1.0.0',
  orientation: 'portrait',
  icon: brand.icon,
  userInterfaceStyle: 'automatic',
  backgroundColor: theme.color.paper,
  runtimeVersion: {
    policy: 'fingerprint',
  },
  updates: {
    url: updateUrl,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },
  ios: {
    bundleIdentifier: brand.iosBundleIdentifier,
    supportsTablet: true,
  },
  android: {
    package: brand.androidPackage,
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [androidAuthAppLink()],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    adaptiveIcon: {
      backgroundColor: theme.color.paper,
      foregroundImage: brand.androidForeground,
      backgroundImage: brand.androidBackground,
      monochromeImage: brand.androidMonochrome,
    },
  },
  web: {
    bundler: 'metro',
    // One index.html. vercel.json rewrites client routes onto it; the host still serves real files first.
    output: 'single',
    name: webDocumentTitle,
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-localization',
    'expo-notifications',
    [
      'expo-splash-screen',
      {
        backgroundColor: theme.color.paper,
        image: brand.splash,
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    eas: {
      projectId: easProjectId || undefined,
    },
  },
};

module.exports = config;
