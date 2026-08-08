const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const NODE = process.execPath;
const TEST_FILES = fs
  .readdirSync(path.join(ROOT, "tests"))
  .filter((file) => file.endsWith(".test.js"))
  .map((file) => path.join("tests", file));

const checks = [
  {
    name: "format",
    command: NODE,
    args: ["node_modules/prettier/bin/prettier.cjs", "--check", "."],
  },
  {
    name: "lint",
    command: NODE,
    args: ["node_modules/eslint/bin/eslint.js", "."],
  },
  {
    name: "unit tests",
    command: NODE,
    args: ["--test", "--test-isolation=none"].concat(TEST_FILES),
  },
  {
    name: "PWA offline smoke",
    command: NODE,
    args: ["tests/pwa-offline-smoke.js"],
  },
  {
    name: "Pages artifact smoke",
    command: NODE,
    args: ["tests/pages-artifact-smoke.js"],
  },
];

function runCheck(check) {
  console.log("Running " + check.name + "...");
  const result = childProcess.spawnSync(check.command, check.args, {
    cwd: ROOT,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(check.name + " failed with exit code " + result.status);
  }
}

try {
  checks.forEach(runCheck);
  console.log("Validation passed.");
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
