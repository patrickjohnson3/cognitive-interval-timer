const UIControls = require("../ui-controls.js");
const Core = require("../core.js");
const assert = require("node:assert/strict");
const test = require("node:test");

function createNode(options) {
  const config = options || {};
  const listeners = {};
  const attrs = {};

  return {
    id: config.id || "",
    tagName: config.tagName || "BUTTON",
    type: config.type || "button",
    value: config.value || "",
    checked: Boolean(config.checked),
    isContentEditable: false,
    listeners,
    focusCount: 0,
    addEventListener: function addEventListener(type, handler) {
      listeners[type] = handler;
    },
    focus: function focus() {
      this.focusCount += 1;
    },
    checkValidity: function checkValidity() {
      return true;
    },
    getAttribute: function getAttribute(name) {
      return attrs[name];
    },
    setAttribute: function setAttribute(name, value) {
      attrs[name] = String(value);
    },
    closest: function closest(selector) {
      return selector === "#" + this.id ? this : null;
    },
  };
}

function createDom() {
  return {
    controls: {
      start: createNode({ id: "start" }),
      skip: createNode({ id: "skip" }),
      reset: createNode({ id: "reset" }),
      save: createNode({ id: "save" }),
      defaults: createNode({ id: "defaults" }),
      activateDisplayModes: createNode({ id: "activate-display-modes" }),
      exitMinimalModeWrap: createNode({ id: "minimal-exit-wrap" }),
      exitMinimalModeReveal: createNode({ id: "minimal-exit-reveal" }),
      exitMinimalModePanel: createNode({ id: "minimal-exit-panel", tagName: "DIV" }),
      restartMinimalBlock: createNode({ id: "restart-minimal-block" }),
      exitMinimalMode: createNode({ id: "exit-minimal-mode" }),
    },
    theme: createNode({ id: "theme", tagName: "SELECT", value: "dark" }),
    fields: {
      prep: createNode({ id: "prep", tagName: "INPUT", type: "number", value: "2" }),
      focus: createNode({ id: "focus", tagName: "INPUT", type: "number", value: "45" }),
      recall: createNode({ id: "recall", tagName: "INPUT", type: "number", value: "3" }),
      break: createNode({ id: "break", tagName: "INPUT", type: "number", value: "15" }),
      long_break: createNode({ id: "long_break", tagName: "INPUT", type: "number", value: "25" }),
      blocks_per_ultradian: createNode({
        id: "blocks_per_ultradian",
        tagName: "INPUT",
        type: "number",
        value: "2",
      }),
      prep_enabled: createNode({
        id: "prep_enabled",
        tagName: "INPUT",
        type: "checkbox",
        checked: true,
      }),
      auto_start: createNode({
        id: "auto_start",
        tagName: "INPUT",
        type: "checkbox",
        checked: true,
      }),
      sound_enabled: createNode({
        id: "sound_enabled",
        tagName: "INPUT",
        type: "checkbox",
        checked: true,
      }),
      quiet_mode_enabled: createNode({
        id: "quiet_mode_enabled",
        tagName: "INPUT",
        type: "checkbox",
      }),
      fullscreen_enabled: createNode({
        id: "fullscreen_enabled",
        tagName: "INPUT",
        type: "checkbox",
      }),
      minimal_mode_enabled: createNode({
        id: "minimal_mode_enabled",
        tagName: "INPUT",
        type: "checkbox",
      }),
      wake_lock_enabled: createNode({
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
  const windowListeners = {};
  const documentListeners = {};
  const documentElement = {
    attrs: {},
    hasAttribute: function hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name);
    },
    setAttribute: function setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    removeAttribute: function removeAttribute(name) {
      delete this.attrs[name];
    },
  };
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

  global.document = {
    documentElement,
    fullscreenElement: null,
    addEventListener: function addEventListener(type, handler) {
      documentListeners[type] = handler;
    },
  };
  global.window = {
    addEventListener: function addEventListener(type, handler) {
      windowListeners[type] = handler;
    },
  };
  if (config.pointerEvents !== false) {
    global.window.PointerEvent = function PointerEvent() {};
  }
  if (config.touchEvents) {
    global.window.TouchEvent = function TouchEvent() {};
  }

  UIControls.create(dom, Core.SETTING_FIELDS).bindControls(handlers);
  return { calls, dom, documentElement, documentListeners, windowListeners };
}

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
  assert.equal(ctx.dom.controls.restartMinimalBlock.focusCount, 1);
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
  ctx.windowListeners.keydown({ key: "Escape", target: createNode({ tagName: "BODY" }) });

  assert(!ctx.calls.includes("exit-minimal"), "expected first Escape to close the disclosure");
  assert.equal(ctx.dom.controls.exitMinimalModeReveal.focusCount, 1);

  ctx.windowListeners.keydown({ key: "Escape", target: createNode({ tagName: "BODY" }) });

  assert(ctx.calls.includes("exit-minimal"), "expected Escape to exit minimal mode");
});

test("timer shortcuts do not intercept native button keyboard actions", function () {
  const ctx = bindWithBrowserStubs();
  const button = createNode({ tagName: "BUTTON" });
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

test("clicking screen in minimal mode toggles start pause without pointer events", function () {
  const ctx = bindWithBrowserStubs({ pointerEvents: false });
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.windowListeners.click({
    button: 0,
    target: createNode({ id: "timer-panel", tagName: "DIV" }),
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
    target: createNode({ id: "timer-panel", tagName: "DIV" }),
  });

  assert(ctx.calls.includes("shortcut:toggle"), "expected minimal pointerup to toggle timer");
});

test("touch release in minimal mode toggles start pause without pointer events", function () {
  const ctx = bindWithBrowserStubs({ pointerEvents: false, touchEvents: true });
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.windowListeners.touchend({
    cancelable: true,
    preventDefault: function preventDefault() {},
    target: createNode({ id: "timer-panel", tagName: "DIV" }),
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
    target: createNode({ id: "timer-panel", tagName: "DIV" }),
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
  const target = createNode({ id: "timer-panel", tagName: "DIV" });
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
  const exitTarget = createNode({ id: "minimal-exit-wrap" });
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.windowListeners.pointerup({ button: 0, target: exitTarget });

  assert(!ctx.calls.includes("shortcut:toggle"), "exit panel clicks should not toggle timer");
});
