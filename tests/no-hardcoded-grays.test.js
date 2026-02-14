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

function stripThemeTokenBlocks(css) {
  return css
    .replace(/:root\[data-theme="light"\]\s*\{[\s\S]*?\}/g, "")
    .replace(/:root\[data-theme="dark"\]\s*\{[\s\S]*?\}/g, "")
    .replace(/:root\[data-theme="dark"\]\[data-contrast="high"\]\s*\{[\s\S]*?\}/g, "");
}

test("no hardcoded hex grays outside theme token declarations", function () {
  const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  const light = fs.readFileSync(path.join(__dirname, "..", "themes", "light.css"), "utf8");
  const dark = fs.readFileSync(path.join(__dirname, "..", "themes", "dark.css"), "utf8");

  const merged = stripThemeTokenBlocks(styles) + "\n" + stripThemeTokenBlocks(light) + "\n" + stripThemeTokenBlocks(dark);
  const matches = merged.match(/#[0-9a-fA-F]{6}/g) || [];
  assert(matches.length === 0, "found hardcoded hex colors: " + matches.join(", "));
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
