// TWC MedCRM Progressive Web App Service Worker (v4)
const CACHE_NAME = 'twc-medcrm-pwa-v4';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './apple-touch-icon.png',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-192x192.png',
  './pwa-maskable-512x512.png'
];

// 1. Install Event: Pre-cache core shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache each asset safely
      for (const asset of PRECACHE_ASSETS) {
        try {
          const res = await fetch(asset, { cache: 'no-cache' });
          if (res && res.status === 200) {
            await cache.put(asset, res);
          }
        } catch (err) {
          console.warn('[PWA SW] Pre-cache skipped:', asset, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Chromium offline installability compliance
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Check if navigation / HTML request
  const isNavigation = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    // Network-first for navigation, falling back to cached shell
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
              cache.put('./index.html', networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback
          const directMatch = await caches.match(event.request);
          if (directMatch) return directMatch;

          const indexMatch = await caches.match('./index.html') || await caches.match('index.html');
          if (indexMatch) return indexMatch;

          // Search cache for any stored HTML page
          const cache = await caches.open(CACHE_NAME);
          const cachedRequests = await cache.keys();
          for (const req of cachedRequests) {
            if (req.url.endsWith('index.html') || req.url.endsWith('/')) {
              const res = await cache.match(req);
              if (res) return res;
            }
          }

          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>TWC MedCRM Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#0F3D3E;color:#fff;font-family:sans-serif;text-align:center;padding:40px 20px;"><h2>TWC MedCRM</h2><p>You are currently offline. Please reconnect to access live clinical services.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // Cache-first for images, fonts, and static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Revalidate in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith('http')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
