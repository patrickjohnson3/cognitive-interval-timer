const Core = require("../core.js");
const Content = require("../content.js");
const assert = require("node:assert/strict");
const test = require("node:test");

test("setting field metadata covers every normalized setting", function () {
  assert.deepEqual(
    Core.SETTING_FIELDS.map(function settingKey(descriptor) {
      return descriptor.key;
    }),
    Object.keys(Core.DEFAULT_SETTINGS)
  );
});

test("recommended timing ignores unrelated preferences", function () {
  assert.equal(Core.usesRecommendedTiming({ quiet_mode_enabled: true, prep_enabled: false }), true);
  assert.equal(Core.usesRecommendedTiming({ focus: 30 }), false);
  assert.deepEqual(Core.TIMING_SETTING_KEYS, [
    "prep",
    "focus",
    "recall",
    "break",
    "long_break",
    "blocks_per_ultradian",
  ]);
});

test("nextPhase chooses long_break after ultradian threshold", function () {
  const settings = Core.normalizeSettings({ blocks_per_ultradian: 2 });
  const stats = Core.normalizeStats({
    dateKey: Core.dateKey(),
    focusBlocksToday: 1,
    focusBlocksSinceLong: 2,
  });
  const next = Core.nextPhase("recall", stats, settings);
  assert(next === "long_break", "expected long_break, got " + next);
});

test("rolloverStats resets daily count but preserves long-break counter", function () {
  const old = { dateKey: "Mon Jan 01 2001", focusBlocksToday: 7, focusBlocksSinceLong: 3 };
  const rolled = Core.rolloverStats(old, "Tue Jan 02 2001");
  assert(rolled.focusBlocksToday === 0, "focusBlocksToday should reset");
  assert(rolled.focusBlocksSinceLong === 3, "focusBlocksSinceLong should remain");
});

test("dateKey uses stable local ISO date format", function () {
  const key = Core.dateKey(new Date(2026, 6, 5, 23, 30, 0));

  assert(key === "2026-07-05", "expected local YYYY-MM-DD key, got " + key);
});

test("advanceTimerByElapsed transitions and credits focus completion", function () {
  const settings = Core.normalizeSettings({
    focus: 1,
    recall: 1,
    break: 1,
    long_break: 1,
    prep: 1,
    blocks_per_ultradian: 2,
  });
  const timer = {
    status: Core.STATUS.RUNNING,
    phase: "focus",
    focusBlockNumber: 1,
    remainingSec: 10,
  };
  const stats = Core.normalizeStats({
    dateKey: Core.dateKey(),
    focusBlocksToday: 0,
    focusBlocksSinceLong: 0,
  });

  const out = Core.advanceTimerByElapsed(timer, 12, settings, stats, { autoStart: true });
  assert(out.timer.phase === "recall", "expected recall after 12s from focus with 10s remaining");
  assert(timer.phase === "recall", "expected timer object to be advanced in place");
  assert(out.stats.focusBlocksToday === 1, "expected focusBlocksToday increment");
  assert(stats.focusBlocksToday === 1, "expected stats object to be advanced in place");
  assert(out.stats.focusBlocksSinceLong === 1, "expected focusBlocksSinceLong increment");
});

test("advanceTimerByElapsed requires explicit state objects", function () {
  const settings = Core.normalizeSettings(null);
  const stats = Core.normalizeStats(null);
  let threw = false;

  try {
    Core.advanceTimerByElapsed(null, 1, settings, stats);
  } catch {
    threw = true;
  }

  assert(threw === true, "expected missing timer to throw");
});

test("timer mutations reject unknown phases", function () {
  const settings = Core.normalizeSettings(null);
  const stats = Core.normalizeStats(null);
  const timer = {
    status: Core.STATUS.RUNNING,
    phase: Core.PHASE.FOCUS,
    focusBlockNumber: 1,
    remainingSec: 10,
  };

  assert.throws(function transitionToUnknownPhase() {
    Core.transitionToPhase(timer, stats, settings, "unknown");
  }, /known phases/);
  assert.equal(timer.phase, Core.PHASE.FOCUS);

  timer.phase = "unknown";
  assert.throws(function advanceUnknownPhase() {
    Core.advanceTimerByElapsed(timer, 1, settings, stats);
  }, /known timer phase/);
});

test("advanceTimerByElapsed handles large elapsed time without dropping transitions", function () {
  const settings = Core.normalizeSettings({
    prep: 1,
    focus: 1,
    recall: 1,
    break: 1,
    long_break: 1,
    blocks_per_ultradian: 2,
  });

  const timer = {
    status: Core.STATUS.RUNNING,
    phase: "focus",
    focusBlockNumber: 1,
    remainingSec: 1,
  };
  const stats = Core.normalizeStats({
    dateKey: Core.dateKey(),
    focusBlocksToday: 0,
    focusBlocksSinceLong: 0,
  });

  const out = Core.advanceTimerByElapsed(timer, 700, settings, stats, {
    autoStart: true,
    maxTransitions: 1000,
  });
  assert(out.events.length > 10, "expected many transitions for large elapsed time");
  assert(out.transitionLimitHit === false, "transition limit should not be hit here");
  assert(out.remainingElapsed === 0, "elapsed time should be fully consumed");
});

test("advanceTimerByElapsed follows a full two-block cycle into long break", function () {
  const settings = Core.normalizeSettings({
    prep_enabled: true,
    blocks_per_ultradian: 2,
    auto_start: true,
  });
  let timer = {
    status: Core.STATUS.RUNNING,
    phase: "prep",
    focusBlockNumber: 1,
    remainingSec: 1,
  };
  let stats = Core.normalizeStats({
    dateKey: Core.dateKey(),
    focusBlocksToday: 0,
    focusBlocksSinceLong: 0,
  });
  const phases = [timer.phase];

  while (timer.phase !== "long_break") {
    const out = Core.advanceTimerByElapsed(timer, 1, settings, stats, { autoStart: true });
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
  assert(timer.focusBlockNumber === 2, "expected second block to remain active through long break");
});

test("all phases have short and long guidance text", function () {
  Core.PHASES.forEach(function eachPhase(phase) {
    const shortHint = Content.PHASE_CONFIG[phase].shortHint;
    const longHint = Content.PHASE_CONFIG[phase].longHint;
    assert(
      typeof shortHint === "string" && shortHint.trim().length > 0,
      "missing short hint for " + phase
    );
    assert(
      typeof longHint === "string" && longHint.trim().length > 0,
      "missing long hint for " + phase
    );
  });
});

test("Focus guidance stays concise", function () {
  assert.equal(
    Content.PHASE_CONFIG.focus.longHint,
    "One task. Slightly challenging. No switching."
  );
});

test("Prep guidance contains instructions without repeating their rationale", function () {
  assert.equal(
    Content.PHASE_CONFIG.prep.longHint,
    "Stand up. Breathe slowly. Clearly state the one thing you’re about to do."
  );
});

test("normalizeSettings preserves wake lock preference", function () {
  const settings = Core.normalizeSettings({ wake_lock_enabled: true });
  assert(settings.wake_lock_enabled === true, "expected wake lock preference to normalize");
});

test("normalizeSettings preserves quiet mode preference", function () {
  const settings = Core.normalizeSettings({ quiet_mode_enabled: true });
  assert(settings.quiet_mode_enabled === true, "expected quiet mode preference to normalize");
});

test("normalizeSettings preserves the single-key shortcut preference", function () {
  const settings = Core.normalizeSettings({ single_key_shortcuts_enabled: false });
  assert.equal(settings.single_key_shortcuts_enabled, false);
});

test("countdown while suspended defaults on and can be disabled", function () {
  assert.equal(Core.normalizeSettings(null).continue_while_suspended, true);
  assert.equal(
    Core.normalizeSettings({ continue_while_suspended: false }).continue_while_suspended,
    false
  );
});

test("normalizeTimerState restores a persisted timer and suspension anchor", function () {
  const settings = Core.normalizeSettings(null);
  const timer = Core.normalizeTimerState(
    {
      status: Core.STATUS.RUNNING,
      phase: Core.PHASE.RECALL,
      focusBlockNumber: 3,
      remainingSec: 77,
      suspendedAtMs: 123456,
    },
    settings
  );

  assert(timer.status === Core.STATUS.RUNNING, "expected running status to restore");
  assert(timer.phase === Core.PHASE.RECALL, "expected phase to restore");
  assert(timer.focusBlockNumber === 3, "expected active block to restore");
  assert(timer.remainingSec === 77, "expected remaining time to restore unchanged");
  assert.equal(timer.suspendedAtMs, 123456);
  assert(timer.lastTickMs === null, "expected a fresh wall-clock anchor");
});

test("normalizeTimerState rejects invalid or inapplicable suspension anchors", function () {
  const settings = Core.normalizeSettings(null);

  assert.equal(
    Core.normalizeTimerState(
      { status: Core.STATUS.RUNNING, phase: Core.PHASE.FOCUS, suspendedAtMs: null },
      settings
    ).suspendedAtMs,
    null
  );
  assert.equal(
    Core.normalizeTimerState(
      { status: Core.STATUS.RUNNING, phase: Core.PHASE.FOCUS, suspendedAtMs: "invalid" },
      settings
    ).suspendedAtMs,
    null
  );
  assert.equal(
    Core.normalizeTimerState(
      { status: Core.STATUS.RUNNING, phase: Core.PHASE.FOCUS, suspendedAtMs: false },
      settings
    ).suspendedAtMs,
    null
  );
  assert.equal(
    Core.normalizeTimerState(
      { status: Core.STATUS.PAUSED, phase: Core.PHASE.FOCUS, suspendedAtMs: 123456 },
      settings
    ).suspendedAtMs,
    null
  );
});

test("normalizeTimerState bounds corrupted remaining time to the phase duration", function () {
  const settings = Core.normalizeSettings({ focus: 25 });
  const timer = Core.normalizeTimerState(
    {
      status: Core.STATUS.PAUSED,
      phase: Core.PHASE.FOCUS,
      focusBlockNumber: 1,
      remainingSec: 999999,
    },
    settings
  );

  assert.equal(timer.remainingSec, 25 * 60);
});
