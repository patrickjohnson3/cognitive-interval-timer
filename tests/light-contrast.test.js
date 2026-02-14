const { parseThemeTokens, contrastRatio } = require("./theme-utils");

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

test("light contrast ratios meet minimum thresholds for key pairs", function () {
  const light = parseThemeTokens().light;

  const pairs = [
    { fg: "--text-primary", bg: "--color-surface", min: 7.0 },
    { fg: "--text-secondary", bg: "--color-surface", min: 4.5 },
    { fg: "--color-focus-ring", bg: "--color-surface", min: 4.5 },
    { fg: "--color-primary-text", bg: "--color-accent", min: 4.5 },
  ];

  pairs.forEach((pair) => {
    const ratio = contrastRatio(light[pair.fg], light[pair.bg]);
    assert(ratio != null, `unable to calculate contrast for ${pair.fg}/${pair.bg}`);
    assert(ratio >= pair.min, `${pair.fg} vs ${pair.bg} contrast ${ratio.toFixed(2)} < ${pair.min}`);
  });
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
