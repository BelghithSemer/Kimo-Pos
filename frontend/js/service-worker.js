const CACHE_NAME = 'kimo-pos-v2';
const OFFLINE_ORDERS = 'offline-orders';
const urlsToCache = [
  '/',
  '/css/styles.css',
  '/js/main.js',
  '/js/auth.js',
  '/logo_kimo.png',
  '/manifest.json'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  // For API calls, use network-first strategy with offline fallback
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If network request succeeded, return it
          return response;
        })
        .catch(error => {
          // If network fails, try to get from cache for GET requests
          if (event.request.method === 'GET') {
            return caches.match(event.request);
          }
          // For POST/PUT/DELETE, we'll handle offline storage in main.js
          throw error;
        })
    );
  } else {
    // For static assets, use cache-first strategy
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request);
        })
    );
  }
});

// Background sync for offline orders
self.addEventListener('sync', event => {
  if (event.tag === 'sync-offline-orders') {
    event.waitUntil(syncOfflineOrders());
  }
});

// Sync offline orders when connection is restored
async function syncOfflineOrders() {
  // This would sync with your backend
  console.log('Syncing offline orders...');
  // In a real implementation, you would get orders from IndexedDB
  // and send them to your server
}