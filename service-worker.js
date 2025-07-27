// © 2025 Shibmap Project
// Licensed under CC BY-NC 4.0
// Service Worker with runtime tile caching for Carto Light

const APP_CACHE = 'Shibmap-v3';            // bump cache to force update
const TILE_CACHE = 'Shibmap-tiles-v1';     // runtime cache for basemap tiles

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=EB+Garamond&family=Noto+Serif+JP:wght@400;600&display=swap',
];

// Install: pre-cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Fetch: runtime cache for Carto tiles (network-first, cache fallback)
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // ignore non-GET

  const url = new URL(req.url);

  // Carto basemap tiles
  if (url.hostname.endsWith('basemaps.cartocdn.com')) {
    event.respondWith((async () => {
      try {
        const networkResp = await fetch(req);
        const cache = await caches.open(TILE_CACHE);
        cache.put(req, networkResp.clone());
        return networkResp;
      } catch (err) {
        const cache = await caches.open(TILE_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  // App shell & other requests: cache-first
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});

// Activate: clean up old caches and take control
self.addEventListener('activate', event => {
  const allow = new Set([APP_CACHE, TILE_CACHE]);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (allow.has(k) ? null : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});