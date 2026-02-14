const fs = require("fs");
const path = require("path");
const { parseThemeTokens } = require("./theme-utils");

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

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        out[key] = stable(value[key]);
      });
    return out;
  }
  return value;
}

test("dark key token snapshot stays stable", function () {
  const expectedPath = path.join(__dirname, "__snapshots__", "dark-ui.snapshot.json");
  const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
  const dark = parseThemeTokens().dark;

  const actual = {
    "--color-bg": dark["--color-bg"],
    "--color-text": dark["--color-text"],
    "--text-primary": dark["--text-primary"],
    "--text-secondary": dark["--text-secondary"],
    "--color-button": dark["--color-button"],
    "--color-button-hover": dark["--color-button-hover"],
    "--color-accent": dark["--color-accent"],
    "--color-accent-strong": dark["--color-accent-strong"],
    "--border-subtle": dark["--border-subtle"],
    "--border-strong": dark["--border-strong"],
    "--panel-bg": dark["--panel-bg"],
    "--button-primary-bg": dark["--button-primary-bg"],
  };

  assert(
    JSON.stringify(stable(actual), null, 2) === JSON.stringify(stable(expected), null, 2),
    "dark snapshot changed; update tests/__snapshots__/dark-ui.snapshot.json if intentional"
  );
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
