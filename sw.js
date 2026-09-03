const CACHE_PREFIX = 'arena-sx-';
const CACHE_NAME = `${CACHE_PREFIX}v6-safe-shell`;
const APP_SHELL = new Set([
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-512-maskable.svg'
]);
const PRIVATE_PATH = /\/(api|auth|login|logout|admin|session|sessions|token|tokens|account|profile|me|supabase)(\/|\?|$)/i;
const SENSITIVE_QUERY_KEYS = new Set([
  'token','access_token','refresh_token','password','passwd','secret','session','auth','authorization','api_key','apikey','code','credential','credentials'
]);

function hasSensitiveQuery(url) {
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) return true;
  }
  return false;
}

function isSafeRequest(request) {
  if (
    request.method !== 'GET' ||
    request.headers.has('authorization') ||
    request.headers.has('cookie') ||
    request.headers.has('range') ||
    request.headers.has('if-range')
  ) return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin &&
    !PRIVATE_PATH.test(url.pathname) &&
    !url.origin.includes('supabase.co') &&
    !hasSensitiveQuery(url);
}

function isCacheableResponse(response) {
  if (!response || !response.ok || response.status === 206 || response.type === 'opaque' || response.redirected) return false;
  const cacheControl = (response.headers.get('cache-control') || '').toLowerCase();
  if (cacheControl.includes('private') || cacheControl.includes('no-store')) return false;
  if (response.headers.has('set-cookie') || response.headers.has('content-range')) return false;
  return true;
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all([...APP_SHELL].map(async path => {
    try {
      const response = await fetch(path, { credentials: 'omit', cache: 'no-store', redirect: 'error' });
      if (isCacheableResponse(response)) await cache.put(path, response.clone());
    } catch (_) {}
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (!isSafeRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store', redirect: 'error' })
        .then(response => response)
        .catch(() => caches.open(CACHE_NAME).then(cache => cache.match('./index.html')))
    );
    return;
  }

  const url = new URL(request.url);
  if (url.search) return;

  const scopePath = new URL(self.registration.scope).pathname;
  const relative = './' + url.pathname.slice(scopePath.length);
  if (!APP_SHELL.has(relative)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(relative);
      if (cached) return cached;
      try {
        const response = await fetch(request, { credentials: 'omit', cache: 'no-store', redirect: 'error' });
        if (isCacheableResponse(response)) await cache.put(relative, response.clone());
        return response;
      } catch (_) {
        return cached;
      }
    })
  );
});
