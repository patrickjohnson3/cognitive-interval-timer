(function initDisplayServices(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroDisplayServices = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeDisplayServices() {
  function callAsPromise(operation) {
    try {
      return Promise.resolve(operation());
    } catch (error) {
      return Promise.reject(error);
    }
  }

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
          return callAsPromise(function requestFullscreenExit() {
            return doc.exitFullscreen();
          })
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
        pendingEnable = callAsPromise(function requestFullscreenEntry() {
          return root.requestFullscreen();
        })
          .then(function fullscreenEntered() {
            if (!desiredEnabled && doc.fullscreenElement && doc.exitFullscreen) {
              return callAsPromise(function requestStaleFullscreenExit() {
                return doc.exitFullscreen();
              }).then(function exitStaleFullscreen() {
                return false;
              });
            }
            return true;
          })
          .catch(function handleFullscreenEnterError() {
            if (desiredEnabled) onUnavailable();
            return Boolean(doc.fullscreenElement);
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
    const onWakeLockFailure = deps.onWakeLockFailure || function noop() {};
    const fullscreen = createFullscreenService({
      documentRef: doc,
      onUnavailable: deps.onFullscreenUnavailable,
    });
    let minimalModeActive = false;
    let minimalModeHistoryActive = false;
    let minimalModeHistoryToken = null;
    let nextMinimalModeHistoryToken = 1;
    const pendingHistoryExitTokens = new Set();
    let minimalPreferences = null;
    let wakeLockBeforeMinimalMode = null;
    let wakeLockRequestId = 0;

    function bind() {
      if (!win || typeof win.addEventListener !== "function") return;
      win.addEventListener("popstate", function onPopState(event) {
        const poppedToken = event && event.state && event.state.minimalModeToken;
        if (
          minimalModeActive &&
          poppedToken &&
          pendingHistoryExitTokens.has(poppedToken) &&
          poppedToken !== minimalModeHistoryToken
        ) {
          pendingHistoryExitTokens.delete(poppedToken);
          if (typeof win.history.replaceState === "function") {
            win.history.replaceState(
              { appState: "minimal-mode", minimalModeToken: minimalModeHistoryToken },
              ""
            );
          }
          return;
        }
        if (!minimalModeActive) {
          minimalModeHistoryActive = false;
          minimalModeHistoryToken = null;
          pendingHistoryExitTokens.clear();
          return;
        }

        minimalModeHistoryActive = false;
        minimalModeHistoryToken = null;
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

      return callAsPromise(function requestWakeLockState() {
        return wakeLock.setEnabled(enabled);
      })
        .then(function reconcileWakeLock(result) {
          const unsupported =
            typeof wakeLock.isSupported === "function" && wakeLock.isSupported() === false;
          if (currentRequestId === wakeLockRequestId && enabled && result === false) {
            if (unsupported) onWakeLockUnavailable();
            else onWakeLockFailure();
          }
          return result;
        })
        .catch(function containWakeLockFailure() {
          if (currentRequestId === wakeLockRequestId && enabled) onWakeLockFailure();
          return false;
        });
    }

    function setMinimalMode(enabled, preferences, options) {
      const config = Object.assign(
        {
          updateHistory: true,
          restoreFullscreen: true,
          wakeLockBeforeMinimal: null,
          reuseHistoryEntry: false,
        },
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
        if (config.updateHistory) enterMinimalModeHistory(config.reuseHistoryEntry);
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

    function enterMinimalModeHistory(reuseHistoryEntry) {
      if (minimalModeHistoryActive || !canUseHistory()) return;
      try {
        minimalModeHistoryToken = nextMinimalModeHistoryToken;
        nextMinimalModeHistoryToken += 1;
        const state = { appState: "minimal-mode", minimalModeToken: minimalModeHistoryToken };
        if (reuseHistoryEntry && typeof win.history.replaceState === "function") {
          win.history.replaceState(state, "");
        } else {
          win.history.pushState(state, "");
        }
        minimalModeHistoryActive = true;
      } catch {
        minimalModeHistoryActive = false;
        minimalModeHistoryToken = null;
      }
    }

    function exitMinimalModeHistory() {
      if (!minimalModeHistoryActive || !canUseHistory()) {
        minimalModeHistoryActive = false;
        minimalModeHistoryToken = null;
        return;
      }
      const exitingToken = minimalModeHistoryToken;
      minimalModeHistoryActive = false;
      minimalModeHistoryToken = null;
      pendingHistoryExitTokens.add(exitingToken);
      try {
        win.history.back();
      } catch {
        pendingHistoryExitTokens.delete(exitingToken);
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
