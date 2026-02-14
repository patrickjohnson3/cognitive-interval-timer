const fs = require("fs");
const path = require("path");

function readStyles() {
  return fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
}

function extractThemeBlock(css, theme) {
  const re = new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\}`);
  const match = css.match(re);
  if (!match) throw new Error(`Could not find ${theme} theme block`);
  return match[1];
}

function parseTokens(block) {
  const out = {};
  block
    .split("\n")
    .map((line) => line.trim())
    .forEach((line) => {
      if (!line.startsWith("--")) return;
      const idx = line.indexOf(":");
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).replace(/;$/, "").trim();
      out[key] = value;
    });
  return out;
}

function parseThemeTokens() {
  const css = readStyles();
  return {
    light: parseTokens(extractThemeBlock(css, "light")),
    dark: parseTokens(extractThemeBlock(css, "dark")),
  };
}

function parseColorChannels(value) {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const raw = hex[1];
    return [
      parseInt(raw.slice(0, 2), 16),
      parseInt(raw.slice(2, 4), 16),
      parseInt(raw.slice(4, 6), 16),
    ];
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(",").map((v) => v.trim());
    if (parts.length >= 3) {
      return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
    }
  }

  return null;
}

module.exports = {
  parseThemeTokens,
  parseColorChannels,
};
