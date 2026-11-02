// TWC MedCRM Progressive Web App Service Worker (v6)
const CACHE_NAME = 'twc-medcrm-pwa-v6';

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

// 1. Install Event: Concurrent precache core shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((asset) =>
          fetch(asset)
            .then((res) => {
              if (res && res.status === 200) {
                return cache.put(asset, res);
              }
            })
            .catch(() => {})
        )
      );
    })
  );
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

// 3. Fetch Event: Reliable Cache-First for static assets without background request hanging
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Ignore non-HTTP/HTTPS schemes (e.g. chrome-extension, devtools, websockets)
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  // Navigation / HTML document requests
  const isNavigation = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone).catch(() => {});
            }).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          const matchDirect = await caches.match(event.request);
          if (matchDirect) return matchDirect;

          const matchIndex = await caches.match('./index.html') || await caches.match('./');
          if (matchIndex) return matchIndex;

          return new Response(
            '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>TWC MedCRM</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#0F3D3E;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;"><div style="max-width:400px;margin:0 auto;background:rgba(255,255,255,0.08);padding:30px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);"><h2 style="margin-bottom:10px;">TWC MedCRM</h2><p style="font-size:14px;color:rgba(255,255,255,0.7);line-height:1.5;">Offline cache active. Live clinical services require an internet connection.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // Static Assets (Cache-First, Network Fallback without background perpetual fetch)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone).catch(() => {});
            }).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => {
          return new Response('', { status: 408, statusText: 'Resource unavailable offline' });
        });
    })
  );
});
