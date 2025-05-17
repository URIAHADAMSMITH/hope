// Service Worker for Earth PWA

const CACHE_NAME = 'earth-v1';
const STATIC_CACHE = 'earth-static-v1';
const DYNAMIC_CACHE = 'earth-dynamic-v1';
const API_CACHE = 'earth-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/map.js',
  '/js/issues.js',
  '/js/utils.js',
  '/js/api.js',
  '/js/config.js',
  '/manifest.json',
  '/assets/favicon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js',
  'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-brands-400.woff2'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      }),
      
      // Create other caches
      caches.open(DYNAMIC_CACHE),
      caches.open(API_CACHE)
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName.startsWith('earth-') &&
              ![STATIC_CACHE, DYNAMIC_CACHE, API_CACHE].includes(cacheName)
            );
          })
          .map((cacheName) => {
            return caches.delete(cacheName);
          })
      );
    })
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle different types of requests
  if (isStaticAsset(url)) {
    // Static assets - Cache First strategy
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isApiRequest(url)) {
    // API requests - Network First strategy
    event.respondWith(networkFirst(request, API_CACHE));
  } else {
    // Dynamic content - Network First strategy
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  }
});

// Cache First strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Network error occurred' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Network First strategy
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(cacheName);
    
    // Only cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(
      JSON.stringify({ error: 'Network error occurred' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Helper functions
function isStaticAsset(url) {
  return (
    STATIC_ASSETS.includes(url.pathname) ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  );
}

function isApiRequest(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.hostname === 'api.mapbox.com' ||
    url.hostname.endsWith('supabase.co')
  );
}

// Background sync for offline support
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-issues') {
    event.waitUntil(syncIssues());
  }
});

// Sync issues when back online
async function syncIssues() {
  try {
    const cache = await caches.open(API_CACHE);
    const requests = await cache.keys();
    
    const syncPromises = requests
      .filter(request => request.method === 'POST')
      .map(async (request) => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.delete(request);
          }
        } catch (error) {
          console.error('Error syncing request:', error);
        }
      });
    
    await Promise.all(syncPromises);
  } catch (error) {
    console.error('Error during sync:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/assets/icon-192.png',
    badge: '/assets/badge.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
}); 