(function initAppController(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./display-services.js"));
  } else {
    root.PomodoroAppController = factory(root.PomodoroDisplayServices);
  }
})(typeof self !== "undefined" ? self : this, function makeAppController(DisplayServices) {
  function create(deps) {
    const Core = deps.Core;
    const Content = deps.Content;
    const announce = deps.announce;
    const render = deps.render;
    const controls = deps.controls;
    const storage = deps.storage;
    const sessionLock = deps.sessionLock || {
      acquire: function acquire() {
        return Promise.resolve(true);
      },
      release: function release() {},
      hasLock: function hasLock() {
        return true;
      },
    };
    const audio = deps.audio;
    const haptics = deps.haptics || {
      tap: function noopTap() {},
      phaseChange: function noopPhaseChange() {},
    };
    const wakeLock = deps.wakeLock;
    const a11y = deps.a11y;
    const doc = deps.documentRef || document;

    const appState = {
      settings: Core.normalizeSettings(null),
      draftSettings: Core.normalizeSettings(null),
      stats: Core.normalizeStats(null),
      theme: "dark",
      timer: {
        status: Core.STATUS.IDLE,
        phase: Core.PHASE.FOCUS,
        focusBlockNumber: 0,
        remainingSec: 0,
        lastTickMs: null,
      },
      ui: {
        settingsDirty: false,
        storageWarning: false,
        storageCorruption: false,
        sessionConflict: false,
      },
    };

    let lastSavedSession = null;
    let sessionNeedsMigration = false;
    let sessionActionPending = null;
    const displayModes = DisplayServices.createDisplayModeService({
      documentRef: doc,
      windowRef: deps.windowRef,
      wakeLock: wakeLock,
      onMinimalModeChange: renderMinimalModeState,
      onMinimalModeExited: reconcileMinimalModeExited,
      onFullscreenExited: reconcileFullscreenExited,
      onFullscreenUnavailable: reconcileFullscreenUnavailable,
      onWakeLockUnavailable: reconcileWakeLockUnavailable,
    });
    const timer =
      deps.timer ||
      deps.TimerEngine.create({
        state: appState,
        Core: Core,
        hooks: {
          onPhaseChange,
          onStateChange,
        },
      });

    const controller = {
      initialize,
      start,
      pause,
      skip,
      reset,
      setTheme,
      saveSettings,
    };

    return {
      controller,
      state: appState,
      onPhaseChange,
      onStateChange,
      handleShortcut,
      onSettingsInput,
      restoreDefaults,
    };

    function initialize() {
      hydrateFromStorage();
      syncStorageWarning();
      render.hydrateStaticContent();
      a11y.applyAriaDefaults(doc);
      render.setTagline(randomFrom(Content.SITE_TAGLINES));
      render.hydrateSettingsForm(appState.settings);
      render.hydrateTheme(appState.theme);
      render.setDisplayActivationAvailable(savedDisplayModeNeedsActivation());

      controls.bindControls({
        onPrimaryAction,
        onSkip: controller.skip,
        onReset: controller.reset,
        onSaveSettings: controller.saveSettings,
        onRestoreDefaults: restoreDefaults,
        onThemeChange: controller.setTheme,
        onShortcut: handleShortcut,
        onSettingsInput,
        onFullscreenToggle,
        onFullscreenChange,
        onMinimalModeToggle,
        onWakeLockToggle,
        onActivateDisplayModes,
        onExitMinimalMode,
      });

      displayModes.bind();
      bindTimerVisibility();
      applySettingsSideEffects({ hydrateForm: false, activateDisplayModes: false });
      timer.startTicker();
      onStateChange();
      if (appState.timer.status !== Core.STATUS.IDLE) {
        ensureSessionAccess(function noop() {});
      } else if (sessionNeedsMigration) {
        ensureSessionAccess(function persistMigratedIdleSession() {
          onStateChange();
          sessionLock.release();
        });
      }
    }

    function randomFrom(values) {
      if (!Array.isArray(values) || values.length === 0) return "";
      return values[Math.floor(Math.random() * values.length)];
    }

    function hydrateFromStorage() {
      const storedSession = storage.getJSON(Core.STORAGE_KEYS.session, null);
      const hasSession =
        storedSession &&
        storedSession.version === 1 &&
        storedSession.settings &&
        storedSession.stats &&
        storedSession.timer;
      sessionNeedsMigration = !hasSession;

      const storedSettings = hasSession
        ? storedSession.settings
        : storage.getJSON(Core.STORAGE_KEYS.settings, Core.DEFAULT_SETTINGS);
      appState.settings = Core.normalizeSettings(storedSettings);
      appState.draftSettings = Object.assign({}, appState.settings);

      const storedStats = hasSession
        ? storedSession.stats
        : storage.getJSON(Core.STORAGE_KEYS.stats, {
            dateKey: Core.dateKey(),
            focusBlocksToday: 0,
            focusBlocksSinceLong: 0,
          });
      appState.stats = Core.normalizeStats(storedStats, Core.dateKey());

      const storedTheme = storage.getText(Core.STORAGE_KEYS.theme, "dark");
      appState.theme = storedTheme === "light" ? "light" : "dark";

      const storedTimer = hasSession
        ? storedSession.timer
        : storage.getJSON(Core.STORAGE_KEYS.timer, null);
      appState.timer = Core.normalizeTimerState(storedTimer, appState.settings);
      lastSavedSession = sessionSnapshot();
      appState.ui.storageCorruption =
        typeof storage.hadReadError === "function" && storage.hadReadError();
    }

    function cloneStats(stats) {
      return {
        dateKey: stats.dateKey,
        focusBlocksToday: stats.focusBlocksToday,
        focusBlocksSinceLong: stats.focusBlocksSinceLong,
      };
    }

    function timerSnapshot(timerState) {
      return {
        status: timerState.status,
        phase: timerState.phase,
        focusBlockNumber: timerState.focusBlockNumber,
        remainingSec: timerState.remainingSec,
      };
    }

    function sessionSnapshot() {
      return {
        version: 1,
        settings: Object.assign({}, appState.settings),
        stats: cloneStats(appState.stats),
        timer: timerSnapshot(appState.timer),
      };
    }

    function sameSession(a, b) {
      return Boolean(a && b && JSON.stringify(a) === JSON.stringify(b));
    }

    function storageIsMemoryOnly() {
      return typeof storage.mode === "function" && storage.mode() === "memory";
    }

    function syncStorageWarning(writeResult) {
      appState.ui.storageWarning = writeResult === false || storageIsMemoryOnly();
    }

    function persistTheme(theme) {
      syncStorageWarning(storage.setText(Core.STORAGE_KEYS.theme, theme));
    }

    function persistSessionIfChanged() {
      if (!sessionLock.hasLock()) return;
      const snapshot = sessionSnapshot();
      if (!sessionNeedsMigration && sameSession(lastSavedSession, snapshot)) return;
      syncStorageWarning(storage.setJSON(Core.STORAGE_KEYS.session, snapshot));
      lastSavedSession = snapshot;
      sessionNeedsMigration = false;
    }

    function quietModeIsEnabled() {
      return appState.settings.quiet_mode_enabled;
    }

    function tapFeedback() {
      if (quietModeIsEnabled()) return;
      safelyRunFeedback(haptics.tap);
    }

    function safelyRunFeedback(feedback) {
      try {
        return feedback();
      } catch {
        return false;
      }
    }

    function start() {
      return ensureSessionAccess(function startTimer() {
        tapFeedback();
        timer.start();
      });
    }

    function pause() {
      return ensureSessionAccess(function pauseTimer() {
        tapFeedback();
        timer.pause();
      });
    }

    function skip() {
      return ensureSessionAccess(function skipTimer() {
        tapFeedback();
        timer.skip();
      });
    }

    function reset() {
      return ensureSessionAccess(function resetTimer() {
        tapFeedback();
        timer.reset();
        sessionLock.release();
      });
    }

    function ensureSessionAccess(action) {
      if (sessionLock.hasLock()) {
        appState.ui.sessionConflict = false;
        action();
        return Promise.resolve(true);
      }
      if (sessionActionPending) return sessionActionPending;

      sessionActionPending = sessionLock
        .acquire()
        .then(function sessionAccessResolved(acquired) {
          sessionActionPending = null;
          appState.ui.sessionConflict = !acquired;
          syncTimerSuspension();
          if (!acquired) {
            render.render(appState);
            return false;
          }
          action();
          if (sessionNeedsMigration) onStateChange();
          return true;
        })
        .catch(function sessionAccessFailed() {
          sessionActionPending = null;
          appState.ui.sessionConflict = true;
          syncTimerSuspension();
          render.render(appState);
          return false;
        });
      return sessionActionPending;
    }

    function onPrimaryAction() {
      if (appState.timer.status === Core.STATUS.RUNNING) {
        pause();
        return;
      }
      start();
    }

    function handleShortcut(action) {
      if (action === "toggle") {
        onPrimaryAction();
        return;
      }
      if (action === "skip") skip();
      if (action === "reset") reset();
    }

    function onPhaseChange(payload) {
      if (!quietModeIsEnabled()) {
        safelyRunFeedback(haptics.phaseChange);
      }
      if (!quietModeIsEnabled() && appState.settings.sound_enabled) {
        safelyRunFeedback(audio.playPhaseChime);
      }
      showPhaseTransition(payload);
      announce.announce(
        a11y.formatAnnouncement("phase_started", { label: phaseLabel(payload.to) })
      );
    }

    function showPhaseTransition(payload) {
      if (!payload || !payload.from || !announce.showTransition) return;
      const from = phaseLabel(payload.from);
      const to = phaseLabel(payload.to);
      announce.showTransition(from + " complete. " + to + " starts now.");
    }

    function phaseLabel(phase) {
      const config = Content.PHASE_CONFIG && Content.PHASE_CONFIG[phase];
      return (config && config.displayName) || String(phase || "");
    }

    function sameSettings(a, b) {
      return Core.SETTING_FIELDS.every(function settingsMatch(descriptor) {
        return a[descriptor.key] === b[descriptor.key];
      });
    }

    function onSettingsInput(rawSettings) {
      const normalized = Core.normalizeSettings(rawSettings);
      appState.draftSettings = normalized;
      appState.ui.settingsDirty =
        !rawNumericSettingsAreValid(rawSettings, normalized) ||
        !sameSettings(normalized, appState.settings);
      onStateChange();
    }

    function rawNumericSettingsAreValid(rawSettings, normalized) {
      return Core.SETTING_FIELDS.every(function rawSettingIsValid(descriptor) {
        if (descriptor.type !== "number") return true;
        const rawValue = rawSettings[descriptor.key];
        if (typeof rawValue === "string" && rawValue.trim() === "") return false;
        const numberValue = Number(rawValue);
        return Number.isInteger(numberValue) && numberValue === normalized[descriptor.key];
      });
    }

    function applySettingsSideEffects(options) {
      const config = Object.assign(
        { hydrateForm: true, correctInitialPhase: false, activateDisplayModes: true },
        options || {}
      );
      if (config.hydrateForm) {
        render.hydrateSettingsForm(appState.settings);
        appState.draftSettings = Object.assign({}, appState.settings);
      }
      if (!config.activateDisplayModes) {
        displayModes.setWakeLock(appState.settings.wake_lock_enabled);
      } else if (appState.settings.minimal_mode_enabled) {
        displayModes.setMinimalMode(true, appState.settings);
      } else if (displayModes.isMinimalModeActive()) {
        displayModes.setMinimalMode(false, appState.settings);
      } else {
        displayModes.setWakeLock(appState.settings.wake_lock_enabled);
        displayModes.setFullscreen(appState.settings.fullscreen_enabled);
      }

      const initialPhase = Core.initialPhase(appState.settings);
      if (
        config.correctInitialPhase &&
        appState.timer.status === Core.STATUS.IDLE &&
        appState.timer.phase !== initialPhase
      ) {
        timer.resetToPhase(initialPhase);
        return true;
      }
      return false;
    }

    function onFullscreenToggle(enabled) {
      if (enabled) {
        render.setSettingField("wake_lock_enabled", true);
        updateDraftFromForm();
        displayModes.setWakeLock(true);
      }
      return displayModes.setFullscreen(enabled);
    }

    function onFullscreenChange(isFullscreen) {
      displayModes.handleFullscreenChange(isFullscreen);
    }

    function onMinimalModeToggle(enabled) {
      let wakeLockBeforeMinimal = null;
      if (enabled) {
        wakeLockBeforeMinimal = controls.readSettingsForm().wake_lock_enabled;
        render.setSettingField("wake_lock_enabled", true);
        updateDraftFromForm();
      }
      const result = displayModes.setMinimalMode(enabled, appState.draftSettings, {
        wakeLockBeforeMinimal: wakeLockBeforeMinimal,
      });
      if (enabled) controls.focusMinimalModeReveal();
      return result;
    }

    function onWakeLockToggle(enabled) {
      return displayModes.setWakeLock(enabled);
    }

    function savedDisplayModeNeedsActivation() {
      return Boolean(
        appState.settings.fullscreen_enabled ||
        appState.settings.minimal_mode_enabled ||
        appState.settings.wake_lock_enabled
      );
    }

    function onActivateDisplayModes() {
      render.setDisplayActivationAvailable(false);
      if (appState.settings.minimal_mode_enabled) {
        onMinimalModeToggle(true);
      } else if (appState.settings.fullscreen_enabled) {
        onFullscreenToggle(true);
      } else {
        onWakeLockToggle(appState.settings.wake_lock_enabled);
      }
      onSettingsInput(controls.readSettingsForm());
    }

    function onExitMinimalMode(options) {
      if (!displayModes.isMinimalModeActive()) return;
      render.setSettingField("minimal_mode_enabled", false);
      displayModes.setMinimalMode(false, appState.draftSettings, options);
      updateDraftFromForm();
      onStateChange();
      controls.focusPrimaryAction();
    }

    function renderMinimalModeState(active, restoredWakeLock) {
      render.setMinimalModeActive(active);
      if (!active) render.setSettingField("wake_lock_enabled", restoredWakeLock);
    }

    function reconcileMinimalModeExited() {
      render.setSettingField("minimal_mode_enabled", false);
      updateDraftFromForm();
      onStateChange();
      controls.focusPrimaryAction();
    }

    function reconcileFullscreenExited() {
      const settings = controls.readSettingsForm();
      if (!settings.fullscreen_enabled) return;
      render.setSettingField("fullscreen_enabled", false);
      onSettingsInput(controls.readSettingsForm());
    }

    function reconcileFullscreenUnavailable() {
      render.setSettingField("fullscreen_enabled", false);

      if (appState.settings.fullscreen_enabled) {
        appState.settings = Core.normalizeSettings(
          Object.assign({}, appState.settings, { fullscreen_enabled: false })
        );
      }

      updateDraftFromForm();
      onStateChange();
    }

    function reconcileWakeLockUnavailable() {
      render.setSettingField("wake_lock_enabled", false);

      if (appState.settings.wake_lock_enabled) {
        appState.settings = Core.normalizeSettings(
          Object.assign({}, appState.settings, {
            wake_lock_enabled: false,
          })
        );
      }

      updateDraftFromForm();
      onStateChange();
    }

    function bindTimerVisibility() {
      if (!doc || typeof doc.addEventListener !== "function" || !timer.setSuspended) return;
      function syncTimerVisibility() {
        const activeSessionWithoutLock =
          appState.timer.status !== Core.STATUS.IDLE && !sessionLock.hasLock();
        timer.setSuspended(doc.visibilityState === "hidden" || activeSessionWithoutLock);
      }
      doc.addEventListener("visibilitychange", syncTimerVisibility);
      syncTimerVisibility();
    }

    function syncTimerSuspension() {
      const hidden = doc && doc.visibilityState === "hidden";
      const activeSessionWithoutLock =
        appState.timer.status !== Core.STATUS.IDLE && !sessionLock.hasLock();
      timer.setSuspended(hidden || activeSessionWithoutLock);
    }

    function saveSettings(rawSettings) {
      return ensureSessionAccess(function saveSessionSettings() {
        saveSettingsWithAccess(rawSettings);
      });
    }

    function saveSettingsWithAccess(rawSettings) {
      const previousSettings = appState.settings;
      const oldPhaseDuration = Core.phaseDurationSec(appState.timer.phase, previousSettings);
      const elapsedInPhase = Math.max(0, oldPhaseDuration - appState.timer.remainingSec);
      const next = Core.normalizeSettings(rawSettings);
      appState.draftSettings = Object.assign({}, next);

      appState.settings = next;

      if (appState.timer.status !== Core.STATUS.RUNNING) {
        const nextPhaseDuration = Core.phaseDurationSec(appState.timer.phase, appState.settings);
        appState.timer.remainingSec = Math.max(0, nextPhaseDuration - elapsedInPhase);
      }

      appState.ui.settingsDirty = false;
      const resetToInitialPhase = applySettingsSideEffects({ correctInitialPhase: true });
      announce.flashMessage(a11y.formatAnnouncement("settings_saved"));

      if (resetToInitialPhase) return;

      onStateChange();
    }

    function restoreDefaults() {
      return ensureSessionAccess(function restoreSessionDefaults() {
        appState.settings = Core.normalizeSettings(Core.DEFAULT_SETTINGS);
        appState.draftSettings = Object.assign({}, appState.settings);

        appState.ui.settingsDirty = false;

        applySettingsSideEffects();
        timer.reset();
        sessionLock.release();
        announce.flashMessage(a11y.formatAnnouncement("defaults_restored"));
      });
    }

    function setTheme(nextTheme) {
      appState.theme = nextTheme === "dark" ? "dark" : "light";
      persistTheme(appState.theme);
      render.hydrateTheme(appState.theme);
      onStateChange();
    }

    function onStateChange() {
      appState.stats = Core.rolloverStats(appState.stats, Core.dateKey());
      persistSessionIfChanged();
      render.render(appState);
    }

    function updateDraftFromForm() {
      appState.draftSettings = Core.normalizeSettings(controls.readSettingsForm());
      appState.ui.settingsDirty = !sameSettings(appState.draftSettings, appState.settings);
    }
  }

  return {
    create,
  };
});
