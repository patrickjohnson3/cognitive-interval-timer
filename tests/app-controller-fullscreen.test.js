const AppController = require("../app-controller.js");
const Core = require("../core.js");
const Content = require("../content.js");
const { createBrowserFixture, eventTargetNode } = require("./helpers/dom.js");
const assert = require("node:assert/strict");
const test = require("node:test");

function flushPromises() {
  return new Promise(function resolveSoon(resolve) {
    setTimeout(resolve, 0);
  });
}

function createDom() {
  return {
    controls: {
      activateDisplayModes: eventTargetNode(),
    },
    copy: {
      phaseSettingsHeading: eventTargetNode(),
      blocks: eventTargetNode(),
      prepEnabled: eventTargetNode(),
      autoStart: eventTargetNode(),
      soundEnabled: eventTargetNode(),
      quietModeEnabled: eventTargetNode(),
      continueWhileSuspended: eventTargetNode(),
      fullscreenEnabled: eventTargetNode(),
      minimalModeEnabled: eventTargetNode(),
      wakeLockEnabled: eventTargetNode(),
      phaseLabels: {
        prep: eventTargetNode(),
        focus: eventTargetNode(),
        recall: eventTargetNode(),
        break: eventTargetNode(),
        long_break: eventTargetNode(),
      },
    },
    fields: {
      prep: eventTargetNode({ value: 2 }),
      focus: eventTargetNode({ value: 45 }),
      recall: eventTargetNode({ value: 3 }),
      break: eventTargetNode({ value: 15 }),
      long_break: eventTargetNode({ value: 25 }),
      blocks_per_ultradian: eventTargetNode({ value: 2 }),
      prep_enabled: eventTargetNode(),
      auto_start: eventTargetNode(),
      sound_enabled: eventTargetNode(),
      quiet_mode_enabled: eventTargetNode(),
      single_key_shortcuts_enabled: eventTargetNode({ checked: true }),
      continue_while_suspended: eventTargetNode({ checked: true }),
      fullscreen_enabled: eventTargetNode(),
      minimal_mode_enabled: eventTargetNode(),
      wake_lock_enabled: eventTargetNode(),
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
  if (config.storedSession) {
    stored[Core.STORAGE_KEYS.session] = config.storedSession;
  }
  const fullscreenRequests = [];
  let boundHandlers = null;
  let bindCount = 0;
  const wakeLockCalls = [];
  const timerCalls = [];
  const suspensionCalls = [];
  let timerIsSuspended = false;
  const hapticCalls = [];
  const audioCalls = [];
  const transitionCalls = [];
  const announcementCalls = [];
  const visualStatusCalls = [];
  const hydratedThemes = [];
  const historyCalls = [];
  let sessionWriteCount = 0;
  const browser = createBrowserFixture({
    requestFullscreen: function requestFullscreen() {
      fullscreenRequests.push(true);
      if (config.rejectFullscreen) {
        return Promise.reject(new Error("fullscreen unavailable"));
      }
      return Promise.resolve();
    },
    exitFullscreen: function exitFullscreen() {
      fullscreenRequests.push(false);
      if (config.rejectFullscreenExit) {
        return Promise.reject(new Error("fullscreen exit unavailable"));
      }
      browser.document.fullscreenElement = null;
      return Promise.resolve();
    },
    pushState: function pushState(state, title) {
      historyCalls.push({ type: "pushState", state, title });
    },
    replaceState: function replaceState(state, title) {
      historyCalls.push({ type: "replaceState", state, title });
    },
    back: function back() {
      historyCalls.push({ type: "back" });
    },
  });
  global.document = browser.document;

  const controls = {
    bindControls: function bindControls(handlers) {
      bindCount += 1;
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
        single_key_shortcuts_enabled: dom.fields.single_key_shortcuts_enabled.checked,
        continue_while_suspended: dom.fields.continue_while_suspended.checked,
        fullscreen_enabled: dom.fields.fullscreen_enabled.checked,
        minimal_mode_enabled: dom.fields.minimal_mode_enabled.checked,
        wake_lock_enabled: dom.fields.wake_lock_enabled.checked,
      };
    },
    focusMinimalModeReveal: function focusMinimalModeReveal() {},
    focusPrimaryAction: function focusPrimaryAction() {},
  };

  const render = {
    setTagline: function setTagline() {},
    hydrateStaticContent: function hydrateStaticContent() {},
    hydrateTheme: function hydrateTheme(theme) {
      hydratedThemes.push(theme);
    },
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
    setSettingField: function setSettingField(key, value) {
      if (typeof value === "boolean") dom.fields[key].checked = value;
      else dom.fields[key].value = String(value);
    },
    setMinimalModeActive: function setMinimalModeActive(active) {
      if (active) global.document.documentElement.setAttribute("data-minimal-mode", "true");
      else global.document.documentElement.removeAttribute("data-minimal-mode");
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
      showVisualStatus: function showVisualStatus(message) {
        visualStatusCalls.push(message);
      },
      announce: function announce(message) {
        announcementCalls.push(message);
      },
    },
    render,
    controls,
    timer: {
      startTicker: function startTicker() {
        timerCalls.push("startTicker");
      },
      start: function start() {
        timerCalls.push("start");
      },
      pause: function pause() {
        timerCalls.push("pause");
      },
      skip: function skip() {
        timerCalls.push("skip");
      },
      reset: function reset() {
        timerCalls.push("reset");
      },
      resetToPhase: function resetToPhase(phase) {
        timerCalls.push("resetToPhase:" + phase);
      },
      setSuspended: function setSuspended(suspended, options) {
        timerCalls.push("suspended:" + suspended);
        suspensionCalls.push({ suspended: Boolean(suspended), options: options });
        const resumed = timerIsSuspended && !suspended;
        timerIsSuspended = Boolean(suspended);
        if (resumed && config.suspendedTimerResult) return config.suspendedTimerResult;
        return { changed: false, expired: false };
      },
    },
    storage: {
      getJSON: function getJSON(key, fallback) {
        return Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : fallback;
      },
      setJSON: function setJSON(key, value) {
        stored[key] = value;
        if (key === Core.STORAGE_KEYS.session) sessionWriteCount += 1;
        if (Object.prototype.hasOwnProperty.call(config, "storageWriteResult")) {
          return config.storageWriteResult;
        }
        return true;
      },
      getText: function getText(key, fallback) {
        if (key === Core.STORAGE_KEYS.theme && config.storedTheme) return config.storedTheme;
        return fallback;
      },
      setText: function setText(key, value) {
        stored[key] = value;
        if (Object.prototype.hasOwnProperty.call(config, "storageWriteResult")) {
          return config.storageWriteResult;
        }
        return true;
      },
      mode: function mode() {
        return config.storageMode || "local";
      },
    },
    sessionLock: config.sessionLock,
    audio: {
      playPhaseChime: function playPhaseChime() {
        audioCalls.push("phase");
      },
    },
    haptics: {
      tap: function tap() {
        if (config.feedbackThrows) throw new Error("haptics unavailable");
        hapticCalls.push("tap");
      },
      phaseChange: function phaseChange() {
        if (config.feedbackThrows) throw new Error("haptics unavailable");
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
      formatAnnouncement: function formatAnnouncement(type) {
        return type;
      },
    },
    dom,
    windowRef: browser.window,
    confirmAction: config.confirmAction,
    now: config.now,
  });

  app.controller.initialize();
  return {
    app,
    boundHandlers,
    dom,
    fullscreenRequests,
    stored,
    timerCalls,
    suspensionCalls,
    wakeLockCalls,
    hapticCalls,
    audioCalls,
    transitionCalls,
    announcementCalls,
    visualStatusCalls,
    hydratedThemes,
    historyCalls,
    windowListeners: browser.windowListeners,
    documentListeners: browser.documentListeners,
    getBindCount: function getBindCount() {
      return bindCount;
    },
    getSessionWriteCount: function getSessionWriteCount() {
      return sessionWriteCount;
    },
  };
}

test("application initialization is idempotent", function () {
  const ctx = setup();

  assert.equal(ctx.app.controller.initialize(), false);
  assert.equal(ctx.getBindCount(), 1);
  assert.equal(
    ctx.timerCalls.filter(function isTicker(call) {
      return call === "startTicker";
    }).length,
    1
  );
});

test("signal theme survives storage and user selection", function () {
  const restored = setup({ storedTheme: "signal" });
  assert.equal(restored.app.state.theme, "signal");
  assert.equal(restored.hydratedThemes.at(-1), "signal");

  const selected = setup();
  selected.boundHandlers.onThemeChange("signal");
  assert.equal(selected.app.state.theme, "signal");
  assert.equal(selected.stored[Core.STORAGE_KEYS.theme], "signal");
  assert.equal(selected.hydratedThemes.at(-1), "signal");
});

test("unknown themes fall back to dark", function () {
  const ctx = setup({ storedTheme: "neon" });
  assert.equal(ctx.app.state.theme, "dark");

  ctx.boundHandlers.onThemeChange("invalid");
  assert.equal(ctx.app.state.theme, "dark");
  assert.equal(ctx.stored[Core.STORAGE_KEYS.theme], "dark");
});

test("primary action starts before timer has started", function () {
  const ctx = setup();
  ctx.boundHandlers.onPrimaryAction();

  assert(ctx.timerCalls.includes("start"), "expected primary action to start timer");
  assert(ctx.hapticCalls.includes("tap"), "expected primary action haptic tap");
});

test("shortcut actions map to timer operations", function () {
  const ctx = setup();

  ctx.boundHandlers.onShortcut("toggle");
  ctx.boundHandlers.onShortcut("skip");
  ctx.boundHandlers.onShortcut("reset");

  assert(ctx.timerCalls.includes("start"));
  assert(ctx.timerCalls.includes("skip"));
  assert(ctx.timerCalls.includes("reset"));
});

test("a second client cannot mutate an active timer session", async function () {
  const ctx = setup({
    sessionLock: {
      hasLock: function hasLock() {
        return false;
      },
      acquire: function acquire() {
        return Promise.resolve(false);
      },
      release: function release() {},
    },
  });

  ctx.boundHandlers.onPrimaryAction();
  await Promise.resolve();
  await Promise.resolve();

  assert(!ctx.timerCalls.includes("start"), "expected timer start to be denied");
  assert.equal(ctx.app.state.ui.sessionConflict, true);
});

test("a client refreshes persisted state after acquiring the session lock", async function () {
  let held = false;
  let resolveAcquisition;
  const initialSession = {
    version: 1,
    settings: Object.assign({}, Core.DEFAULT_SETTINGS),
    stats: {
      dateKey: Core.dateKey(),
      focusBlocksToday: 0,
      focusBlocksSinceLong: 0,
    },
    timer: {
      status: Core.STATUS.IDLE,
      phase: Core.PHASE.PREP,
      focusBlockNumber: 0,
      remainingSec: 120,
    },
  };
  const ctx = setup({
    storedSession: initialSession,
    sessionLock: {
      hasLock: function hasLock() {
        return held;
      },
      acquire: function acquire() {
        return new Promise(function waitForAcquisition(resolve) {
          resolveAcquisition = function acquireLock() {
            held = true;
            resolve(true);
          };
        });
      },
      release: function release() {
        held = false;
      },
    },
  });

  ctx.boundHandlers.onPrimaryAction();
  ctx.stored[Core.STORAGE_KEYS.session] = {
    version: 1,
    settings: Object.assign({}, Core.DEFAULT_SETTINGS, { focus: 30 }),
    stats: {
      dateKey: Core.dateKey(),
      focusBlocksToday: 3,
      focusBlocksSinceLong: 1,
    },
    timer: {
      status: Core.STATUS.PAUSED,
      phase: Core.PHASE.RECALL,
      focusBlockNumber: 2,
      remainingSec: 42,
    },
  };
  resolveAcquisition();
  await flushPromises();

  assert.equal(ctx.app.state.settings.focus, 30);
  assert.equal(ctx.app.state.stats.focusBlocksToday, 3);
  assert.equal(ctx.app.state.timer.phase, Core.PHASE.RECALL);
  assert.equal(ctx.app.state.timer.remainingSec, 42);
  assert(ctx.timerCalls.includes("start"), "expected the queued action to run after refresh");
  assert(ctx.announcementCalls.includes("timer_resumed"));
});

test("document visibility tracks and reconciles suspended wall time", function () {
  const ctx = setup();
  global.document.visibilityState = "hidden";
  ctx.documentListeners.visibilitychange();
  global.document.visibilityState = "visible";
  ctx.documentListeners.visibilitychange();

  assert(ctx.timerCalls.includes("suspended:true"), "expected hidden timer suspension");
  assert(ctx.timerCalls.includes("suspended:false"), "expected visible timer resynchronization");
  assert.equal(ctx.suspensionCalls.at(-2).options.trackElapsed, true);
  assert.equal(ctx.suspensionCalls.at(-1).options.countElapsed, true);
});

test("disabled suspended countdown preserves freeze behavior", function () {
  const ctx = setup({
    storedSettings: Core.normalizeSettings({ continue_while_suspended: false }),
  });
  global.document.visibilityState = "hidden";
  ctx.documentListeners.visibilitychange();
  global.document.visibilityState = "visible";
  ctx.documentListeners.visibilitychange();

  assert.equal(ctx.suspensionCalls.at(-2).options.trackElapsed, false);
  assert.equal(ctx.suspensionCalls.at(-1).options.countElapsed, false);
});

test("disabled suspended countdown preference persists", function () {
  const ctx = setup();

  ctx.app.controller.saveSettings(
    Object.assign({}, ctx.app.state.settings, { continue_while_suspended: false })
  );

  assert.equal(ctx.stored[Core.STORAGE_KEYS.session].settings.continue_while_suspended, false);
});

test("suspended phase expiration is announced without a phase transition", function () {
  const ctx = setup({ suspendedTimerResult: { changed: true, expired: true } });
  ctx.app.state.timer.status = Core.STATUS.RUNNING;
  ctx.app.state.timer.phase = Core.PHASE.FOCUS;
  global.document.visibilityState = "hidden";
  ctx.documentListeners.visibilitychange();
  global.document.visibilityState = "visible";
  ctx.documentListeners.visibilitychange();

  assert(ctx.announcementCalls.includes("phase_elapsed_while_suspended"));
  assert(ctx.visualStatusCalls.includes("phase_elapsed_while_suspended"));
  assert.equal(ctx.transitionCalls.length, 0);
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
  assert.equal(ctx.stored[Core.STORAGE_KEYS.session].timer.remainingSec, 42);
});

test("timer settings and statistics persist as one coherent session", function () {
  const ctx = setup();
  ctx.app.state.settings.focus = 30;
  ctx.app.state.stats.focusBlocksToday = 4;
  ctx.app.state.timer.phase = Core.PHASE.RECALL;
  ctx.app.state.timer.remainingSec = 25;
  ctx.app.state.timer.suspendedAtMs = 123456;

  ctx.app.onStateChange();

  const session = ctx.stored[Core.STORAGE_KEYS.session];
  assert.equal(session.version, 1);
  assert.equal(session.settings.focus, 30);
  assert.equal(session.stats.focusBlocksToday, 4);
  assert.equal(session.timer.phase, Core.PHASE.RECALL);
  assert.equal(session.timer.remainingSec, 25);
  assert.equal(session.timer.suspendedAtMs, 123456);
});

test("timer persistence does not add time to a fractional countdown", function () {
  const ctx = setup();
  ctx.app.state.timer.remainingSec = 41.25;
  ctx.app.onStateChange();

  assert.equal(ctx.stored[Core.STORAGE_KEYS.session].timer.remainingSec, 41.25);
});

test("running countdown persistence is throttled without delaying state changes", function () {
  let currentTime = 1000;
  const ctx = setup({
    now: function now() {
      return currentTime;
    },
  });
  const initialWrites = ctx.getSessionWriteCount();

  ctx.app.state.timer.status = Core.STATUS.RUNNING;
  ctx.app.onStateChange();
  assert.equal(ctx.getSessionWriteCount(), initialWrites + 1, "start state should persist now");

  ctx.app.state.timer.remainingSec -= 1;
  ctx.app.onStateChange();
  assert.equal(ctx.getSessionWriteCount(), initialWrites + 1, "running progress should wait");

  currentTime += 5000;
  ctx.app.state.timer.remainingSec -= 1;
  ctx.app.onStateChange();
  assert.equal(ctx.getSessionWriteCount(), initialWrites + 2, "checkpoint should persist");

  ctx.app.state.timer.status = Core.STATUS.PAUSED;
  ctx.app.onStateChange();
  assert.equal(ctx.getSessionWriteCount(), initialWrites + 3, "pause state should persist now");
});

test("suspension anchors bypass running progress write throttling", function () {
  const ctx = setup({
    now: function now() {
      return 1000;
    },
  });
  ctx.app.state.timer.status = Core.STATUS.RUNNING;
  ctx.app.onStateChange();
  const runningWrites = ctx.getSessionWriteCount();

  ctx.app.state.timer.suspendedAtMs = 1000;
  ctx.app.onStateChange();

  assert.equal(ctx.getSessionWriteCount(), runningWrites + 1);
  assert.equal(ctx.stored[Core.STORAGE_KEYS.session].timer.suspendedAtMs, 1000);
});

test("page suspension forces pending running progress to storage", function () {
  let currentTime = 1000;
  const ctx = setup({
    now: function now() {
      return currentTime;
    },
  });
  ctx.app.state.timer.status = Core.STATUS.RUNNING;
  ctx.app.onStateChange();
  const runningWrites = ctx.getSessionWriteCount();

  ctx.app.state.timer.remainingSec -= 1;
  ctx.app.onStateChange();
  assert.equal(ctx.getSessionWriteCount(), runningWrites);

  global.document.visibilityState = "hidden";
  ctx.documentListeners.visibilitychange();
  assert.equal(ctx.getSessionWriteCount(), runningWrites + 1);
  assert.equal(
    ctx.stored[Core.STORAGE_KEYS.session].timer.remainingSec,
    ctx.app.state.timer.remainingSec
  );

  ctx.app.state.timer.remainingSec -= 1;
  ctx.windowListeners.pagehide();
  assert.equal(ctx.getSessionWriteCount(), runningWrites + 2);
});

test("primary action pauses while timer is running", function () {
  const ctx = setup();
  ctx.app.state.timer.status = Core.STATUS.RUNNING;
  ctx.boundHandlers.onPrimaryAction();

  assert(ctx.timerCalls.includes("pause"), "expected primary action to pause timer");
  assert(ctx.hapticCalls.includes("tap"), "expected pause haptic tap");
  assert(ctx.announcementCalls.includes("timer_paused"));
});

test("primary action resumes while timer is paused", function () {
  const ctx = setup();
  ctx.app.state.timer.status = Core.STATUS.PAUSED;
  ctx.boundHandlers.onPrimaryAction();

  assert(ctx.timerCalls.includes("start"), "expected primary action to resume timer");
  assert(ctx.hapticCalls.includes("tap"), "expected resume haptic tap");
  assert(ctx.announcementCalls.includes("timer_resumed"));
});

test("primary action cannot resume an expired suspended phase", function () {
  const ctx = setup();
  ctx.app.state.timer.status = Core.STATUS.PAUSED;
  ctx.app.state.timer.remainingSec = 0;
  ctx.boundHandlers.onPrimaryAction();

  assert(!ctx.timerCalls.includes("start"));
  assert(!ctx.hapticCalls.includes("tap"));
});

test("restart announces the reset timer state", function () {
  const ctx = setup();
  ctx.boundHandlers.onReset();

  assert(ctx.timerCalls.includes("reset"));
  assert(ctx.announcementCalls.includes("block_restarted"));
});

test("restore defaults requires confirmation before resetting", async function () {
  const ctx = setup({
    confirmAction: function rejectConfirmation(message) {
      assert.equal(message, Content.UI_COPY.restoreDefaultsConfirmation);
      return false;
    },
  });

  const restored = await ctx.app.restoreDefaults();

  assert.equal(restored, false);
  assert(!ctx.timerCalls.includes("reset"));
});

test("confirmed restore defaults resets the block", async function () {
  const ctx = setup({
    confirmAction: function acceptConfirmation() {
      return true;
    },
  });

  const restored = await ctx.app.restoreDefaults();

  assert.equal(restored, true);
  assert(ctx.timerCalls.includes("reset"));
});

test("recommended timing restores only timing fields as an unsaved draft", function () {
  const ctx = setup();
  ctx.dom.fields.focus.value = "30";
  ctx.dom.fields.break.value = "5";
  ctx.dom.fields.quiet_mode_enabled.checked = true;

  ctx.boundHandlers.onRestoreRecommendedTiming();

  Core.TIMING_SETTING_KEYS.forEach(function timingMatchesRecommendation(key) {
    assert.equal(ctx.app.state.draftSettings[key], Core.DEFAULT_SETTINGS[key]);
  });
  assert.equal(ctx.app.state.draftSettings.quiet_mode_enabled, true);
  assert.equal(ctx.app.state.settings.quiet_mode_enabled, false);
  assert.equal(ctx.app.state.ui.settingsDirty, true);
  assert(!ctx.timerCalls.includes("reset"));
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

test("optional feedback failures do not interrupt phase handling", function () {
  const ctx = setup({ feedbackThrows: true });

  assert.doesNotThrow(function handlePhase() {
    ctx.app.onPhaseChange({ from: Core.PHASE.FOCUS, to: Core.PHASE.RECALL });
  });
  assert.equal(ctx.transitionCalls.length, 1);
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

  const saved = ctx.stored[Core.STORAGE_KEYS.session].settings;
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
  assert(ctx.announcementCalls.includes("fullscreen_unavailable"));
  assert(ctx.visualStatusCalls.includes("fullscreen_unavailable"));
});

test("fullscreen exit rejection restores the actual enabled field", async function () {
  const ctx = setup({ rejectFullscreenExit: true });
  global.document.fullscreenElement = global.document.documentElement;
  ctx.dom.fields.fullscreen_enabled.checked = false;

  await ctx.boundHandlers.onFullscreenToggle(false);

  assert.equal(ctx.dom.fields.fullscreen_enabled.checked, true);
  assert.equal(ctx.app.state.draftSettings.fullscreen_enabled, true);
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
    ctx.stored[Core.STORAGE_KEYS.session].settings.fullscreen_enabled === true,
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

test("minimal mode accepts ownership of the Settings history entry", function () {
  const ctx = setup();

  ctx.boundHandlers.onMinimalModeToggle(true, { reuseHistoryEntry: true });

  assert.equal(ctx.historyCalls.length, 1);
  assert.equal(ctx.historyCalls[0].type, "replaceState");
  assert.equal(ctx.historyCalls[0].state.appState, "minimal-mode");
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
  ctx.dom.fields.fullscreen_enabled.checked = true;
  ctx.dom.fields.minimal_mode_enabled.checked = true;
  ctx.boundHandlers.onMinimalModeToggle(true);

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
  assert(ctx.announcementCalls.includes("wake_lock_request_failed"));
  assert(ctx.visualStatusCalls.includes("wake_lock_request_failed"));
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
    ctx.stored[Core.STORAGE_KEYS.session].settings.wake_lock_enabled === true,
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
    ctx.stored[Core.STORAGE_KEYS.session].settings.wake_lock_enabled === false,
    "expected unsupported preference to clear"
  );
  assert(ctx.announcementCalls.includes("wake_lock_unavailable"));
  assert(ctx.visualStatusCalls.includes("wake_lock_unavailable"));
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

  const saved = ctx.stored[Core.STORAGE_KEYS.session].settings;
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
