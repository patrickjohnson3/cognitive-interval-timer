(function initWakeLock(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroWakeLock = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeWakeLock() {
  function callAsPromise(operation) {
    try {
      return Promise.resolve(operation());
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function createController(env) {
    const scope = env || {};
    const nav = scope.navigator || (typeof navigator !== "undefined" ? navigator : null);
    const doc = scope.document || (typeof document !== "undefined" ? document : null);
    const schedule = scope.setTimeout || setTimeout;
    const cancelSchedule = scope.clearTimeout || clearTimeout;
    const retryDelayMs = scope.retryDelayMs || 1000;
    let wakeLock = null;
    let wanted = false;
    let requestId = 0;
    let retryTimeoutId = null;
    let retryAfterRelease = true;

    function isSupported() {
      return Boolean(nav && nav.wakeLock && typeof nav.wakeLock.request === "function");
    }

    function rememberRelease(lock) {
      if (!lock || typeof lock.addEventListener !== "function") return;
      lock.addEventListener("release", function onRelease() {
        if (wakeLock !== lock) return;
        wakeLock = null;
        if (
          !wanted ||
          !retryAfterRelease ||
          (doc && doc.visibilityState !== "visible") ||
          retryTimeoutId
        ) {
          return;
        }
        retryTimeoutId = schedule(function retryReleasedWakeLock() {
          retryTimeoutId = null;
          requestLock({ retryAfterRelease: false });
        }, retryDelayMs);
      });
    }

    function requestLock(options) {
      const config = Object.assign({ retryAfterRelease: true }, options || {});
      if (!wanted || !isSupported()) return Promise.resolve(false);
      if (doc && doc.visibilityState === "hidden") return Promise.resolve(false);
      if (wakeLock) return Promise.resolve(true);

      const currentRequestId = ++requestId;

      return callAsPromise(function requestScreenWakeLock() {
        return nav.wakeLock.request("screen");
      })
        .then(function onLock(lock) {
          if (!wanted || currentRequestId !== requestId) {
            if (!lock || typeof lock.release !== "function") return false;
            return callAsPromise(function releaseStaleLock() {
              return lock.release();
            })
              .catch(function ignoreStaleReleaseError() {})
              .then(function staleLockReleased() {
                return false;
              });
          }
          wakeLock = lock;
          retryAfterRelease = config.retryAfterRelease;
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
      if (retryTimeoutId) {
        cancelSchedule(retryTimeoutId);
        retryTimeoutId = null;
      }
      const lock = wakeLock;
      wakeLock = null;
      if (!lock || typeof lock.release !== "function") return Promise.resolve(false);

      return callAsPromise(function releaseActiveLock() {
        return lock.release();
      })
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
      requestLock({ retryAfterRelease: true });
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
