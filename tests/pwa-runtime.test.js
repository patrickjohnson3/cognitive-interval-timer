const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createElementFactory } = require("./helpers/dom.js");
const assert = require("node:assert/strict");
const test = require("node:test");

function readProjectFile(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

function currentServiceWorkerCacheName() {
  const appConfig = require("../app-config.js");
  const appVersion = require("../app-version.js");

  return appConfig.cachePrefix + "app-shell-" + appVersion.build;
}

function loadServiceWorkerRuntime(options) {
  const config = options || {};
  const listeners = {};
  const cached = new Map(config.cached || []);
  const cacheWrites = [];
  const fetchCalls = [];
  const context = {
    Promise,
    Response,
    URL,
    fetch: function fetch(request) {
      fetchCalls.push(request.url || request);
      if (config.fetchError) return Promise.reject(config.fetchError);
      if (typeof config.fetchResponse === "function")
        return Promise.resolve(config.fetchResponse(request));
      return Promise.resolve({
        ok: true,
        status: 200,
        type: "basic",
        headers: {
          get: function getHeader() {
            const url = request.url || request;
            if (String(url).endsWith(".js")) return "text/javascript";
            if (String(url).endsWith(".json")) return "application/json";
            return "text/html";
          },
        },
        clone: function clone() {
          return this;
        },
      });
    },
    caches: {
      keys: function keys() {
        return Promise.resolve([]);
      },
      delete: function deleteCache() {
        return Promise.resolve(true);
      },
      match: function match(request) {
        return Promise.resolve(cached.get(request.url || request) || null);
      },
      open: function openCache() {
        return Promise.resolve({
          addAll: function addAll() {
            return Promise.resolve();
          },
          keys: function keys() {
            return Promise.resolve([]);
          },
          put: function put(request, response) {
            if (config.cachePutError) return Promise.reject(config.cachePutError);
            cacheWrites.push(request.url || request);
            cached.set(request.url || request, response);
            return Promise.resolve();
          },
          delete: function deleteRequest() {
            return Promise.resolve(true);
          },
        });
      },
    },
    self: {
      skipWaiting: function skipWaiting() {
        if (config.skipWaitingError) return Promise.reject(config.skipWaitingError);
        return Promise.resolve();
      },
      clients: {
        claim: function claim() {
          return Promise.resolve();
        },
      },
      addEventListener: function addEventListener(type, handler) {
        listeners[type] = handler;
      },
      location: {
        href: "https://example.test/service-worker.js",
        origin: "https://example.test",
      },
      registration: {
        scope: "https://example.test/",
      },
    },
  };

  vm.runInNewContext(readProjectFile("app-config.js"), context, {
    filename: "app-config.js",
  });
  vm.runInNewContext(readProjectFile("app-shell-assets.js"), context, {
    filename: "app-shell-assets.js",
  });
  vm.runInNewContext(readProjectFile("app-version.js"), context, {
    filename: "app-version.js",
  });
  vm.runInNewContext(readProjectFile("service-worker.js"), context, {
    filename: "service-worker.js",
  });

  return { cacheWrites, cached, fetchCalls, listeners };
}

function runFetch(runtime, request) {
  let responsePromise = null;
  const waitUntilPromises = [];
  runtime.listeners.fetch({
    request: Object.assign({ method: "GET", mode: "same-origin" }, request),
    respondWith: function respondWith(promise) {
      responsePromise = promise;
    },
    waitUntil: function waitUntil(promise) {
      waitUntilPromises.push(promise);
    },
  });
  return responsePromise.then(function waitForResponse(response) {
    return Promise.all(waitUntilPromises).then(function returnResponse() {
      return response;
    });
  });
}

function flushPromises() {
  return new Promise(function resolveSoon(resolve) {
    setTimeout(resolve, 0);
  });
}

function loadPWA(options) {
  const config = options || {};
  const nodes = {};
  const bodyChildren = [];
  const listeners = {};
  const reloads = [];
  const timeouts = new Map();
  let nextTimeoutId = 1;
  const slot = {
    id: "pwa-install-slot",
    hidden: true,
    children: [],
    appendChild: function appendChild(child) {
      this.children.push(child);
      if (child.id) nodes[child.id] = child;
      child.children.forEach(function registerDescendant(descendant) {
        if (descendant.id) nodes[descendant.id] = descendant;
      });
    },
  };
  nodes[slot.id] = slot;
  nodes.theme = {
    id: "theme",
    focusCount: 0,
    focus: function focus() {
      this.focusCount += 1;
    },
  };
  nodes["pwa-update-indicator"] = {
    id: "pwa-update-indicator",
    hidden: true,
  };
  nodes["open-settings"] = {
    id: "open-settings",
    attributes: {},
    setAttribute: function setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute: function getAttribute(name) {
      return this.attributes[name];
    },
  };

  const registration = config.registration || {};
  const navigatorRef = {
    platform: config.platform || "",
    userAgent: config.userAgent || "",
    maxTouchPoints: config.maxTouchPoints || 0,
    standalone: Boolean(config.standalone),
  };
  if (config.serviceWorkerSupported !== false) {
    navigatorRef.serviceWorker = {
      controller: config.controlled ? {} : null,
      addEventListener: function addServiceWorkerListener(type, handler) {
        listeners["serviceWorker:" + type] = handler;
      },
      register: function registerServiceWorker() {
        if (config.registrationError) return Promise.reject(config.registrationError);
        return Promise.resolve(registration);
      },
    };
  }

  const context = {
    console,
    document: {
      body: {
        appendChild: function appendBodyChild(child) {
          bodyChildren.push(child);
        },
      },
      createElement: createElementFactory(nodes),
      getElementById: function getElementById(id) {
        return nodes[id] || null;
      },
    },
    navigator: navigatorRef,
    window: {
      addEventListener: function addWindowListener(type, handler) {
        listeners["window:" + type] = handler;
      },
      location: {
        reload: function reload() {
          reloads.push(true);
        },
      },
      matchMedia: function matchMedia(query) {
        return { matches: Boolean(config.displayModes && config.displayModes[query]) };
      },
      confirm: function confirm(message) {
        if (config.confirmations) config.confirmations.push(message);
        return config.confirmResult !== false;
      },
      setTimeout: function setTimeout(callback) {
        const id = nextTimeoutId;
        nextTimeoutId += 1;
        timeouts.set(id, callback);
        return id;
      },
      clearTimeout: function clearTimeout(id) {
        timeouts.delete(id);
      },
    },
  };
  context.self = context;

  vm.runInNewContext(readProjectFile("pwa-prompts.js"), context, { filename: "pwa-prompts.js" });
  context.window.PomodoroPWAPrompts = context.PomodoroPWAPrompts;
  vm.runInNewContext(readProjectFile("pwa.js"), context, { filename: "pwa.js" });
  return { bodyChildren, listeners, nodes, registration, reloads, slot, timeouts };
}

test("PWA update prompt renders in settings slot and posts skip-waiting", async function () {
  const messages = [];
  const registration = {
    waiting: {
      postMessage: function postMessage(message) {
        messages.push(message);
      },
    },
    addEventListener: function addEventListener() {},
  };
  const runtime = loadPWA({
    registration,
    displayModes: {
      "(display-mode: standalone)": true,
    },
  });

  runtime.listeners["window:load"]();
  await flushPromises();

  const card = runtime.nodes["pwa-update"];
  const button = runtime.nodes["pwa-update-button"];
  assert(
    runtime.bodyChildren.length === 0,
    "update prompt should not append a floating body button"
  );
  assert(runtime.slot.hidden === false, "expected prompt slot to be visible");
  assert(card && card.className === "pwa-prompt-card", "expected update prompt card");
  assert(
    card.children[0].textContent === "A newer version is ready.",
    "expected update prompt copy"
  );
  assert.equal(card.children[0].attributes.role, "status");
  assert.equal(card.children[0].attributes["aria-live"], "polite");
  assert(button && button.textContent === "Update", "expected update button");
  assert.equal(runtime.nodes["pwa-update-indicator"].hidden, false);
  assert.equal(
    runtime.nodes["open-settings"].attributes["aria-describedby"],
    "pwa-update-indicator"
  );

  button.listeners.click();
  assert(button.disabled === true, "expected update button to disable after click");
  assert(
    messages.length === 1 && messages[0].type === "SKIP_WAITING",
    "expected skip-waiting message"
  );

  runtime.listeners["serviceWorker:controllerchange"]();
  assert(runtime.reloads.length === 1, "expected accepted update to reload once");
});

test("first service worker control does not reload the app", function () {
  const runtime = loadPWA();

  runtime.listeners["serviceWorker:controllerchange"]();

  assert(runtime.reloads.length === 0, "expected initial service worker control not to reload");
});

test("PWA update does not discard dirty settings without confirmation", async function () {
  const messages = [];
  const confirmations = [];
  const registration = {
    waiting: {
      postMessage: function postMessage(message) {
        messages.push(message);
      },
    },
    addEventListener: function addEventListener() {},
  };
  const runtime = loadPWA({
    registration,
    controlled: true,
    confirmResult: false,
    confirmations,
  });
  runtime.nodes["open-settings"].setAttribute("data-dirty", "true");
  runtime.listeners["window:load"]();
  await flushPromises();

  runtime.nodes["pwa-update-button"].listeners.click();

  assert.equal(confirmations.length, 1);
  assert.equal(messages.length, 0);
  assert.equal(runtime.nodes["pwa-update-button"].disabled, false);
});

test("an update activated by another client reloads a clean page", function () {
  const runtime = loadPWA({ controlled: true });

  runtime.listeners["serviceWorker:controllerchange"]();

  assert.equal(runtime.reloads.length, 1);
});

test("an update activated by another client defers reload for dirty settings", function () {
  const confirmations = [];
  const runtime = loadPWA({ controlled: true, confirmations });
  runtime.nodes["open-settings"].setAttribute("data-dirty", "true");

  runtime.listeners["serviceWorker:controllerchange"]();

  assert.equal(runtime.reloads.length, 0);
  assert.equal(runtime.nodes["pwa-update-button"].textContent, "Reload");
  runtime.nodes["pwa-update-button"].listeners.click();
  assert.equal(confirmations.length, 1);
  assert.equal(runtime.reloads.length, 1);
});

test("PWA update click tolerates a missing waiting worker", async function () {
  const registration = {
    waiting: {
      postMessage: function postMessage() {},
    },
    addEventListener: function addEventListener() {},
  };
  const runtime = loadPWA({
    registration,
    displayModes: {
      "(display-mode: standalone)": true,
    },
  });

  runtime.listeners["window:load"]();
  await flushPromises();
  registration.waiting = null;

  runtime.nodes["pwa-update-button"].listeners.click();
  assert(
    runtime.nodes["pwa-update-button"].disabled === false,
    "button should not disable without a waiting worker"
  );
});

test("PWA update click recovers when worker messaging fails", async function () {
  const registration = {
    waiting: {
      postMessage: function postMessage() {
        throw new Error("worker became redundant");
      },
    },
    addEventListener: function addEventListener() {},
  };
  const runtime = loadPWA({ registration });

  runtime.listeners["window:load"]();
  await flushPromises();
  runtime.nodes["pwa-update-button"].listeners.click();

  assert.equal(runtime.nodes["pwa-update-button"].disabled, false);
  assert.equal(runtime.nodes["pwa-update-button"].textContent, "Update");
  assert(runtime.nodes["pwa-status"]);
});

test("PWA update timeout restores the update button", async function () {
  const registration = {
    waiting: { postMessage: function postMessage() {} },
    addEventListener: function addEventListener() {},
  };
  const runtime = loadPWA({ registration });

  runtime.listeners["window:load"]();
  await flushPromises();
  runtime.nodes["pwa-update-button"].listeners.click();
  const timeout = Array.from(runtime.timeouts.values())[0];
  timeout();

  assert.equal(runtime.nodes["pwa-update-button"].disabled, false);
  assert.equal(runtime.nodes["pwa-update-button"].textContent, "Update");
});

test("PWA update prompt renders in regular browser mode", async function () {
  const registration = {
    waiting: {
      postMessage: function postMessage() {},
    },
    addEventListener: function addEventListener() {},
  };
  const runtime = loadPWA({ registration });

  runtime.listeners["window:load"]();
  await flushPromises();

  assert(runtime.nodes["pwa-update"], "expected update prompt outside installed display mode");
});

test("PWA registration failure renders a visible status card", async function () {
  const runtime = loadPWA({
    registrationError: new Error("registration failed"),
  });

  runtime.listeners["window:load"]();
  await flushPromises();

  const card = runtime.nodes["pwa-status"];
  assert(runtime.slot.hidden === false, "expected prompt slot to be visible");
  assert(card && card.className === "pwa-prompt-card", "expected status prompt card");
  assert(
    card.children[0].textContent === "Offline support is unavailable right now.",
    "expected registration failure copy"
  );
});

test("PWA unsupported browser renders a visible status card", async function () {
  const runtime = loadPWA({
    serviceWorkerSupported: false,
  });

  runtime.listeners["window:load"]();
  await flushPromises();

  const card = runtime.nodes["pwa-status"];
  assert(runtime.slot.hidden === false, "expected prompt slot to be visible");
  assert(card && card.className === "pwa-prompt-card", "expected status prompt card");
  assert(
    card.children[0].textContent === "Offline support is unavailable in this browser.",
    "expected unsupported browser copy"
  );
});

test("install prompt returns focus to settings after the browser choice", async function () {
  let promptCalls = 0;
  const runtime = loadPWA();
  runtime.listeners["window:beforeinstallprompt"]({
    preventDefault: function preventDefault() {},
    prompt: function prompt() {
      promptCalls += 1;
    },
    userChoice: Promise.resolve({ outcome: "dismissed" }),
  });

  runtime.nodes["pwa-install-button"].listeners.click();
  await flushPromises();

  assert.equal(promptCalls, 1);
  assert.equal(runtime.nodes.theme.focusCount, 1);
});

test("service worker deletes only this app's old caches", async function () {
  const deletedCaches = [];
  const deletedRequests = [];
  const listeners = {};
  const currentCache = currentServiceWorkerCacheName();
  const expectedRequest = { url: "https://example.test/index.html" };
  const staleRequest = { url: "https://example.test/removed.js" };
  const context = {
    Promise,
    Response,
    URL,
    caches: {
      keys: function keys() {
        return Promise.resolve([
          "cognitive-interval-timer-old",
          "other-project-cache",
          currentCache,
        ]);
      },
      delete: function deleteCache(key) {
        deletedCaches.push(key);
        return Promise.resolve(true);
      },
      open: function openCache(key) {
        assert(key === currentCache, "expected current cache to be opened for pruning");
        return Promise.resolve({
          keys: function keys() {
            return Promise.resolve([expectedRequest, staleRequest]);
          },
          delete: function deleteRequest(request) {
            deletedRequests.push(request.url);
            return Promise.resolve(true);
          },
        });
      },
    },
    self: {
      clients: {
        claim: function claim() {
          return Promise.resolve();
        },
      },
      addEventListener: function addEventListener(type, handler) {
        listeners[type] = handler;
      },
      location: {
        origin: "https://example.test",
      },
      registration: {
        scope: "https://example.test/",
      },
    },
  };

  vm.runInNewContext(readProjectFile("app-config.js"), context, {
    filename: "app-config.js",
  });
  vm.runInNewContext(readProjectFile("app-shell-assets.js"), context, {
    filename: "app-shell-assets.js",
  });
  vm.runInNewContext(readProjectFile("app-version.js"), context, {
    filename: "app-version.js",
  });
  vm.runInNewContext(readProjectFile("service-worker.js"), context, {
    filename: "service-worker.js",
  });

  let activationPromise = null;
  listeners.activate({
    waitUntil: function waitUntil(promise) {
      activationPromise = promise;
    },
  });

  await activationPromise;
  assert(
    deletedCaches.includes("cognitive-interval-timer-old"),
    "expected old app cache to be deleted"
  );
  assert(
    !deletedCaches.includes("other-project-cache"),
    "unrelated origin cache should not be deleted"
  );
  assert(!deletedCaches.includes(currentCache), "current app cache should not be deleted");
  assert(!deletedRequests.includes(expectedRequest.url), "expected app-shell request to be kept");
  assert(deletedRequests.includes(staleRequest.url), "expected stale current-cache entry to prune");
});

test("service worker keeps update activation alive and acknowledges it", async function () {
  const runtime = loadServiceWorkerRuntime();
  const messages = [];
  let activation = null;

  runtime.listeners.message({
    data: { type: "SKIP_WAITING" },
    source: {
      postMessage: function postMessage(message) {
        messages.push(message);
      },
    },
    waitUntil: function waitUntil(promise) {
      activation = promise;
    },
  });

  assert(activation, "expected activation to extend the message lifetime");
  await activation;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "SKIP_WAITING_RESULT");
  assert.equal(messages[0].ok, true);
});

test("service worker runtime-caches only app-shell assets", async function () {
  const runtime = loadServiceWorkerRuntime();

  await runFetch(runtime, {
    url: "https://example.test/app.js",
  });
  await runFetch(runtime, {
    url: "https://example.test/notes.json",
  });

  assert(runtime.cacheWrites.includes("https://example.test/app.js"), "expected app shell cache");
  assert(
    !runtime.cacheWrites.includes("https://example.test/notes.json"),
    "expected non-shell request to skip cache"
  );
});

test("service worker serves the current app shell without mixing network versions", async function () {
  const cachedAsset = new Response("current app", { status: 200 });
  const runtime = loadServiceWorkerRuntime({
    cached: [["https://example.test/app.js", cachedAsset]],
  });

  const response = await runFetch(runtime, {
    url: "https://example.test/app.js",
  });

  assert.equal(response, cachedAsset);
  assert.deepEqual(runtime.fetchCalls, []);
});

test("service worker returns network response when cache write fails", async function () {
  const networkResponse = {
    ok: true,
    status: 200,
    type: "basic",
    headers: {
      get: function getHeader() {
        return "text/javascript";
      },
    },
    clone: function clone() {
      return this;
    },
  };
  const runtime = loadServiceWorkerRuntime({
    cachePutError: new Error("cache unavailable"),
    fetchResponse: function fetchResponse() {
      return networkResponse;
    },
  });

  const response = await runFetch(runtime, {
    url: "https://example.test/app.js",
  });

  assert(response === networkResponse, "expected network response despite cache write failure");
});

test("service worker rejects malformed app-shell responses", async function () {
  const runtime = loadServiceWorkerRuntime({
    fetchResponse: function fetchResponse() {
      return {
        ok: true,
        status: 200,
        type: "basic",
        headers: {
          get: function getHeader() {
            return "text/html";
          },
        },
        clone: function clone() {
          return this;
        },
      };
    },
  });

  const response = await runFetch(runtime, {
    url: "https://example.test/app.js",
  });

  assert.equal(response.status, 503);
  assert.deepEqual(runtime.cacheWrites, []);
});

test("service worker falls back to cached shell for offline navigation", async function () {
  const cachedShell = new Response("cached shell", { status: 200 });
  const runtime = loadServiceWorkerRuntime({
    fetchError: new Error("offline"),
    cached: [[new URL("./index.html", "https://example.test/").href, cachedShell]],
  });

  const response = await runFetch(runtime, {
    mode: "navigate",
    url: "https://example.test/",
  });

  assert(response === cachedShell, "expected cached shell fallback");
});

test("service worker returns 503 for uncached offline assets", async function () {
  const runtime = loadServiceWorkerRuntime({
    fetchError: new Error("offline"),
  });

  const response = await runFetch(runtime, {
    url: "https://example.test/app.js",
  });

  assert(response.status === 503, "expected offline asset 503 response");
});
