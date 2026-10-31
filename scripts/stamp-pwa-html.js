const { execSync } = require('node:child_process');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

// `output: 'single'` writes Expo's stock index.html and does not render app/+html.tsx.
// This template is what Expo reads from public/index.html, so the first response is installable
// even when the host build command is `expo export` and does not run the post-export stamp.
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

const { brand, webDocumentTitle } = require('../src/config/brand.ts');
const { pwaIcons, pwaManifest, pwaSplashes, splashMedia, splashPath } = require('../src/config/pwa.ts');
const { darkColor } = require('../src/ui/theme.ts');

const CACHE_PLACEHOLDER = "const CACHE_NAME = 'shell-static-v1';";

function deployRevision() {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
  if (/^[0-9a-f]{12,}$/i.test(fromEnv)) return fromEnv.slice(0, 12).toLowerCase();
  const sha = execSync('git rev-parse --short=12 HEAD', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (!/^[0-9a-f]{12}$/i.test(sha)) {
    throw new Error(`pwa cache revision must be 12 hex characters, received ${sha}`);
  }
  return sha.toLowerCase();
}

function stampCacheName(file, revision = deployRevision()) {
  const source = fs.readFileSync(file, 'utf8');
  const next = source.replace(
    /const CACHE_NAME = 'shell-static-[^']*';/,
    `const CACHE_NAME = 'shell-static-${revision}';`,
  );
  if (next === source && !source.includes(`const CACHE_NAME = 'shell-static-${revision}';`)) {
    throw new Error(`CACHE_NAME assignment missing in ${file}`);
  }
  if (next !== source) fs.writeFileSync(file, next);
}

function restoreCachePlaceholder(file) {
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  const next = source.replace(/const CACHE_NAME = 'shell-static-[^']*';/, CACHE_PLACEHOLDER);
  if (next !== source) fs.writeFileSync(file, next);
}

function exportingWeb() {
  return process.argv.includes('export') || process.env.VERCEL === '1';
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function pwaHeadTags() {
  const lines = [
    `<meta name="theme-color" content="${pwaManifest.theme_color}" media="(prefers-color-scheme: light)" />`,
    `<meta name="theme-color" content="${darkColor.paper}" media="(prefers-color-scheme: dark)" />`,
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    `<meta name="apple-mobile-web-app-title" content="${escapeHtml(brand.webName)}" />`,
    '<link rel="manifest" href="/manifest.webmanifest" />',
    `<link rel="icon" href="${pwaIcons.svg}" type="image/svg+xml" />`,
    `<link rel="icon" href="${pwaIcons.ico}" sizes="32x32" />`,
    `<link rel="apple-touch-icon" href="${pwaIcons.appleTouch}" />`,
    ...pwaSplashes.map(
      (splash) =>
        `<link rel="apple-touch-startup-image" href="${splashPath(splash)}" media="${splashMedia(splash)}" />`,
    ),
    '<script src="/pwa-head.js"></script>',
  ];
  return lines.map((line) => `    ${line}`).join('\n');
}

function stripPwaHeadTags(html) {
  return html
    .replace(/[ \t]*<meta name="theme-color"[^>]*>\n?/g, '')
    .replace(/[ \t]*<meta name="apple-mobile-web-app-capable"[^>]*>\n?/g, '')
    .replace(/[ \t]*<meta name="apple-mobile-web-app-status-bar-style"[^>]*>\n?/g, '')
    .replace(/[ \t]*<meta name="apple-mobile-web-app-title"[^>]*>\n?/g, '')
    .replace(/[ \t]*<link rel="manifest"[^>]*>\n?/g, '')
    .replace(/[ \t]*<link rel="icon"[^>]*>\n?/g, '')
    .replace(/[ \t]*<link rel="apple-touch-icon"[^>]*>\n?/g, '')
    .replace(/[ \t]*<link rel="apple-touch-startup-image"[^>]*>\n?/g, '');
}

function applyDocumentTitle(html) {
  const title = `<title>${escapeHtml(webDocumentTitle)}</title>`;
  if (html.includes(title)) return html;
  return html.replace(/<title>[^<]*<\/title>/, title);
}

const RESET_STYLE = `    <style id="expo-reset">
      * {
        -webkit-tap-highlight-color: transparent;
      }
      /* These styles make the body full-height */
      html,
      body {
        height: 100%;
        background-color: #F7F4EC;
      }
      /* These styles disable body scrolling if you are using <ScrollView> */
      body {
        overflow: hidden;
        background-color: #F7F4EC;
      }
      /* These styles make the root element full-height */
      #root {
        display: flex;
        height: 100%;
        flex: 1;
        background-color: #F7F4EC;
      }
      #root [style*="rgb(242, 242, 242)"] {
        background-color: #F7F4EC !important;
      }
      @media (prefers-color-scheme: dark) {
        html,
        body,
        #root,
        #root [style*="rgb(242, 242, 242)"] {
          background-color: #141413 !important;
        }
      }
    </style>`;

function stampHtml(html) {
  let next = html.replace('<html lang="en">', '<html lang="zh-Hans">');
  if (!next.includes('viewport-fit=cover')) {
    next = next.replace(
      'width=device-width, initial-scale=1, shrink-to-fit=no',
      'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover',
    );
  }
  next = next.replace(/[ \t]*<style id="expo-reset">[\s\S]*?<\/style>/, RESET_STYLE);
  const tags = pwaHeadTags();
  if (next.includes(tags)) return next;
  next = stripPwaHeadTags(next);
  return next.replace('</head>', `${tags}\n  </head>`);
}

function publicIndexHtml() {
  return `<!DOCTYPE html>
<html lang="zh-Hans">
  <head>
    <meta charset="utf-8" />
    <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
    <title>%WEB_TITLE%</title>
${RESET_STYLE}
${pwaHeadTags()}
  </head>
  <body>
    <!-- Use static rendering with Expo Router to support running without JavaScript. -->
    <noscript> You need to enable JavaScript to run this app. </noscript>
    <!-- The root element for your Expo app. -->
    <div id="root"></div>
  </body>
</html>
`;
}

function preparePwaPublicFiles() {
  const htmlPath = path.resolve('public/index.html');
  const html = publicIndexHtml();
  if (!fs.existsSync(htmlPath) || fs.readFileSync(htmlPath, 'utf8') !== html) {
    fs.writeFileSync(htmlPath, html);
  }
  const worker = path.resolve('public/sw.js');
  if (exportingWeb() && fs.existsSync(worker)) stampCacheName(worker);
}

function stampExportedWeb() {
  const htmlPath = path.resolve('dist/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const stamped = applyDocumentTitle(stampHtml(html));
  if (stamped !== html) fs.writeFileSync(htmlPath, stamped);
  const worker = path.resolve('dist/sw.js');
  if (fs.existsSync(worker)) stampCacheName(worker);
  restoreCachePlaceholder(path.resolve('public/sw.js'));
}

module.exports = { preparePwaPublicFiles, stampHtml, pwaHeadTags };

if (require.main === module) {
  if (process.argv.includes('--prebuild')) {
    const { renderPwaIcons } = require('./render-pwa-icons.js');
    const { theme } = require('../src/ui/theme.ts');
    renderPwaIcons({
      source: path.resolve('public/icons/apple-touch-icon.png'),
      outDir: path.resolve('public/icons'),
      splashes: pwaSplashes,
      paper: theme.color.paper,
    });
  } else {
    stampExportedWeb();
  }
}
