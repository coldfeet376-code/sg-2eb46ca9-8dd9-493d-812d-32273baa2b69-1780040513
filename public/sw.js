// SERVICE WORKER DISABLED
// This file is kept for compatibility but does nothing
// The aggressive caching was preventing mobile browsers from getting updated code

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete all caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Don't intercept any fetch requests - let browser handle everything
self.addEventListener('fetch', (event) => {
  // Pass through - no caching
  return;
});