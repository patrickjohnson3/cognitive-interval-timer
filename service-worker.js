const CACHE_PREFIX = "cognitive-interval-timer-";
const CACHE_NAME = CACHE_PREFIX + "app-shell";
const REQUIRED_APP_SHELL = [
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
];
const OPTIONAL_APP_SHELL = [
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-192.png",
  "./assets/icons/maskable-512.png",
];
const APP_SHELL = REQUIRED_APP_SHELL.concat(OPTIONAL_APP_SHELL);

function serviceWorkerBaseUrl() {
  if (self.registration && self.registration.scope) return self.registration.scope;
  return new URL("./", self.location.href || self.location.origin + "/").href;
}

function appShellAssetUrls() {
  const baseUrl = serviceWorkerBaseUrl();
  return APP_SHELL.map(function toAbsoluteAssetUrl(asset) {
    return new URL(asset, baseUrl).href;
  });
}

function cacheOptionalAsset(cache, asset) {
  return fetch(asset)
    .then(function cacheOptionalResponse(response) {
      if (!response || !response.ok) return false;
      return cache.put(asset, response).then(function optionalCached() {
        return true;
      });
    })
    .catch(function ignoreOptionalCacheError() {
      return false;
    });
}

function pruneCurrentAppShellCache() {
  const expectedUrls = new Set(appShellAssetUrls());
  return caches.open(CACHE_NAME).then(function pruneCache(cache) {
    return cache.keys().then(function deleteUnexpectedRequests(requests) {
      return Promise.all(
        requests
          .filter(function isUnexpectedRequest(request) {
            return !expectedUrls.has(request.url);
          })
          .map(function deleteUnexpectedRequest(request) {
            return cache.delete(request);
          })
      );
    });
  });
}

self.addEventListener("install", function installServiceWorker(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function cacheAppShell(cache) {
      return cache.addAll(REQUIRED_APP_SHELL).then(function cacheOptionalShellAssets() {
        return Promise.all(
          OPTIONAL_APP_SHELL.map(function eachOptionalAsset(asset) {
            return cacheOptionalAsset(cache, asset);
          })
        );
      });
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
              return key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME;
            })
            .map(function deleteCache(key) {
              return caches.delete(key);
            })
        );
      })
      .then(function pruneCurrentCache() {
        return pruneCurrentAppShellCache();
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
          if (!response || !response.ok || response.type !== "basic") {
            return response;
          }

          const responseCopy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(function cacheNavigation(cache) {
              return cache.put("./index.html", responseCopy);
            })
          );
          return response;
        })
        .catch(function fallBackToCachedShell() {
          return caches.match("./index.html").then(function useCachedShell(cached) {
            return (
              cached ||
              new Response("Offline app shell unavailable.", { status: 503, statusText: "Offline" })
            );
          });
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
          return (
            cached ||
            new Response("Offline asset unavailable.", { status: 503, statusText: "Offline" })
          );
        });
      })
  );
});
