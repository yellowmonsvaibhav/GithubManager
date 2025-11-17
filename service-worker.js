const CACHE_NAME = "github-manager-v3";
const urlsToCache = [
  "/",
  "/dashboard.html",
  "/css/style.css",
  "/js/dashboard.js",
  "/js/homepage.js",
];

// Optional resources that might not always be available
const optionalUrls = ["/css/favicon.png", "/favicon.png", "/favicon.ico"];

// Install event - cache resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      // Cache essential resources first
      return Promise.allSettled(
        urlsToCache.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`Failed to cache ${url}:`, err);
            return null;
          })
        )
      ).then(() => {
        // Try to cache optional resources, but don't fail if they don't exist
        return Promise.allSettled(
          optionalUrls.map((url) =>
            fetch(url)
              .then((response) => {
                if (response.ok) {
                  return cache.put(url, response);
                }
                return null;
              })
              .catch((err) => {
                // Silently fail for optional resources
                console.debug(`Optional resource ${url} not available:`, err.message);
                return null;
              })
          )
        );
      });
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip service worker interception for:
  // - API requests (GitHub API, exchange endpoint)
  // - External resources
  // - Non-GET requests
  // - Service worker itself
  // - Favicon requests (let browser handle them natively)
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/exchange") ||
    url.pathname === "/service-worker.js" ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/favicon.png" ||
    url.hostname.includes("github.com") ||
    url.hostname.includes("api.github.com") ||
    request.method !== "GET"
  ) {
    // For these requests, don't intercept - let browser handle them
    // This prevents service worker errors for optional resources
    return;
  }

  // For same-origin requests, try cache first, then network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // Fetch from network with error handling
      return fetch(request)
        .then((response) => {
          // Don't cache if response is not ok
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          // Clone the response for caching
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch((error) => {
          console.warn("Fetch failed for:", request.url, error);
          // Return a basic offline page or error response
          if (request.destination === "document") {
            return caches.match("/dashboard.html") || new Response("Offline", { status: 503 });
          }
          return new Response("Network error", { status: 408 });
        });
    })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});
