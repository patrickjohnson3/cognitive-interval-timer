const fs = require("fs");
const path = require("path");
const Content = require("../content.js");

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

test("tooltip keys in markup have structured copy", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const keys = Array.from(html.matchAll(/data-tooltip-key="([^"]+)"/g)).map(function toKey(match) {
    return match[1];
  });
  const tooltips = Content.UI_COPY.tooltips;

  assert(keys.length > 0, "expected tooltip keys in markup");
  keys.forEach(function eachKey(key) {
    const tooltip = tooltips[key];
    assert(tooltip, "missing tooltip copy for " + key);
    assert(tooltip.triggerLabel, "missing trigger label for " + key);
    assert(tooltip.heading, "missing heading for " + key);
    assert(tooltip.body, "missing body for " + key);
  });
});
