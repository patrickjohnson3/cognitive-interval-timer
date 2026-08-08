const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const appShell = require("../app-shell-assets.js");
const packageJson = require("../package.json");

const ROOT = path.join(__dirname, "..");
const SITE_ROOT = path.join(ROOT, "_site");

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

function assertGeneratedOutput(target) {
  if (target !== SITE_ROOT) {
    throw new Error("Pages artifacts may only be written to " + SITE_ROOT);
  }
}

function trackedFiles() {
  return childProcess
    .execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function gitValue(args, fallback) {
  try {
    return childProcess.execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

function buildMetadata() {
  const commit = process.env.GITHUB_SHA || gitValue(["rev-parse", "HEAD"], "local");
  const shortCommit = commit === "local" ? "local" : commit.slice(0, 7);
  const builtAt = process.env.GITHUB_SHA ? new Date().toISOString() : "local";
  const version = packageJson.version;

  return {
    version,
    build: commit,
    commit,
    builtAt,
    label: version + "+" + shortCommit,
  };
}

function appVersionSource(metadata) {
  return (
    "(function initAppVersion(root, factory) {\n" +
    '  if (typeof module === "object" && module.exports) {\n' +
    "    module.exports = factory();\n" +
    "  } else {\n" +
    "    root.PomodoroAppVersion = factory();\n" +
    "  }\n" +
    '})(typeof self !== "undefined" ? self : this, function makeAppVersion() {\n' +
    "  return " +
    JSON.stringify(metadata, null, 4) +
    ";\n" +
    "});\n"
  );
}

function writeAppVersion(outputDir, metadata) {
  fs.writeFileSync(path.join(outputDir, "app-version.js"), appVersionSource(metadata));
}

function writeServiceWorkerBuild(outputDir, metadata) {
  const serviceWorkerPath = path.join(outputDir, "service-worker.js");
  const serviceWorker = fs.readFileSync(serviceWorkerPath, "utf8");
  const stampedServiceWorker = serviceWorker.replace(
    'const SERVICE_WORKER_BUILD = "local";',
    "const SERVICE_WORKER_BUILD = " + JSON.stringify(metadata.build) + ";"
  );
  if (stampedServiceWorker === serviceWorker) {
    throw new Error("Missing service worker build placeholder");
  }
  fs.writeFileSync(serviceWorkerPath, stampedServiceWorker);
}

function preparePagesArtifact(outputArg) {
  const outputDir = path.resolve(ROOT, outputArg || "_site");
  assertGeneratedOutput(outputDir);
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

  const metadata = buildMetadata();
  writeAppVersion(outputDir, metadata);
  writeServiceWorkerBuild(outputDir, metadata);

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
  buildMetadata,
  preparePagesArtifact,
};
