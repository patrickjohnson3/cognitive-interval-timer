const fs = require("fs");
const path = require("path");

function readStyles() {
  const shared = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  const light = fs.readFileSync(path.join(__dirname, "..", "themes", "light.css"), "utf8");
  const dark = fs.readFileSync(path.join(__dirname, "..", "themes", "dark.css"), "utf8");
  const signal = fs.readFileSync(path.join(__dirname, "..", "themes", "signal.css"), "utf8");
  return light + "\n" + dark + "\n" + signal + "\n" + shared;
}

function extractThemeBlock(css, theme) {
  const re = new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\}`);
  const match = css.match(re);
  if (!match) throw new Error(`Could not find ${theme} theme block`);
  return match[1];
}

function parseTokens(block) {
  const out = {};
  const declarations = block.match(/--[^:]+:[\s\S]*?;/g) || [];
  declarations.forEach((declaration) => {
    const idx = declaration.indexOf(":");
    if (idx === -1) return;
    const key = declaration.slice(0, idx).trim();
    const value = declaration
      .slice(idx + 1)
      .replace(/;$/, "")
      .replace(/\s+/g, " ")
      .trim();
    out[key] = value;
  });
  return out;
}

function parseThemeTokens() {
  const css = readStyles();
  return {
    light: parseTokens(extractThemeBlock(css, "light")),
    dark: parseTokens(extractThemeBlock(css, "dark")),
    signal: parseTokens(extractThemeBlock(css, "signal")),
  };
}

function parseHex(value) {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (!hex) return null;
  const raw = hex[1];
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16),
  ];
}

function relativeLuminance(rgb) {
  const convert = (n) => {
    const v = n / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb.map(convert);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) return null;
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

module.exports = {
  parseThemeTokens,
  parseHex,
  contrastRatio,
};
