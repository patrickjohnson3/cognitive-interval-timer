function eventTargetNode(options) {
  const config = options || {};
  const attributes = {};
  const listeners = {};

  return {
    id: config.id || "",
    tagName: config.tagName || "BUTTON",
    type: config.type || "button",
    textContent: "",
    value: config.value == null ? "" : String(config.value),
    checked: Boolean(config.checked),
    hidden: Boolean(config.hidden),
    isContentEditable: false,
    attributes,
    attrs: attributes,
    listeners,
    focusCount: 0,
    addEventListener: function addEventListener(type, handler) {
      listeners[type] = handler;
    },
    focus: function focus() {
      this.focusCount += 1;
    },
    blur: function blur() {
      this.blurCount = (this.blurCount || 0) + 1;
    },
    checkValidity: function checkValidity() {
      return true;
    },
    getAttribute: function getAttribute(name) {
      return attributes[name];
    },
    setAttribute: function setAttribute(name, value) {
      attributes[name] = String(value);
    },
    removeAttribute: function removeAttribute(name) {
      delete attributes[name];
    },
    hasAttribute: function hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name);
    },
    closest: function closest(selector) {
      return selector === "#" + this.id ? this : null;
    },
  };
}

function textNode() {
  return eventTargetNode({ tagName: "SPAN" });
}

function createBrowserFixture(options) {
  const config = options || {};
  const documentListeners = {};
  const windowListeners = {};
  const documentElement = eventTargetNode({ tagName: "HTML" });
  if (config.requestFullscreen) documentElement.requestFullscreen = config.requestFullscreen;

  const documentRef = {
    activeElement: null,
    documentElement,
    fullscreenElement: null,
    visibilityState: config.visibilityState || "visible",
    addEventListener: function addEventListener(type, handler) {
      documentListeners[type] = handler;
    },
    querySelectorAll:
      config.querySelectorAll ||
      function querySelectorAll() {
        return [];
      },
  };
  if (config.exitFullscreen) documentRef.exitFullscreen = config.exitFullscreen;

  const windowRef = {
    history: {
      pushState: config.pushState || function pushState() {},
      replaceState: config.replaceState || function replaceState() {},
      back: config.back || function back() {},
    },
    addEventListener: function addEventListener(type, handler) {
      windowListeners[type] = handler;
    },
  };
  if (config.pointerEvents) windowRef.PointerEvent = function PointerEvent() {};
  if (config.touchEvents) windowRef.TouchEvent = function TouchEvent() {};

  return {
    document: documentRef,
    window: windowRef,
    documentElement,
    documentListeners,
    windowListeners,
  };
}

function controlButtonNode() {
  const node = textNode();
  node.icon = textNode();
  node.label = textNode();
  node.querySelector = function querySelector(selector) {
    if (selector === ".control-icon") return node.icon;
    if (selector === ".control-label") return node.label;
    return null;
  };
  return node;
}

function createElementFactory(nodes) {
  function registerTree(node) {
    if (node.id) nodes[node.id] = node;
    node.children.forEach(registerTree);
  }

  return function createElement(tagName) {
    return {
      tagName: tagName.toUpperCase(),
      id: "",
      className: "",
      textContent: "",
      hidden: false,
      disabled: false,
      children: [],
      attributes: {},
      listeners: {},
      remove: function remove() {
        delete nodes[this.id];
      },
      setAttribute: function setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      addEventListener: function addEventListener(type, handler) {
        this.listeners[type] = handler;
      },
      appendChild: function appendChild(child) {
        this.children.push(child);
        registerTree(child);
      },
    };
  };
}

module.exports = {
  createBrowserFixture,
  controlButtonNode,
  createElementFactory,
  eventTargetNode,
  textNode,
};
