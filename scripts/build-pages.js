const { preparePagesArtifact } = require("./prepare-pages-artifact.js");

try {
  const outputDir = preparePagesArtifact(process.argv[2] || "_site");
  console.log("Built Pages artifact at " + outputDir);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
