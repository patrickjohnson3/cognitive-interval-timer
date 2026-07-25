const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (err) {
    console.error("FAIL", name);
    console.error("  " + err.message);
    process.exitCode = 1;
  }
}

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("Node version metadata stays aligned", function () {
  const nodeVersion = read(".node-version").trim();
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));

  assert(
    /^\d+\.\d+\.\d+$/.test(nodeVersion),
    ".node-version should contain an exact semver version"
  );
  assert(
    pkg.engines && pkg.engines.node === nodeVersion,
    "package engines.node should match .node-version"
  );
  assert(
    lock.packages[""].engines.node === nodeVersion,
    "lockfile root engines.node should match .node-version"
  );
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
