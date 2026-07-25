const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const appShell = require("../app-shell-assets.js");

const ROOT = path.join(__dirname, "..");

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

function preparePagesArtifact(outputArg) {
  const outputDir = path.resolve(ROOT, outputArg || "_site");
  assertInsideRoot(outputDir);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  trackedFiles()
    .filter((file) => !isDevOnly(file))
    .forEach((file) => {
      const source = path.join(ROOT, file);
      const destination = path.join(outputDir, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    });

  const missingAppShellAssets = appShell.APP_SHELL.filter((asset) => asset !== "./").filter(
    (asset) => !fs.existsSync(path.join(outputDir, asset.replace(/^\.\//, "")))
  );

  if (missingAppShellAssets.length > 0) {
    throw new Error(
      "Missing app shell assets in Pages artifact: " + missingAppShellAssets.join(", ")
    );
  }

  return outputDir;
}

if (require.main === module) {
  preparePagesArtifact(process.argv[2] || "_site");
}

module.exports = {
  preparePagesArtifact,
};
