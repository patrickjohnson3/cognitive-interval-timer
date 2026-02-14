const Core = require("../core.js");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

test("nextPhase chooses long_break after ultradian threshold", function () {
  const settings = Core.normalizeSettings({ blocks_per_ultradian: 2 });
  const stats = Core.normalizeStats({ dateKey: Core.dateKey(), focusBlocksToday: 1, focusBlocksSinceLong: 2 });
  const next = Core.nextPhase("recall", stats, settings);
  assert(next === "long_break", "expected long_break, got " + next);
});

test("rolloverStats resets daily count but preserves long-break counter", function () {
  const old = { dateKey: "Mon Jan 01 2001", focusBlocksToday: 7, focusBlocksSinceLong: 3 };
  const rolled = Core.rolloverStats(old, "Tue Jan 02 2001");
  assert(rolled.focusBlocksToday === 0, "focusBlocksToday should reset");
  assert(rolled.focusBlocksSinceLong === 3, "focusBlocksSinceLong should remain");
});

test("consumeElapsed transitions and credits focus completion", function () {
  const settings = Core.normalizeSettings({ focus: 1, recall: 1, break: 1, long_break: 1, prime: 1, blocks_per_ultradian: 2 });
  const timer = { running: true, phase: "focus", remainingSec: 10 };
  const stats = Core.normalizeStats({ dateKey: Core.dateKey(), focusBlocksToday: 0, focusBlocksSinceLong: 0 });

  const out = Core.consumeElapsed(timer, 12, settings, stats, { autoStart: true });
  assert(out.timer.phase === "recall", "expected recall after 12s from focus with 10s remaining");
  assert(out.stats.focusBlocksToday === 1, "expected focusBlocksToday increment");
  assert(out.stats.focusBlocksSinceLong === 1, "expected focusBlocksSinceLong increment");
});

test("consumeElapsed handles large elapsed time without dropping transitions", function () {
  const settings = Core.normalizeSettings({
    prime: 1,
    focus: 1,
    recall: 1,
    break: 1,
    long_break: 1,
    blocks_per_ultradian: 2,
  });

  const timer = { running: true, phase: "focus", remainingSec: 1 };
  const stats = Core.normalizeStats({ dateKey: Core.dateKey(), focusBlocksToday: 0, focusBlocksSinceLong: 0 });

  const out = Core.consumeElapsed(timer, 700, settings, stats, { autoStart: true, maxTransitions: 1000 });
  assert(out.events.length > 10, "expected many transitions for large elapsed time");
  assert(out.transitionLimitHit === false, "transition limit should not be hit here");
  assert(out.remainingElapsed === 0, "elapsed time should be fully consumed");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
