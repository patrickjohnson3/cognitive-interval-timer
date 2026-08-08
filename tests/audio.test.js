const Audio = require("../audio.js");
const assert = require("node:assert/strict");
const test = require("node:test");

test("audio engine contains platform construction failures", function () {
  const originalWindow = global.window;
  global.window = {
    AudioContext: function AudioContext() {
      throw new Error("audio device unavailable");
    },
    addEventListener: function addEventListener() {},
    removeEventListener: function removeEventListener() {},
  };

  try {
    const audio = Audio.createEngine();
    assert.equal(audio.playPhaseChime(), false);
  } finally {
    global.window = originalWindow;
  }
});
