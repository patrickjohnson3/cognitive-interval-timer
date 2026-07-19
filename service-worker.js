const APP_VERSION = "2026.07.19-pwa.5";
const CACHE_NAME = "cognitive-interval-timer-" + APP_VERSION;
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
  "./haptics.js",
  "./wake-lock.js",
  "./display-mode.js",
  "./timer-engine.js",
  "./a11y.js",
  "./app-controller.js",
  "./app.js",
  "./pwa.js",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-192.png",
  "./assets/icons/maskable-512.png",
];

self.addEventListener("install", function installServiceWorker(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function cacheAppShell(cache) {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener("message", function handleServiceWorkerMessage(event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

self.addEventListener("fetch", function handleFetch(event) {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function useFreshNavigation(response) {
          const responseCopy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(function cacheNavigation(cache) {
              return cache.put("./index.html", responseCopy);
            })
          );
          return response;
        })
        .catch(function fallBackToCachedShell() {
          return caches.match("./index.html");
        })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(function useFreshAsset(response) {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseCopy = response.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then(function cacheResponse(cache) {
            return cache.put(request, responseCopy);
          })
        );
        return response;
      })
      .catch(function fallBackToCachedAsset() {
        return caches.match(request).then(function useCachedAsset(cached) {
          return cached || new Response("Offline asset unavailable.", { status: 503, statusText: "Offline" });
        });
      })
  );
});
