// Warehouse Rota PWA Service Worker
const CACHE_NAME = 'warehouse-rota-v1';
const RUNTIME_CACHE = 'warehouse-rota-runtime';

// Files to cache immediately on install
const PRECACHE_URLS = [
  '/',
  '/staff',
  '/config',
  '/analytics',
  '/swaps',
  '/offline.html'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching files');
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache failed for some files:', err);
        // Continue even if some files fail
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache runtime files (JS, CSS, images)
          if (
            event.request.url.includes('/_next/') ||
            event.request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/)
          ) {
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return response;
        })
        .catch(() => {
          // Offline fallback
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html') || new Response('Offline');
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});