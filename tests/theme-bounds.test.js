const { parseThemeTokens } = require("./theme-utils");
const assert = require("node:assert/strict");
const test = require("node:test");

test("theme base text/background colors match expected values", function () {
  const themes = parseThemeTokens();
  assert(themes.light["--color-bg"] === "#f2eee6", "light background must be warm off-white");
  assert(themes.light["--color-surface"] === "#fbf8f2", "light surface must be soft off-white");
  assert(themes.light["--color-text"] === "#24231f", "light text must be dark charcoal");
  assert(themes.light["--color-muted"] === "#625d54", "light secondary text must be warm gray");
  assert(themes.light["--color-border"] === "#d8d0c4", "light borders must be warm neutral");
  assert(themes.light["--color-accent"] === "#a95f12", "light attention accent must be amber");
  assert(
    themes.light["--color-break-accent"] === "#64717d",
    "light short break accent must be cool neutral"
  );
  assert(
    themes.light["--color-long-break-accent"] === "#64717d",
    "light long break accent must be cool neutral"
  );
  assert(themes.light["--color-success"] === "#467850", "light success must be muted green");
  assert(themes.light["--color-error"] === "#a74646", "light errors must use muted red");
  assert(
    themes.light["--phase-focus-accent"] === "#85837d",
    "light focus phase must use a neutral accent"
  );
  assert(themes.dark["--color-bg"] === "#0f172a", "dark background must be #0f172a");
  assert(themes.dark["--color-surface"] === "#1e293b", "dark surface must be #1e293b");
  assert(themes.dark["--color-text"] === "#e5e7eb", "dark text must be #e5e7eb");
  assert(themes.dark["--color-muted"] === "#94a3b8", "dark secondary text must be #94a3b8");
  assert(themes.dark["--color-border"] === "#334155", "dark border must be #334155");
  assert(themes.dark["--color-accent"] === "#d28a2e", "dark attention accent must be #d28a2e");
  assert(
    themes.dark["--color-break-accent"] === "#8995a3",
    "dark short break accent must be #8995a3"
  );
  assert(
    themes.dark["--color-long-break-accent"] === "#8995a3",
    "dark long break accent must be #8995a3"
  );
  assert(themes.dark["--color-success"] === "#6f9b78", "dark success must be muted green");
  assert(themes.dark["--color-error"] === "#dc7373", "dark errors must use muted red");
  assert(
    themes.dark["--phase-focus-accent"] === "#64748b",
    "dark focus phase must use a neutral accent"
  );
});
