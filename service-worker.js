if (typeof importScripts === "function") {
  importScripts("./app-config.js", "./app-version.js", "./app-shell-assets.js");
}

const CACHE_PREFIX = self.PomodoroAppConfig.cachePrefix;
const APP_VERSION = self.PomodoroAppVersion;
const CACHE_VERSION = APP_VERSION.build || APP_VERSION.version || "local";
const CACHE_NAME = CACHE_PREFIX + "app-shell-" + CACHE_VERSION;
const REQUIRED_APP_SHELL = self.PomodoroAppShell.REQUIRED_APP_SHELL;
const OPTIONAL_APP_SHELL = self.PomodoroAppShell.OPTIONAL_APP_SHELL;
const APP_SHELL = self.PomodoroAppShell.APP_SHELL;

function serviceWorkerBaseUrl() {
  if (self.registration && self.registration.scope) return self.registration.scope;
  return new URL("./", self.location.href || self.location.origin + "/").href;
}

function appShellAssetUrl(asset) {
  return new URL(asset, serviceWorkerBaseUrl()).href;
}

const APP_SHELL_URLS = APP_SHELL.map(appShellAssetUrl);
const APP_SHELL_URL_SET = new Set(APP_SHELL_URLS);
const INDEX_URL = appShellAssetUrl("./index.html");

function isAppShellRequest(requestUrl) {
  return APP_SHELL_URL_SET.has(requestUrl.href);
}

function cacheOptionalAsset(cache, asset) {
  const assetUrl = appShellAssetUrl(asset);
  return fetch(assetUrl)
    .then(function cacheOptionalResponse(response) {
      if (!response || !response.ok) return false;
      return cache.put(assetUrl, response).then(function optionalCached() {
        return true;
      });
    })
    .catch(function ignoreOptionalCacheError() {
      return false;
    });
}

function cacheResponse(cacheKey, response) {
  if (!response || response.status !== 200 || response.type !== "basic") return response;
  const responseCopy = response.clone();
  return caches
    .open(CACHE_NAME)
    .then(function cacheFreshResponse(cache) {
      return cache.put(cacheKey, responseCopy).then(function cachedFreshResponse() {
        return response;
      });
    })
    .catch(function ignoreCacheWriteError() {
      return response;
    });
}

function offlineResponse(message) {
  return new Response(message, { status: 503, statusText: "Offline" });
}

function fetchNavigation(request) {
  return fetch(request)
    .then(function useFreshNavigation(response) {
      if (!response || !response.ok || response.type !== "basic") return response;
      return cacheResponse(INDEX_URL, response);
    })
    .catch(function fallBackToCachedShell() {
      return caches.match(INDEX_URL).then(function useCachedShell(cached) {
        return cached || offlineResponse("Offline app shell unavailable.");
      });
    });
}

function fetchAsset(request, requestUrl) {
  return fetch(request)
    .then(function useFreshAsset(response) {
      if (!isAppShellRequest(requestUrl)) return response;
      return cacheResponse(request, response);
    })
    .catch(function fallBackToCachedAsset() {
      return caches.match(request).then(function useCachedAsset(cached) {
        return cached || offlineResponse("Offline asset unavailable.");
      });
    });
}

function pruneCurrentAppShellCache() {
  const expectedUrls = new Set(APP_SHELL_URLS);
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
      return cache
        .addAll(REQUIRED_APP_SHELL.map(appShellAssetUrl))
        .then(function cacheOptionalShellAssets() {
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
    event.respondWith(fetchNavigation(request));
    return;
  }

  event.respondWith(fetchAsset(request, requestUrl));
});
