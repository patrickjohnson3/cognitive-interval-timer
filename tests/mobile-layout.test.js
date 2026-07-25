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
  const html = read("index.html");
  const requiredSnippets = [
    "html {",
    "overflow-x: hidden;",
    "body {",
    "width: 100%;",
    "max-width: 100%;",
    "min-height: 100svh;",
    "env(safe-area-inset-top, 0px)",
    ".app {",
    "max-width: 100%;",
  ];

  assert(html.includes("viewport-fit=cover"), "missing viewport safe-area opt-in");
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

test("short mobile landscape gets a compact two-column layout", function () {
  const css = read("styles.css");
  const requiredSnippets = [
    "@media (orientation: landscape) and (max-height: 520px)",
    "--density-scale: 0.82;",
    "align-items: start;",
    "width: min(960px, 100%);",
    "grid-template-columns: minmax(16rem, 1.05fr) minmax(14rem, 0.95fr);",
    "@media (orientation: landscape) and (max-height: 520px) and (max-width: 640px)",
  ];

  requiredSnippets.forEach((snippet) => {
    assert(css.includes(snippet), "missing landscape layout rule: " + snippet);
  });
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
