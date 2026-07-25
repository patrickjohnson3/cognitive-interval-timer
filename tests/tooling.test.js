const fs = require("fs");
const path = require("path");
const { parseWorkflowYaml } = require("./helpers/workflow-yaml.js");

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

function workflow(file) {
  return parseWorkflowYaml(read(file));
}

function steps(job) {
  return Array.isArray(job.steps) ? job.steps : [];
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
  const pages = workflow(".github/workflows/deploy-pages.yml");
  const ci = workflow(".github/workflows/ci.yml");
  const deploy = pages.jobs.deploy;
  const deploySteps = steps(deploy);
  const ciSteps = steps(ci.jobs.test);

  assert(pages.on.workflow_run.workflows.includes("CI"), "Pages deploy should listen for CI");
  assert(
    pages.on.workflow_run.types.includes("completed"),
    "Pages deploy should run after CI completes"
  );
  assert(
    deploy.if.includes("github.event.workflow_run.conclusion == 'success'"),
    "Pages deploy should require successful CI"
  );
  assert(
    deploy.if.includes("github.event.workflow_run.head_branch == 'pwa'"),
    "Pages deploy should be limited to the pwa branch"
  );
  assert(
    ciSteps.some(function runsOfflineSmoke(step) {
      return step.run === "npm run test:pwa:offline";
    }),
    "CI validation should include the PWA offline smoke test"
  );
  assert(
    ciSteps.some(function runsPagesArtifactSmoke(step) {
      return step.run === "npm run test:pages:artifact";
    }),
    "CI validation should include the Pages artifact smoke test"
  );
  assert(
    deploySteps.some(function deploysPages(step) {
      return step.uses === "actions/deploy-pages@v4";
    }),
    "Pages workflow should use the official deploy action"
  );
  assert(
    deploySteps.some(function buildsPages(step) {
      return step.run === "npm run build:pages";
    }),
    "Pages workflow should build the static artifact through the build script"
  );
});

test("Validation wrapper runs project checks without npm", function () {
  const validate = read("scripts/validate.js");
  const pkg = JSON.parse(read("package.json"));

  assert(
    pkg.scripts["build:pages"] === "node scripts/build-pages.js _site",
    "missing build script"
  );
  assert(pkg.scripts.validate === "node scripts/validate.js", "missing validate script");
  assert(validate.includes("process.execPath"), "validate should use the current Node binary");
  assert(validate.includes("prettier.cjs"), "validate should run Prettier directly");
  assert(validate.includes("eslint.js"), "validate should run ESLint directly");
  assert(validate.includes("--test"), "validate should run the Node test runner");
  assert(
    validate.includes("tests/pwa-offline-smoke.js"),
    "validate should run the PWA offline smoke test"
  );
  assert(
    validate.includes("tests/pages-artifact-smoke.js"),
    "validate should run the Pages artifact smoke test"
  );
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
