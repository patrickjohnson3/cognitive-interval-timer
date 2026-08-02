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
    "@media (orientation: landscape) and (max-height: 600px)",
    "--density-scale: 0.82;",
    "align-items: start;",
    "width: min(960px, 100%);",
    "grid-template-columns: minmax(16rem, 1.05fr) minmax(14rem, 0.95fr);",
    "@media (orientation: landscape) and (max-height: 600px) and (max-width: 640px)",
  ];

  requiredSnippets.forEach((snippet) => {
    assert(css.includes(snippet), "missing landscape layout rule: " + snippet);
  });
});

test("minimal mode uses small viewport height on mobile", function () {
  const css = read("styles.css");
  const minimalSection = css.slice(css.indexOf(':root[data-minimal-mode="true"] .app'));

  assert(minimalSection.includes("min-height: 100vh;"), "missing minimal mode vh fallback");
  assert(minimalSection.includes("min-height: 100svh;"), "missing minimal mode svh height");
});

test("minimal mode exit panel avoids mobile top edge", function () {
  const css = read("styles.css");
  const minimalSection = css.slice(css.indexOf(".minimal-exit-panel"));
  const requiredSnippets = [
    "pointer-events: none;",
    "transform: translateY(calc(-100% - var(--space-2)));",
    "top: calc(env(safe-area-inset-top, 0px) + 18px);",
    "width: 56px;",
    "height: 40px;",
    "top: calc(env(safe-area-inset-top, 0px) + 12px);",
    ':root[data-minimal-mode="true"] .minimal-exit-wrap[data-open="true"] .minimal-exit-panel',
    "pointer-events: auto;",
    "@media (hover: none)",
    "opacity: 0.32;",
  ];

  requiredSnippets.forEach((snippet) => {
    assert(minimalSection.includes(snippet), "missing minimal panel mobile edge rule: " + snippet);
  });
  assert(
    !minimalSection.includes(".minimal-exit-wrap:hover .minimal-exit-panel"),
    "hover should not auto-open minimal panel"
  );
  assert(
    !minimalSection.includes(".minimal-exit-wrap:focus-within .minimal-exit-panel"),
    "focus should not auto-open minimal panel"
  );
});

test("minimal mode has a stronger reading hierarchy", function () {
  const css = read("styles.css");
  const minimalSection = css.slice(css.indexOf(':root[data-minimal-mode="true"] .app'));
  const requiredSnippets = [
    "letter-spacing: 0.22em;",
    "font-size: clamp(5.25rem, 22vw, 12rem);",
    "font-size: clamp(1.35rem, 3.8vw, 2.35rem);",
    "max-width: min(760px, 92vw);",
  ];

  requiredSnippets.forEach((snippet) => {
    assert(minimalSection.includes(snippet), "missing minimal readability rule: " + snippet);
  });
});

test("narrow mobile layout has calmer reading spacing", function () {
  const css = read("styles.css");
  const mobileSection = css.slice(css.indexOf("@media (max-width: 760px)"));
  const requiredSnippets = [
    ".controls button",
    "min-height: 48px;",
    "padding-block: 0.8rem;",
    ".long-hint",
    "line-height: 1.58;",
    ".checks",
    "gap: var(--space-4);",
    ".setting-help",
    "line-height: 1.45;",
  ];

  requiredSnippets.forEach((snippet) => {
    assert(mobileSection.includes(snippet), "missing mobile readability rule: " + snippet);
  });
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
