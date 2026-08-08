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

function expectedContentTypes(requestUrl) {
  const pathname = new URL(requestUrl, serviceWorkerBaseUrl()).pathname.toLowerCase();
  if (pathname.endsWith("/") || pathname.endsWith(".html")) return ["text/html"];
  if (pathname.endsWith(".js")) return ["text/javascript", "application/javascript"];
  if (pathname.endsWith(".css")) return ["text/css"];
  if (pathname.endsWith(".webmanifest")) return ["application/manifest+json", "application/json"];
  if (pathname.endsWith(".png")) return ["image/png"];
  if (pathname.endsWith(".svg")) return ["image/svg+xml"];
  return [];
}

function responseIsValidAppShellAsset(requestUrl, response) {
  if (!response || !response.ok || response.status !== 200 || response.type !== "basic") {
    return false;
  }
  const expected = expectedContentTypes(requestUrl);
  if (expected.length === 0) return false;
  const contentType = response.headers && response.headers.get("content-type");
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return expected.some(function contentTypeMatches(type) {
    return normalized.includes(type);
  });
}

function fetchAppShellResponse(request) {
  const requestUrl = request.url || request;
  return fetch(request).then(function validateAppShellResponse(response) {
    if (!responseIsValidAppShellAsset(requestUrl, response)) {
      throw new Error("Invalid app-shell response for " + requestUrl);
    }
    return response;
  });
}

function isAppShellRequest(requestUrl) {
  return APP_SHELL_URL_SET.has(requestUrl.href);
}

function cacheOptionalAsset(cache, asset) {
  const assetUrl = appShellAssetUrl(asset);
  return fetchAppShellResponse(assetUrl)
    .then(function cacheOptionalResponse(response) {
      return cache.put(assetUrl, response).then(function optionalCached() {
        return true;
      });
    })
    .catch(function ignoreOptionalCacheError() {
      return false;
    });
}

function cacheResponse(cacheKey, response) {
  const requestUrl = cacheKey.url || cacheKey;
  if (!responseIsValidAppShellAsset(requestUrl, response)) {
    return Promise.reject(new Error("Refusing invalid app-shell response for " + requestUrl));
  }
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
  return caches.match(INDEX_URL).then(function useCurrentShell(cached) {
    if (cached) return cached;
    return fetchAppShellResponse(request)
      .then(function cacheInitialNavigation(response) {
        return cacheResponse(INDEX_URL, response);
      })
      .catch(function navigationUnavailable() {
        return offlineResponse("Offline app shell unavailable.");
      });
  });
}

function fetchAppShellAsset(request) {
  return caches.match(request).then(function useCurrentAsset(cached) {
    if (cached) return cached;
    return fetchAppShellResponse(request)
      .then(function cacheInitialAsset(response) {
        return cacheResponse(request, response);
      })
      .catch(function assetUnavailable() {
        return offlineResponse("Offline asset unavailable.");
      });
  });
}

function fetchAsset(request, requestUrl) {
  if (isAppShellRequest(requestUrl)) return fetchAppShellAsset(request);
  return fetch(request);
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
      return Promise.all(
        REQUIRED_APP_SHELL.map(function fetchRequiredAsset(asset) {
          const assetUrl = appShellAssetUrl(asset);
          return fetchAppShellResponse(assetUrl).then(function pairRequiredResponse(response) {
            return { assetUrl, response };
          });
        })
      )
        .then(function cacheRequiredAssets(entries) {
          return Promise.all(
            entries.map(function cacheRequiredEntry(entry) {
              return cache.put(entry.assetUrl, entry.response);
            })
          );
        })
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
