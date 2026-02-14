const { parseThemeTokens } = require("./theme-utils");

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
  assert(themes.dark["--color-bg"] === "#0f172a", "dark background must be #0f172a");
  assert(themes.dark["--color-surface"] === "#1e293b", "dark surface must be #1e293b");
  assert(themes.dark["--color-text"] === "#e5e7eb", "dark text must be #e5e7eb");
  assert(themes.dark["--color-muted"] === "#94a3b8", "dark secondary text must be #94a3b8");
  assert(themes.dark["--color-border"] === "#334155", "dark border must be #334155");
  assert(themes.dark["--color-accent"] === "#3b82f6", "dark focus accent must be #3b82f6");
  assert(themes.dark["--color-recall-accent"] === "#8b5cf6", "dark recall accent must be #8b5cf6");
  assert(themes.dark["--color-break-accent"] === "#22c55e", "dark short break accent must be #22c55e");
  assert(themes.dark["--color-long-break-accent"] === "#d97706", "dark long break accent must be #d97706");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
