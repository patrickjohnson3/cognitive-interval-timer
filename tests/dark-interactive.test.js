const { parseThemeTokens, parseHex } = require("./theme-utils");
const assert = require("node:assert/strict");
const test = require("node:test");

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
