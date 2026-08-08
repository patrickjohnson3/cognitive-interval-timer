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
