(function initDisplayServices(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroDisplayServices = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeDisplayServices() {
  function createFullscreenService(deps) {
    const doc = deps.documentRef || document;
    const onUnavailable = deps.onUnavailable || function noop() {};
    let active = false;
    let requestId = 0;

    function setEnabled(enabled) {
      const currentRequestId = ++requestId;
      const root = doc.documentElement;
      const activeFullscreen = doc.fullscreenElement || null;

      if (!enabled && activeFullscreen) {
        if (doc.exitFullscreen) {
          return Promise.resolve(doc.exitFullscreen())
            .then(function fullscreenExited() {
              if (currentRequestId === requestId) active = false;
              return false;
            })
            .catch(function fullscreenExitFailed() {
              if (currentRequestId === requestId) active = Boolean(doc.fullscreenElement);
              return active;
            });
        }
        active = Boolean(doc.fullscreenElement);
        return Promise.resolve(active);
      }

      if (!enabled) {
        active = false;
        return Promise.resolve(false);
      }
      if (activeFullscreen) {
        active = true;
        return Promise.resolve(true);
      }

      if (root && root.requestFullscreen) {
        return Promise.resolve(root.requestFullscreen())
          .then(function fullscreenEntered() {
            if (currentRequestId === requestId) active = true;
            return true;
          })
          .catch(function handleFullscreenEnterError() {
            if (currentRequestId === requestId) {
              active = false;
              onUnavailable();
            }
            return false;
          });
      }

      active = false;
      onUnavailable();
      return Promise.resolve(false);
    }

    return {
      setEnabled,
      isActive: function isActive() {
        return active;
      },
    };
  }

  function createWakeLockService(deps) {
    const wakeLock = deps.wakeLock;
    const onUnavailable = deps.onUnavailable || function noop() {};
    let active = false;
    let requestId = 0;

    function setEnabled(enabled) {
      const currentRequestId = ++requestId;
      if (!wakeLock || typeof wakeLock.setEnabled !== "function") {
        active = false;
        if (enabled) onUnavailable();
        return Promise.resolve(false);
      }
      return Promise.resolve(wakeLock.setEnabled(enabled)).then(
        function handleWakeLockResult(result) {
          if (currentRequestId === requestId) {
            active = enabled && result !== false;
            if (enabled && result === false) onUnavailable();
          }
          return result;
        }
      );
    }

    return {
      setEnabled,
      isActive: function isActive() {
        return active;
      },
    };
  }

  return {
    createFullscreenService,
    createWakeLockService,
  };
});
