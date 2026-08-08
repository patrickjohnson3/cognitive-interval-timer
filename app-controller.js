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
    const audio = deps.audio;
    const haptics = deps.haptics || {
      tap: function noopTap() {},
      phaseChange: function noopPhaseChange() {},
    };
    const wakeLock = deps.wakeLock;
    const a11y = deps.a11y;
    const dom = deps.dom;
    const doc = deps.documentRef || document;
    const win = deps.windowRef || (typeof window !== "undefined" ? window : null);

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
      },
    };

    let lastSavedStats = null;
    let lastSavedTimer = null;
    let minimalModeHistoryActive = false;
    let wakeLockBeforeMinimalMode = null;
    let wakeLockRequestId = 0;
    const fullscreenService = DisplayServices.createFullscreenService({
      documentRef: doc,
      onUnavailable: reconcileFullscreenUnavailable,
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
      applyStaticCopy();
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

      bindMinimalModeHistory();
      bindTimerVisibility();
      applySettingsSideEffects({ hydrateForm: false, activateDisplayModes: false });
      timer.startTicker();
      onStateChange();
    }

    function randomFrom(values) {
      if (!Array.isArray(values) || values.length === 0) return "";
      return values[Math.floor(Math.random() * values.length)];
    }

    function hydrateFromStorage() {
      const storedSettings = storage.getJSON(Core.STORAGE_KEYS.settings, Core.DEFAULT_SETTINGS);
      appState.settings = normalizeAppSettings(storedSettings);
      appState.draftSettings = Object.assign({}, appState.settings);

      const storedStats = storage.getJSON(Core.STORAGE_KEYS.stats, {
        dateKey: Core.dateKey(),
        focusBlocksToday: 0,
        focusBlocksSinceLong: 0,
      });
      appState.stats = Core.normalizeStats(storedStats, Core.dateKey());
      lastSavedStats = cloneStats(appState.stats);

      const storedTheme = storage.getText(Core.STORAGE_KEYS.theme, "dark");
      appState.theme = storedTheme === "light" ? "light" : "dark";

      const storedTimer = storage.getJSON(Core.STORAGE_KEYS.timer, null);
      appState.timer = Core.normalizeTimerState(storedTimer, appState.settings);
      lastSavedTimer = timerSnapshot(appState.timer);
    }

    function cloneStats(stats) {
      return {
        dateKey: stats.dateKey,
        focusBlocksToday: stats.focusBlocksToday,
        focusBlocksSinceLong: stats.focusBlocksSinceLong,
      };
    }

    function sameStats(a, b) {
      if (!a || !b) return false;
      return (
        a.dateKey === b.dateKey &&
        a.focusBlocksToday === b.focusBlocksToday &&
        a.focusBlocksSinceLong === b.focusBlocksSinceLong
      );
    }

    function timerSnapshot(timerState) {
      return {
        status: timerState.status,
        phase: timerState.phase,
        focusBlockNumber: timerState.focusBlockNumber,
        remainingSec: timerState.remainingSec,
      };
    }

    function sameTimerSnapshot(a, b) {
      if (!a || !b) return false;
      return (
        a.status === b.status &&
        a.phase === b.phase &&
        a.focusBlockNumber === b.focusBlockNumber &&
        a.remainingSec === b.remainingSec
      );
    }

    function storageIsMemoryOnly() {
      return typeof storage.mode === "function" && storage.mode() === "memory";
    }

    function syncStorageWarning(writeResult) {
      appState.ui.storageWarning = writeResult === false || storageIsMemoryOnly();
    }

    function persistSettings(settings) {
      syncStorageWarning(storage.setJSON(Core.STORAGE_KEYS.settings, settings));
    }

    function persistTheme(theme) {
      syncStorageWarning(storage.setText(Core.STORAGE_KEYS.theme, theme));
    }

    function persistStatsIfChanged() {
      if (sameStats(lastSavedStats, appState.stats)) return;
      syncStorageWarning(storage.setJSON(Core.STORAGE_KEYS.stats, appState.stats));
      lastSavedStats = cloneStats(appState.stats);
    }

    function persistTimerIfChanged() {
      const snapshot = timerSnapshot(appState.timer);
      if (sameTimerSnapshot(lastSavedTimer, snapshot)) return;
      syncStorageWarning(storage.setJSON(Core.STORAGE_KEYS.timer, snapshot));
      lastSavedTimer = snapshot;
    }

    function normalizeAppSettings(rawSettings) {
      return Core.normalizeSettings(rawSettings);
    }

    function quietModeIsEnabled() {
      return appState.settings.quiet_mode_enabled;
    }

    function tapFeedback() {
      if (quietModeIsEnabled()) return;
      haptics.tap();
    }

    function start() {
      tapFeedback();
      timer.start();
    }

    function pause() {
      tapFeedback();
      timer.pause();
    }

    function skip() {
      tapFeedback();
      timer.skip();
    }

    function reset() {
      tapFeedback();
      timer.reset();
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
        haptics.phaseChange();
      }
      if (!quietModeIsEnabled() && appState.settings.sound_enabled) {
        audio.playPhaseChime();
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

    function applyStaticCopy() {
      dom.copy.phaseSettingsHeading.textContent = Content.UI_COPY.phaseSettingsHeading;
      dom.copy.blocks.textContent = Content.UI_COPY.blocksBeforeLongBreak;
      dom.copy.prepEnabled.textContent = Content.UI_COPY.startWithPrep;
      dom.copy.autoStart.textContent = Content.UI_COPY.autoStartNext;
      dom.copy.soundEnabled.textContent = Content.UI_COPY.soundOnPhaseChange;
      dom.copy.quietModeEnabled.textContent = Content.UI_COPY.quietMode;
      dom.copy.fullscreenEnabled.textContent = Content.UI_COPY.fullscreenMode;
      dom.copy.minimalModeEnabled.textContent = Content.UI_COPY.minimalMode;
      dom.copy.wakeLockEnabled.textContent = Content.UI_COPY.keepScreenAwake;
      applyTooltipCopy();

      Core.PHASES.forEach(function eachPhase(phase) {
        if (!dom.copy.phaseLabels[phase]) return;
        dom.copy.phaseLabels[phase].textContent = phaseLabel(phase);
      });
    }

    function applyTooltipCopy() {
      if (!doc.querySelectorAll) return;
      const tooltips = Content.UI_COPY.tooltips || {};
      const wrappers = doc.querySelectorAll("[data-tooltip-key]");
      wrappers.forEach(function eachTooltip(wrapper) {
        const copy = tooltips[wrapper.getAttribute("data-tooltip-key")];
        if (!copy) return;

        const trigger = wrapper.querySelector(".tip-trigger");
        const bubble = wrapper.querySelector(".tip-bubble");
        const heading = bubble && bubble.querySelector("strong");
        const body = bubble && bubble.querySelector("span");

        if (trigger) trigger.setAttribute("aria-label", copy.triggerLabel);
        if (heading) heading.textContent = copy.heading;
        if (body) body.textContent = copy.body;
      });
    }

    function sameSettings(a, b) {
      return Core.SETTING_FIELDS.every(function settingsMatch(descriptor) {
        return a[descriptor.key] === b[descriptor.key];
      });
    }

    function onSettingsInput(rawSettings) {
      const normalized = normalizeAppSettings(rawSettings);
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
        applyWakeLockSetting(appState.settings.wake_lock_enabled);
      } else if (appState.settings.minimal_mode_enabled) {
        applyMinimalModeSetting(true, appState.settings);
      } else {
        applyWakeLockSetting(appState.settings.wake_lock_enabled);
        applyMinimalModeSetting(false, appState.settings);
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
        dom.fields.wake_lock_enabled.checked = true;
        updateDraftFromForm();
        applyWakeLockSetting(true);
      }
      return applyFullscreenSetting(enabled);
    }

    function onFullscreenChange(isFullscreen) {
      if (isFullscreen) return;
      if (doc.documentElement.hasAttribute("data-minimal-mode")) {
        if (dom.fields.fullscreen_enabled.checked) {
          dom.fields.fullscreen_enabled.checked = false;
          updateDraftFromForm();
        }
        onExitMinimalMode({ restoreFullscreen: false });
        return;
      }
      if (!dom.fields.fullscreen_enabled.checked) return;
      dom.fields.fullscreen_enabled.checked = false;
      onSettingsInput(controls.readSettingsForm());
    }

    function onMinimalModeToggle(enabled) {
      if (enabled) {
        rememberWakeLockBeforeMinimalMode();
        dom.fields.wake_lock_enabled.checked = true;
        updateDraftFromForm();
      }
      return applyMinimalModeSetting(enabled);
    }

    function onWakeLockToggle(enabled) {
      return applyWakeLockSetting(enabled);
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
      if (!doc.documentElement.hasAttribute("data-minimal-mode")) return;
      dom.fields.minimal_mode_enabled.checked = false;
      updateDraftFromForm();
      applyMinimalModeSetting(false, null, options);
      onStateChange();
    }

    function reconcileFullscreenUnavailable() {
      if (dom.fields.fullscreen_enabled.checked) {
        dom.fields.fullscreen_enabled.checked = false;
      }

      if (appState.settings.fullscreen_enabled) {
        appState.settings = Core.normalizeSettings(
          Object.assign({}, appState.settings, { fullscreen_enabled: false })
        );
        persistSettings(appState.settings);
      }

      updateDraftFromForm();
      onStateChange();
    }

    function reconcileWakeLockUnavailable() {
      if (dom.fields.wake_lock_enabled.checked) {
        dom.fields.wake_lock_enabled.checked = false;
      }

      if (appState.settings.wake_lock_enabled) {
        appState.settings = Core.normalizeSettings(
          Object.assign({}, appState.settings, {
            wake_lock_enabled: false,
          })
        );
        persistSettings(appState.settings);
      }

      updateDraftFromForm();
      onStateChange();
    }

    function applyFullscreenSetting(enabled) {
      return fullscreenService.setEnabled(enabled);
    }

    function applyWakeLockSetting(enabled) {
      const currentRequestId = ++wakeLockRequestId;
      if (!wakeLock || typeof wakeLock.setEnabled !== "function") {
        if (enabled) reconcileWakeLockUnavailable();
        return Promise.resolve(false);
      }
      return Promise.resolve(wakeLock.setEnabled(enabled)).then(function reconcileWakeLock(result) {
        const unsupported =
          typeof wakeLock.isSupported === "function" && wakeLock.isSupported() === false;
        if (currentRequestId === wakeLockRequestId && enabled && result === false && unsupported) {
          reconcileWakeLockUnavailable();
        }
        return result;
      });
    }

    function bindMinimalModeHistory() {
      if (!win || typeof win.addEventListener !== "function") return;
      win.addEventListener("popstate", function onMinimalModePopState() {
        if (!doc.documentElement.hasAttribute("data-minimal-mode")) {
          minimalModeHistoryActive = false;
          return;
        }

        minimalModeHistoryActive = false;
        dom.fields.minimal_mode_enabled.checked = false;
        restoreWakeLockAfterMinimalMode();
        updateDraftFromForm();
        applyMinimalModeSetting(false, null, { updateHistory: false });
        onStateChange();
      });
    }

    function bindTimerVisibility() {
      if (!doc || typeof doc.addEventListener !== "function" || !timer.setSuspended) return;
      function syncTimerVisibility() {
        timer.setSuspended(doc.visibilityState === "hidden");
      }
      doc.addEventListener("visibilitychange", syncTimerVisibility);
      syncTimerVisibility();
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
        // If history cleanup fails, the visible app state has still exited minimal mode.
      }
    }

    function rememberWakeLockBeforeMinimalMode() {
      if (doc.documentElement.hasAttribute("data-minimal-mode")) return;
      wakeLockBeforeMinimalMode = Boolean(dom.fields.wake_lock_enabled.checked);
    }

    function restoreWakeLockAfterMinimalMode() {
      if (wakeLockBeforeMinimalMode === null) return;
      dom.fields.wake_lock_enabled.checked = wakeLockBeforeMinimalMode;
      updateDraftFromForm();
      applyWakeLockSetting(wakeLockBeforeMinimalMode);
      wakeLockBeforeMinimalMode = null;
    }

    function applyMinimalModeSetting(enabled, rawSettings, options) {
      const config = Object.assign({ updateHistory: true, restoreFullscreen: true }, options || {});
      const settings = normalizeAppSettings(rawSettings || appState.draftSettings);
      if (enabled) {
        doc.documentElement.setAttribute("data-minimal-mode", "true");
        if (config.updateHistory) enterMinimalModeHistory();
        applyWakeLockSetting(true);
        return applyFullscreenSetting(true);
      }

      doc.documentElement.removeAttribute("data-minimal-mode");
      if (config.updateHistory) exitMinimalModeHistory();
      restoreWakeLockAfterMinimalMode();
      return applyFullscreenSetting(config.restoreFullscreen && settings.fullscreen_enabled);
    }

    function saveSettings(rawSettings) {
      const previousSettings = appState.settings;
      const oldPhaseDuration = Core.phaseDurationSec(appState.timer.phase, previousSettings);
      const elapsedInPhase = Math.max(0, oldPhaseDuration - appState.timer.remainingSec);
      const next = normalizeAppSettings(rawSettings);
      appState.draftSettings = Object.assign({}, next);

      appState.settings = next;
      persistSettings(appState.settings);

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
      appState.settings = normalizeAppSettings(Core.DEFAULT_SETTINGS);
      appState.draftSettings = Object.assign({}, appState.settings);
      persistSettings(appState.settings);

      appState.ui.settingsDirty = false;

      applySettingsSideEffects();
      timer.reset();
      announce.flashMessage(a11y.formatAnnouncement("defaults_restored"));
    }

    function setTheme(nextTheme) {
      appState.theme = nextTheme === "dark" ? "dark" : "light";
      persistTheme(appState.theme);
      render.hydrateTheme(appState.theme);
      onStateChange();
    }

    function onStateChange() {
      appState.stats = Core.rolloverStats(appState.stats, Core.dateKey());
      persistStatsIfChanged();
      persistTimerIfChanged();
      render.render(appState);
    }

    function updateDraftFromForm() {
      appState.draftSettings = normalizeAppSettings(controls.readSettingsForm());
      appState.ui.settingsDirty = !sameSettings(appState.draftSettings, appState.settings);
    }
  }

  return {
    create,
  };
});
