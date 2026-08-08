const Core = require("../core.js");
const TimerEngine = require("../timer-engine.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (err) {
    console.error("FAIL", name);
    console.error("  " + err.message);
    process.exitCode = 1;
  }
}

function createTimerContext() {
  const stateChanges = [];
  const phaseChanges = [];
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
      lastTickMs: Date.now(),
    },
  };
  const timer = TimerEngine.create({
    state,
    Core,
    hooks: {
      onStateChange: function onStateChange() {
        stateChanges.push(true);
      },
      onPhaseChange: function onPhaseChange(payload) {
        phaseChanges.push(payload);
      },
    },
  });

  return { state, timer, stateChanges, phaseChanges };
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

test("suspension discards hidden elapsed time", function () {
  const ctx = createTimerContext();
  ctx.timer.setSuspended(true);
  assert(ctx.state.timer.lastTickMs === null, "expected suspension to clear the wall-clock anchor");

  ctx.timer.setSuspended(false);
  assert(
    typeof ctx.state.timer.lastTickMs === "number",
    "expected resume to establish a fresh wall-clock anchor"
  );
  assert(ctx.state.stats.focusBlocksToday === 0, "expected no focus completion while suspended");
});
