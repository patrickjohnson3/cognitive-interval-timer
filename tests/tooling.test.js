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

test("Pages deployment stays gated by validation", function () {
  const workflow = read(".github/workflows/deploy-pages.yml");
  const ciWorkflow = read(".github/workflows/ci.yml");

  assert(workflow.includes("workflow_run:"), "Pages deploy should run from the CI workflow result");
  assert(workflow.includes("- CI"), "Pages deploy should listen for the CI workflow");
  assert(
    workflow.includes("github.event.workflow_run.conclusion == 'success'"),
    "Pages deploy should require successful CI"
  );
  assert(
    workflow.includes("github.event.workflow_run.head_branch == 'pwa'"),
    "Pages deploy should be limited to the pwa branch"
  );
  assert(
    ciWorkflow.includes("npm run test:pwa:offline"),
    "CI validation should include the PWA offline smoke test"
  );
  assert(
    workflow.includes("actions/deploy-pages@v4"),
    "Pages workflow should use the official deploy action"
  );
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
