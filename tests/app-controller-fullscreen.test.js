const AppController = require("../app-controller.js");
const Core = require("../core.js");
const Content = require("../content.js");
const assert = require("node:assert/strict");
const test = require("node:test");

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
    controls: {
      activateDisplayModes: createNode(),
    },
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
  if (config.storedTimer) {
    stored[Core.STORAGE_KEYS.timer] = config.storedTimer;
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
  const documentListeners = {};

  global.document = {
    fullscreenElement: null,
    visibilityState: "visible",
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
    addEventListener: function addEventListener(type, handler) {
      documentListeners[type] = handler;
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
    hydrateStaticContent: function hydrateStaticContent() {},
    hydrateTheme: function hydrateTheme() {},
    hydrateSettingsForm: function hydrateSettingsForm(settings) {
      Object.keys(settings).forEach(function eachSetting(key) {
        if (!dom.fields[key]) return;
        if (typeof settings[key] === "boolean") dom.fields[key].checked = settings[key];
        else dom.fields[key].value = String(settings[key]);
      });
    },
    setDisplayActivationAvailable: function setDisplayActivationAvailable(available) {
      dom.controls.activateDisplayModes.hidden = !available;
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
      resetToPhase: function resetToPhase(phase) {
        timerCalls.push("resetToPhase:" + phase);
      },
      setSuspended: function setSuspended(suspended) {
        timerCalls.push("suspended:" + suspended);
      },
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
      isSupported: function isSupported() {
        return config.wakeLockSupported !== false;
      },
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
    documentListeners,
  };
}

test("primary action starts before timer has started", function () {
  const ctx = setup();
  ctx.boundHandlers.onPrimaryAction();

  assert(ctx.timerCalls.includes("start"), "expected primary action to start timer");
  assert(ctx.hapticCalls.includes("tap"), "expected primary action haptic tap");
});

test("document visibility freezes and resynchronizes the timer clock", function () {
  const ctx = setup();
  global.document.visibilityState = "hidden";
  ctx.documentListeners.visibilitychange();
  global.document.visibilityState = "visible";
  ctx.documentListeners.visibilitychange();

  assert(ctx.timerCalls.includes("suspended:true"), "expected hidden timer suspension");
  assert(ctx.timerCalls.includes("suspended:false"), "expected visible timer resynchronization");
});

test("timer session state survives application initialization", function () {
  const ctx = setup({
    storedTimer: {
      status: Core.STATUS.PAUSED,
      phase: Core.PHASE.RECALL,
      focusBlockNumber: 2,
      remainingSec: 42,
    },
  });

  assert(ctx.app.state.timer.status === Core.STATUS.PAUSED, "expected paused status to restore");
  assert(ctx.app.state.timer.phase === Core.PHASE.RECALL, "expected recall phase to restore");
  assert(ctx.app.state.timer.focusBlockNumber === 2, "expected active block to restore");
  assert(ctx.app.state.timer.remainingSec === 42, "expected remaining time to restore");
});

test("timer persistence does not add time to a fractional countdown", function () {
  const ctx = setup();
  ctx.app.state.timer.remainingSec = 41.25;
  ctx.app.onStateChange();

  assert.equal(ctx.stored[Core.STORAGE_KEYS.timer].remainingSec, 41.25);
});

test("primary action pauses while timer is running", function () {
  const ctx = setup();
  ctx.app.state.timer.status = Core.STATUS.RUNNING;
  ctx.boundHandlers.onPrimaryAction();

  assert(ctx.timerCalls.includes("pause"), "expected primary action to pause timer");
  assert(ctx.hapticCalls.includes("tap"), "expected pause haptic tap");
});

test("primary action resumes while timer is paused", function () {
  const ctx = setup();
  ctx.app.state.timer.status = Core.STATUS.PAUSED;
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

test("unsaved settings are tracked as explicit draft state", function () {
  const ctx = setup();
  const draft = Object.assign({}, Core.DEFAULT_SETTINGS, { focus: 60 });

  ctx.app.onSettingsInput(draft);

  assert(ctx.app.state.settings.focus === 45, "expected persisted settings to remain unchanged");
  assert(ctx.app.state.draftSettings.focus === 60, "expected draft settings to update");
  assert(ctx.app.state.ui.settingsDirty === true, "expected draft to be marked unsaved");
});

test("clamped numeric input remains marked unsaved", function () {
  const ctx = setup({ storedSettings: Core.normalizeSettings({ focus: 180 }) });
  const rawSettings = Object.assign({}, ctx.app.state.settings, { focus: "999" });

  ctx.app.onSettingsInput(rawSettings);

  assert.equal(ctx.app.state.draftSettings.focus, 180);
  assert.equal(ctx.app.state.ui.settingsDirty, true);
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

test("saving fullscreen preserves the explicit wake lock preference", function () {
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
  assert(saved.wake_lock_enabled === false, "expected wake lock preference to remain explicit");
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

test("saved fullscreen remains a preference without activating on startup", async function () {
  const ctx = setup({
    rejectFullscreen: true,
    storedSettings: Core.normalizeSettings({ fullscreen_enabled: true, wake_lock_enabled: true }),
  });

  await flushPromises();
  assert(ctx.fullscreenRequests.length === 0, "expected no startup fullscreen request");
  assert(
    ctx.dom.fields.fullscreen_enabled.checked === true,
    "expected saved fullscreen preference to remain checked"
  );
  assert(
    ctx.stored[Core.STORAGE_KEYS.settings].fullscreen_enabled === true,
    "expected saved fullscreen preference to remain stored"
  );
});

test("saved fullscreen can be activated with a user action", function () {
  const ctx = setup({
    storedSettings: Core.normalizeSettings({ fullscreen_enabled: true }),
  });
  assert.equal(ctx.dom.controls.activateDisplayModes.hidden, false);

  ctx.boundHandlers.onActivateDisplayModes();

  assert(ctx.fullscreenRequests.includes(true));
  assert.equal(ctx.dom.controls.activateDisplayModes.hidden, true);
});

test("saved minimal mode remains a preference without activating on startup", function () {
  const ctx = setup({
    storedSettings: Core.normalizeSettings({ minimal_mode_enabled: true }),
  });

  assert(
    !global.document.documentElement.hasAttribute("data-minimal-mode"),
    "expected minimal mode not to activate on startup"
  );
  assert(ctx.fullscreenRequests.length === 0, "expected no startup fullscreen request");
  assert(
    ctx.dom.fields.minimal_mode_enabled.checked === true,
    "expected saved minimal mode preference to remain checked"
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

test("Android fullscreen exit does not immediately re-enter saved fullscreen", function () {
  const ctx = setup();
  ctx.dom.fields.fullscreen_enabled.checked = true;
  ctx.dom.fields.minimal_mode_enabled.checked = true;
  ctx.boundHandlers.onMinimalModeToggle(true);
  const requestCountBeforeExit = ctx.fullscreenRequests.length;

  ctx.boundHandlers.onFullscreenChange(false);

  assert(
    ctx.fullscreenRequests.length === requestCountBeforeExit,
    "expected fullscreen exit not to request fullscreen again"
  );
  assert(
    ctx.dom.fields.fullscreen_enabled.checked === false,
    "expected fullscreen field to reflect the exited state"
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

test("exiting minimal mode restores previously disabled wake lock", function () {
  const ctx = setup();
  ctx.dom.fields.wake_lock_enabled.checked = false;
  ctx.dom.fields.minimal_mode_enabled.checked = true;
  ctx.boundHandlers.onMinimalModeToggle(true);

  ctx.boundHandlers.onExitMinimalMode();

  assert(
    ctx.dom.fields.wake_lock_enabled.checked === false,
    "expected wake lock checkbox to restore to disabled"
  );
  assert(
    ctx.wakeLockCalls[ctx.wakeLockCalls.length - 1] === false,
    "expected wake lock to be released"
  );
});

test("exiting minimal mode preserves previously enabled wake lock", function () {
  const ctx = setup();
  ctx.dom.fields.wake_lock_enabled.checked = true;
  ctx.dom.fields.minimal_mode_enabled.checked = true;
  ctx.boundHandlers.onMinimalModeToggle(true);

  ctx.boundHandlers.onExitMinimalMode();

  assert(
    ctx.dom.fields.wake_lock_enabled.checked === true,
    "expected wake lock checkbox to remain enabled"
  );
  assert(
    ctx.wakeLockCalls[ctx.wakeLockCalls.length - 1] === true,
    "expected wake lock to remain requested"
  );
});

test("temporary wake lock rejection preserves wake lock field", async function () {
  const ctx = setup({ wakeLockResult: false });
  ctx.dom.fields.wake_lock_enabled.checked = true;
  await ctx.boundHandlers.onWakeLockToggle(true);

  assert(
    ctx.dom.fields.wake_lock_enabled.checked === true,
    "expected temporary rejection to preserve wake lock preference"
  );
});

test("wake lock rejection leaves fullscreen enabled", async function () {
  const ctx = setup({ wakeLockResult: false });
  ctx.dom.fields.fullscreen_enabled.checked = true;

  await ctx.boundHandlers.onFullscreenToggle(true);
  await flushPromises();

  assert(
    ctx.dom.fields.fullscreen_enabled.checked === true,
    "expected fullscreen to remain enabled"
  );
  assert(
    ctx.dom.fields.wake_lock_enabled.checked === true,
    "expected wake lock preference to remain"
  );
});

test("wake lock rejection leaves minimal mode enabled", async function () {
  const ctx = setup({ wakeLockResult: false });
  ctx.dom.fields.minimal_mode_enabled.checked = true;

  await ctx.boundHandlers.onMinimalModeToggle(true);
  await flushPromises();

  assert(
    global.document.documentElement.hasAttribute("data-minimal-mode"),
    "expected minimal mode to remain enabled"
  );
  assert(
    ctx.dom.fields.minimal_mode_enabled.checked === true,
    "expected minimal field to remain enabled"
  );
  assert(
    ctx.dom.fields.wake_lock_enabled.checked === true,
    "expected wake lock preference to remain"
  );
});

test("saved wake lock is preserved when request temporarily fails on startup", async function () {
  const ctx = setup({
    wakeLockResult: false,
    storedSettings: Core.normalizeSettings({ wake_lock_enabled: true }),
  });

  await flushPromises();
  assert(ctx.wakeLockCalls.includes(true), "expected saved wake lock to be requested");
  assert(
    ctx.dom.fields.wake_lock_enabled.checked === true,
    "expected saved wake lock preference to remain checked"
  );
  assert(
    ctx.stored[Core.STORAGE_KEYS.settings].wake_lock_enabled === true,
    "expected saved wake lock preference to remain stored"
  );
});

test("unsupported wake lock clears the unavailable preference", async function () {
  const ctx = setup({
    wakeLockResult: false,
    wakeLockSupported: false,
    storedSettings: Core.normalizeSettings({ wake_lock_enabled: true }),
  });

  await flushPromises();
  assert(ctx.dom.fields.wake_lock_enabled.checked === false, "expected unsupported field to clear");
  assert(
    ctx.stored[Core.STORAGE_KEYS.settings].wake_lock_enabled === false,
    "expected unsupported preference to clear"
  );
});

test("saving minimal mode preserves the explicit wake lock preference", function () {
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
  assert(saved.wake_lock_enabled === false, "expected wake lock preference to remain explicit");
});

test("saving Prep as the idle starting phase resets the timer to Prep", function () {
  const ctx = setup({ storedSettings: Core.normalizeSettings({ prep_enabled: false }) });
  ctx.app.controller.saveSettings(
    Object.assign({}, ctx.app.state.settings, {
      prep_enabled: true,
    })
  );

  assert(ctx.timerCalls.includes("resetToPhase:" + Core.PHASE.PREP));
});

test("disabling Prep while idle resets the timer to Focus", function () {
  const ctx = setup({ storedSettings: Core.normalizeSettings({ prep_enabled: true }) });
  ctx.app.state.timer.phase = Core.PHASE.PREP;
  ctx.app.controller.saveSettings(
    Object.assign({}, ctx.app.state.settings, {
      prep_enabled: false,
    })
  );

  assert(ctx.timerCalls.includes("resetToPhase:" + Core.PHASE.FOCUS));
});
