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
    const onWakeLockUnavailable = deps.onWakeLockUnavailable || function noop() {};

    function applyFullscreen(enabled) {
      const root = doc.documentElement;
      const activeFullscreen = doc.fullscreenElement || null;

      if (!enabled && activeFullscreen) {
        if (doc.exitFullscreen) {
          return Promise.resolve(doc.exitFullscreen())
            .then(function fullscreenExited() {
              return false;
            })
            .catch(function fullscreenExitFailed() {
              return Boolean(doc.fullscreenElement);
            });
        }
        return Promise.resolve(Boolean(doc.fullscreenElement));
      }

      if (!enabled) return Promise.resolve(false);
      if (activeFullscreen) return Promise.resolve(true);

      if (enabled && !activeFullscreen && root && root.requestFullscreen) {
        return Promise.resolve(root.requestFullscreen())
          .then(function fullscreenEntered() {
            return true;
          })
          .catch(function handleFullscreenEnterError() {
            onFullscreenUnavailable();
            return false;
          });
      }

      if (enabled) onFullscreenUnavailable();
      return Promise.resolve(false);
    }

    function applyWakeLock(enabled) {
      if (!wakeLock || typeof wakeLock.setEnabled !== "function") {
        if (enabled) onWakeLockUnavailable();
        return Promise.resolve(false);
      }
      return Promise.resolve(wakeLock.setEnabled(enabled)).then(
        function handleWakeLockResult(result) {
          if (enabled && result === false) onWakeLockUnavailable();
          return result;
        }
      );
    }

    function enableWakeLockField() {
      dom.fields.wake_lock_enabled.checked = true;
      return applyWakeLock(true);
    }

    function applyMinimalMode(enabled, settings) {
      if (enabled) {
        doc.documentElement.setAttribute("data-minimal-mode", "true");
        enableWakeLockField();
        return applyFullscreen(true);
      } else {
        doc.documentElement.removeAttribute("data-minimal-mode");
        return applyFullscreen(Boolean(settings && settings.fullscreen_enabled));
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
