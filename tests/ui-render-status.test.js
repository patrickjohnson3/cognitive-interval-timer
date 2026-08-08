const UIRender = require("../ui-render.js");
const AppConfig = require("../app-config.js");
const { controlButtonNode, textNode } = require("./helpers/dom.js");
const assert = require("node:assert/strict");
const test = require("node:test");

function resetDocument() {
  global.document = {
    title: "",
    nodes: {},
    documentElement: {
      attrs: {},
      setAttribute: function setAttribute(name, value) {
        this.attrs[name] = String(value);
      },
      removeAttribute: function removeAttribute(name) {
        delete this.attrs[name];
      },
    },
    querySelectorAll: function querySelectorAll() {
      return [];
    },
    getElementById: function getElementById(id) {
      return this.nodes[id] || null;
    },
  };
}

function createDeps() {
  resetDocument();
  const dom = {
    state: textNode(),
    time: textNode(),
    hint: textNode(),
    longHint: textNode(),
    today: textNode(),
    long: textNode(),
    focusBlockBadge: textNode(),
    focusBlockContext: textNode(),
    dirtyIndicator: textNode(),
    copy: {
      phaseSettingsHeading: textNode(),
      blocks: textNode(),
      prepEnabled: textNode(),
      autoStart: textNode(),
      soundEnabled: textNode(),
      quietModeEnabled: textNode(),
      fullscreenEnabled: textNode(),
      minimalModeEnabled: textNode(),
      wakeLockEnabled: textNode(),
      phaseLabels: {
        focus: textNode(),
      },
    },
    controls: {
      start: controlButtonNode(),
      activateDisplayModes: { hidden: true },
    },
    theme: { value: "dark" },
    tagline: textNode(),
    fields: {
      prep: { value: "" },
      focus: { value: "" },
      recall: { value: "" },
      break: { value: "" },
      long_break: { value: "" },
      blocks_per_ultradian: { value: "" },
      prep_enabled: { checked: false },
      auto_start: { checked: false },
      sound_enabled: { checked: false },
      quiet_mode_enabled: { checked: false },
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
    formatTime: function formatTime() {
      return "00:10";
    },
  };

  const storage = {
    mode: function mode() {
      return "local";
    },
  };

  const Content = {
    PHASE_CONFIG: {
      focus: {
        displayName: "Focus",
        shortHint: "One task.",
        longHint: "Long hint.",
      },
    },
    UI_COPY: {
      labels: {
        documentTitleBase: "Cognitive Interval Timer",
        documentTitleSeparator: " - ",
        focusBlocksTodayPrefix: "today: ",
        focusBlocksTodaySuffix: " focus blocks",
        sinceLongBreakPrefix: "long break: ",
        focusBlockPrefix: "Focus Block ",
        focusBlockReady: "Focus Block\nReady",
        focusBlockSessionSuffix: "of session",
        focusBlockReadyContext: "Ready to begin session.",
        unsavedChanges: "Unsaved Changes",
        allSettingsSaved: "All Settings Saved",
        storageUnavailable: "Settings are not being saved in this browser.",
        primaryActionIcons: {
          idle: "▶",
          running: "⏸",
          paused: "▶",
        },
        primaryActionLabels: {
          idle: "Start",
          running: "Pause",
          paused: "Resume",
        },
        primaryActionAriaLabels: {
          idle: "Start timer",
          running: "Pause timer",
          paused: "Resume timer",
        },
      },
    },
  };

  return { dom, Core, Content, AppConfig, storage };
}

function baseState() {
  return {
    timer: {
      phase: "focus",
      focusBlockNumber: 0,
      remainingSec: 10,
      status: "idle",
    },
    stats: {
      focusBlocksToday: 0,
      focusBlocksSinceLong: 0,
    },
    settings: {
      blocks_per_ultradian: 2,
      quiet_mode_enabled: false,
    },
    ui: {
      settingsDirty: false,
      storageWarning: false,
    },
  };
}

test("primary button shows Start before timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  render.render(state);
  assert(deps.dom.controls.start.icon.textContent === "▶", "expected Start icon");
  assert(
    deps.dom.controls.start.label.textContent === "Start",
    "expected Start label before first start"
  );
  assert(
    deps.dom.controls.start.attributes["aria-label"] === "Start timer",
    "expected Start aria label"
  );
});

test("saved display activation control reflects availability", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  render.setDisplayActivationAvailable(true);
  assert.equal(deps.dom.controls.activateDisplayModes.hidden, false);
  render.setDisplayActivationAvailable(false);
  assert.equal(deps.dom.controls.activateDisplayModes.hidden, true);
});

test("renderer owns display field and minimal-mode DOM updates", function () {
  const deps = createDeps();
  deps.Core.SETTING_FIELDS = [{ key: "wake_lock_enabled", type: "boolean" }];
  const render = UIRender.create(deps);

  render.setSettingField("wake_lock_enabled", true);
  render.setMinimalModeActive(true);

  assert.equal(deps.dom.fields.wake_lock_enabled.checked, true);
  assert.equal(global.document.documentElement.attrs["data-minimal-mode"], "true");

  render.setMinimalModeActive(false);
  assert.equal(global.document.documentElement.attrs["data-minimal-mode"], undefined);
});

test("static UI copy is hydrated by the renderer", function () {
  const deps = createDeps();
  deps.Core.PHASES = ["focus"];
  deps.Content.UI_COPY.phaseSettingsHeading = "Cycle Structure";
  deps.Content.UI_COPY.blocksBeforeLongBreak = "Blocks";
  deps.Content.UI_COPY.startWithPrep = "Prep enabled";
  deps.Content.UI_COPY.autoStartNext = "Auto-start";
  deps.Content.UI_COPY.soundOnPhaseChange = "Sound";
  deps.Content.UI_COPY.quietMode = "Quiet";
  deps.Content.UI_COPY.fullscreenMode = "Fullscreen";
  deps.Content.UI_COPY.minimalMode = "Minimal";
  deps.Content.UI_COPY.keepScreenAwake = "Awake";
  const render = UIRender.create(deps);

  render.hydrateStaticContent();

  assert.equal(deps.dom.copy.phaseSettingsHeading.textContent, "Cycle Structure");
  assert.equal(deps.dom.copy.phaseLabels.focus.textContent, "Focus");
});

test("hydrateTheme updates browser theme color", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const themeColor = textNode();
  document.nodes["theme-color-meta"] = themeColor;

  render.hydrateTheme("light");
  assert(
    themeColor.attributes.content === AppConfig.themeColors.light,
    "expected light browser theme color"
  );

  render.hydrateTheme("dark");
  assert(
    themeColor.attributes.content === AppConfig.themeColors.dark,
    "expected dark browser theme color"
  );

  delete document.nodes["theme-color-meta"];
});

test("stats use compact lowercase labels", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  render.render(state);
  assert(deps.dom.today.textContent === "today: 0 focus blocks", "expected compact today stats");
  assert(deps.dom.long.textContent === "long break: 0 / 2", "expected compact long break stats");
});

test("storage warning overrides saved settings text", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.ui.storageWarning = true;
  render.render(state);
  assert(
    deps.dom.dirtyIndicator.textContent === "Settings are not being saved in this browser.",
    "expected persistent storage warning"
  );
});

test("focus block badge shows Ready before timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  render.render(state);
  assert(
    deps.dom.focusBlockBadge.textContent === "Focus Block\nReady",
    "expected ready focus block label"
  );
  assert(
    deps.dom.focusBlockBadge.attributes["aria-label"] === "Focus Block Ready",
    "expected ready aria label"
  );
  assert(
    deps.dom.focusBlockContext.textContent === "Ready to begin session.",
    "expected ready focus block context"
  );
});

test("document title stays static before timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  render.render(state);
  assert(
    document.title === "Cognitive Interval Timer",
    "expected static document title before first start"
  );
});

test("primary button shows Resume after timer is paused", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.status = "paused";
  state.timer.focusBlockNumber = 1;
  render.render(state);
  assert(deps.dom.controls.start.icon.textContent === "▶", "expected Resume icon");
  assert(
    deps.dom.controls.start.label.textContent === "Resume",
    "expected Resume label while paused"
  );
  assert(
    deps.dom.controls.start.attributes["aria-label"] === "Resume timer",
    "expected Resume aria label"
  );
});

test("focus block badge uses one-based display after timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.status = "paused";
  state.timer.focusBlockNumber = 1;
  render.render(state);
  assert(
    deps.dom.focusBlockBadge.textContent === "Focus Block 1",
    "expected first focus block label"
  );
  assert(
    deps.dom.focusBlockContext.textContent === "of session",
    "expected focus block session context"
  );
  assert(
    deps.dom.focusBlockBadge.attributes["aria-label"] === "Focus Block 1 of session",
    "expected first focus block aria label"
  );
});

test("focus block badge displays the active session block instead of daily completions", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.status = "paused";
  state.timer.focusBlockNumber = 2;
  state.stats.focusBlocksToday = 7;

  render.render(state);

  assert(deps.dom.focusBlockBadge.textContent === "Focus Block 2", "expected active block number");
});

test("primary button shows Pause while timer is running", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.status = "running";
  state.timer.focusBlockNumber = 1;
  render.render(state);
  assert(deps.dom.controls.start.icon.textContent === "⏸", "expected Pause icon");
  assert(
    deps.dom.controls.start.label.textContent === "Pause",
    "expected Pause label while running"
  );
  assert(
    deps.dom.controls.start.attributes["aria-label"] === "Pause timer",
    "expected Pause aria label"
  );
});

test("document title includes timer after timer has started", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.timer.status = "paused";
  state.timer.focusBlockNumber = 1;
  render.render(state);
  assert(
    document.title === "00:10 - Focus | Cognitive Interval Timer",
    "expected timer document title after first start"
  );
});
