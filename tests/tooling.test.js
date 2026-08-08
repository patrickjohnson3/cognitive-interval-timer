const fs = require("fs");
const path = require("path");
const { parseWorkflowYaml } = require("./helpers/workflow-yaml.js");
const { DEPLOY_FILES, preparePagesArtifact } = require("../scripts/prepare-pages-artifact.js");
const assert = require("node:assert/strict");
const test = require("node:test");

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
  const majorVersion = nodeVersion.split(".")[0];
  const engineRange = ">=" + majorVersion + " <" + (Number(majorVersion) + 1);
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));

  assert(
    /^\d+\.\d+\.\d+$/.test(nodeVersion),
    ".node-version should contain an exact semver version"
  );
  assert(
    pkg.engines && pkg.engines.node === engineRange,
    "package engines.node should support the .node-version major"
  );
  assert(
    lock.packages[""].engines.node === engineRange,
    "lockfile root engines.node should match package engines.node"
  );
});

test("CI keeps deployable branch output validated", function () {
  const ci = workflow(".github/workflows/ci.yml");
  const ciSteps = steps(ci.jobs.test);

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
});

test("Pages deploy builds stamped artifact from master", function () {
  const pages = workflow(".github/workflows/deploy-pages.yml");
  const deploy = pages.jobs.deploy;
  const deploySteps = steps(deploy);

  assert(
    pages.on.push.branches.includes("master"),
    "Pages deploy should run from the master branch"
  );
  assert(deploy.environment.name === "github-pages", "Pages deploy should target github-pages");
  assert(
    deploySteps.some(function validates(step) {
      return step.run === "npm run validate";
    }),
    "Pages deploy should validate before building"
  );
  assert(
    deploySteps.some(function buildsPages(step) {
      return step.run === "npm run build:pages";
    }),
    "Pages deploy should build the static artifact through the build script"
  );
  assert(
    deploySteps.some(function uploadsPagesArtifact(step) {
      return step.uses === "actions/upload-pages-artifact@v3";
    }),
    "Pages deploy should upload the generated artifact"
  );
  assert(
    deploySteps.some(function deploysPages(step) {
      return step.uses === "actions/deploy-pages@v4";
    }),
    "Pages workflow should use the official deploy action"
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

test("Pages artifact build refuses destructive output targets", function () {
  let error = null;
  try {
    preparePagesArtifact(".");
  } catch (caught) {
    error = caught;
  }

  assert(error, "expected repository-root output to be rejected");
  assert(
    error.message.includes("Pages artifacts may only be written"),
    "expected a clear generated-output error"
  );
});

test("Pages artifact uses an explicit runtime allowlist", function () {
  ["AGENTS.md", "README.md", "SECURITY.md", "TODO.md", "package.json"].forEach((file) => {
    assert(!DEPLOY_FILES.includes(file), "development file should not deploy: " + file);
  });
  assert(DEPLOY_FILES.includes("index.html"), "expected index in deploy allowlist");
  assert(DEPLOY_FILES.includes("service-worker.js"), "expected service worker in deploy allowlist");
});
