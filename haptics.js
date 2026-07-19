(function initHaptics(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroHaptics = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeHaptics() {
  const PATTERNS = {
    tap: 12,
    phase: [18, 30, 18],
  };

  function createController(deps) {
    const nav = (deps && deps.navigatorRef) || (typeof navigator !== "undefined" ? navigator : null);

    function vibrate(pattern) {
      if (!nav || typeof nav.vibrate !== "function") return false;
      return Boolean(nav.vibrate(pattern));
    }

    function tap() {
      return vibrate(PATTERNS.tap);
    }

    function phaseChange() {
      return vibrate(PATTERNS.phase);
    }

    return {
      tap,
      phaseChange,
    };
  }

  return {
    createController,
    PATTERNS,
  };
});
