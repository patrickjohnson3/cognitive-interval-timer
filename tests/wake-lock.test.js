const WakeLock = require("../wake-lock.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(function onPass() {
      console.log("PASS", name);
    })
    .catch(function onFail(err) {
      console.error("FAIL", name);
      console.error("  " + err.message);
      process.exitCode = 1;
    });
}

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
