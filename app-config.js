(function initAppConfig(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroAppConfig = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeAppConfig() {
  return {
    name: "Cognitive Interval Timer",
    shortName: "CogTimer",
    description: "A phase-based focus timer for deep work, recall, and real breaks.",
    cachePrefix: "cognitive-interval-timer-",
    documentTitleSeparator: " - ",
    manifestId: "/cognitive-interval-timer/",
    manifestStartUrl: "/cognitive-interval-timer/",
    manifestScope: "/cognitive-interval-timer/",
    manifestOrientation: "any",
  };
});
