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

test("dark theme colors stay within configured grayscale bounds", function () {
  const themes = parseThemeTokens();
  const tokens = themes.dark;

  Object.keys(tokens).forEach((token) => {
    if (!token.startsWith("--color-")) return;
    if (token === "--color-shadow") return;
    const channels = parseColorChannels(tokens[token]);
    if (!channels) return;
    channels.forEach((channel) => {
      assert(channel >= MIN && channel <= MAX, `dark ${token} out of bounds: ${channel}`);
    });
    assert(channels[0] === channels[1] && channels[1] === channels[2], `dark ${token} not grayscale`);
  });
});

test("theme base text/background colors match expected values", function () {
  const themes = parseThemeTokens();
  assert(themes.light["--color-bg"] === "#f5f7f9", "light background must be #f5f7f9");
  assert(themes.light["--color-surface"] === "#ffffff", "light surface must be #ffffff");
  assert(themes.light["--color-text"] === "#1f2933", "light text must be #1f2933");
  assert(themes.light["--color-muted"] === "#52606d", "light secondary text must be #52606d");
  assert(themes.light["--color-border"] === "#e4e7eb", "light border must be #e4e7eb");
  assert(themes.light["--color-accent"] === "#2563eb", "light focus accent must be #2563eb");
  assert(themes.light["--color-break-accent"] === "#16a34a", "light break accent must be #16a34a");
  assert(themes.light["--color-recall-accent"] === "#7c3aed", "light recall accent must be #7c3aed");
  assert(themes.dark["--color-bg"] === "#1e1e1e", "dark background must be #1e1e1e");
  assert(themes.dark["--color-text"] === "#d4d4d4", "dark text must be #d4d4d4");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
