const DisplayServices = require("../display-services.js");
const assert = require("node:assert/strict");
const test = require("node:test");

test("fullscreen service enters and exits fullscreen", async function () {
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
  assert((await fullscreen.setEnabled(false)) === false, "expected fullscreen disable result");
});

test("fullscreen service ignores stale async results", async function () {
  let resolveEnter = null;
  const doc = {
    fullscreenElement: null,
    documentElement: {
      requestFullscreen: function requestFullscreen() {
        return new Promise(function waitForEnter(resolve) {
          resolveEnter = function finishEnter() {
            doc.fullscreenElement = doc.documentElement;
            resolve();
          };
        });
      },
    },
    exitFullscreen: function exitFullscreen() {
      doc.fullscreenElement = null;
      return Promise.resolve();
    },
  };
  const fullscreen = DisplayServices.createFullscreenService({ documentRef: doc });
  const enablePromise = fullscreen.setEnabled(true);
  const disablePromise = fullscreen.setEnabled(false);

  resolveEnter();
  await enablePromise;
  await disablePromise;

  assert(doc.fullscreenElement === null, "expected stale fullscreen entry to be exited");
});

test("display mode service owns minimal fullscreen wake lock and history state", async function () {
  const events = [];
  const listeners = {};
  const doc = {
    fullscreenElement: null,
    documentElement: {
      requestFullscreen: function requestFullscreen() {
        doc.fullscreenElement = doc.documentElement;
        events.push("fullscreen:on");
        return Promise.resolve();
      },
    },
    exitFullscreen: function exitFullscreen() {
      doc.fullscreenElement = null;
      events.push("fullscreen:off");
      return Promise.resolve();
    },
  };
  const service = DisplayServices.createDisplayModeService({
    documentRef: doc,
    windowRef: {
      history: {
        pushState: function pushState() {
          events.push("history:push");
        },
        back: function back() {
          events.push("history:back");
        },
      },
      addEventListener: function addEventListener(type, handler) {
        listeners[type] = handler;
      },
    },
    wakeLock: {
      isSupported: function isSupported() {
        return true;
      },
      setEnabled: function setEnabled(enabled) {
        events.push("wake:" + enabled);
        return Promise.resolve(true);
      },
    },
    onMinimalModeChange: function onMinimalModeChange(active) {
      events.push("minimal:" + active);
    },
    onMinimalModeExited: function onMinimalModeExited() {
      events.push("minimal:external-exit");
    },
    onFullscreenExited: function onFullscreenExited() {
      events.push("fullscreen:external-exit");
    },
    onFullscreenUnavailable: function onFullscreenUnavailable() {},
    onWakeLockUnavailable: function onWakeLockUnavailable() {},
  });

  service.bind();
  await service.setMinimalMode(
    true,
    { fullscreen_enabled: false, wake_lock_enabled: false },
    { wakeLockBeforeMinimal: false }
  );
  assert.equal(service.isMinimalModeActive(), true);
  assert(events.includes("history:push"));
  assert(events.includes("wake:true"));

  listeners.popstate();
  assert.equal(service.isMinimalModeActive(), false);
  assert(events.includes("wake:false"));
  assert(events.includes("minimal:external-exit"));
});
