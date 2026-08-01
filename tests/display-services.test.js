const DisplayServices = require("../display-services.js");

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

test("fullscreen service tracks active state", async function () {
  const doc = {
    fullscreenElement: null,
    documentElement: {
      requestFullscreen: function requestFullscreen() {
        doc.fullscreenElement = doc.documentElement;
        return Promise.resolve();
      },
    },
    exitFullscreen: function exitFullscreen() {
      doc.fullscreenElement = null;
      return Promise.resolve();
    },
  };
  const fullscreen = DisplayServices.createFullscreenService({ documentRef: doc });

  assert((await fullscreen.setEnabled(true)) === true, "expected fullscreen enable result");
  assert(fullscreen.isActive() === true, "expected active fullscreen state");
  assert((await fullscreen.setEnabled(false)) === false, "expected fullscreen disable result");
  assert(fullscreen.isActive() === false, "expected inactive fullscreen state");
});

test("wake lock service reconciles rejected requests", async function () {
  let unavailable = 0;
  const wakeLock = DisplayServices.createWakeLockService({
    wakeLock: {
      setEnabled: function setEnabled() {
        return Promise.resolve(false);
      },
    },
    onUnavailable: function onUnavailable() {
      unavailable += 1;
    },
  });

  assert((await wakeLock.setEnabled(true)) === false, "expected wake lock rejection");
  assert(wakeLock.isActive() === false, "expected inactive wake lock state");
  assert(unavailable === 1, "expected unavailable callback");
});

test("fullscreen service ignores stale async results", async function () {
  let resolveEnter = null;
  const doc = {
    fullscreenElement: null,
    documentElement: {
      requestFullscreen: function requestFullscreen() {
        return new Promise(function waitForEnter(resolve) {
          resolveEnter = resolve;
        });
      },
    },
  };
  const fullscreen = DisplayServices.createFullscreenService({ documentRef: doc });
  const enablePromise = fullscreen.setEnabled(true);
  const disablePromise = fullscreen.setEnabled(false);

  resolveEnter();
  await enablePromise;
  await disablePromise;

  assert(fullscreen.isActive() === false, "expected latest fullscreen request to win");
});

test("wake lock service ignores stale async results", async function () {
  let resolveEnable = null;
  const wakeLock = DisplayServices.createWakeLockService({
    wakeLock: {
      setEnabled: function setEnabled(enabled) {
        if (!enabled) return Promise.resolve(false);
        return new Promise(function waitForEnable(resolve) {
          resolveEnable = resolve;
        });
      },
    },
  });
  const enablePromise = wakeLock.setEnabled(true);
  const disablePromise = wakeLock.setEnabled(false);

  resolveEnable(true);
  await enablePromise;
  await disablePromise;

  assert(wakeLock.isActive() === false, "expected latest wake lock request to win");
});
