const fs = require("fs");
const path = require("path");
const { parseThemeTokens } = require("./theme-utils");

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

test("theme token snapshot stays stable", function () {
  const snapshotPath = path.join(__dirname, "__snapshots__", "theme-tokens.snapshot.json");
  const expected = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const actual = parseThemeTokens();
  assert(
    JSON.stringify(stable(actual), null, 2) === JSON.stringify(stable(expected), null, 2),
    "theme token snapshot changed; update tests/__snapshots__/theme-tokens.snapshot.json if intentional"
  );
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
