const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

// `output: 'single'` writes Expo's stock index.html and does not render app/+html.tsx.
// Stamp the tags into that file so the first response, before JavaScript, is installable.
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

const { brand } = require('../src/config/brand.ts');
const { pwaIcons, pwaManifest, pwaSplashes, splashMedia, splashPath } = require('../src/config/pwa.ts');

const htmlPath = path.resolve('dist/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace('<html lang="en">', '<html lang="zh-Hans">');
html = html.replace(
  'width=device-width, initial-scale=1, shrink-to-fit=no',
  'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover',
);

if (!html.includes('rel="manifest"')) {
  const tags = [
    `<meta name="theme-color" content="${pwaManifest.theme_color}" />`,
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    `<meta name="apple-mobile-web-app-title" content="${brand.homeScreenShortName}" />`,
    '<link rel="manifest" href="/manifest.webmanifest" />',
    `<link rel="apple-touch-icon" href="${pwaIcons.appleTouch}" />`,
    ...pwaSplashes.map(
      (splash) =>
        `<link rel="apple-touch-startup-image" href="${splashPath(splash)}" media="${splashMedia(splash)}" />`,
    ),
  ].join('');
  html = html.replace('</head>', `${tags}</head>`);
}

fs.writeFileSync(htmlPath, html);
