const CACHE_NAME = 'arena-sx-v2';
const APP_SHELL = new Set([
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-512-maskable.svg'
]);
const PRIVATE_PATH = /\/(api|auth|login|logout|admin|session|sessions|token|tokens|account|profile|me|supabase)(\/|\?|$)/i;

function isSafeRequest(request) {
  if (request.method !== 'GET' || request.headers.has('authorization')) return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin && !PRIVATE_PATH.test(url.pathname) && !url.origin.includes('supabase.co');
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([...APP_SHELL])));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (!isSafeRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => caches.match('./index.html')));
    return;
  }

  const url = new URL(request.url);
  const scopePath = new URL(self.registration.scope).pathname;
  const relative = './' + url.pathname.slice(scopePath.length);
  if (!APP_SHELL.has(relative)) return;

  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
