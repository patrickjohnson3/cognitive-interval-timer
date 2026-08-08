(function initWakeLock(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroWakeLock = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeWakeLock() {
  function createController(env) {
    const scope = env || {};
    const nav = scope.navigator || (typeof navigator !== "undefined" ? navigator : null);
    const doc = scope.document || (typeof document !== "undefined" ? document : null);
    let wakeLock = null;
    let wanted = false;
    let requestId = 0;

    function isSupported() {
      return Boolean(nav && nav.wakeLock && typeof nav.wakeLock.request === "function");
    }

    function rememberRelease(lock) {
      if (!lock || typeof lock.addEventListener !== "function") return;
      lock.addEventListener("release", function onRelease() {
        if (wakeLock === lock) wakeLock = null;
      });
    }

    function requestLock() {
      if (!wanted || !isSupported()) return Promise.resolve(false);
      if (doc && doc.visibilityState === "hidden") return Promise.resolve(false);
      if (wakeLock) return Promise.resolve(true);

      const currentRequestId = ++requestId;

      return nav.wakeLock
        .request("screen")
        .then(function onLock(lock) {
          if (!wanted || currentRequestId !== requestId) {
            if (!lock || typeof lock.release !== "function") return false;
            return Promise.resolve(lock.release())
              .catch(function ignoreStaleReleaseError() {})
              .then(function staleLockReleased() {
                return false;
              });
          }
          wakeLock = lock;
          rememberRelease(lock);
          return true;
        })
        .catch(function ignoreWakeLockError() {
          wakeLock = null;
          return false;
        });
    }

    function releaseLock() {
      requestId += 1;
      const lock = wakeLock;
      wakeLock = null;
      if (!lock || typeof lock.release !== "function") return Promise.resolve(false);

      return Promise.resolve(lock.release())
        .then(function onRelease() {
          return true;
        })
        .catch(function ignoreWakeLockReleaseError() {
          return false;
        });
    }

    function setEnabled(enabled) {
      wanted = Boolean(enabled);
      if (!wanted) return releaseLock();
      return requestLock();
    }

    function handleVisibilityChange() {
      if (!wanted || !doc || doc.visibilityState !== "visible") return;
      requestLock();
    }

    if (doc && typeof doc.addEventListener === "function") {
      doc.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return {
      isSupported,
      setEnabled,
      requestLock,
      releaseLock,
    };
  }

  return {
    createController,
  };
});
