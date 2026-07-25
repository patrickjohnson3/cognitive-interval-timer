// Coordinates stateful display services for fullscreen, minimal mode, and wake lock.
(function initDisplayMode(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./display-services.js"));
  } else {
    root.PomodoroDisplayMode = factory(root.PomodoroDisplayServices);
  }
})(typeof self !== "undefined" ? self : this, function makeDisplayMode(DisplayServices) {
  function create(deps) {
    const dom = deps.dom;
    const wakeLock = deps.wakeLock;
    const doc = deps.documentRef || document;
    const onFullscreenUnavailable = deps.onFullscreenUnavailable || function noop() {};
    const onWakeLockUnavailable = deps.onWakeLockUnavailable || function noop() {};
    const fullscreenService = DisplayServices.createFullscreenService({
      documentRef: doc,
      onUnavailable: onFullscreenUnavailable,
    });
    const wakeLockService = DisplayServices.createWakeLockService({
      wakeLock: wakeLock,
      onUnavailable: onWakeLockUnavailable,
    });
    const minimalModeService = DisplayServices.createMinimalModeService({
      documentRef: doc,
      dom: dom,
      fullscreen: fullscreenService,
      wakeLock: wakeLockService,
    });

    function enableWakeLockField() {
      dom.fields.wake_lock_enabled.checked = true;
      return wakeLockService.setEnabled(true);
    }

    return {
      applyFullscreen: fullscreenService.setEnabled,
      applyWakeLock: wakeLockService.setEnabled,
      applyMinimalMode: minimalModeService.setEnabled,
      enableWakeLockField,
      state: {
        fullscreen: fullscreenService.isActive,
        minimalMode: minimalModeService.isActive,
        wakeLock: wakeLockService.isActive,
      },
    };
  }

  return {
    create,
  };
});
