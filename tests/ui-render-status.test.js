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
    cycleSummary: textNode(),
    cycleFocus: textNode(),
    cycleRecall: textNode(),
    cycleBreak: textNode(),
    today: textNode(),
    long: textNode(),
    focusBlockBadge: textNode(),
    focusBlockContext: textNode(),
    protocolStatus: textNode(),
    sessionStatus: Object.assign(textNode(), { hidden: true }),
    dirtyIndicator: textNode(),
    copy: {
      phaseSettingsHeading: textNode(),
      blocks: textNode(),
      prepEnabled: textNode(),
      autoStart: textNode(),
      soundEnabled: textNode(),
      quietModeEnabled: textNode(),
      singleKeyShortcutsEnabled: textNode(),
      fullscreenEnabled: textNode(),
      minimalModeEnabled: textNode(),
      wakeLockEnabled: textNode(),
      phaseLabels: {
        focus: textNode(),
      },
    },
    controls: {
      start: controlButtonNode(),
      minimalPrimaryAction: controlButtonNode(),
      activateDisplayModes: { hidden: true },
      restoreRecommendedTiming: { hidden: true },
      openSettings: textNode(),
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
      single_key_shortcuts_enabled: { checked: true },
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
    usesRecommendedTiming: function usesRecommendedTiming(settings) {
      return settings.focus === 45;
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
      break: {
        displayName: "Short Break",
        shortHint: "Step away.",
        longHint: "Recover before the next focus block.",
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
        recommendedProtocol: "Recommended protocol",
        customTiming: "Custom timing",
        unsavedChanges: "Unsaved Changes",
        allSettingsSaved: "All Settings Saved",
        storageUnavailable: "Settings are not being saved in this browser.",
        sessionInUse: "Another window is using this timer session.",
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
      focus: 45,
      recall: 3,
      break: 15,
      blocks_per_ultradian: 2,
      quiet_mode_enabled: false,
    },
    ui: {
      settingsDirty: false,
      storageWarning: false,
      storageCorruption: false,
      sessionConflict: false,
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
  assert.equal(deps.dom.controls.minimalPrimaryAction.label.textContent, "Start");
  assert.equal(deps.dom.controls.minimalPrimaryAction.attributes["aria-label"], "Start timer");
});

test("renderer exposes the current phase and timer status for semantic styling", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();

  render.render(state);
  assert.equal(global.document.documentElement.attrs["data-phase"], "focus");
  assert.equal(global.document.documentElement.attrs["data-timer-status"], "idle");

  state.timer.phase = "break";
  state.timer.status = "running";
  render.render(state);
  assert.equal(global.document.documentElement.attrs["data-phase"], "break");
  assert.equal(global.document.documentElement.attrs["data-timer-status"], "running");
});

test("session conflicts appear beside the timer controls", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.ui.sessionConflict = true;

  render.render(state);

  assert.equal(deps.dom.sessionStatus.hidden, false);
  assert.equal(deps.dom.sessionStatus.textContent, "Another window is using this timer session.");

  state.ui.sessionConflict = false;
  render.render(state);
  assert.equal(deps.dom.sessionStatus.hidden, true);
});

test("cycle summary reflects the active duration settings", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();

  render.render(state);

  assert.equal(deps.dom.cycleFocus.textContent, "45");
  assert.equal(deps.dom.cycleRecall.textContent, "3");
  assert.equal(deps.dom.cycleBreak.textContent, "15");
  assert.equal(
    deps.dom.cycleSummary.attributes["aria-label"],
    "Cycle: 45 minutes focus, 3 minutes recall, 15 minutes short break"
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

  render.hydrateTheme("signal");
  assert(
    themeColor.attributes.content === AppConfig.themeColors.signal,
    "expected signal browser theme color"
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

test("recommended protocol marker follows the settings draft", function () {
  const deps = createDeps();
  const render = UIRender.create(deps);
  const state = baseState();
  state.draftSettings = Object.assign({}, state.settings);

  render.render(state);
  assert.equal(deps.dom.protocolStatus.textContent, "Recommended protocol");
  assert.equal(deps.dom.controls.restoreRecommendedTiming.hidden, true);

  state.draftSettings.focus = 30;
  render.render(state);
  assert.equal(deps.dom.protocolStatus.textContent, "Custom timing");
  assert.equal(deps.dom.controls.restoreRecommendedTiming.hidden, false);
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
