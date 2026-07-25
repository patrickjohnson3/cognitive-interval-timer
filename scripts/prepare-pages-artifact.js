const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const outputArg = process.argv[2] || "_site";
const OUTPUT_DIR = path.resolve(ROOT, outputArg);

const DEV_ONLY_PATHS = new Set([
  ".gitignore",
  ".node-version",
  ".prettierignore",
  ".prettierrc.json",
  "eslint.config.js",
  "package-lock.json",
  "package.json",
  "README.md",
]);

const DEV_ONLY_PREFIXES = [".github/", "scripts/", "tests/"];

function isDevOnly(file) {
  return DEV_ONLY_PATHS.has(file) || DEV_ONLY_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function assertInsideRoot(target) {
  const relative = path.relative(ROOT, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Refusing to write outside repository: " + target);
  }
}

function trackedFiles() {
  return childProcess
    .execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

assertInsideRoot(OUTPUT_DIR);
fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

trackedFiles()
  .filter((file) => !isDevOnly(file))
  .forEach((file) => {
    const source = path.join(ROOT, file);
    const destination = path.join(OUTPUT_DIR, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  });
