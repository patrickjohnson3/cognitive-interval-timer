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

test("break settings keep all break controls in cycle structure", function () {
  const html = read("index.html");
  assert(html.includes('id="label-break"'), "missing short break label");
  assert(html.includes('id="label-long_break"'), "missing long break label");
  assert(html.includes('id="label-blocks"'), "missing blocks label");
});

test("cycle structure uses paired two-column input rows", function () {
  const css = read("styles.css");
  const requiredSnippets = [
    ".cycle-paired-grid",
    "grid-template-columns: repeat(2, minmax(0, 1fr));",
    "gap: var(--space-3);",
    ".cycle-col-heading",
    "font-size: 0.72rem;",
    ".settings-divider",
    "height: 1px;",
  ];

  requiredSnippets.forEach((snippet) => {
    assert(css.includes(snippet), "missing cycle structure rule: " + snippet);
  });
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
