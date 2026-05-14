/* Murder Mitten Media — Service Worker
   Strategy:
   - Cache-first for static assets (JS, CSS, fonts, images)
   - Network-first for API calls and HTML pages
   - Offline fallback to cached homepage
*/

const CACHE_NAME = "mmm-v1";
const OFFLINE_URL = "/";

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API calls, OAuth, socket.io — always network
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/api/socket.io") ||
    url.pathname.startsWith("/api/trpc")
  ) {
    return;
  }

  // For navigation requests (HTML pages): network-first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(OFFLINE_URL) || caches.match("/");
        })
    );
    return;
  }

  // For static assets (JS, CSS, fonts, images): cache-first
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type === "error") {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
