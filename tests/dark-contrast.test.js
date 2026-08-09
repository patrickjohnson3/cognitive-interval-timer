const { parseThemeTokens, contrastRatio } = require("./theme-utils");
const assert = require("node:assert/strict");
const test = require("node:test");

test("dark contrast ratios meet minimum thresholds for key pairs", function () {
  const dark = parseThemeTokens().dark;

  const pairs = [
    { fg: "--text-primary", bg: "--color-surface", min: 7.0 },
    { fg: "--text-secondary", bg: "--color-surface", min: 4.5 },
    { fg: "--color-focus-ring", bg: "--color-surface", min: 3.0 },
    { fg: "--color-primary-text", bg: "--color-accent", min: 4.5 },
    { fg: "--timer-text-color", bg: "--color-surface", min: 7.0 },
    { fg: "--color-recovery", bg: "--color-surface", min: 4.5 },
    { fg: "--color-success", bg: "--color-surface", min: 4.5 },
    { fg: "--color-error", bg: "--color-surface", min: 4.5 },
  ];

  pairs.forEach((pair) => {
    const ratio = contrastRatio(dark[pair.fg], dark[pair.bg]);
    assert(ratio != null, `unable to calculate contrast for ${pair.fg}/${pair.bg}`);
    assert(
      ratio >= pair.min,
      `${pair.fg} vs ${pair.bg} contrast ${ratio.toFixed(2)} < ${pair.min}`
    );
  });
});
