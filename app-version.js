(function initAppVersion(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroAppVersion = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeAppVersion() {
  return {
    version: "1.1.0",
    build: "local",
    commit: "local",
    builtAt: "local",
    label: "1.1.0-local",
  };
});
