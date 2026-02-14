const { parseThemeTokens, parseColorChannels } = require("./theme-utils");

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

const MIN = 0x1e;
const MAX = 0xd4;

test("theme colors stay within configured grayscale bounds", function () {
  const themes = parseThemeTokens();

  ["light", "dark"].forEach((themeName) => {
    const tokens = themes[themeName];
    Object.keys(tokens).forEach((token) => {
      if (!token.startsWith("--color-")) return;
      if (token === "--color-shadow") return;
      const channels = parseColorChannels(tokens[token]);
      if (!channels) return;
      channels.forEach((channel) => {
        assert(channel >= MIN && channel <= MAX, `${themeName} ${token} out of bounds: ${channel}`);
      });
      assert(channels[0] === channels[1] && channels[1] === channels[2], `${themeName} ${token} not grayscale`);
    });
  });
});

test("theme base text/background colors match expected boundaries", function () {
  const themes = parseThemeTokens();
  assert(themes.light["--color-bg"] === "#d4d4d4", "light background must be #d4d4d4");
  assert(themes.light["--color-text"] === "#1e1e1e", "light text must be #1e1e1e");
  assert(themes.dark["--color-bg"] === "#1e1e1e", "dark background must be #1e1e1e");
  assert(themes.dark["--color-text"] === "#d4d4d4", "dark text must be #d4d4d4");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
