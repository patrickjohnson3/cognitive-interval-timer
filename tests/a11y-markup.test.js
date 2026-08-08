const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const test = require("node:test");

function findAriaHiddenBlocks(html) {
  const blocks = [];
  const openTagPattern = /<([a-z][a-z0-9-]*)\b[^>]*aria-hidden="true"[^>]*>/gi;
  let match;

  while ((match = openTagPattern.exec(html)) !== null) {
    const tag = match[1];
    const start = match.index + match[0].length;
    const close = html.indexOf("</" + tag + ">", start);
    if (close !== -1) {
      blocks.push({ tag, body: html.slice(start, close) });
    }
  }

  return blocks;
}

test("aria-hidden containers do not include focusable elements", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const focusablePattern = /<(button|input|select|textarea)\b|<a\b[^>]*href=|tabindex="(?!-1")/i;
  const offenders = findAriaHiddenBlocks(html).filter(function hasFocusable(block) {
    return focusablePattern.test(block.body);
  });

  assert(offenders.length === 0, "found focusable content inside aria-hidden containers");
});

test("timer control icons are hidden from accessible names", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  ["start", "skip", "reset"].forEach(function eachControl(id) {
    const buttonMatch = html.match(new RegExp('<button id="' + id + '"[\\s\\S]*?</button>'));
    assert(buttonMatch, "missing timer control #" + id);
    assert(
      buttonMatch[0].includes('class="control-icon" aria-hidden="true"'),
      "missing aria-hidden control icon for #" + id
    );
    assert(
      buttonMatch[0].includes('class="control-label"'),
      "missing separate control label for #" + id
    );
  });
});

test("complex behavior settings include accessible helper text", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const describedSettings = [
    ["quiet_mode_enabled", "help-quiet-mode-enabled"],
    ["fullscreen_enabled", "help-fullscreen-enabled"],
    ["minimal_mode_enabled", "help-minimal-mode-enabled"],
    ["wake_lock_enabled", "help-wake-lock-enabled"],
  ];

  describedSettings.forEach(function eachSetting(setting) {
    const inputId = setting[0];
    const helpId = setting[1];

    assert(
      html.includes('id="' + inputId + '"') && html.includes('aria-describedby="' + helpId + '"'),
      "missing helper relationship for " + inputId
    );
    assert(html.includes('id="' + helpId + '"'), "missing helper text for " + inputId);
  });
});
