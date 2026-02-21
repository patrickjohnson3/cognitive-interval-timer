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
        sessionFlags: {
          changedAutoStart: false,
          changedSound: false,
        },
      },
    };

    let lastSavedStats = null;

    const controller = {
      initialize,
      start: timer.start,
      pause: timer.pause,
      skip: timer.skip,
      reset: timer.reset,
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
      applyStaticCopy();
      a11y.applyAriaDefaults(document);
      render.setTagline(randomFrom(Content.SITE_TAGLINES));
      render.hydrateSettingsForm(appState.settings);
      render.hydrateTheme(appState.theme);

      controls.bindControls({
        onStart: controller.start,
        onPause: controller.pause,
        onSkip: controller.skip,
        onReset: controller.reset,
        onSaveSettings: controller.saveSettings,
        onRestoreDefaults: restoreDefaults,
        onThemeChange: controller.setTheme,
        onShortcut: handleShortcut,
        onSettingsInput: onSettingsInput,
        onFullscreenToggle: onFullscreenToggle,
        onMinimalModeToggle: onMinimalModeToggle,
        onExitMinimalMode: onExitMinimalMode,
      });

      applyMinimalMode(appState.settings.minimal_mode_enabled);
      timer.startTicker();
      onStateChange();
    }

    function randomFrom(values) {
      if (!Array.isArray(values) || values.length === 0) return "";
      return values[Math.floor(Math.random() * values.length)];
    }

    function applyStaticCopy() {
      dom.copy.phaseSettingsHeading.textContent = Content.UI_COPY.phaseSettingsHeading;
      dom.copy.blocks.textContent = Content.UI_COPY.blocksBeforeLongBreak;
      dom.copy.primeEnabled.textContent = Content.UI_COPY.startWithPrep;
      dom.copy.autoStart.textContent = Content.UI_COPY.autoStartNext;
      dom.copy.soundEnabled.textContent = Content.UI_COPY.soundOnPhaseChange;
      dom.copy.fullscreenEnabled.textContent = Content.UI_COPY.fullscreenMode;
      dom.copy.minimalModeEnabled.textContent = Content.UI_COPY.minimalMode;

      Core.PHASES.forEach(function eachPhase(phase) {
        if (!dom.copy.phaseLabels[phase]) return;
        const contentPhaseConfig = Content.PHASE_CONFIG && Content.PHASE_CONFIG[phase];
        dom.copy.phaseLabels[phase].textContent =
          (contentPhaseConfig && contentPhaseConfig.settingsLabel) || Core.stateLabel(phase);
      });
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
      lastSavedStats = cloneStats(appState.stats);

      const storedTheme = storage.getText(Core.STORAGE_KEYS.theme, "dark");
      appState.theme = storedTheme === "light" ? "light" : "dark";

      appState.timer.phase = Core.initialPhase(appState.settings);
      appState.timer.remainingSec = Core.phaseDurationSec(appState.timer.phase, appState.settings);
    }

    function onSettingsInput(rawSettings) {
      const normalized = Core.normalizeSettings(rawSettings);
      appState.ui.settingsDirty = !sameSettings(normalized, appState.settings);
      onStateChange();
    }

    function onFullscreenToggle(enabled) {
      applyFullscreenSetting(enabled);
    }

    function onMinimalModeToggle(enabled) {
      applyMinimalMode(enabled);
    }

    function onExitMinimalMode() {
      if (!document.documentElement.hasAttribute("data-minimal-mode")) return;
      dom.fields.minimal_mode_enabled.checked = false;
      applyMinimalMode(false);
      onSettingsInput(controls.readSettingsForm());
    }

    function sameSettings(a, b) {
      return (
        a.prime === b.prime &&
        a.focus === b.focus &&
        a.recall === b.recall &&
        a.break === b.break &&
        a.long_break === b.long_break &&
        a.blocks_per_ultradian === b.blocks_per_ultradian &&
        a.prime_enabled === b.prime_enabled &&
        a.auto_start === b.auto_start &&
        a.sound_enabled === b.sound_enabled &&
        a.fullscreen_enabled === b.fullscreen_enabled &&
        a.minimal_mode_enabled === b.minimal_mode_enabled
      );
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
      storage.setJSON(Core.STORAGE_KEYS.settings, appState.settings);

      if (!appState.timer.running) {
        const nextPhaseDuration = Core.phaseDurationSec(appState.timer.phase, appState.settings);
        appState.timer.remainingSec = Math.max(0, nextPhaseDuration - elapsedInPhase);
      }

      appState.ui.settingsDirty = false;
      render.hydrateSettingsForm(appState.settings);
      applyFullscreenSetting(appState.settings.fullscreen_enabled);
      applyMinimalMode(appState.settings.minimal_mode_enabled);
      announce.flashMessage(a11y.formatAnnouncement("settings_saved"));

      if (!appState.settings.prime_enabled && appState.timer.phase === Core.PHASE.PREP) {
        timer.resetToPhase(Core.PHASE.FOCUS);
        return;
      }

      onStateChange();
    }

    function restoreDefaults() {
      appState.settings = Core.normalizeSettings(Core.DEFAULT_SETTINGS);
      storage.setJSON(Core.STORAGE_KEYS.settings, appState.settings);

      appState.ui.settingsDirty = false;
      appState.ui.sessionFlags.changedAutoStart = false;
      appState.ui.sessionFlags.changedSound = false;

      render.hydrateSettingsForm(appState.settings);
      applyFullscreenSetting(appState.settings.fullscreen_enabled);
      applyMinimalMode(appState.settings.minimal_mode_enabled);
      timer.reset();
      announce.flashMessage(a11y.formatAnnouncement("defaults_restored"));
    }

    function setTheme(nextTheme) {
      appState.theme = nextTheme === "dark" ? "dark" : "light";
      storage.setText(Core.STORAGE_KEYS.theme, appState.theme);
      render.hydrateTheme(appState.theme);
      onStateChange();
    }

    function applyFullscreenSetting(enabled) {
      const root = document.documentElement;
      const activeFullscreen = document.fullscreenElement || null;

      if (!enabled && activeFullscreen) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(function ignoreFullscreenExitError() {});
        }
        return;
      }

      if (enabled && !activeFullscreen) {
        if (root.requestFullscreen) {
          root.requestFullscreen().catch(function ignoreFullscreenEnterError() {});
        }
      }
    }

    function applyMinimalMode(enabled) {
      if (enabled) {
        document.documentElement.setAttribute("data-minimal-mode", "true");
        applyFullscreenSetting(true);
      } else {
        document.documentElement.removeAttribute("data-minimal-mode");
        applyFullscreenSetting(appState.settings.fullscreen_enabled);
      }
    }

    function handleShortcut(action) {
      if (action === "toggle") {
        if (appState.timer.running) timer.pause();
        else timer.start();
        return;
      }
      if (action === "skip") timer.skip();
      if (action === "reset") timer.reset();
    }

    function onPhaseChange(payload) {
      if (appState.settings.sound_enabled) {
        audio.playPhaseChime();
      }
      announce.announce(a11y.formatAnnouncement("phase_started", { label: payload.label }));
    }

    function onStateChange() {
      appState.stats = Core.rolloverStats(appState.stats, Core.dateKey());
      persistStatsIfChanged();
      render.render(appState);
    }

    function sameStats(a, b) {
      if (!a || !b) return false;
      return (
        a.dateKey === b.dateKey &&
        a.focusBlocksToday === b.focusBlocksToday &&
        a.focusBlocksSinceLong === b.focusBlocksSinceLong
      );
    }

    function cloneStats(stats) {
      return {
        dateKey: stats.dateKey,
        focusBlocksToday: stats.focusBlocksToday,
        focusBlocksSinceLong: stats.focusBlocksSinceLong,
      };
    }

    function persistStatsIfChanged() {
      if (sameStats(lastSavedStats, appState.stats)) return;
      storage.setJSON(Core.STORAGE_KEYS.stats, appState.stats);
      lastSavedStats = cloneStats(appState.stats);
    }
  }

  return {
    create,
  };
});
