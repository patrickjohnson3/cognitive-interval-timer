const A11y = require("../a11y.js");
const Content = require("../content.js");
const assert = require("node:assert/strict");
const test = require("node:test");

test("tooltip triggers use description semantics without popup semantics", function () {
  const attributes = {};
  const bubble = { id: "tip-copy" };
  const trigger = {
    getAttribute: function getAttribute(name) {
      return attributes[name] || null;
    },
    setAttribute: function setAttribute(name, value) {
      attributes[name] = String(value);
    },
    closest: function closest() {
      return {
        querySelector: function querySelector() {
          return bubble;
        },
      };
    },
  };
  const root = {
    querySelectorAll: function querySelectorAll() {
      return [trigger];
    },
  };

  A11y.create({ Content }).applyAriaDefaults(root);

  assert.equal(attributes["aria-describedby"], "tip-copy");
  assert.equal(attributes["aria-haspopup"], undefined);
});
