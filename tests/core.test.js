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
  const settings = Core.normalizeSettings({ focus: 1, recall: 1, break: 1, long_break: 1, prep: 1, blocks_per_ultradian: 2 });
  const timer = { running: true, phase: "focus", remainingSec: 10 };
  const stats = Core.normalizeStats({ dateKey: Core.dateKey(), focusBlocksToday: 0, focusBlocksSinceLong: 0 });

  const out = Core.consumeElapsed(timer, 12, settings, stats, { autoStart: true });
  assert(out.timer.phase === "recall", "expected recall after 12s from focus with 10s remaining");
  assert(out.stats.focusBlocksToday === 1, "expected focusBlocksToday increment");
  assert(out.stats.focusBlocksSinceLong === 1, "expected focusBlocksSinceLong increment");
});

test("consumeElapsed handles large elapsed time without dropping transitions", function () {
  const settings = Core.normalizeSettings({
    prep: 1,
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

test("consumeElapsed follows a full two-block cycle into long break", function () {
  const settings = Core.normalizeSettings({
    prep_enabled: true,
    blocks_per_ultradian: 2,
    auto_start: true,
  });
  let timer = { running: true, phase: "prep", remainingSec: 1 };
  let stats = Core.normalizeStats({ dateKey: Core.dateKey(), focusBlocksToday: 0, focusBlocksSinceLong: 0 });
  const phases = [timer.phase];

  while (timer.phase !== "long_break") {
    const out = Core.consumeElapsed(timer, 1, settings, stats, { autoStart: true });
    assert(out.events.length === 1, "expected exactly one transition");
    timer = out.timer;
    stats = out.stats;
    phases.push(timer.phase);

    if (timer.phase !== "long_break") {
      timer.remainingSec = 1;
    }
  }

  assert(
    phases.join(" > ") === "prep > focus > recall > break > focus > recall > long_break",
    "unexpected phase sequence: " + phases.join(" > ")
  );
  assert(stats.focusBlocksToday === 2, "expected two completed focus blocks");
  assert(stats.focusBlocksSinceLong === 0, "expected long break to reset since-long counter");
});

test("stateLabel maps all phases to configured display names", function () {
  Core.PHASES.forEach(function eachPhase(phase) {
    const expected = Core.PHASE_CONFIG[phase].displayName;
    const actual = Core.stateLabel(phase);
    assert(actual === expected, "expected " + phase + " label " + expected + ", got " + actual);
  });
});

test("all phases have short and long guidance text", function () {
  Core.PHASES.forEach(function eachPhase(phase) {
    const shortHint = Core.STATE_HINTS[phase];
    const longHint = Core.STATE_LONG_HINTS[phase];
    assert(typeof shortHint === "string" && shortHint.trim().length > 0, "missing short hint for " + phase);
    assert(typeof longHint === "string" && longHint.trim().length > 0, "missing long hint for " + phase);
  });
});

test("normalizeSettings preserves wake lock preference", function () {
  const settings = Core.normalizeSettings({ wake_lock_enabled: true });
  assert(settings.wake_lock_enabled === true, "expected wake lock preference to normalize");
});

test("normalizeSettings accepts legacy prime setting keys", function () {
  const settings = Core.normalizeSettings({ prime: 4, prime_enabled: false });
  assert(settings.prep === 4, "expected legacy prime duration to map to prep");
  assert(settings.prep_enabled === false, "expected legacy prime_enabled to map to prep_enabled");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
