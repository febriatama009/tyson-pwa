// ============================================================
// TYSON PRISON WORKOUT — Service Worker
// Versi: 1.0.0
// Strategy: Cache First untuk assets, Network First untuk HTML
// ============================================================

const CACHE_NAME = 'tyson-prison-v1';
const OFFLINE_URL = './index.html';

// Asset yang di-cache saat install
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
];

// Font Google yang akan di-cache saat pertama kali diakses
const CACHE_DOMAINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ============================================================
// INSTALL — cache semua asset penting
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing Tyson Prison Workout v1...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching assets...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Install complete. Skipping waiting...');
        return self.skipWaiting();
      })
      .catch(err => console.error('[SW] Pre-cache failed:', err))
  );
});

// ============================================================
// ACTIVATE — hapus cache lama
// ============================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Now controlling all clients.');
      return self.clients.claim();
    })
  );
});

// ============================================================
// FETCH — strategi cache
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Google Fonts — Cache First (jarang berubah)
  if (CACHE_DOMAINS.some(d => url.hostname.includes(d))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // File lokal — Cache First, fallback ke network, fallback ke offline
  if (url.origin === location.origin || event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          // Tetap fetch di background untuk update (Stale-While-Revalidate)
          fetch(event.request)
            .then(response => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, response.clone());
                });
              }
            })
            .catch(() => {});
          return cached;
        }

        // Tidak ada di cache — fetch dari network
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return response;
          })
          .catch(() => {
            // Offline fallback
            if (event.request.destination === 'document') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
    );
    return;
  }
});

// ============================================================
// MESSAGE — handle skip waiting dari app
// ============================================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
