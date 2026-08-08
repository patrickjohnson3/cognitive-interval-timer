const WakeLock = require("../wake-lock.js");
const assert = require("node:assert/strict");
const test = require("node:test");

function createLock() {
  return {
    released: false,
    addEventListener: function addEventListener() {},
    release: function release() {
      this.released = true;
      return Promise.resolve();
    },
  };
}

test("requests screen wake lock when enabled", async function () {
  const calls = [];
  const lock = createLock();
  const wakeLock = WakeLock.createController({
    document: { visibilityState: "visible", addEventListener: function addEventListener() {} },
    navigator: {
      wakeLock: {
        request: function request(type) {
          calls.push(type);
          return Promise.resolve(lock);
        },
      },
    },
  });

  const enabled = await wakeLock.setEnabled(true);
  assert(enabled === true, "expected wake lock to be enabled");
  assert(calls.length === 1 && calls[0] === "screen", "expected screen wake lock request");
});

test("releases active wake lock when disabled", async function () {
  const lock = createLock();
  const wakeLock = WakeLock.createController({
    document: { visibilityState: "visible", addEventListener: function addEventListener() {} },
    navigator: {
      wakeLock: {
        request: function request() {
          return Promise.resolve(lock);
        },
      },
    },
  });

  await wakeLock.setEnabled(true);
  const released = await wakeLock.setEnabled(false);
  assert(released === true, "expected release result");
  assert(lock.released === true, "expected active lock to release");
});

test("reports unsupported browser without throwing", async function () {
  const wakeLock = WakeLock.createController({
    document: { visibilityState: "visible", addEventListener: function addEventListener() {} },
    navigator: {},
  });

  const enabled = await wakeLock.setEnabled(true);
  assert(wakeLock.isSupported() === false, "expected unsupported wake lock");
  assert(enabled === false, "expected unsupported enable to resolve false");
});

test("contains synchronous wake-lock request failures", async function () {
  const wakeLock = WakeLock.createController({
    document: { visibilityState: "visible", addEventListener: function addEventListener() {} },
    navigator: {
      wakeLock: {
        request: function request() {
          throw new Error("wake lock failed synchronously");
        },
      },
    },
  });

  assert.equal(await wakeLock.setEnabled(true), false);
});

test("releases a pending lock that resolves after wake lock is disabled", async function () {
  let resolveRequest = null;
  const lock = createLock();
  const wakeLock = WakeLock.createController({
    document: { visibilityState: "visible", addEventListener: function addEventListener() {} },
    navigator: {
      wakeLock: {
        request: function request() {
          return new Promise(function waitForLock(resolve) {
            resolveRequest = resolve;
          });
        },
      },
    },
  });

  const pendingEnable = wakeLock.setEnabled(true);
  await wakeLock.setEnabled(false);
  resolveRequest(lock);

  assert((await pendingEnable) === false, "expected stale enable request to report disabled");
  assert(lock.released === true, "expected stale lock to be released immediately");
});

test("retries one spontaneous visible wake-lock release", async function () {
  const releaseListeners = [];
  const scheduled = [];
  let requests = 0;
  const wakeLock = WakeLock.createController({
    document: { visibilityState: "visible", addEventListener: function addEventListener() {} },
    navigator: {
      wakeLock: {
        request: function request() {
          requests += 1;
          return Promise.resolve({
            addEventListener: function addEventListener(type, listener) {
              if (type === "release") releaseListeners.push(listener);
            },
            release: function release() {
              return Promise.resolve();
            },
          });
        },
      },
    },
    setTimeout: function setTimeout(callback) {
      scheduled.push(callback);
      return scheduled.length;
    },
    clearTimeout: function clearTimeout() {},
  });

  await wakeLock.setEnabled(true);
  releaseListeners[0]();
  assert.equal(scheduled.length, 1);
  scheduled[0]();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(requests, 2);

  releaseListeners[1]();
  assert.equal(scheduled.length, 1, "retry-acquired lock should not create an endless loop");
});
