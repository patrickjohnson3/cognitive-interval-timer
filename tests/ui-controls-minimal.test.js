const UIControls = require("../ui-controls.js");

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
    addEventListener: function addEventListener(type, handler) {
      listeners[type] = handler;
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
      pause: createNode({ id: "pause" }),
      skip: createNode({ id: "skip" }),
      reset: createNode({ id: "reset" }),
      save: createNode({ id: "save" }),
      defaults: createNode({ id: "defaults" }),
      exitMinimalModeWrap: createNode({ id: "minimal-exit-wrap" }),
      exitMinimalModeReveal: createNode({ id: "minimal-exit-reveal" }),
      exitMinimalMode: createNode({ id: "exit-minimal-mode" }),
    },
    theme: createNode({ id: "theme", tagName: "SELECT", value: "dark" }),
    fields: {
      prime: createNode({ id: "prime", tagName: "INPUT", type: "number", value: "2" }),
      focus: createNode({ id: "focus", tagName: "INPUT", type: "number", value: "45" }),
      recall: createNode({ id: "recall", tagName: "INPUT", type: "number", value: "3" }),
      break: createNode({ id: "break", tagName: "INPUT", type: "number", value: "15" }),
      long_break: createNode({ id: "long_break", tagName: "INPUT", type: "number", value: "25" }),
      blocks_per_ultradian: createNode({ id: "blocks_per_ultradian", tagName: "INPUT", type: "number", value: "2" }),
      prime_enabled: createNode({ id: "prime_enabled", tagName: "INPUT", type: "checkbox", checked: true }),
      auto_start: createNode({ id: "auto_start", tagName: "INPUT", type: "checkbox", checked: true }),
      sound_enabled: createNode({ id: "sound_enabled", tagName: "INPUT", type: "checkbox", checked: true }),
      fullscreen_enabled: createNode({ id: "fullscreen_enabled", tagName: "INPUT", type: "checkbox" }),
      minimal_mode_enabled: createNode({ id: "minimal_mode_enabled", tagName: "INPUT", type: "checkbox" }),
      wake_lock_enabled: createNode({ id: "wake_lock_enabled", tagName: "INPUT", type: "checkbox" }),
    },
  };
}

function bindWithBrowserStubs() {
  const dom = createDom();
  const windowListeners = {};
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
    onMinimalModeToggle: function onMinimalModeToggle(enabled) {
      calls.push("minimal:" + enabled);
    },
    onWakeLockToggle: function onWakeLockToggle(enabled) {
      calls.push("wake-lock:" + enabled);
    },
    onExitMinimalMode: function onExitMinimalMode() {
      calls.push("exit-minimal");
    },
  };

  global.document = { documentElement };
  global.window = {
    addEventListener: function addEventListener(type, handler) {
      windowListeners[type] = handler;
    },
  };

  UIControls.create(dom).bindControls(handlers);
  return { calls, dom, documentElement, windowListeners };
}

test("minimal mode checkbox triggers minimal handler and dirty settings handler", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.fields.minimal_mode_enabled.checked = true;
  ctx.dom.fields.minimal_mode_enabled.listeners.change();

  assert(ctx.calls.includes("minimal:true"), "expected minimal mode toggle handler");
  assert(ctx.calls.includes("settings"), "expected settings dirty handler");
});

test("fullscreen checkbox triggers fullscreen handler and dirty settings handler", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.fields.fullscreen_enabled.checked = true;
  ctx.dom.fields.fullscreen_enabled.listeners.change();

  assert(ctx.calls.includes("fullscreen:true"), "expected fullscreen toggle handler");
  assert(ctx.calls.includes("settings"), "expected settings dirty handler");
});

test("wake lock checkbox triggers wake lock handler and dirty settings handler", function () {
  const ctx = bindWithBrowserStubs();
  ctx.dom.fields.wake_lock_enabled.checked = true;
  ctx.dom.fields.wake_lock_enabled.listeners.change();

  assert(ctx.calls.includes("wake-lock:true"), "expected wake lock toggle handler");
  assert(ctx.calls.includes("settings"), "expected settings dirty handler");
});

test("Escape exits minimal mode", function () {
  const ctx = bindWithBrowserStubs();
  ctx.windowListeners.keydown({ key: "Escape", target: createNode({ tagName: "BODY" }) });

  assert(ctx.calls.includes("exit-minimal"), "expected Escape to exit minimal mode");
});

test("clicking screen in minimal mode toggles start pause", function () {
  const ctx = bindWithBrowserStubs();
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.windowListeners.click({ button: 0, target: createNode({ id: "timer-panel" }) });

  assert(ctx.calls.includes("shortcut:toggle"), "expected minimal click to toggle timer");
});

test("clicking exit panel in minimal mode does not toggle timer", function () {
  const ctx = bindWithBrowserStubs();
  const exitTarget = createNode({ id: "minimal-exit-wrap" });
  ctx.documentElement.setAttribute("data-minimal-mode", "true");
  ctx.windowListeners.click({ button: 0, target: exitTarget });

  assert(!ctx.calls.includes("shortcut:toggle"), "exit panel clicks should not toggle timer");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
