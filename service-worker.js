const CACHE_NAME = "cognitive-interval-timer-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./themes/light.css",
  "./themes/dark.css",
  "./styles.css",
  "./content.js",
  "./core.js",
  "./view-model.js",
  "./ui-announce.js",
  "./ui-render.js",
  "./ui-controls.js",
  "./storage.js",
  "./audio.js",
  "./wake-lock.js",
  "./display-mode.js",
  "./timer-engine.js",
  "./a11y.js",
  "./app-controller.js",
  "./app.js",
  "./pwa.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

self.addEventListener("install", function installServiceWorker(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function cacheAppShell(cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function activateServiceWorker(event) {
  event.waitUntil(
    caches
      .keys()
      .then(function deleteOldCaches(keys) {
        return Promise.all(
          keys
            .filter(function isOldCache(key) {
              return key !== CACHE_NAME;
            })
            .map(function deleteCache(key) {
              return caches.delete(key);
            })
        );
      })
      .then(function claimClients() {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function cacheFirstForAppShell(event) {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(function serveCachedResponse(cached) {
      if (cached) return cached;

      return fetch(request)
        .then(function cacheNetworkResponse(response) {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then(function cacheResponse(cache) {
            cache.put(request, responseCopy);
          });
          return response;
        })
        .catch(function fallBackToShell() {
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return caches.match(request);
        });
    })
  );
});
