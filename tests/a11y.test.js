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

test("document headings do not skip hierarchy levels", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const levels = Array.from(html.matchAll(/<h([1-6])\b/g), function headingLevel(match) {
    return Number(match[1]);
  });

  assert.equal(levels[0], 1);
  levels.slice(1).forEach(function verifyHeadingLevel(level, index) {
    assert(level <= levels[index] + 1, "heading level skipped after heading " + (index + 1));
  });
});

test("platform failures have readable announcements", function () {
  const a11y = A11y.create({ Content });

  assert.match(a11y.formatAnnouncement("fullscreen_unavailable"), /Fullscreen is unavailable/);
  assert.match(a11y.formatAnnouncement("wake_lock_unavailable"), /not supported/);
  assert.match(a11y.formatAnnouncement("wake_lock_request_failed"), /could not be kept awake/);
});

test("timer actions have concise status announcements", function () {
  const a11y = A11y.create({ Content });

  assert.equal(a11y.formatAnnouncement("timer_paused"), "Timer paused.");
  assert.equal(a11y.formatAnnouncement("timer_resumed"), "Timer resumed.");
  assert.equal(a11y.formatAnnouncement("block_restarted"), "Block restarted.");
});

test("tooltip triggers meet the 44 CSS-pixel touch target minimum", function () {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  const rule = css.match(/\.tip-trigger\s*\{([^}]*)\}/)[1];
  const coarsePointerRule = css.match(/@media \(any-pointer: coarse\)\s*\{([\s\S]*?)\n\}/)[1];

  assert.match(rule, /width:\s*44px/);
  assert.match(rule, /height:\s*44px/);
  assert.match(coarsePointerRule, /width:\s*48px/);
  assert.match(coarsePointerRule, /height:\s*48px/);
});
