const CACHE_NAME = 'finance-omid-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './chatbot.html',
  './dashboard.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try { await cache.add(asset); } catch (err) { console.warn('Failed to cache:', asset); }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Bypass Network for Turso, Gemini, and Cloudflare Workers
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('turso.io') ||
    url.hostname.includes('generativelanguage.googleapis.com') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('pages.dev')
  ) {
    return;
  }

  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (url.pathname.includes('dashboard')) return caches.match('./dashboard.html');
        return caches.match('./index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => cachedResponse);
      return cachedResponse || fetchPromise;
    })
  );
});
