const UIRender = require("../ui-render.js");
const ViewModel = require("../view-model.js");

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
  return {
    textContent: "",
    attributes: {},
    setAttribute: function setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
  };
}

function createDeps() {
  const dom = {
    state: textNode(),
    time: textNode(),
    hint: textNode(),
    longHint: textNode(),
    today: textNode(),
    long: textNode(),
    focusBlockBadge: textNode(),
    dirtyIndicator: textNode(),
    sessionNote: textNode(),
    controls: {
      start: textNode(),
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
        focusBlocksTodayPrefix: "today: ",
        focusBlocksTodaySuffix: " focus blocks",
        sinceLongBreakPrefix: "long break: ",
        focusBlockPrefix: "Focus Block ",
        focusBlockReady: "Focus Block\nReady",
        primaryActionLabels: {
          idle: "▶ Start",
          running: "⏸ Pause",
          paused: "▶ Resume",
        },
        primaryActionAriaLabels: {
          idle: "Start timer",
          running: "Pause timer",
          paused: "Resume timer",
        },
      },
    },
  };

  return { dom, viewModel: ViewModel.create({ Core, Content }), storage };
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

test("primary button shows Start before timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  render.render(state);
  assert(deps.dom.controls.start.textContent === "▶ Start", "expected Start label before first start");
  assert(deps.dom.controls.start.attributes["aria-label"] === "Start timer", "expected Start aria label");
});

test("stats use compact lowercase labels", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  render.render(state);
  assert(deps.dom.today.textContent === "today: 0 focus blocks", "expected compact today stats");
  assert(deps.dom.long.textContent === "long break: 0 / 2", "expected compact long break stats");
});

test("focus block badge shows Ready before timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  render.render(state);
  assert(deps.dom.focusBlockBadge.textContent === "Focus Block\nReady", "expected ready focus block label");
  assert(deps.dom.focusBlockBadge.attributes["aria-label"] === "Focus Block Ready", "expected ready aria label");
});

test("document title stays static before timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  render.render(state);
  assert(document.title === "Cognitive Interval Timer", "expected static document title before first start");
});

test("primary button shows Resume after timer is paused", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.hasStartedOnce = true;
  render.render(state);
  assert(deps.dom.controls.start.textContent === "▶ Resume", "expected Resume label while paused");
  assert(deps.dom.controls.start.attributes["aria-label"] === "Resume timer", "expected Resume aria label");
});

test("focus block badge uses one-based display after timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.hasStartedOnce = true;
  render.render(state);
  assert(deps.dom.focusBlockBadge.textContent === "Focus Block 1", "expected first focus block label");
  assert(deps.dom.focusBlockBadge.attributes["aria-label"] === "Focus Block 1", "expected first focus block aria label");
});

test("primary button shows Pause while timer is running", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.running = true;
  state.timer.hasStartedOnce = true;
  render.render(state);
  assert(deps.dom.controls.start.textContent === "⏸ Pause", "expected Pause label while running");
  assert(deps.dom.controls.start.attributes["aria-label"] === "Pause timer", "expected Pause aria label");
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
