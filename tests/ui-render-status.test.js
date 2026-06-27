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
    controls: {
      pause: textNode(),
    },
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
      fullscreen_enabled: { checked: false },
      minimal_mode_enabled: { checked: false },
      wake_lock_enabled: { checked: false },
    },
  };

  const Core = {
    STATUS: {
      IDLE: "idle",
      RUNNING: "running",
      PAUSED: "paused",
    },
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

  const Content = {
    UI_COPY: {
      labels: {
        documentTitleBase: "Cognitive Interval Timer",
        documentTitleSeparator: " - ",
        pauseButton: "⏸ Pause",
        resumeButton: "▶ Resume",
      },
    },
  };

  return { dom, Core, Content, storage };
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

test("document title stays static before timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  render.render(state);
  assert(document.title === "Cognitive Interval Timer", "expected static document title before first start");
});

test("status shows Paused after timer has started at least once", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.hasStartedOnce = true;
  render.render(state);
  assert(deps.dom.status.textContent === "Status: Paused", "expected Paused after first start");
});

test("pause button shows Resume after timer is paused", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.hasStartedOnce = true;
  render.render(state);
  assert(deps.dom.controls.pause.textContent === "▶ Resume", "expected Resume label while paused");
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

test("pause button shows Pause while timer is running", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.running = true;
  state.timer.hasStartedOnce = true;
  render.render(state);
  assert(deps.dom.controls.pause.textContent === "⏸ Pause", "expected Pause label while running");
});

test("document title includes timer after timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.hasStartedOnce = true;
  render.render(state);
  assert(
    document.title === "00:10 - Focus | Cognitive Interval Timer",
    "expected timer document title after first start"
  );
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
