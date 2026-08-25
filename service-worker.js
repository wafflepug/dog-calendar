/* Waffle House Boarding — recovery service worker */

const WAFFLE_SW_VERSION = 'v11.1.83-search-avatar';
const WAFFLE_CACHE_PREFIX = 'waffle-house-';
const APP_SHELL_CACHE = `${WAFFLE_CACHE_PREFIX}shell-${WAFFLE_SW_VERSION}`;
const RUNTIME_CACHE = `${WAFFLE_CACHE_PREFIX}runtime-${WAFFLE_SW_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './directory.html',
  './reminders.html',
  './audit.html',
  './waffle-app.css?v=11.0.5',
  './waffle-app.js?v=11.0.5',
  './waffle-logo.png?v=11.1.24',
  './waffle-logo-dark.png?v=11.1.24',
  './manifest.webmanifest?v=11.1.24',
  './pwa-icon-192.png?v=11.1.24',
  './pwa-icon-512.png?v=11.1.24',
  './pwa-maskable-512.png?v=11.1.24',
  './pwa-apple-touch-icon.png?v=11.1.24',
  './waffle-firebase-config.js?v=11.1.4-recovery',
  './waffle-v10.8.css?v=11.0.5',
  './waffle-v10.8.js?v=11.0.5',
  './waffle-v10.8.2.css?v=11.0.5',
  './waffle-v10.8.2.js?v=11.0.5',
  './waffle-v10.8.3.css?v=11.0.5',
  './waffle-v10.8.3.js?v=11.0.5',
  './waffle-v10.8.5.css?v=11.0.5',
  './waffle-v10.8.5.js?v=11.0.5',
  './waffle-v10.8.6.css?v=11.0.5',
  './waffle-v10.8.6.js?v=11.0.5',
  './waffle-v10.8.7.css?v=11.0.5',
  './waffle-v10.8.8.css?v=11.0.5',
  './waffle-v10.8.8.js?v=11.0.5',
  './waffle-v10.8.9.css?v=11.0.5',
  './waffle-v10.8.9.js?v=11.0.5',
  './waffle-v11.0.css?v=11.0.5',
  './waffle-v11.0.js?v=11.0.5',
  './waffle-v11.0.3.css?v=11.0.5',
  './waffle-v11.0.4.js?v=11.0.5',

  /* The HTML pages still reference the historical V11.0.5 query string.
     Cache exact aliases so first-paint CSS and the shared loader stay current
     online and offline. */
  './waffle-v11.0.5.css?v=11.0.5',
  './waffle-v11.0.5.js?v=11.0.5',
  './waffle-v11.0.5.css?v=11.1.47',
  './waffle-v11.0.5.js?v=11.1.47',
  './waffle-v11.0.5.css?v=11.1.48',
  './waffle-v11.0.5.js?v=11.1.48',
  './waffle-v11.0.5-core.js?v=11.1.40',

  './waffle-v11.1.30.js?v=11.1.31',
  './waffle-v11.1.37-assets.js?v=11.1.47',
  './waffle-v11.1.37.js?v=11.1.47',
  './waffle-v11.1.38.js?v=11.1.47',
  './waffle-v11.1.39.js?v=11.1.47',
  './waffle-v11.1.40.js?v=11.1.47',
  './waffle-v11.1.45.js?v=11.1.47',
  './waffle-v11.1.47.js?v=11.1.47',
  './waffle-v11.1.48.js?v=11.1.48',
  './waffle-v11.1.53.js?v=11.1.53',
  './waffle-v11.1.58.js?v=11.1.58',
  './waffle-v11.1.60.js?v=11.1.60',
  './waffle-v11.1.61.js?v=11.1.61',
  './waffle-v11.1.66.js?v=11.1.66',
  './waffle-v11.1.67.js?v=11.1.67',
  './waffle-v11.1.68.js?v=11.1.68',
  './waffle-v11.1.69.js?v=11.1.69',
  './waffle-v11.1.70.js?v=11.1.70',
  './waffle-v11.1.71.js?v=11.1.71',
  './waffle-v11.1.75.js?v=11.1.75',
  './waffle-v11.1.76.js?v=11.1.76',
  './waffle-v11.1.80.js?v=11.1.80',
  './waffle-search-avatar-v1181.svg?v=11.1.82',
  './waffle-ui-contract.js?v=11.1.48',
  './waffle-ui-contract.js?v=11.1.51'
];

const OPTIONAL_EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.css',
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.js'
];

let waffleMessaging = null;

function waffleFirebaseConfigReady(config) {
  if (!config || typeof config !== 'object') return false;
  const required = [config.apiKey, config.projectId, config.messagingSenderId, config.appId, config.vapidKey];
  return required.every(value => {
    const text = String(value || '').trim();
    return text && !text.startsWith('PASTE_');
  });
}

try {
  importScripts('./waffle-firebase-config.js?v=11.1.4-recovery');
  const config = self.WAFFLE_FIREBASE_CONFIG || null;
  if (waffleFirebaseConfigReady(config)) {
    importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js');
    firebase.initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId
    });
    waffleMessaging = firebase.messaging();
    waffleMessaging.onBackgroundMessage(payload => {
      const data = payload && payload.data ? payload.data : {};
      self.registration.showNotification(data.title || '🐾 Waffle House', {
        body: data.body || 'Waffle House has an update.',
        icon: './pwa-icon-192.png?v=11.1.24',
        badge: './pwa-icon-192.png?v=11.1.24',
        tag: data.tag || data.category || 'waffle-update',
        renotify: true,
        data: { link: data.link || 'index.html' }
      });
    });
  }
} catch (error) {
  console.warn('Waffle push messaging is not configured yet:', error);
}

self.addEventListener('notificationclick', event => {
  const rawLink = event.notification && event.notification.data ? event.notification.data.link : '';
  if (!rawLink) return;
  event.notification.close();
  const targetUrl = new URL(rawLink, self.registration.scope).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const exact = windowClients.find(client => client.url === targetUrl);
      if (exact) return exact.focus();
      const sameScope = windowClients.find(client => client.url.startsWith(self.registration.scope));
      if (sameScope) return sameScope.navigate(targetUrl).then(() => sameScope.focus());
      return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    await cache.addAll(APP_SHELL);
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
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith(WAFFLE_CACHE_PREFIX) && key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
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

function isRecoveryCriticalAsset(url) {
  return url.origin === self.location.origin && url.pathname.endsWith('/waffle-firebase-config.js');
}

function isFirstPaintCriticalAsset(url) {
  return url.origin === self.location.origin && (
    url.pathname.endsWith('/waffle-v11.0.5.css') ||
    url.pathname.endsWith('/waffle-v11.0.5.js') ||
    url.pathname.endsWith('/waffle-v11.1.30.js') ||
    url.pathname.endsWith('/waffle-v11.1.40.js') ||
    url.pathname.endsWith('/waffle-v11.1.45.js') ||
    url.pathname.endsWith('/waffle-v11.1.47.js') ||
    url.pathname.endsWith('/waffle-v11.1.48.js') ||
    url.pathname.endsWith('/waffle-v11.1.53.js') ||
    url.pathname.endsWith('/waffle-v11.1.58.js') ||
    url.pathname.endsWith('/waffle-v11.1.60.js') ||
    url.pathname.endsWith('/waffle-v11.1.61.js') ||
    url.pathname.endsWith('/waffle-v11.1.66.js') ||
    url.pathname.endsWith('/waffle-v11.1.67.js') ||
    url.pathname.endsWith('/waffle-v11.1.68.js') ||
    url.pathname.endsWith('/waffle-v11.1.69.js') ||
    url.pathname.endsWith('/waffle-v11.1.70.js') ||
    url.pathname.endsWith('/waffle-v11.1.71.js') ||
    url.pathname.endsWith('/waffle-v11.1.75.js') ||
    url.pathname.endsWith('/waffle-v11.1.76.js') ||
    url.pathname.endsWith('/waffle-v11.1.80.js') ||
    url.pathname.endsWith('/waffle-today-avatar-v1178.svg') ||
    url.pathname.endsWith('/waffle-calendar-avatar-v1178.svg') ||
    url.pathname.endsWith('/waffle-care-avatar-v1178.svg') ||
    url.pathname.endsWith('/waffle-add-avatar-v1177.svg') ||
    url.pathname.endsWith('/waffle-notification-avatar-v1181.svg') ||
    url.pathname.endsWith('/waffle-search-avatar-v1181.svg') ||
    url.pathname.endsWith('/waffle-ui-contract.js')
  );
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const url = new URL(request.url);
    const file = url.pathname.split('/').pop() || 'index.html';
    const fallback = await caches.match(`./${file}`) || await caches.match('./index.html');
    if (fallback) return fallback;
    throw error;
  }
}

async function networkFirstStatic(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(response => {
      if (response && (response.ok || response.type === 'opaque')) {
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

  if (isOperationalDataRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isRecoveryCriticalAsset(url) || isFirstPaintCriticalAsset(url)) {
    event.respondWith(networkFirstStatic(request));
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const isJsDelivr = url.hostname === 'cdn.jsdelivr.net';
  if (sameOrigin || isJsDelivr) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});