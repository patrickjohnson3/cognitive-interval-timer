const { parseThemeTokens, parseHex } = require("./theme-utils");

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

function avg(rgb) {
  return (rgb[0] + rgb[1] + rgb[2]) / 3;
}

test("dark interactive states have measurable luminance deltas", function () {
  const dark = parseThemeTokens().dark;

  const button = parseHex(dark["--color-button"]);
  const hover = parseHex(dark["--color-button-hover"]);
  const accent = parseHex(dark["--color-accent"]);
  const accentStrong = parseHex(dark["--color-accent-strong"]);

  assert(button && hover && accent && accentStrong, "interactive tokens must be hex colors");

  const buttonDelta = Math.abs(avg(hover) - avg(button));
  const primaryDelta = Math.abs(avg(accent) - avg(accentStrong));

  assert(buttonDelta >= 12, `button/hover delta too small: ${buttonDelta}`);
  assert(primaryDelta >= 20, `primary gradient delta too small: ${primaryDelta}`);
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
