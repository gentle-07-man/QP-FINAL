const CACHE_NAME = 'qp-final-v3';
const urlsToCache = ['/', '/index.html', '/manifest.json', '/icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache v3 installed');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Firestore, Firebase, API requests kokhono cache korbe na - always network
  if (e.request.url.includes('firestore') || e.request.url.includes('firebase') || e.request.url.includes('fapi')) {
    return e.respondWith(fetch(e.request));
  }
  
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
