const fs = require("fs");
const path = require("path");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      result
        .then(function asyncPass() {
          console.log("PASS", name);
        })
        .catch(function asyncFail(err) {
          console.error("FAIL", name);
          console.error("  " + err.message);
          process.exitCode = 1;
        });
      return;
    }

    console.log("PASS", name);
  } catch (err) {
    console.error("FAIL", name);
    console.error("  " + err.message);
    process.exitCode = 1;
  }
}

function readProjectFile(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

function flushPromises() {
  return new Promise(function resolveSoon(resolve) {
    setTimeout(resolve, 0);
  });
}

function createElementFactory(nodes) {
  function registerTree(node) {
    if (node.id) nodes[node.id] = node;
    node.children.forEach(registerTree);
  }

  return function createElement(tagName) {
    return {
      tagName: tagName.toUpperCase(),
      id: "",
      className: "",
      textContent: "",
      hidden: false,
      disabled: false,
      children: [],
      attributes: {},
      listeners: {},
      setAttribute: function setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      addEventListener: function addEventListener(type, handler) {
        this.listeners[type] = handler;
      },
      appendChild: function appendChild(child) {
        this.children.push(child);
        registerTree(child);
      },
    };
  };
}

function loadPWA(options) {
  const config = options || {};
  const nodes = {};
  const bodyChildren = [];
  const listeners = {};
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

  const registration = config.registration || {};
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
    navigator: {
      platform: config.platform || "",
      userAgent: config.userAgent || "",
      maxTouchPoints: config.maxTouchPoints || 0,
      standalone: Boolean(config.standalone),
      serviceWorker: {
        addEventListener: function addServiceWorkerListener(type, handler) {
          listeners["serviceWorker:" + type] = handler;
        },
        register: function registerServiceWorker() {
          return Promise.resolve(registration);
        },
      },
    },
    window: {
      addEventListener: function addWindowListener(type, handler) {
        listeners["window:" + type] = handler;
      },
      location: {
        reload: function reload() {},
      },
      matchMedia: function matchMedia(query) {
        return { matches: Boolean(config.displayModes && config.displayModes[query]) };
      },
    },
  };
  context.self = context;

  vm.runInNewContext(readProjectFile("pwa.js"), context, { filename: "pwa.js" });
  return { bodyChildren, listeners, nodes, registration, slot };
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
  assert(runtime.bodyChildren.length === 0, "update prompt should not append a floating body button");
  assert(runtime.slot.hidden === false, "expected prompt slot to be visible");
  assert(card && card.className === "pwa-prompt-card", "expected update prompt card");
  assert(card.children[0].textContent === "A newer version is ready.", "expected update prompt copy");
  assert(button && button.textContent === "Update", "expected update button");

  button.listeners.click();
  assert(button.disabled === true, "expected update button to disable after click");
  assert(messages.length === 1 && messages[0].type === "SKIP_WAITING", "expected skip-waiting message");
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
  assert(runtime.nodes["pwa-update-button"].disabled === false, "button should not disable without a waiting worker");
});

test("service worker deletes only this app's old caches", async function () {
  const deleted = [];
  const listeners = {};
  const context = {
    Promise,
    Response,
    URL,
    caches: {
      keys: function keys() {
        return Promise.resolve(["cognitive-interval-timer-old", "other-project-cache", "cognitive-interval-timer-2026.07.19-pwa.7"]);
      },
      delete: function deleteCache(key) {
        deleted.push(key);
        return Promise.resolve(true);
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
    },
  };

  vm.runInNewContext(readProjectFile("service-worker.js"), context, { filename: "service-worker.js" });

  let activationPromise = null;
  listeners.activate({
    waitUntil: function waitUntil(promise) {
      activationPromise = promise;
    },
  });

  await activationPromise;
  assert(deleted.includes("cognitive-interval-timer-old"), "expected old app cache to be deleted");
  assert(!deleted.includes("other-project-cache"), "unrelated origin cache should not be deleted");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
