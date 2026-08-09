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

test("audio engine schedules the three-note phase chime", function () {
  const originalWindow = global.window;
  const destination = {};
  const oscillators = [];
  const gains = [];

  function AudioContext() {
    this.currentTime = 10;
    this.destination = destination;
    this.state = "running";
  }
  AudioContext.prototype.createOscillator = function createOscillator() {
    const oscillator = {
      frequency: {},
      connectTarget: null,
      connect: function connect(target) {
        this.connectTarget = target;
      },
      start: function start(time) {
        this.startTime = time;
      },
      stop: function stop(time) {
        this.stopTime = time;
      },
    };
    oscillators.push(oscillator);
    return oscillator;
  };
  AudioContext.prototype.createGain = function createGain() {
    const schedule = [];
    const gain = {
      connectTarget: null,
      schedule,
      connect: function connect(target) {
        this.connectTarget = target;
      },
      gain: {
        setValueAtTime: function setValueAtTime(value, time) {
          schedule.push(["set", value, time]);
        },
        linearRampToValueAtTime: function linearRampToValueAtTime(value, time) {
          schedule.push(["linear", value, time]);
        },
        exponentialRampToValueAtTime: function exponentialRampToValueAtTime(value, time) {
          schedule.push(["exponential", value, time]);
        },
      },
    };
    gains.push(gain);
    return gain;
  };

  global.window = {
    AudioContext,
    addEventListener: function addEventListener() {},
    removeEventListener: function removeEventListener() {},
  };

  try {
    const audio = Audio.createEngine();
    assert.equal(audio.playPhaseChime(), true);
    assert.equal(oscillators.length, 3);
    assert.deepEqual(
      oscillators.map(function frequency(oscillator) {
        return oscillator.frequency.value;
      }),
      [523.25, 659.25, 783.99]
    );

    oscillators.forEach(function validOscillator(oscillator, index) {
      assert.equal(oscillator.type, "sine");
      assert.equal(oscillator.connectTarget, gains[index]);
      assert.ok(oscillator.startTime >= 10.01);
      assert.ok(Math.abs(oscillator.stopTime - oscillator.startTime - 0.12) < 1e-12);
    });
    gains.forEach(function validEnvelope(gain) {
      assert.equal(gain.connectTarget, destination);
      assert.deepEqual(
        gain.schedule.map(function operation(entry) {
          return entry[0];
        }),
        ["set", "linear", "exponential"]
      );
    });
  } finally {
    global.window = originalWindow;
  }
});
