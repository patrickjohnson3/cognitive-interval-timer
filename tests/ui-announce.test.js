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
