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
  assert(themes.signal["--color-bg"] === "#07111a", "signal background must be deep ink");
  assert(themes.signal["--color-surface"] === "#0d1b26", "signal surfaces must be ink blue");
  assert(themes.signal["--color-text"] === "#f2eee3", "signal text must be warm ivory");
  assert(themes.signal["--color-border"] === "#29404d", "signal borders must remain visible");
  assert(themes.signal["--signal-cyan"] === "#20d9e8", "signal primary accent must be cyan");
  assert(themes.signal["--signal-amber"] === "#ffad32", "signal prep accent must be amber");
  assert(themes.signal["--color-success"] === "#4bd37b", "signal success must be green");
  assert(themes.signal["--color-error"] === "#ff5964", "signal errors must be red");
  assert(themes.signal["--panel-bg"] === "var(--color-surface)", "signal cards must stay flat");
  assert(themes.signal["--timer-glow"] === "transparent", "signal timer must not glow");
});
