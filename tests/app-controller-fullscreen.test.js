const AppController = require("../app-controller.js");
const Core = require("../core.js");
const Content = require("../content.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      result
        .then(function asyncPass() {
          console.log("PASS", name);
        })
        .catch(function asyncFail(err) {
          console.error("FAIL", name);
          console.error("  " + err.message);
          process.exitCode = 1;
        });
      return;
    }
    console.log("PASS", name);
  } catch (err) {
    console.error("FAIL", name);
    console.error("  " + err.message);
    process.exitCode = 1;
  }
}

function flushPromises() {
  return new Promise(function resolveSoon(resolve) {
    setTimeout(resolve, 0);
  });
}

function createNode(value) {
  return {
    textContent: "",
    value: value == null ? "" : String(value),
    checked: false,
  };
}

function createDom() {
  return {
    copy: {
      phaseSettingsHeading: createNode(),
      blocks: createNode(),
      prepEnabled: createNode(),
      autoStart: createNode(),
      soundEnabled: createNode(),
      quietModeEnabled: createNode(),
      fullscreenEnabled: createNode(),
      minimalModeEnabled: createNode(),
      wakeLockEnabled: createNode(),
      phaseLabels: {
        prep: createNode(),
        focus: createNode(),
        recall: createNode(),
        break: createNode(),
        long_break: createNode(),
      },
    },
    fields: {
      prep: createNode(2),
      focus: createNode(45),
      recall: createNode(3),
      break: createNode(15),
      long_break: createNode(25),
      blocks_per_ultradian: createNode(2),
      prep_enabled: createNode(),
      auto_start: createNode(),
      sound_enabled: createNode(),
      quiet_mode_enabled: createNode(),
      fullscreen_enabled: createNode(),
      minimal_mode_enabled: createNode(),
      wake_lock_enabled: createNode(),
    },
  };
}

function setup(options) {
  const config = options || {};
  const dom = createDom();
  const stored = {};
  if (config.storedSettings) {
    stored[Core.STORAGE_KEYS.settings] = config.storedSettings;
  }
  const fullscreenRequests = [];
  let boundHandlers = null;
  const wakeLockCalls = [];
  const timerCalls = [];
  const hapticCalls = [];
  const audioCalls = [];
  const transitionCalls = [];
  const historyCalls = [];
  const windowListeners = {};

  global.document = {
    fullscreenElement: null,
    documentElement: {
      attrs: {},
      setAttribute: function setAttribute(name, value) {
        this.attrs[name] = String(value);
      },
      removeAttribute: function removeAttribute(name) {
        delete this.attrs[name];
      },
      hasAttribute: function hasAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attrs, name);
      },
      requestFullscreen: function requestFullscreen() {
        fullscreenRequests.push(true);
        if (config.rejectFullscreen) {
          return Promise.reject(new Error("fullscreen unavailable"));
        }
        return Promise.resolve();
      },
    },
    exitFullscreen: function exitFullscreen() {
      fullscreenRequests.push(false);
      return Promise.resolve();
    },
  };

  const controls = {
    bindControls: function bindControls(handlers) {
      boundHandlers = handlers;
    },
    readSettingsForm: function readSettingsForm() {
      return {
        prep: dom.fields.prep.value,
        focus: dom.fields.focus.value,
        recall: dom.fields.recall.value,
        break: dom.fields.break.value,
        long_break: dom.fields.long_break.value,
        blocks_per_ultradian: dom.fields.blocks_per_ultradian.value,
        prep_enabled: dom.fields.prep_enabled.checked,
        auto_start: dom.fields.auto_start.checked,
        sound_enabled: dom.fields.sound_enabled.checked,
        quiet_mode_enabled: dom.fields.quiet_mode_enabled.checked,
        fullscreen_enabled: dom.fields.fullscreen_enabled.checked,
        minimal_mode_enabled: dom.fields.minimal_mode_enabled.checked,
        wake_lock_enabled: dom.fields.wake_lock_enabled.checked,
      };
    },
  };

  const windowRef = {
    history: {
      pushState: function pushState(state, title) {
        historyCalls.push({ type: "pushState", state, title });
      },
      back: function back() {
        historyCalls.push({ type: "back" });
      },
    },
    addEventListener: function addEventListener(type, handler) {
      windowListeners[type] = handler;
    },
  };

  const render = {
    setTagline: function setTagline() {},
    hydrateTheme: function hydrateTheme() {},
    hydrateSettingsForm: function hydrateSettingsForm(settings) {
      Object.keys(settings).forEach(function eachSetting(key) {
        if (!dom.fields[key]) return;
        if (typeof settings[key] === "boolean") dom.fields[key].checked = settings[key];
        else dom.fields[key].value = String(settings[key]);
      });
    },
    render: function render() {},
  };

  const app = AppController.create({
    Core,
    Content,
    announce: {
      flashMessage: function flashMessage() {},
      showTransition: function showTransition(message) {
        transitionCalls.push(message);
      },
      announce: function announce() {},
    },
    render,
    controls,
    timer: {
      startTicker: function startTicker() {},
      start: function start() {
        timerCalls.push("start");
      },
      pause: function pause() {
        timerCalls.push("pause");
      },
      skip: function skip() {},
      reset: function reset() {},
      resetToPhase: function resetToPhase() {},
    },
    storage: {
      getJSON: function getJSON(key, fallback) {
        return Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : fallback;
      },
      setJSON: function setJSON(key, value) {
        stored[key] = value;
        if (Object.prototype.hasOwnProperty.call(config, "storageWriteResult")) {
          return config.storageWriteResult;
        }
        return true;
      },
      getText: function getText(key, fallback) {
        return fallback;
      },
      setText: function setText() {
        if (Object.prototype.hasOwnProperty.call(config, "storageWriteResult")) {
          return config.storageWriteResult;
        }
        return true;
      },
      mode: function mode() {
        return config.storageMode || "local";
      },
    },
    audio: {
      playPhaseChime: function playPhaseChime() {
        audioCalls.push("phase");
      },
    },
    haptics: {
      tap: function tap() {
        hapticCalls.push("tap");
      },
      phaseChange: function phaseChange() {
        hapticCalls.push("phase");
      },
    },
    wakeLock: {
      setEnabled: function setEnabled(enabled) {
        wakeLockCalls.push(Boolean(enabled));
        if (Object.prototype.hasOwnProperty.call(config, "wakeLockResult")) {
          return Promise.resolve(config.wakeLockResult);
        }
        return Promise.resolve(true);
      },
    },
    a11y: {
      applyAriaDefaults: function applyAriaDefaults() {},
      formatAnnouncement: function formatAnnouncement() {
        return "";
      },
    },
    dom,
    windowRef,
  });

  app.controller.initialize();
  return {
    app,
    boundHandlers,
    dom,
    fullscreenRequests,
    stored,
    timerCalls,
    wakeLockCalls,
    hapticCalls,
    audioCalls,
    transitionCalls,
    historyCalls,
    windowListeners,
  };
}

test("primary action starts before timer has started", function () {
  const ctx = setup();
  ctx.boundHandlers.onPrimaryAction();

  assert(ctx.timerCalls.includes("start"), "expected primary action to start timer");
  assert(ctx.hapticCalls.includes("tap"), "expected primary action haptic tap");
});

test("primary action pauses while timer is running", function () {
  const ctx = setup();
  ctx.app.state.timer.running = true;
  ctx.app.state.timer.hasStartedOnce = true;
  ctx.boundHandlers.onPrimaryAction();

  assert(ctx.timerCalls.includes("pause"), "expected primary action to pause timer");
  assert(ctx.hapticCalls.includes("tap"), "expected pause haptic tap");
});

test("primary action resumes while timer is paused", function () {
  const ctx = setup();
  ctx.app.state.timer.running = false;
  ctx.app.state.timer.hasStartedOnce = true;
  ctx.boundHandlers.onPrimaryAction();

  assert(ctx.timerCalls.includes("start"), "expected primary action to resume timer");
  assert(ctx.hapticCalls.includes("tap"), "expected resume haptic tap");
});

test("phase changes trigger phase haptic feedback", function () {
  const ctx = setup();
  ctx.app.onPhaseChange({ from: Core.PHASE.FOCUS, to: Core.PHASE.RECALL, label: "Recall" });

  assert(ctx.hapticCalls.includes("phase"), "expected phase-change haptic feedback");
  assert(ctx.audioCalls.includes("phase"), "expected phase-change sound");
  assert(
    ctx.transitionCalls.includes("Focus complete. Recall starts now."),
    "expected readable phase transition"
  );
});

test("initial phase start does not show completion transition", function () {
  const ctx = setup();
  ctx.app.onPhaseChange({ from: null, to: Core.PHASE.FOCUS, label: "Focus" });

  assert(ctx.transitionCalls.length === 0, "initial start should not show completion transition");
});

test("quiet mode suppresses tap feedback", function () {
  const ctx = setup({ storedSettings: Core.normalizeSettings({ quiet_mode_enabled: true }) });
  ctx.boundHandlers.onPrimaryAction();

  assert(ctx.timerCalls.includes("start"), "expected primary action to start timer");
  assert(!ctx.hapticCalls.includes("tap"), "expected quiet mode to suppress tap haptics");
});

test("quiet mode suppresses phase sound and haptics", function () {
  const ctx = setup({
    storedSettings: Core.normalizeSettings({ quiet_mode_enabled: true, sound_enabled: true }),
  });
  ctx.app.onPhaseChange({ label: "Focus" });

  assert(!ctx.hapticCalls.includes("phase"), "expected quiet mode to suppress phase haptics");
  assert(!ctx.audioCalls.includes("phase"), "expected quiet mode to suppress phase sound");
});

test("memory-only storage shows a persistence warning", function () {
  const ctx = setup({ storageMode: "memory" });

  assert(ctx.app.state.ui.storageWarning === true, "expected memory storage warning");
});

test("failed storage write shows a persistence warning", function () {
  const ctx = setup({ storageWriteResult: false });
  ctx.app.controller.saveSettings({
    prep: 2,
    focus: 45,
    recall: 3,
    break: 15,
    long_break: 25,
    blocks_per_ultradian: 2,
    prep_enabled: true,
    auto_start: true,
    sound_enabled: true,
    fullscreen_enabled: false,
    minimal_mode_enabled: false,
    wake_lock_enabled: false,
  });

  assert(ctx.app.state.ui.storageWarning === true, "expected failed storage warning");
});

test("fullscreen toggle enables keep screen awake", function () {
  const ctx = setup();
  ctx.boundHandlers.onFullscreenToggle(true);

  assert(
    ctx.dom.fields.wake_lock_enabled.checked === true,
    "expected wake lock checkbox to be checked"
  );
  assert(ctx.wakeLockCalls.includes(true), "expected wake lock to be requested");
});

test("minimal mode toggle requests keep screen awake once", function () {
  const ctx = setup();
  ctx.boundHandlers.onMinimalModeToggle(true);

  assert(
    ctx.wakeLockCalls.filter(function isEnableCall(call) {
      return call === true;
    }).length === 1,
    "expected one wake lock enable request"
  );
});

test("saving fullscreen preserves keep screen awake field state", function () {
  const ctx = setup();
  ctx.app.controller.saveSettings({
    prep: 2,
    focus: 45,
    recall: 3,
    break: 15,
    long_break: 25,
    blocks_per_ultradian: 2,
    prep_enabled: true,
    auto_start: true,
    sound_enabled: true,
    fullscreen_enabled: true,
    minimal_mode_enabled: false,
    wake_lock_enabled: false,
  });

  const saved = ctx.stored[Core.STORAGE_KEYS.settings];
  assert(saved.fullscreen_enabled === true, "expected fullscreen setting to save");
  assert(saved.wake_lock_enabled === true, "expected fullscreen to save wake lock preference");
});

test("fullscreen rejection clears fullscreen field", async function () {
  const ctx = setup({ rejectFullscreen: true });
  ctx.dom.fields.fullscreen_enabled.checked = true;
  await ctx.boundHandlers.onFullscreenToggle(true);

  assert(
    ctx.dom.fields.fullscreen_enabled.checked === false,
    "expected fullscreen checkbox to clear"
  );
  assert(
    ctx.app.state.ui.settingsDirty === true,
    "expected auto-enabled wake lock to remain unsaved"
  );
});

test("saved fullscreen is cleared when fullscreen request fails on startup", async function () {
  const ctx = setup({
    rejectFullscreen: true,
    storedSettings: Core.normalizeSettings({ fullscreen_enabled: true, wake_lock_enabled: true }),
  });

  await flushPromises();
  assert(ctx.fullscreenRequests.includes(true), "expected saved fullscreen to request fullscreen");
  assert(
    ctx.dom.fields.fullscreen_enabled.checked === false,
    "expected fullscreen checkbox to clear"
  );
  assert(
    ctx.stored[Core.STORAGE_KEYS.settings].fullscreen_enabled === false,
    "expected saved fullscreen to clear"
  );
});

test("minimal mode toggle enables keep screen awake", function () {
  const ctx = setup();
  ctx.boundHandlers.onMinimalModeToggle(true);

  assert(
    ctx.dom.fields.wake_lock_enabled.checked === true,
    "expected wake lock checkbox to be checked"
  );
  assert(ctx.wakeLockCalls.includes(true), "expected wake lock to be requested");
});

test("minimal mode pushes a single back-button history entry", function () {
  const ctx = setup();
  ctx.boundHandlers.onMinimalModeToggle(true);
  ctx.boundHandlers.onMinimalModeToggle(true);

  const pushes = ctx.historyCalls.filter(function isPush(call) {
    return call.type === "pushState";
  });
  assert(pushes.length === 1, "expected one minimal mode history entry");
  assert(
    pushes[0].state.appState === "minimal-mode",
    "expected minimal mode marker in history state"
  );
});

test("Android back exits minimal mode before leaving the app", function () {
  const ctx = setup();
  ctx.dom.fields.minimal_mode_enabled.checked = true;
  ctx.boundHandlers.onMinimalModeToggle(true);

  ctx.windowListeners.popstate({});

  assert(
    !global.document.documentElement.hasAttribute("data-minimal-mode"),
    "expected back navigation to exit minimal mode"
  );
  assert(
    ctx.dom.fields.minimal_mode_enabled.checked === false,
    "expected minimal mode checkbox to clear"
  );
  assert(
    !ctx.historyCalls.some(function isBack(call) {
      return call.type === "back";
    }),
    "expected hardware back handling not to call history.back again"
  );
});

test("Android fullscreen exit also exits minimal mode", function () {
  const ctx = setup();
  ctx.dom.fields.minimal_mode_enabled.checked = true;
  ctx.boundHandlers.onMinimalModeToggle(true);

  ctx.boundHandlers.onFullscreenChange(false);

  assert(
    !global.document.documentElement.hasAttribute("data-minimal-mode"),
    "expected fullscreen exit to exit minimal mode"
  );
  assert(
    ctx.dom.fields.minimal_mode_enabled.checked === false,
    "expected fullscreen exit to clear minimal mode checkbox"
  );
  assert(
    ctx.historyCalls.some(function isBack(call) {
      return call.type === "back";
    }),
    "expected fullscreen exit to remove minimal mode history entry"
  );
});

test("exiting minimal mode restores current fullscreen form state", function () {
  const ctx = setup();
  global.document.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.dom.fields.fullscreen_enabled.checked = true;
  ctx.dom.fields.minimal_mode_enabled.checked = true;

  ctx.boundHandlers.onExitMinimalMode();

  assert(
    ctx.fullscreenRequests.includes(true),
    "expected exit from minimal mode to honor current fullscreen field"
  );
});

test("exiting minimal mode from UI removes the synthetic history entry", function () {
  const ctx = setup();
  ctx.dom.fields.minimal_mode_enabled.checked = true;
  ctx.boundHandlers.onMinimalModeToggle(true);

  ctx.boundHandlers.onExitMinimalMode();

  assert(
    ctx.historyCalls.some(function isBack(call) {
      return call.type === "back";
    }),
    "expected UI exit to remove minimal mode history entry"
  );
  assert(
    !global.document.documentElement.hasAttribute("data-minimal-mode"),
    "expected UI exit to remove minimal mode attribute"
  );
});

test("wake lock rejection clears wake lock field", async function () {
  const ctx = setup({ wakeLockResult: false });
  ctx.dom.fields.wake_lock_enabled.checked = true;
  await ctx.boundHandlers.onWakeLockToggle(true);

  assert(
    ctx.dom.fields.wake_lock_enabled.checked === false,
    "expected wake lock checkbox to clear"
  );
  assert(ctx.app.state.ui.settingsDirty === false, "expected rejected wake lock to avoid dirty UI");
});

test("saved wake lock is cleared when request fails on startup", async function () {
  const ctx = setup({
    wakeLockResult: false,
    storedSettings: Core.normalizeSettings({ wake_lock_enabled: true }),
  });

  await flushPromises();
  assert(ctx.wakeLockCalls.includes(true), "expected saved wake lock to be requested");
  assert(
    ctx.dom.fields.wake_lock_enabled.checked === false,
    "expected wake lock checkbox to clear"
  );
  assert(
    ctx.stored[Core.STORAGE_KEYS.settings].wake_lock_enabled === false,
    "expected saved wake lock setting to clear"
  );
});

test("saving minimal mode preserves keep screen awake field state", function () {
  const ctx = setup();
  ctx.app.controller.saveSettings({
    prep: 2,
    focus: 45,
    recall: 3,
    break: 15,
    long_break: 25,
    blocks_per_ultradian: 2,
    prep_enabled: true,
    auto_start: true,
    sound_enabled: true,
    fullscreen_enabled: false,
    minimal_mode_enabled: true,
    wake_lock_enabled: false,
  });

  const saved = ctx.stored[Core.STORAGE_KEYS.settings];
  assert(saved.minimal_mode_enabled === true, "expected minimal mode setting to save");
  assert(saved.wake_lock_enabled === true, "expected minimal mode to save wake lock preference");
});
