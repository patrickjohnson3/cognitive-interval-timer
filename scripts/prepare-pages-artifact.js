const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const appShell = require("../app-shell-assets.js");
const packageJson = require("../package.json");

const ROOT = path.join(__dirname, "..");
const SITE_ROOT = path.join(ROOT, "_site");
const DEPLOY_FILES = appShell.APP_SHELL.concat("./service-worker.js")
  .filter((asset) => asset !== "./")
  .map((asset) => asset.replace(/^\.\//, ""));

function assertGeneratedOutput(target) {
  if (target !== SITE_ROOT) {
    throw new Error("Pages artifacts may only be written to " + SITE_ROOT);
  }
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

function preparePagesArtifact(outputArg) {
  const outputDir = path.resolve(ROOT, outputArg || "_site");
  assertGeneratedOutput(outputDir);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  DEPLOY_FILES.forEach((file) => {
    const source = path.join(ROOT, file);
    const destination = path.join(outputDir, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  });

  const metadata = buildMetadata();
  writeAppVersion(outputDir, metadata);

  return outputDir;
}

if (require.main === module) {
  preparePagesArtifact(process.argv[2] || "_site");
}

module.exports = {
  DEPLOY_FILES,
  buildMetadata,
  preparePagesArtifact,
};
