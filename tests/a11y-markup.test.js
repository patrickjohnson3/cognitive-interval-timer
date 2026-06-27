const fs = require("fs");
const path = require("path");

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
