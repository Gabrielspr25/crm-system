// Service Worker para forzar actualizaciones
const CACHE_VERSION = 'v5.1.13';

self.addEventListener('install', (event) => {
  // Forzar activación inmediata
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpiar caches viejos
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Tomar control inmediato
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // No cachear nada, siempre ir a la red
  event.respondWith(
    fetch(event.request).catch(() => {
      // Si falla la red, intentar del cache
      return caches.match(event.request);
    })
  );
});
