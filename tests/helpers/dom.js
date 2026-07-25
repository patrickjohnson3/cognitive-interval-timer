function textNode() {
  return {
    textContent: "",
    attributes: {},
    setAttribute: function setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
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
  controlButtonNode,
  createElementFactory,
  textNode,
};
