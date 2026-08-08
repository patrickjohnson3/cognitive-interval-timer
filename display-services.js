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
    let desiredEnabled = false;
    let pendingEnable = null;

    function setEnabled(enabled) {
      desiredEnabled = Boolean(enabled);
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
        if (pendingEnable) return pendingEnable;
        return Promise.resolve(false);
      }
      if (activeFullscreen) {
        return Promise.resolve(true);
      }
      if (pendingEnable) return pendingEnable;

      if (root && root.requestFullscreen) {
        pendingEnable = Promise.resolve(root.requestFullscreen())
          .then(function fullscreenEntered() {
            if (!desiredEnabled && doc.fullscreenElement && doc.exitFullscreen) {
              return Promise.resolve(doc.exitFullscreen()).then(function exitStaleFullscreen() {
                return false;
              });
            }
            return true;
          })
          .catch(function handleFullscreenEnterError() {
            if (desiredEnabled) onUnavailable();
            return false;
          })
          .finally(function clearPendingEnable() {
            pendingEnable = null;
          });
        return pendingEnable;
      }

      onUnavailable();
      return Promise.resolve(false);
    }

    return {
      setEnabled,
    };
  }

  function createDisplayModeService(deps) {
    const doc = deps.documentRef || document;
    const win = deps.windowRef || (typeof window !== "undefined" ? window : null);
    const wakeLock = deps.wakeLock;
    const onMinimalModeChange = deps.onMinimalModeChange;
    const onMinimalModeExited = deps.onMinimalModeExited;
    const onFullscreenExited = deps.onFullscreenExited;
    const onWakeLockUnavailable = deps.onWakeLockUnavailable;
    const fullscreen = createFullscreenService({
      documentRef: doc,
      onUnavailable: deps.onFullscreenUnavailable,
    });
    let minimalModeActive = false;
    let minimalModeHistoryActive = false;
    let minimalPreferences = null;
    let wakeLockBeforeMinimalMode = null;
    let wakeLockRequestId = 0;

    function bind() {
      if (!win || typeof win.addEventListener !== "function") return;
      win.addEventListener("popstate", function onPopState() {
        if (!minimalModeActive) {
          minimalModeHistoryActive = false;
          return;
        }

        minimalModeHistoryActive = false;
        exitMinimalMode({ updateHistory: false });
        onMinimalModeExited();
      });
    }

    function isMinimalModeActive() {
      return minimalModeActive;
    }

    function setFullscreen(enabled) {
      return fullscreen.setEnabled(enabled);
    }

    function setWakeLock(enabled) {
      const currentRequestId = ++wakeLockRequestId;
      if (!wakeLock || typeof wakeLock.setEnabled !== "function") {
        if (enabled) onWakeLockUnavailable();
        return Promise.resolve(false);
      }

      return Promise.resolve(wakeLock.setEnabled(enabled)).then(function reconcileWakeLock(result) {
        const unsupported =
          typeof wakeLock.isSupported === "function" && wakeLock.isSupported() === false;
        if (currentRequestId === wakeLockRequestId && enabled && result === false && unsupported) {
          onWakeLockUnavailable();
        }
        return result;
      });
    }

    function setMinimalMode(enabled, preferences, options) {
      const config = Object.assign(
        { updateHistory: true, restoreFullscreen: true, wakeLockBeforeMinimal: null },
        options || {}
      );
      if (enabled) {
        if (!minimalModeActive) {
          wakeLockBeforeMinimalMode =
            config.wakeLockBeforeMinimal === null
              ? Boolean(preferences.wake_lock_enabled)
              : Boolean(config.wakeLockBeforeMinimal);
        }
        minimalPreferences = preferences;
        minimalModeActive = true;
        onMinimalModeChange(true);
        if (config.updateHistory) enterMinimalModeHistory();
        setWakeLock(true);
        return setFullscreen(true);
      }

      minimalPreferences = preferences || minimalPreferences;
      return exitMinimalMode(config);
    }

    function exitMinimalMode(options) {
      const config = Object.assign({ updateHistory: true, restoreFullscreen: true }, options || {});
      const preferences = minimalPreferences || {
        fullscreen_enabled: false,
        wake_lock_enabled: false,
      };
      const restoreWakeLock =
        wakeLockBeforeMinimalMode === null
          ? Boolean(preferences.wake_lock_enabled)
          : wakeLockBeforeMinimalMode;
      minimalModeActive = false;
      onMinimalModeChange(false, restoreWakeLock);
      if (config.updateHistory) exitMinimalModeHistory();
      wakeLockBeforeMinimalMode = null;
      minimalPreferences = null;
      setWakeLock(restoreWakeLock);
      return setFullscreen(config.restoreFullscreen && preferences.fullscreen_enabled);
    }

    function handleFullscreenChange(isFullscreen) {
      if (isFullscreen) return;
      if (minimalModeActive) {
        onFullscreenExited();
        exitMinimalMode({ restoreFullscreen: false });
        onMinimalModeExited();
        return;
      }
      onFullscreenExited();
    }

    function canUseHistory() {
      return (
        win &&
        win.history &&
        typeof win.history.pushState === "function" &&
        typeof win.history.back === "function"
      );
    }

    function enterMinimalModeHistory() {
      if (minimalModeHistoryActive || !canUseHistory()) return;
      try {
        win.history.pushState({ appState: "minimal-mode" }, "");
        minimalModeHistoryActive = true;
      } catch {
        minimalModeHistoryActive = false;
      }
    }

    function exitMinimalModeHistory() {
      if (!minimalModeHistoryActive || !canUseHistory()) {
        minimalModeHistoryActive = false;
        return;
      }
      minimalModeHistoryActive = false;
      try {
        win.history.back();
      } catch {
        // The visible state has still exited minimal mode.
      }
    }

    return {
      bind,
      isMinimalModeActive,
      setFullscreen,
      setWakeLock,
      setMinimalMode,
      handleFullscreenChange,
    };
  }

  return {
    createFullscreenService,
    createDisplayModeService,
  };
});
