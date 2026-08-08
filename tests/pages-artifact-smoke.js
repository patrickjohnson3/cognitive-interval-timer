const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const packageJson = require("../package.json");

const ROOT = path.join(__dirname, "..");
const SITE_ROOT = path.join(ROOT, "_site");
const NODE = process.execPath;

function run(command, args, options) {
  const result = childProcess.spawnSync(command, args, {
    cwd: ROOT,
    env: Object.assign({}, process.env, options && options.env),
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(command + " failed with exit code " + result.status);
  }
}

function gitValue(args) {
  return childProcess.execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function assertVersionedArtifact() {
  const commit = gitValue(["rev-parse", "HEAD"]);
  const shortCommit = commit.slice(0, 7);
  const appVersion = fs.readFileSync(path.join(SITE_ROOT, "app-version.js"), "utf8");

  if (!appVersion.includes('"label": "' + packageJson.version + "+" + shortCommit + '"')) {
    throw new Error("Pages artifact app-version.js does not include the commit build label");
  }
}

try {
  run(NODE, ["scripts/build-pages.js", "_site"]);
  assertVersionedArtifact();
  run(NODE, ["tests/pwa-offline-smoke.js"], { env: { APP_ROOT: SITE_ROOT } });
  console.log("Pages artifact smoke passed.");
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
