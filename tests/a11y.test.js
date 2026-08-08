const A11y = require("../a11y.js");
const Content = require("../content.js");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

test("phase transitions use only the dedicated live announcer", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const transition = html.match(/<p class="transition-message"[^>]*>/)[0];

  assert(!transition.includes("aria-live"));
  assert(html.includes('id="live-announcer" class="sr-only" aria-live="polite"'));
});
