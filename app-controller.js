(function initAppController(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroAppController = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeAppController() {
  function create(deps) {
    const Core = deps.Core;
    const Content = deps.Content;
    const announce = deps.announce;
    const render = deps.render;
    const controls = deps.controls;
    const timer = deps.timer;
    const storage = deps.storage;
    const audio = deps.audio;
    const haptics = deps.haptics || {
      tap: function noopTap() {},
      phaseChange: function noopPhaseChange() {},
    };
    const wakeLock = deps.wakeLock;
    const DisplayMode = deps.DisplayMode;
    const Persistence = deps.Persistence;
    const SettingsEffects = deps.SettingsEffects;
    const TimerActions = deps.TimerActions;
    const a11y = deps.a11y;
    const dom = deps.dom;

    const appState = {
      settings: Core.normalizeSettings(null),
      stats: Core.normalizeStats(null),
      theme: "dark",
      timer: {
        running: false,
        phase: Core.PHASE.FOCUS,
        remainingSec: 0,
        lastTickMs: null,
        hasStartedOnce: false,
      },
      ui: {
        settingsDirty: false,
        storageWarning: false,
        sessionFlags: {
          changedAutoStart: false,
          changedSound: false,
        },
      },
    };

    let settingsEffects = null;
    const displayMode = DisplayMode.create({
      dom: dom,
      wakeLock: wakeLock,
      documentRef: document,
      onFullscreenUnavailable: function onFullscreenUnavailable() {
        if (settingsEffects) settingsEffects.reconcileFullscreenUnavailable();
      },
      onWakeLockUnavailable: function onWakeLockUnavailable() {
        if (settingsEffects) settingsEffects.reconcileWakeLockUnavailable();
      },
    });
    const persistence = Persistence.create({ Core, storage, state: appState });
    const timerActions = TimerActions.create({
      state: appState,
      timer,
      haptics,
      audio,
      announce,
      a11y,
    });

    settingsEffects = SettingsEffects.create({
      Core,
      Content,
      controls,
      displayMode,
      documentRef: document,
      dom,
      persistence,
      render,
      state: appState,
      timer,
      onStateChange,
    });

    const controller = {
      initialize,
      start: timerActions.start,
      pause: timerActions.pause,
      skip: timerActions.skip,
      reset: timerActions.reset,
      setTheme,
      saveSettings,
    };

    return {
      controller,
      state: appState,
      onPhaseChange: timerActions.onPhaseChange,
      onStateChange,
      handleShortcut: timerActions.handleShortcut,
      onSettingsInput: settingsEffects.onSettingsInput,
      restoreDefaults,
    };

    function initialize() {
      hydrateFromStorage();
      persistence.syncStorageWarning();
      settingsEffects.applyStaticCopy();
      a11y.applyAriaDefaults(document);
      render.setTagline(randomFrom(Content.SITE_TAGLINES));
      render.hydrateSettingsForm(appState.settings);
      render.hydrateTheme(appState.theme);

      controls.bindControls({
        onStart: controller.start,
        onPause: controller.pause,
        onPrimaryAction: timerActions.onPrimaryAction,
        onSkip: controller.skip,
        onReset: controller.reset,
        onSaveSettings: controller.saveSettings,
        onRestoreDefaults: restoreDefaults,
        onThemeChange: controller.setTheme,
        onShortcut: timerActions.handleShortcut,
        onSettingsInput: settingsEffects.onSettingsInput,
        onFullscreenToggle: settingsEffects.onFullscreenToggle,
        onFullscreenChange: settingsEffects.onFullscreenChange,
        onMinimalModeToggle: settingsEffects.onMinimalModeToggle,
        onWakeLockToggle: settingsEffects.onWakeLockToggle,
        onExitMinimalMode: settingsEffects.onExitMinimalMode,
      });

      settingsEffects.applySettingsSideEffects({ hydrateForm: false });
      timer.startTicker();
      onStateChange();
    }

    function randomFrom(values) {
      if (!Array.isArray(values) || values.length === 0) return "";
      return values[Math.floor(Math.random() * values.length)];
    }

    function hydrateFromStorage() {
      const storedSettings = storage.getJSON(Core.STORAGE_KEYS.settings, Core.DEFAULT_SETTINGS);
      appState.settings = Core.normalizeSettings(storedSettings);

      const storedStats = storage.getJSON(Core.STORAGE_KEYS.stats, {
        dateKey: Core.dateKey(),
        focusBlocksToday: 0,
        focusBlocksSinceLong: 0,
      });
      appState.stats = Core.normalizeStats(storedStats, Core.dateKey());
      persistence.initializeStatsSnapshot(appState.stats);

      const storedTheme = storage.getText(Core.STORAGE_KEYS.theme, "dark");
      appState.theme = storedTheme === "light" ? "light" : "dark";

      appState.timer.phase = Core.initialPhase(appState.settings);
      appState.timer.remainingSec = Core.phaseDurationSec(appState.timer.phase, appState.settings);
    }

    function saveSettings(rawSettings) {
      const previousSettings = appState.settings;
      const oldPhaseDuration = Core.phaseDurationSec(appState.timer.phase, previousSettings);
      const elapsedInPhase = Math.max(0, oldPhaseDuration - appState.timer.remainingSec);
      const next = Core.normalizeSettings(rawSettings);

      if (next.auto_start !== appState.settings.auto_start) {
        appState.ui.sessionFlags.changedAutoStart = true;
      }
      if (next.sound_enabled !== appState.settings.sound_enabled) {
        appState.ui.sessionFlags.changedSound = true;
      }

      appState.settings = next;
      persistence.persistSettings(appState.settings);

      if (!appState.timer.running) {
        const nextPhaseDuration = Core.phaseDurationSec(appState.timer.phase, appState.settings);
        appState.timer.remainingSec = Math.max(0, nextPhaseDuration - elapsedInPhase);
      }

      appState.ui.settingsDirty = false;
      const resetToFocus = settingsEffects.applySettingsSideEffects({ correctPrepPhase: true });
      announce.flashMessage(a11y.formatAnnouncement("settings_saved"));

      if (resetToFocus) return;

      onStateChange();
    }

    function restoreDefaults() {
      appState.settings = Core.normalizeSettings(Core.DEFAULT_SETTINGS);
      persistence.persistSettings(appState.settings);

      appState.ui.settingsDirty = false;
      appState.ui.sessionFlags.changedAutoStart = false;
      appState.ui.sessionFlags.changedSound = false;

      settingsEffects.applySettingsSideEffects();
      timer.reset();
      announce.flashMessage(a11y.formatAnnouncement("defaults_restored"));
    }

    function setTheme(nextTheme) {
      appState.theme = nextTheme === "dark" ? "dark" : "light";
      persistence.persistTheme(appState.theme);
      render.hydrateTheme(appState.theme);
      onStateChange();
    }

    function onStateChange() {
      appState.stats = Core.rolloverStats(appState.stats, Core.dateKey());
      persistence.persistStatsIfChanged();
      render.render(appState);
    }
  }

  return {
    create,
  };
});
