const UIControls = require("../ui-controls.js");
const Core = require("../core.js");
const { createBrowserFixture, eventTargetNode } = require("./helpers/dom.js");
const assert = require("node:assert/strict");
const test = require("node:test");

function createDom() {
  return {
    views: {
      session: eventTargetNode({ id: "session-view" }),
      settings: eventTargetNode({ id: "settings-view", hidden: true }),
      settingsHeading: eventTargetNode({ id: "settings-view-heading", tagName: "H2" }),
    },
    controls: {
      start: eventTargetNode({ id: "start" }),
      skip: eventTargetNode({ id: "skip" }),
      reset: eventTargetNode({ id: "reset" }),
      openSettings: eventTargetNode({ id: "open-settings" }),
      closeSettings: eventTargetNode({ id: "close-settings" }),
      save: eventTargetNode({ id: "save" }),
      defaults: eventTargetNode({ id: "defaults" }),
      activateDisplayModes: eventTargetNode({ id: "activate-display-modes" }),
      exitMinimalModeWrap: eventTargetNode({ id: "minimal-exit-wrap" }),
      exitMinimalModeReveal: eventTargetNode({ id: "minimal-exit-reveal" }),
      exitMinimalModePanel: eventTargetNode({ id: "minimal-exit-panel", tagName: "DIV" }),
      minimalPrimaryAction: eventTargetNode({ id: "minimal-primary-action" }),
      restartMinimalBlock: eventTargetNode({ id: "restart-minimal-block" }),
      exitMinimalMode: eventTargetNode({ id: "exit-minimal-mode" }),
    },
    theme: eventTargetNode({ id: "theme", tagName: "SELECT", value: "dark" }),
    fields: {
      prep: eventTargetNode({ id: "prep", tagName: "INPUT", type: "number", value: "2" }),
      focus: eventTargetNode({ id: "focus", tagName: "INPUT", type: "number", value: "45" }),
      recall: eventTargetNode({ id: "recall", tagName: "INPUT", type: "number", value: "3" }),
      break: eventTargetNode({ id: "break", tagName: "INPUT", type: "number", value: "15" }),
      long_break: eventTargetNode({
        id: "long_break",
        tagName: "INPUT",
        type: "number",
        value: "25",
      }),
      blocks_per_ultradian: eventTargetNode({
        id: "blocks_per_ultradian",
        tagName: "INPUT",
        type: "number",
        value: "2",
      }),
      prep_enabled: eventTargetNode({
        id: "prep_enabled",
        tagName: "INPUT",
        type: "checkbox",
        checked: true,
      }),
      auto_start: eventTargetNode({
        id: "auto_start",
        tagName: "INPUT",
        type: "checkbox",
        checked: true,
      }),
      sound_enabled: eventTargetNode({
        id: "sound_enabled",
        tagName: "INPUT",
        type: "checkbox",
        checked: true,
      }),
      quiet_mode_enabled: eventTargetNode({
        id: "quiet_mode_enabled",
        tagName: "INPUT",
        type: "checkbox",
      }),
      single_key_shortcuts_enabled: eventTargetNode({
        id: "single_key_shortcuts_enabled",
        tagName: "INPUT",
        type: "checkbox",
        checked: true,
      }),
      fullscreen_enabled: eventTargetNode({
        id: "fullscreen_enabled",
        tagName: "INPUT",
        type: "checkbox",
      }),
      minimal_mode_enabled: eventTargetNode({
        id: "minimal_mode_enabled",
        tagName: "INPUT",
        type: "checkbox",
      }),
      wake_lock_enabled: eventTargetNode({
        id: "wake_lock_enabled",
        tagName: "INPUT",
        type: "checkbox",
      }),
    },
  };
}

function bindWithBrowserStubs(options) {
  const config = options || {};
  const dom = createDom();
  const browser = createBrowserFixture({
    pointerEvents: config.pointerEvents !== false,
    touchEvents: config.touchEvents,
    querySelectorAll: config.querySelectorAll,
  });
  const calls = [];
  const handlers = {
    onStart: function onStart() {
      calls.push("start");
    },
    onPrimaryAction: function onPrimaryAction() {
      calls.push("primary");
    },
    onPause: function onPause() {
      calls.push("pause");
    },
    onSkip: function onSkip() {
      calls.push("skip");
    },
    onReset: function onReset() {
      calls.push("reset");
    },
    onSaveSettings: function onSaveSettings() {
      calls.push("save");
    },
    onRestoreDefaults: function onRestoreDefaults() {
      calls.push("defaults");
    },
    onThemeChange: function onThemeChange(value) {
      calls.push("theme:" + value);
    },
    onShortcut: function onShortcut(action) {
      calls.push("shortcut:" + action);
    },
    onSettingsInput: function onSettingsInput() {
      calls.push("settings");
    },
    onFullscreenToggle: function onFullscreenToggle(enabled) {
      calls.push("fullscreen:" + enabled);
    },
    onFullscreenChange: function onFullscreenChange(enabled) {
      calls.push("fullscreen-change:" + enabled);
    },
    onMinimalModeToggle: function onMinimalModeToggle(enabled) {
      calls.push("minimal:" + enabled);
    },
    onWakeLockToggle: function onWakeLockToggle(enabled) {
      calls.push("wake-lock:" + enabled);
    },
    onActivateDisplayModes: function onActivateDisplayModes() {
      calls.push("activate-display");
    },
    onExitMinimalMode: function onExitMinimalMode() {
      calls.push("exit-minimal");
    },
  };

  global.document = browser.document;
  global.window = browser.window;

  UIControls.create(dom, Core.SETTING_FIELDS).bindControls(handlers);
  return Object.assign({ calls, dom }, browser);
}

test("settings open as a dedicated view and return focus on close", function () {
  const ctx = bindWithBrowserStubs();

  assert.equal(ctx.dom.views.session.hidden, false);
  assert.equal(ctx.dom.views.settings.hidden, true);
  assert.equal(ctx.dom.controls.openSettings.getAttribute("aria-expanded"), "false");

  ctx.dom.controls.openSettings.listeners.click();
  assert.equal(ctx.dom.views.session.hidden, true);
  assert.equal(ctx.dom.views.settings.hidden, false);
  assert.equal(ctx.dom.views.settingsHeading.focusCount, 1);
  assert.equal(ctx.dom.controls.openSettings.getAttribute("aria-expanded"), "true");
  assert.equal(ctx.document.documentElement.getAttribute("data-settings-view"), "true");

  ctx.dom.controls.closeSettings.listeners.click();
  assert.equal(ctx.dom.views.session.hidden, false);
  assert.equal(ctx.dom.views.settings.hidden, true);
  assert.equal(ctx.dom.controls.openSettings.focusCount, 1);
  assert.equal(ctx.document.documentElement.hasAttribute("data-settings-view"), false);
});

test("Escape closes settings and timer shortcuts stay inactive there", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.controls.openSettings.listeners.click();

  ctx.windowListeners.keydown({
    key: "s",
    target: ctx.document.documentElement,
    preventDefault: function preventDefault() {},
  });
  assert.equal(ctx.calls.includes("shortcut:skip"), false);

  ctx.windowListeners.keydown({
    key: "Escape",
    target: ctx.document.documentElement,
    preventDefault: function preventDefault() {},
  });
  assert.equal(ctx.dom.views.settings.hidden, true);
  assert.equal(ctx.dom.controls.openSettings.focusCount, 1);
});

test("minimal mode checkbox triggers minimal handler and dirty settings handler", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.fields.minimal_mode_enabled.checked = true;
  ctx.dom.fields.minimal_mode_enabled.listeners.change();

  assert(ctx.calls.includes("minimal:true"), "expected minimal mode toggle handler");
  assert(ctx.calls.includes("settings"), "expected settings dirty handler");
});

test("saved display activation button invokes its handler", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.controls.activateDisplayModes.listeners.click();

  assert(ctx.calls.includes("activate-display"));
});

test("invalid numeric settings are reported instead of saved", function () {
  const ctx = bindWithBrowserStubs();
  let reported = false;
  ctx.dom.fields.focus.checkValidity = function checkValidity() {
    return false;
  };
  ctx.dom.fields.focus.reportValidity = function reportValidity() {
    reported = true;
  };

  ctx.dom.controls.save.listeners.click();

  assert(reported, "expected native validity UI");
  assert(!ctx.calls.includes("save"), "expected invalid settings not to save");
});

test("minimal reveal click opens panel without bubbling", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.controls.exitMinimalModeReveal.listeners.click({
    preventDefault: function preventDefault() {
      ctx.calls.push("prevent-default");
    },
    stopPropagation: function stopPropagation() {
      ctx.calls.push("stop-propagation");
    },
  });

  assert(
    ctx.dom.controls.exitMinimalModeWrap.getAttribute("data-open") === "true",
    "expected reveal click to open minimal panel"
  );
  assert(
    ctx.dom.controls.exitMinimalModePanel.hidden === false,
    "expected panel to become visible"
  );
  assert(
    ctx.dom.controls.exitMinimalModeReveal.getAttribute("aria-expanded") === "true",
    "expected reveal to expose its expanded state"
  );
  assert(ctx.calls.includes("prevent-default"), "expected reveal click to be consumed");
  assert(ctx.calls.includes("stop-propagation"), "expected reveal click not to bubble");
  assert.equal(
    ctx.dom.controls.restartMinimalBlock.focusCount,
    0,
    "opening should preserve focus on the disclosure"
  );
});

test("collapsing minimal controls returns focus to the disclosure", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.controls.exitMinimalModeReveal.listeners.click({});
  ctx.dom.controls.exitMinimalModeReveal.listeners.click({});

  assert.equal(ctx.dom.controls.exitMinimalModeReveal.focusCount, 1);
});

test("closed minimal panel is removed from keyboard navigation", function () {
  const ctx = bindWithBrowserStubs();

  assert(
    ctx.dom.controls.exitMinimalModePanel.hidden === true,
    "expected closed panel to be hidden"
  );
  assert(
    ctx.dom.controls.exitMinimalModeReveal.getAttribute("aria-expanded") === "false",
    "expected reveal to expose its collapsed state"
  );
});

test("primary action button triggers primary action handler", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.controls.start.listeners.click();

  assert(ctx.calls.includes("primary"), "expected primary action handler");
});

test("minimal primary action uses the primary action handler", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.controls.minimalPrimaryAction.listeners.click({
    stopPropagation: function stopPropagation() {
      ctx.calls.push("stop-propagation");
    },
  });

  assert(ctx.calls.includes("primary"), "expected minimal primary action handler");
  assert(ctx.calls.includes("stop-propagation"), "expected minimal action not to bubble");
});

test("fullscreen checkbox triggers fullscreen handler and dirty settings handler", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.fields.fullscreen_enabled.checked = true;
  ctx.dom.fields.fullscreen_enabled.listeners.change();

  assert(ctx.calls.includes("fullscreen:true"), "expected fullscreen toggle handler");
  assert(ctx.calls.includes("settings"), "expected settings dirty handler");
});

test("quiet mode checkbox triggers dirty settings handler", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.fields.quiet_mode_enabled.checked = true;
  ctx.dom.fields.quiet_mode_enabled.listeners.change();

  assert(ctx.calls.includes("settings"), "expected settings dirty handler");
});

test("fullscreenchange handler receives actual fullscreen state", function () {
  const ctx = bindWithBrowserStubs();
  global.document.fullscreenElement = ctx.documentElement;
  ctx.documentListeners.fullscreenchange();
  global.document.fullscreenElement = null;
  ctx.documentListeners.fullscreenchange();

  assert(ctx.calls.includes("fullscreen-change:true"), "expected fullscreen enter notification");
  assert(ctx.calls.includes("fullscreen-change:false"), "expected fullscreen exit notification");
});

test("wake lock checkbox triggers wake lock handler and dirty settings handler", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.fields.wake_lock_enabled.checked = true;
  ctx.dom.fields.wake_lock_enabled.listeners.change();

  assert(ctx.calls.includes("wake-lock:true"), "expected wake lock toggle handler");
  assert(ctx.calls.includes("settings"), "expected settings dirty handler");
});

test("Escape closes an open minimal panel before exiting minimal mode", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.controls.exitMinimalModeReveal.listeners.click({});
  ctx.windowListeners.keydown({ key: "Escape", target: eventTargetNode({ tagName: "BODY" }) });

  assert(!ctx.calls.includes("exit-minimal"), "expected first Escape to close the disclosure");
  assert.equal(ctx.dom.controls.exitMinimalModeReveal.focusCount, 1);

  ctx.windowListeners.keydown({ key: "Escape", target: eventTargetNode({ tagName: "BODY" }) });

  assert(ctx.calls.includes("exit-minimal"), "expected Escape to exit minimal mode");
});

test("Escape dismisses a focused tooltip before other Escape actions", function () {
  const bubble = eventTargetNode({ tagName: "SPAN", hidden: true });
  const trigger = eventTargetNode({ tagName: "BUTTON" });
  const wrapper = eventTargetNode({ tagName: "SPAN" });
  wrapper.querySelector = function querySelector(selector) {
    if (selector === ".tip-trigger") return trigger;
    if (selector === ".tip-bubble") return bubble;
    return null;
  };
  trigger.closest = function closest(selector) {
    return selector === ".tip-wrap" ? wrapper : null;
  };
  const ctx = bindWithBrowserStubs({
    querySelectorAll: function querySelectorAll() {
      return [wrapper];
    },
  });
  trigger.listeners.focus();
  global.document.activeElement = trigger;

  ctx.windowListeners.keydown({ key: "Escape", target: trigger });

  assert.equal(bubble.hidden, true);
  assert.equal(wrapper.getAttribute("data-open"), "false");
  assert.equal(trigger.blurCount || 0, 0, "tooltip dismissal should preserve trigger focus");
  assert(!ctx.calls.includes("exit-minimal"));
});

test("closed tooltips are hidden from assistive technology", function () {
  const bubble = eventTargetNode({ tagName: "SPAN" });
  const trigger = eventTargetNode({ tagName: "BUTTON" });
  const wrapper = eventTargetNode({ tagName: "SPAN" });
  wrapper.querySelector = function querySelector(selector) {
    return selector === ".tip-trigger" ? trigger : bubble;
  };
  bindWithBrowserStubs({
    querySelectorAll: function querySelectorAll() {
      return [wrapper];
    },
  });

  assert.equal(bubble.hidden, true);
  trigger.listeners.focus();
  assert.equal(bubble.hidden, false);
  trigger.listeners.blur();
  assert.equal(bubble.hidden, true);
});

test("timer shortcuts do not intercept native button keyboard actions", function () {
  const ctx = bindWithBrowserStubs();
  const button = eventTargetNode({ tagName: "BUTTON" });
  let prevented = false;

  [" ", "s", "r"].forEach(function eachShortcut(key) {
    ctx.windowListeners.keydown({
      key,
      target: button,
      preventDefault: function preventDefault() {
        prevented = true;
      },
    });
  });

  assert(prevented === false, "expected native button keyboard behavior to remain available");
  assert(
    !ctx.calls.some(function isShortcut(call) {
      return call.startsWith("shortcut:");
    }),
    "expected no global timer shortcut from a focused button"
  );
});

test("single-key shortcuts can be disabled", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.fields.single_key_shortcuts_enabled.checked = false;

  [" ", "s", "r"].forEach(function eachShortcut(key) {
    ctx.windowListeners.keydown({ key, target: eventTargetNode({ tagName: "BODY" }) });
  });

  assert(
    !ctx.calls.some(function isShortcut(call) {
      return call.startsWith("shortcut:");
    }),
    "expected disabled shortcuts not to run"
  );
});

test("modified keys do not trigger timer shortcuts", function () {
  const ctx = bindWithBrowserStubs();

  [" ", "s", "r"].forEach(function eachShortcut(key) {
    ctx.windowListeners.keydown({
      key,
      ctrlKey: true,
      target: eventTargetNode({ tagName: "BODY" }),
    });
  });

  assert(
    !ctx.calls.some(function isShortcut(call) {
      return call.startsWith("shortcut:");
    }),
    "expected modified keys not to run shortcuts"
  );
});

test("clicking screen in minimal mode toggles start pause without pointer events", function () {
  const ctx = bindWithBrowserStubs({ pointerEvents: false });
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.windowListeners.click({
    button: 0,
    target: eventTargetNode({ id: "timer-panel", tagName: "DIV" }),
  });

  assert(ctx.calls.includes("shortcut:toggle"), "expected minimal click to toggle timer");
});

test("pointer release in minimal mode toggles start pause", function () {
  const ctx = bindWithBrowserStubs();
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.windowListeners.pointerup({
    button: 0,
    cancelable: true,
    preventDefault: function preventDefault() {},
    target: eventTargetNode({ id: "timer-panel", tagName: "DIV" }),
  });

  assert(ctx.calls.includes("shortcut:toggle"), "expected minimal pointerup to toggle timer");
});

test("touch release in minimal mode toggles start pause without pointer events", function () {
  const ctx = bindWithBrowserStubs({ pointerEvents: false, touchEvents: true });
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.windowListeners.touchend({
    cancelable: true,
    preventDefault: function preventDefault() {},
    target: eventTargetNode({ id: "timer-panel", tagName: "DIV" }),
  });

  assert(ctx.calls.includes("shortcut:toggle"), "expected minimal touchend to toggle timer");
});

test("clicking outside open minimal panel closes it without toggling timer", function () {
  const ctx = bindWithBrowserStubs({ pointerEvents: false });
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.dom.controls.exitMinimalModeWrap.setAttribute("data-open", "true");
  ctx.windowListeners.click({
    button: 0,
    cancelable: true,
    preventDefault: function preventDefault() {
      ctx.calls.push("prevent-default");
    },
    target: eventTargetNode({ id: "timer-panel", tagName: "DIV" }),
  });

  assert(
    ctx.dom.controls.exitMinimalModeWrap.getAttribute("data-open") === "false",
    "expected outside click to close minimal panel"
  );
  assert(ctx.calls.includes("prevent-default"), "expected outside click to be consumed");
  assert(
    !ctx.calls.includes("shortcut:toggle"),
    "outside click should not toggle timer while closing panel"
  );
});

test("pointer release closes open minimal panel without toggling timer", function () {
  const ctx = bindWithBrowserStubs();
  const target = eventTargetNode({ id: "timer-panel", tagName: "DIV" });
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.dom.controls.exitMinimalModeWrap.setAttribute("data-open", "true");
  ctx.windowListeners.pointerup({ button: 0, target });

  assert(
    ctx.dom.controls.exitMinimalModeWrap.getAttribute("data-open") === "false",
    "expected pointer release to close minimal panel"
  );
  assert(
    !ctx.calls.includes("shortcut:toggle"),
    "synthesized click should not toggle after panel close"
  );
});

test("restarting from minimal panel resets without toggling timer", function () {
  const ctx = bindWithBrowserStubs();
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.dom.controls.exitMinimalModeWrap.setAttribute("data-open", "true");
  ctx.dom.controls.restartMinimalBlock.listeners.click({
    stopPropagation: function stopPropagation() {
      ctx.calls.push("stop-propagation");
    },
  });

  assert(ctx.calls.includes("reset"), "expected minimal panel restart to reset block");
  assert(ctx.calls.includes("stop-propagation"), "expected restart click not to bubble");
  assert(!ctx.calls.includes("shortcut:toggle"), "restart should not toggle timer");
  assert(
    ctx.dom.controls.exitMinimalModeWrap.getAttribute("data-open") === "false",
    "expected restart to close minimal panel"
  );
});

test("clicking exit panel in minimal mode does not toggle timer", function () {
  const ctx = bindWithBrowserStubs();
  const exitTarget = eventTargetNode({ id: "minimal-exit-wrap" });
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.windowListeners.pointerup({ button: 0, target: exitTarget });

  assert(!ctx.calls.includes("shortcut:toggle"), "exit panel clicks should not toggle timer");
});
