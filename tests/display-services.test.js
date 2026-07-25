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

test("minimal mode service enables wake lock and fullscreen", async function () {
  const calls = [];
  const doc = {
    documentElement: {
      attrs: {},
      setAttribute: function setAttribute(name, value) {
        this.attrs[name] = value;
      },
      removeAttribute: function removeAttribute(name) {
        delete this.attrs[name];
      },
    },
  };
  const dom = { fields: { wake_lock_enabled: { checked: false } } };
  const minimal = DisplayServices.createMinimalModeService({
    documentRef: doc,
    dom,
    fullscreen: {
      setEnabled: function setEnabled(enabled) {
        calls.push("fullscreen:" + enabled);
        return Promise.resolve(enabled);
      },
    },
    wakeLock: {
      setEnabled: function setEnabled(enabled) {
        calls.push("wake:" + enabled);
        return Promise.resolve(enabled);
      },
    },
  });

  await minimal.setEnabled(true, { fullscreen_enabled: false });
  assert(minimal.isActive() === true, "expected active minimal mode");
  assert(dom.fields.wake_lock_enabled.checked === true, "expected wake lock field to check");
  assert(doc.documentElement.attrs["data-minimal-mode"] === "true", "expected minimal attr");
  assert(calls.includes("wake:true"), "expected wake lock enable call");
  assert(calls.includes("fullscreen:true"), "expected fullscreen enable call");
});
