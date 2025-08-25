const CORE_CACHE_NAME = 'fuel-cost-calendar-core';
const DYNAMIC_CACHE_NAME = `dynamic-cache-${new Date().toISOString().slice(0, 10)}`;

const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'script.v2.js',
  'js/fuelTypes.js',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CORE_CACHE_NAME)
      .then(cache => {
        console.log('Opened core cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CORE_CACHE_NAME, DYNAMIC_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Stale-while-revalidate strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // If we get a valid response, we clone it and cache it for offline use.
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            const cacheName = urlsToCache.includes(event.request.url) ? CORE_CACHE_NAME : DYNAMIC_CACHE_NAME;
            caches.open(cacheName)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          return networkResponse;
        });

        // Return the cached response immediately, and the fetch promise will update the cache in the background.
        return cachedResponse || fetchPromise;
      })
      .catch(() => {
        // If both cache and network fail, this will be triggered.
        // You can return a fallback page here if you have one.
      })
  );
});
