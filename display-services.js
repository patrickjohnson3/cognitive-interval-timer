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
    let requestId = 0;

    function setEnabled(enabled) {
      const currentRequestId = ++requestId;
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

      if (!enabled) {
        return Promise.resolve(false);
      }
      if (activeFullscreen) {
        return Promise.resolve(true);
      }

      if (root && root.requestFullscreen) {
        return Promise.resolve(root.requestFullscreen())
          .then(function fullscreenEntered() {
            if (currentRequestId !== requestId && doc.fullscreenElement && doc.exitFullscreen) {
              return Promise.resolve(doc.exitFullscreen()).then(function exitStaleFullscreen() {
                return false;
              });
            }
            return true;
          })
          .catch(function handleFullscreenEnterError() {
            if (currentRequestId === requestId) {
              onUnavailable();
            }
            return false;
          });
      }

      onUnavailable();
      return Promise.resolve(false);
    }

    return {
      setEnabled,
    };
  }

  return {
    createFullscreenService,
  };
});
