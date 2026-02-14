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

test("break settings keep paired long-break and block controls", function () {
  const html = read("index.html");
  assert(html.includes('class="break-short"'), "missing break-short field class");
  assert(html.includes('class="break-long"'), "missing break-long field class");
  assert(html.includes('class="break-blocks"'), "missing break-blocks field class");
});

test("break layout grid placement enforces intended grouping", function () {
  const css = read("styles.css");
  const requiredSnippets = [
    ".break-layout",
    "grid-template-columns: repeat(2, minmax(0, 1fr));",
    ".break-short",
    "grid-row: 1;",
    ".break-long",
    "grid-row: 2;",
    ".break-blocks",
    "grid-column: 2 / 3;",
    "grid-row: 2;",
  ];

  requiredSnippets.forEach((snippet) => {
    assert(css.includes(snippet), "missing break layout rule: " + snippet);
  });
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
