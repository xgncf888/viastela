/**
 * App-shell cache only.
 * Static JS, CSS, images, fonts, and index.html may be stored.
 * Supabase hosts, API paths, and any request with Authorization are never touched.
 * /.well-known/* is not intercepted.
 * Navigations and index.html are network-first so a new deploy replaces the old bundle.
 */
// Export rewrites this to shell-static-<revision> so activate drops the previous cache.
const CACHE_NAME = 'shell-static-v1';

const STATIC_FILE = /\.(?:js|css|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i;
const SUPABASE_PATH = /\/(?:auth|rest|functions|storage|realtime)\/v1(?:\/|$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(new Request('/', { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CLEAR_RUNTIME_CACHE') return;
  const port = event.ports?.[0];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => {
        port?.postMessage({ ok: true });
      }),
  );
});

function isSupabase(url) {
  const host = url.hostname;
  if (host === 'supabase.co' || host.endsWith('.supabase.co') || host.endsWith('.supabase.in')) return true;
  return SUPABASE_PATH.test(url.pathname);
}

function hasAuthorization(request) {
  return request.headers.has('authorization');
}

function isShell(url, request) {
  if (request.mode === 'navigate') return true;
  return url.pathname === '/' || url.pathname.endsWith('/index.html');
}

function isStaticAsset(url) {
  if (url.pathname === '/sw.js') return false;
  return STATIC_FILE.test(url.pathname);
}

function contentMatches(response, request, url) {
  if (!response || response.status !== 200 || response.type !== 'basic') return false;
  const type = (response.headers.get('content-type') || '').toLowerCase();
  if (isShell(url, request)) return type.includes('text/html');
  if (url.pathname.endsWith('.js')) return type.includes('javascript');
  if (url.pathname.endsWith('.css')) return type.includes('css');
  if (/\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) return type.startsWith('image/');
  if (/\.(?:woff2?|ttf|otf)$/i.test(url.pathname)) return type.includes('font') || type.includes('octet-stream');
  return false;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (contentMatches(response, request, url)) {
      const copy = response.clone();
      if (request.mode === 'navigate') {
        await cache.put(new Request(new URL('/index.html', self.location.origin).toString()), copy);
      } else {
        await cache.put(request, copy);
      }
    }
    return response;
  } catch (error) {
    if (request.mode === 'navigate') {
      const shell = (await cache.match('/index.html')) || (await cache.match('/'));
      if (shell) return shell;
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/.well-known/')) return;
  if (isSupabase(url)) return;
  if (hasAuthorization(event.request)) return;
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (!isShell(url, event.request) && !isStaticAsset(url)) return;
  event.respondWith(networkFirst(event.request));
});
