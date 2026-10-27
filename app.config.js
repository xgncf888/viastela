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

const { brand } = require('./src/config/brand.ts');
const { theme } = require('./src/ui/theme.ts');

const updateUrl =
  process.env.EXPO_PUBLIC_EAS_UPDATE_URL ?? 'https://u.expo.dev/00000000-0000-0000-0000-000000000000';

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: brand.displayName,
  slug: brand.slug,
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
    adaptiveIcon: {
      backgroundColor: theme.color.paper,
      foregroundImage: brand.androidForeground,
      backgroundImage: brand.androidBackground,
      monochromeImage: brand.androidMonochrome,
    },
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: brand.favicon,
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
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
};

module.exports = config;
