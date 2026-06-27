// Coordinates display-mode browser APIs: fullscreen, minimal mode, and wake lock.
(function initDisplayMode(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroDisplayMode = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeDisplayMode() {
  function create(deps) {
    const dom = deps.dom;
    const wakeLock = deps.wakeLock;
    const doc = deps.documentRef || document;
    const onFullscreenUnavailable = deps.onFullscreenUnavailable || function noop() {};

    function applyFullscreen(enabled) {
      const root = doc.documentElement;
      const activeFullscreen = doc.fullscreenElement || null;

      if (!enabled && activeFullscreen) {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(function ignoreFullscreenExitError() {});
        }
        return;
      }

      if (enabled && !activeFullscreen && root && root.requestFullscreen) {
        root.requestFullscreen().catch(function handleFullscreenEnterError() {
          onFullscreenUnavailable();
        });
      }
    }

    function applyWakeLock(enabled) {
      if (!wakeLock || typeof wakeLock.setEnabled !== "function") return;
      wakeLock.setEnabled(enabled);
    }

    function enableWakeLockField() {
      dom.fields.wake_lock_enabled.checked = true;
      applyWakeLock(true);
    }

    function applyMinimalMode(enabled, settings) {
      if (enabled) {
        doc.documentElement.setAttribute("data-minimal-mode", "true");
        enableWakeLockField();
        applyFullscreen(true);
      } else {
        doc.documentElement.removeAttribute("data-minimal-mode");
        applyFullscreen(Boolean(settings && settings.fullscreen_enabled));
      }
    }

    return {
      applyFullscreen,
      applyWakeLock,
      applyMinimalMode,
      enableWakeLockField,
    };
  }

  return {
    create,
  };
});
