(function initStorage(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroStorage = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeStorage() {
  function createAdapter() {
    const memoryStore = new Map();
    let mode = "local";

    function getText(key, fallback) {
      if (mode === "memory") {
        return memoryStore.has(key) ? memoryStore.get(key) : fallback;
      }
      try {
        const value = localStorage.getItem(key);
        return value == null ? fallback : value;
      } catch {
        mode = "memory";
        return memoryStore.has(key) ? memoryStore.get(key) : fallback;
      }
    }

    function setText(key, value) {
      const nextValue = String(value);
      memoryStore.set(key, nextValue);
      if (mode === "memory") return false;
      try {
        localStorage.setItem(key, nextValue);
        return true;
      } catch {
        mode = "memory";
        return false;
      }
    }

    function getJSON(key, fallback) {
      const raw = getText(key, null);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    }

    function setJSON(key, value) {
      return setText(key, JSON.stringify(value));
    }

    return {
      getText,
      setText,
      getJSON,
      setJSON,
      mode: function currentMode() {
        return mode;
      },
    };
  }

  function createSessionLock(env) {
    const scope = env || {};
    const nav = scope.navigator || (typeof navigator !== "undefined" ? navigator : null);
    const locks = nav && nav.locks;
    const lockName = scope.name || "cognitive-interval-timer-session";
    let held = false;
    let pending = null;
    let releaseHeldLock = null;

    function isSupported() {
      return Boolean(locks && typeof locks.request === "function");
    }

    function hasLock() {
      return held || !isSupported();
    }

    function acquire() {
      if (hasLock()) return Promise.resolve(true);
      if (pending) return pending;

      let resolveAcquisition;
      pending = new Promise(function captureAcquisition(resolve) {
        resolveAcquisition = resolve;
      });
      Promise.resolve()
        .then(function requestSessionLock() {
          return locks.request(lockName, { ifAvailable: true }, function holdSessionLock(lock) {
            pending = null;
            if (!lock) {
              resolveAcquisition(false);
              return false;
            }

            held = true;
            resolveAcquisition(true);
            return new Promise(function waitForRelease(release) {
              releaseHeldLock = release;
            });
          });
        })
        .catch(function acquisitionFailed() {
          pending = null;
          resolveAcquisition(false);
        });
      return pending;
    }

    function release() {
      if (!held || !releaseHeldLock) return false;
      held = false;
      const release = releaseHeldLock;
      releaseHeldLock = null;
      release();
      return true;
    }

    return {
      acquire,
      release,
      hasLock,
      isSupported,
    };
  }

  return {
    createAdapter,
    createSessionLock,
  };
});
