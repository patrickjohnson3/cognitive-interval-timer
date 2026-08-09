const Core = require("../core.js");
const TimerEngine = require("../timer-engine.js");
const assert = require("node:assert/strict");
const test = require("node:test");

function createTimerContext() {
  const stateChanges = [];
  const phaseChanges = [];
  let currentTimeMs = 1000;
  const state = {
    settings: Core.normalizeSettings({ prep_enabled: true }),
    stats: Core.normalizeStats({
      dateKey: Core.dateKey(),
      focusBlocksToday: 0,
      focusBlocksSinceLong: 0,
    }),
    timer: {
      status: Core.STATUS.RUNNING,
      phase: Core.PHASE.FOCUS,
      focusBlockNumber: 1,
      remainingSec: 30,
      lastTickMs: currentTimeMs,
    },
  };
  const timer = TimerEngine.create({
    state,
    Core,
    now: function now() {
      return currentTimeMs;
    },
    hooks: {
      onStateChange: function onStateChange() {
        stateChanges.push(true);
      },
      onPhaseChange: function onPhaseChange(payload) {
        phaseChanges.push(payload);
      },
    },
  });

  return {
    state,
    timer,
    stateChanges,
    phaseChanges,
    advanceClock: function advanceClock(milliseconds) {
      currentTimeMs += milliseconds;
    },
    setClock: function setClock(milliseconds) {
      currentTimeMs = milliseconds;
    },
  };
}

test("reset returns timer to idle primary-action state", function () {
  const ctx = createTimerContext();
  ctx.timer.reset();

  assert(ctx.state.timer.status === Core.STATUS.IDLE, "expected reset timer to become idle");
  assert(ctx.state.timer.focusBlockNumber === 0, "expected reset to clear active block number");
  assert(ctx.state.timer.phase === Core.PHASE.PREP, "expected reset to return to initial phase");
  assert(ctx.stateChanges.length === 1, "expected reset to notify state change");
  assert(ctx.phaseChanges.length === 0, "expected reset not to announce phase change");
});

test("resetToPhase rejects unknown phases before mutating state", function () {
  const ctx = createTimerContext();
  const original = Object.assign({}, ctx.state.timer);

  assert.throws(function resetToUnknownPhase() {
    ctx.timer.resetToPhase("unknown");
  }, /known phase/);
  assert.deepEqual(ctx.state.timer, original);
  assert.equal(ctx.stateChanges.length, 0);
});

test("skipping before start initializes a one-based focus block", function () {
  [true, false].forEach(function eachAutoStart(autoStart) {
    const ctx = createTimerContext();
    ctx.state.settings.auto_start = autoStart;
    ctx.timer.reset();

    ctx.timer.skip();

    assert(ctx.state.timer.focusBlockNumber === 1, "expected first focus block after idle skip");
    assert(ctx.state.timer.phase === Core.PHASE.FOCUS, "expected idle prep to skip to focus");
    assert(
      ctx.state.timer.status === (autoStart ? Core.STATUS.RUNNING : Core.STATUS.PAUSED),
      "expected skip to respect auto-start"
    );
  });
});

test("suspension discards hidden elapsed time without completing work", function () {
  const ctx = createTimerContext();
  const originalSetInterval = global.setInterval;
  let tick = null;
  global.setInterval = function captureTicker(callback) {
    tick = callback;
    return 1;
  };

  try {
    ctx.state.timer.remainingSec = 1;
    ctx.timer.startTicker();
    ctx.timer.setSuspended(true);
    ctx.advanceClock(120000);
    tick();

    assert.equal(ctx.state.timer.phase, Core.PHASE.FOCUS);
    assert.equal(ctx.state.timer.remainingSec, 1);
    assert.equal(ctx.state.stats.focusBlocksToday, 0);
    assert.equal(ctx.stateChanges.length, 0);

    ctx.timer.setSuspended(false);
    ctx.advanceClock(250);
    tick();

    assert.equal(ctx.state.timer.phase, Core.PHASE.FOCUS);
    assert.equal(ctx.state.timer.remainingSec, 0.75);
    assert.equal(ctx.state.stats.focusBlocksToday, 0);
  } finally {
    global.setInterval = originalSetInterval;
  }
});

test("ordinary ticks render only when the displayed second changes", function () {
  const ctx = createTimerContext();
  const originalSetInterval = global.setInterval;
  let tick = null;
  global.setInterval = function captureTicker(callback) {
    tick = callback;
    return 1;
  };

  try {
    ctx.timer.startTicker();
    ctx.state.timer.remainingSec = 29.8;
    ctx.state.timer.lastTickMs = 900;
    tick();
    assert(ctx.stateChanges.length === 0, "expected sub-second tick to skip rendering");

    ctx.state.timer.lastTickMs = -100;
    tick();
    assert(ctx.stateChanges.length === 1, "expected displayed-second change to render");
  } finally {
    global.setInterval = originalSetInterval;
  }
});

test("ticker completion advances the phase and honors auto-start", function () {
  const originalSetInterval = global.setInterval;
  let tick = null;
  global.setInterval = function captureTicker(callback) {
    tick = callback;
    return 1;
  };

  try {
    [true, false].forEach(function eachAutoStart(autoStart) {
      const ctx = createTimerContext();
      ctx.state.settings.auto_start = autoStart;
      ctx.state.timer.remainingSec = 0.1;
      ctx.timer.startTicker();
      ctx.advanceClock(250);
      tick();

      assert.equal(ctx.state.timer.phase, Core.PHASE.RECALL);
      assert.equal(ctx.state.stats.focusBlocksToday, 1);
      assert.equal(ctx.state.stats.focusBlocksSinceLong, 1);
      assert.equal(ctx.state.timer.status, autoStart ? Core.STATUS.RUNNING : Core.STATUS.PAUSED);
      assert.equal(ctx.phaseChanges.length, 1);
      assert.deepEqual(ctx.phaseChanges[0], {
        from: Core.PHASE.FOCUS,
        to: Core.PHASE.RECALL,
        reason: "timer",
      });
      assert.equal(ctx.stateChanges.length, 1);

      if (autoStart) {
        assert.ok(Math.abs(ctx.state.timer.remainingSec - 179.85) < Number.EPSILON);
      } else {
        assert.equal(ctx.state.timer.remainingSec, 180);
        assert.equal(ctx.state.timer.lastTickMs, null);
      }
    });
  } finally {
    global.setInterval = originalSetInterval;
  }
});

test("large or backward clock gaps do not complete unattended work", function () {
  const ctx = createTimerContext();
  const originalSetInterval = global.setInterval;
  let tick = null;
  global.setInterval = function captureTicker(callback) {
    tick = callback;
    return 1;
  };

  try {
    ctx.state.timer.remainingSec = 1;
    ctx.timer.startTicker();
    ctx.advanceClock(6000);
    tick();

    assert.equal(ctx.state.timer.phase, Core.PHASE.FOCUS);
    assert.equal(ctx.state.timer.remainingSec, 1);
    assert.equal(ctx.state.stats.focusBlocksToday, 0);

    ctx.setClock(500);
    tick();
    assert.equal(ctx.state.timer.lastTickMs, 500);
    assert.equal(ctx.state.timer.remainingSec, 1);
  } finally {
    global.setInterval = originalSetInterval;
  }
});

test("idle ticker rolls daily statistics over at midnight", function () {
  const ctx = createTimerContext();
  const originalSetInterval = global.setInterval;
  let tick = null;
  global.setInterval = function captureTicker(callback) {
    tick = callback;
    return 1;
  };

  try {
    ctx.state.timer.status = Core.STATUS.IDLE;
    ctx.state.stats.dateKey = "2000-01-01";
    ctx.state.stats.focusBlocksToday = 5;
    ctx.timer.startTicker();
    tick();

    assert.equal(ctx.state.stats.dateKey, Core.dateKey());
    assert.equal(ctx.state.stats.focusBlocksToday, 0);
    assert.equal(ctx.stateChanges.length, 1);
  } finally {
    global.setInterval = originalSetInterval;
  }
});
