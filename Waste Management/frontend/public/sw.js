/**
 * Safaai Sarathi - Self-Healing Cache Cleaner Service Worker
 * Automatically purges stale legacy caches and unregisters to prevent stale app shell caching.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Pass-through directly to network — never cache HTML or app shell
  event.respondWith(fetch(event.request));
});
