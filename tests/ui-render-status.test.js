const UIRender = require("../ui-render.js");

global.document = {
  title: "",
  documentElement: {
    setAttribute: function setAttribute() {},
  },
};

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

function textNode() {
  return { textContent: "" };
}

function createDeps() {
  const dom = {
    state: textNode(),
    time: textNode(),
    hint: textNode(),
    longHint: textNode(),
    today: textNode(),
    long: textNode(),
    status: textNode(),
    cycleBadge: textNode(),
    dirtyIndicator: textNode(),
    sessionNote: textNode(),
    theme: { value: "dark" },
    tagline: textNode(),
    fields: {
      prime: { value: "" },
      focus: { value: "" },
      recall: { value: "" },
      break: { value: "" },
      long_break: { value: "" },
      blocks_per_ultradian: { value: "" },
      prime_enabled: { checked: false },
      auto_start: { checked: false },
      sound_enabled: { checked: false },
    },
  };

  const Core = {
    stateLabel: function stateLabel() {
      return "Focus";
    },
    formatTime: function formatTime() {
      return "00:10";
    },
    STATE_HINTS: { focus: "One task." },
    STATE_LONG_HINTS: { focus: "Long hint." },
  };

  const storage = {
    mode: function mode() {
      return "local";
    },
  };

  return { dom, Core, storage };
}

function baseState() {
  return {
    timer: {
      phase: "focus",
      remainingSec: 10,
      running: false,
      hasStartedOnce: false,
    },
    stats: {
      focusBlocksToday: 0,
      focusBlocksSinceLong: 0,
    },
    settings: {
      blocks_per_ultradian: 2,
    },
    ui: {
      settingsDirty: false,
      sessionFlags: {
        changedAutoStart: false,
        changedSound: false,
      },
    },
  };
}

test("status shows Idle before timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  render.render(state);
  assert(deps.dom.status.textContent === "Status: Idle", "expected Idle before first start");
});

test("status shows Paused after timer has started at least once", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.hasStartedOnce = true;
  render.render(state);
  assert(deps.dom.status.textContent === "Status: Paused", "expected Paused after first start");
});

test("status shows Running when timer is active", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.running = true;
  state.timer.hasStartedOnce = true;
  render.render(state);
  assert(deps.dom.status.textContent === "Status: Running", "expected Running while active");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
