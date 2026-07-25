const childProcess = require("child_process");
const path = require("path");

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

try {
  run(NODE, ["scripts/prepare-pages-artifact.js", "_site"]);
  run(NODE, ["tests/pwa-offline-smoke.js"], { env: { APP_ROOT: SITE_ROOT } });
  console.log("Pages artifact smoke passed.");
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
