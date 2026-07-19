const AppController = require("../app-controller.js");
const Core = require("../core.js");
const Content = require("../content.js");
const DisplayMode = require("../display-mode.js");

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
        fullscreen_enabled: dom.fields.fullscreen_enabled.checked,
        minimal_mode_enabled: dom.fields.minimal_mode_enabled.checked,
        wake_lock_enabled: dom.fields.wake_lock_enabled.checked,
      };
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
      },
      getText: function getText(key, fallback) {
        return fallback;
      },
      setText: function setText() {},
    },
    audio: {
      playPhaseChime: function playPhaseChime() {},
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
      },
    },
    DisplayMode,
    a11y: {
      applyAriaDefaults: function applyAriaDefaults() {},
      formatAnnouncement: function formatAnnouncement() {
        return "";
      },
    },
    dom,
  });

  app.controller.initialize();
  return { app, boundHandlers, dom, fullscreenRequests, stored, timerCalls, wakeLockCalls, hapticCalls };
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
  ctx.app.onPhaseChange({ label: "Focus" });

  assert(ctx.hapticCalls.includes("phase"), "expected phase-change haptic feedback");
});

test("fullscreen toggle enables keep screen awake", function () {
  const ctx = setup();
  ctx.boundHandlers.onFullscreenToggle(true);

  assert(ctx.dom.fields.wake_lock_enabled.checked === true, "expected wake lock checkbox to be checked");
  assert(ctx.wakeLockCalls.includes(true), "expected wake lock to be requested");
});

test("saving fullscreen normalizes keep screen awake on", function () {
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
  assert(saved.wake_lock_enabled === true, "expected wake lock setting to be forced on");
});

test("fullscreen rejection clears fullscreen field", async function () {
  const ctx = setup({ rejectFullscreen: true });
  ctx.dom.fields.fullscreen_enabled.checked = true;
  await ctx.boundHandlers.onFullscreenToggle(true);

  assert(ctx.dom.fields.fullscreen_enabled.checked === false, "expected fullscreen checkbox to clear");
  assert(ctx.app.state.ui.settingsDirty === true, "expected auto-enabled wake lock to remain unsaved");
});

test("saved fullscreen is cleared when fullscreen request fails on startup", async function () {
  const ctx = setup({
    rejectFullscreen: true,
    storedSettings: Core.normalizeSettings({ fullscreen_enabled: true, wake_lock_enabled: true }),
  });

  await flushPromises();
  assert(ctx.fullscreenRequests.includes(true), "expected saved fullscreen to request fullscreen");
  assert(ctx.dom.fields.fullscreen_enabled.checked === false, "expected fullscreen checkbox to clear");
  assert(ctx.stored[Core.STORAGE_KEYS.settings].fullscreen_enabled === false, "expected saved fullscreen to clear");
});

test("minimal mode toggle enables keep screen awake", function () {
  const ctx = setup();
  ctx.boundHandlers.onMinimalModeToggle(true);

  assert(ctx.dom.fields.wake_lock_enabled.checked === true, "expected wake lock checkbox to be checked");
  assert(ctx.wakeLockCalls.includes(true), "expected wake lock to be requested");
});

test("saving minimal mode normalizes keep screen awake on", function () {
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
  assert(saved.wake_lock_enabled === true, "expected wake lock setting to be forced on");
});
