const fs = require("fs");
const path = require("path");
const { parseThemeTokens } = require("./theme-utils");
const assert = require("node:assert/strict");
const test = require("node:test");

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

test("theme token snapshot stays stable", function () {
  const snapshotPath = path.join(__dirname, "__snapshots__", "theme-tokens.snapshot.json");
  const expected = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const actual = parseThemeTokens();
  assert(
    JSON.stringify(stable(actual), null, 2) === JSON.stringify(stable(expected), null, 2),
    "theme token snapshot changed; update tests/__snapshots__/theme-tokens.snapshot.json if intentional"
  );
});
