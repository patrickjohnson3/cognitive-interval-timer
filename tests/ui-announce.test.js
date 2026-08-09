const UIAnnounce = require("../ui-announce.js");
const { textNode } = require("./helpers/dom.js");
const assert = require("node:assert/strict");
const test = require("node:test");

test("visual status messages appear and clear", function () {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const callbacks = [];
  global.setTimeout = function setTimeoutStub(callback) {
    callbacks.push(callback);
    return callbacks.length;
  };
  global.clearTimeout = function clearTimeoutStub() {};

  try {
    const visualStatus = Object.assign(textNode(), { hidden: true });
    const announce = UIAnnounce.create({ visualStatus: visualStatus });

    announce.showVisualStatus("Fullscreen is unavailable.");
    assert.equal(visualStatus.hidden, false);
    assert.equal(visualStatus.textContent, "Fullscreen is unavailable.");

    callbacks[0]();
    assert.equal(visualStatus.hidden, true);
    assert.equal(visualStatus.textContent, "");
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
});

test("live announcements clear before delayed writes, including repeated text", function () {
  const originalSetTimeout = global.setTimeout;
  const callbacks = [];
  const delays = [];
  global.setTimeout = function setTimeoutStub(callback, delay) {
    callbacks.push(callback);
    delays.push(delay);
    return callbacks.length;
  };

  try {
    const live = Object.assign(textNode(), { textContent: "Focus started." });
    const announce = UIAnnounce.create({ live: live });

    announce.announce("Focus started.");
    assert.equal(live.textContent, "");
    assert.deepEqual(delays, [10]);

    callbacks[0]();
    assert.equal(live.textContent, "Focus started.");

    announce.announce("Focus started.");
    assert.equal(live.textContent, "");
    callbacks[1]();
    assert.equal(live.textContent, "Focus started.");
  } finally {
    global.setTimeout = originalSetTimeout;
  }
});
