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

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("mobile layout prevents document-level horizontal scroll", function () {
  const css = read("styles.css");
  const requiredSnippets = [
    "html {",
    "overflow-x: hidden;",
    "body {",
    "width: 100%;",
    "max-width: 100%;",
    ".app {",
    "max-width: 100%;",
  ];

  requiredSnippets.forEach((snippet) => {
    assert(css.includes(snippet), "missing mobile overflow guard: " + snippet);
  });
});

test("timer controls shrink inside narrow mobile panels", function () {
  const css = read("styles.css");
  const requiredSnippets = [
    "grid-template-columns: repeat(auto-fit, minmax(min(9.75rem, 100%), 1fr));",
    ".controls button",
    "width: 100%;",
    "min-width: 0;",
  ];

  requiredSnippets.forEach((snippet) => {
    assert(css.includes(snippet), "missing responsive control rule: " + snippet);
  });
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
