/* Waffle House Boarding — V8.4 Service Worker */

const WAFFLE_SW_VERSION = 'v8.4.1.1';
const WAFFLE_CACHE_PREFIX = 'waffle-house-';
const APP_SHELL_CACHE = `${WAFFLE_CACHE_PREFIX}shell-${WAFFLE_SW_VERSION}`;
const RUNTIME_CACHE = `${WAFFLE_CACHE_PREFIX}runtime-${WAFFLE_SW_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './directory.html',
  './reminders.html',
  './audit.html',
  './waffle-app.css?v=8.4.1.1',
  './waffle-app.js?v=8.4.1.1',
  './waffle-logo.png',
  './manifest.webmanifest?v=8.4.1.1',
  './pwa-icon-192.png',
  './pwa-icon-512.png',
  './pwa-maskable-512.png',
  './pwa-apple-touch-icon.png'
];

const OPTIONAL_EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.css',
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      await cache.addAll(APP_SHELL);

      // Best-effort runtime seed. A CDN failure must never block installation.
      const runtime = await caches.open(RUNTIME_CACHE);

      await Promise.allSettled(
        OPTIONAL_EXTERNAL_ASSETS.map(async url => {
          const response = await fetch(url, { cache: 'reload' });

          if (response && (response.ok || response.type === 'opaque')) {
            await runtime.put(url, response.clone());
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith(WAFFLE_CACHE_PREFIX) &&
            key !== APP_SHELL_CACHE &&
            key !== RUNTIME_CACHE
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

function isOperationalDataRequest(url) {
  return (
    url.hostname === 'script.google.com' ||
    url.hostname === 'script.googleusercontent.com' ||
    url.hostname === 'docs.google.com' ||
    url.hostname === 'drive.google.com' ||
    url.hostname === 'lh3.googleusercontent.com' ||
    url.hostname.endsWith('.googleusercontent.com')
  );
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch (_) {
    const cached = await caches.match(request);

    if (cached) return cached;

    const url = new URL(request.url);
    const file = url.pathname.split('/').pop() || 'index.html';

    const fallback =
      await caches.match(`./${file}`) ||
      await caches.match('./index.html');

    if (fallback) return fallback;

    throw _;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkPromise =
    fetch(request)
      .then(response => {
        if (
          response &&
          (
            response.ok ||
            response.type === 'opaque'
          )
        ) {
          cache.put(request, response.clone()).catch(() => {});
        }

        return response;
      })
      .catch(() => null);

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }

  const network = await networkPromise;

  if (network) return network;

  throw new Error('Network unavailable and no cached asset exists.');
}

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Operational/user data stays out of Cache Storage.
  // IndexedDB stale-while-revalidate remains the source for cached app data.
  if (isOperationalDataRequest(url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirstNavigation(request)
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const isJsDelivr = url.hostname === 'cdn.jsdelivr.net';

  if (sameOrigin || isJsDelivr) {
    event.respondWith(
      staleWhileRevalidate(request)
    );
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
