const { parseThemeTokens, contrastRatio } = require("./theme-utils");
const assert = require("node:assert/strict");
const test = require("node:test");

test("signal contrast preserves legibility around saturated accents", function () {
  const signal = parseThemeTokens().signal;
  const pairs = [
    { fg: "--text-primary", bg: "--color-surface", min: 7.0 },
    { fg: "--text-secondary", bg: "--color-surface", min: 4.5 },
    { fg: "--timer-text-color", bg: "--color-bg", min: 7.0 },
    { fg: "--color-focus-ring", bg: "--color-surface", min: 3.0 },
    { fg: "--color-primary-text", bg: "--color-accent", min: 4.5 },
    { fg: "--color-attention", bg: "--color-surface", min: 4.5 },
    { fg: "--color-recovery", bg: "--color-surface", min: 4.5 },
    { fg: "--color-success", bg: "--color-surface", min: 4.5 },
    { fg: "--color-error", bg: "--color-surface", min: 4.5 },
    { fg: "--color-border", bg: "--color-surface", min: 1.5 },
  ];

  pairs.forEach((pair) => {
    const ratio = contrastRatio(signal[pair.fg], signal[pair.bg]);
    assert(ratio != null, `unable to calculate contrast for ${pair.fg}/${pair.bg}`);
    assert(
      ratio >= pair.min,
      `${pair.fg} vs ${pair.bg} contrast ${ratio.toFixed(2)} < ${pair.min}`
    );
  });
});
