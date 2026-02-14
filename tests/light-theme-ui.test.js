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

test("key UI blocks are token driven for light-theme safety", function () {
  const css = read("styles.css");

  const checks = [
    { sel: ".app", must: ["var(--elevation-3)"] },
    { sel: ".badge", must: ["var(--badge-bg)", "var(--badge-border)"] },
    { sel: ".hint", must: ["var(--hint-bg)", "var(--hint-border)"] },
    { sel: ".long-hint", must: ["var(--long-hint-bg)", "var(--long-hint-border)"] },
    { sel: ".subtitle", must: ["var(--text-secondary"] },
  ];

  checks.forEach((check) => {
    const idx = css.indexOf(check.sel);
    assert(idx !== -1, `missing selector ${check.sel}`);
    const block = css.slice(idx, css.indexOf("}", idx) + 1);
    check.must.forEach((needle) => {
      assert(block.includes(needle), `${check.sel} missing ${needle}`);
    });
  });
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
