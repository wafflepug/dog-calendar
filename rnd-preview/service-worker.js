/* Release A R&D preview isolation worker.
 * This worker intentionally caches nothing and exists only to take control of
 * /rnd-preview/ with a narrower scope than the production Waffle PWA worker.
 */
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // No respondWith(): all R&D preview requests go directly to the network.
});
