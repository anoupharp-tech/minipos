/**
 * MiniPOS Service Worker
 * Strategy: Cache-first for app shell, network-first for API
 * Offline: Sales queued in IndexedDB, synced on reconnect
 */

const CACHE_NAME = 'minipos-v1.0.2';
const API_ORIGIN = 'script.google.com';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/layout.css',
  './css/pos.css',
  './css/forms.css',
  './css/print.css',
  './css/receipt.css',
  './js/app.js',
  './js/state.js',
  './js/router.js',
  './js/api.js',
  './js/auth.js',
  './js/db.js',
  './js/sync.js',
  './js/i18n.js',
  './js/translations.js',
  './js/scanner.js',
  './js/barcode.js',
  './js/receipt.js',
  './js/utils.js',
  './js/views/login.js',
  './js/views/pos.js',
  './js/views/products.js',
  './js/views/categories.js',
  './js/views/stock.js',
  './js/views/barcodes.js',
  './js/views/reports.js',
  './js/views/settings.js',
  './js/views/users.js',
  './assets/images/logo-placeholder.png',
  './assets/images/product-placeholder.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can, ignore failures for individual assets
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => {
      console.log('[SW] Installed, skipping wait');
      return self.skipWaiting();
    })
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET for non-API (forms etc handled by app)
  if (request.method !== 'GET' && !url.hostname.includes(API_ORIGIN)) return;

  // GAS API: network-only (no caching of API responses)
  if (url.hostname.includes(API_ORIGIN)) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ status: 'error', error: 'Offline - no network', code: 503 }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // External CDN libraries: cache-first, network fallback
  if (url.hostname !== self.location.hostname && url.hostname !== 'localhost') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // App shell: cache-first, then network, then cache anything new
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback to index.html for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-sales') {
    console.log('[SW] Background sync triggered: sync-pending-sales');
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'SYNC_PENDING_SALES' })
        );
      })
    );
  }
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'MiniPOS', {
      body: data.body || '',
      icon: './assets/icons/icon-192.png',
      badge: './assets/icons/icon-192.png',
    })
  );
});

// ─── Message from page ────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
