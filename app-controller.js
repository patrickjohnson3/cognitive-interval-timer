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
    const a11y = deps.a11y;
    const dom = deps.dom;
    const displayMode = DisplayMode.create({
      dom: dom,
      wakeLock: wakeLock,
      documentRef: document,
      onFullscreenUnavailable: reconcileFullscreenUnavailable,
      onWakeLockUnavailable: reconcileWakeLockUnavailable,
    });

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

    let lastSavedStats = null;

    const controller = {
      initialize,
      start: startTimer,
      pause: pauseTimer,
      skip: skipPhase,
      reset: resetBlock,
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
      a11y.applyAriaDefaults(document);
      render.setTagline(randomFrom(Content.SITE_TAGLINES));
      render.hydrateSettingsForm(appState.settings);
      render.hydrateTheme(appState.theme);

      controls.bindControls({
        onStart: controller.start,
        onPause: controller.pause,
        onPrimaryAction: onPrimaryAction,
        onSkip: controller.skip,
        onReset: controller.reset,
        onSaveSettings: controller.saveSettings,
        onRestoreDefaults: restoreDefaults,
        onThemeChange: controller.setTheme,
        onShortcut: handleShortcut,
        onSettingsInput: onSettingsInput,
        onFullscreenToggle: onFullscreenToggle,
        onFullscreenChange: onFullscreenChange,
        onMinimalModeToggle: onMinimalModeToggle,
        onWakeLockToggle: onWakeLockToggle,
        onExitMinimalMode: onExitMinimalMode,
      });

      applySettingsSideEffects({ hydrateForm: false });
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
      dom.copy.prepEnabled.textContent = Content.UI_COPY.startWithPrep;
      dom.copy.autoStart.textContent = Content.UI_COPY.autoStartNext;
      dom.copy.soundEnabled.textContent = Content.UI_COPY.soundOnPhaseChange;
      dom.copy.fullscreenEnabled.textContent = Content.UI_COPY.fullscreenMode;
      dom.copy.minimalModeEnabled.textContent = Content.UI_COPY.minimalMode;
      dom.copy.wakeLockEnabled.textContent = Content.UI_COPY.keepScreenAwake;
      applyTooltipCopy();

      Core.PHASES.forEach(function eachPhase(phase) {
        if (!dom.copy.phaseLabels[phase]) return;
        const contentPhaseConfig = Content.PHASE_CONFIG && Content.PHASE_CONFIG[phase];
        dom.copy.phaseLabels[phase].textContent =
          (contentPhaseConfig && contentPhaseConfig.settingsLabel) || Core.stateLabel(phase);
      });
    }

    function applyTooltipCopy() {
      if (!document.querySelectorAll) return;
      const tooltips = Content.UI_COPY.tooltips || {};
      const wrappers = document.querySelectorAll("[data-tooltip-key]");
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
      if (enabled) {
        enableWakeLockField();
      }
      return applyFullscreenSetting(enabled);
    }

    function onPrimaryAction() {
      if (appState.timer.running) {
        controller.pause();
        return;
      }
      controller.start();
    }

    function onFullscreenChange(isFullscreen) {
      if (isFullscreen || !dom.fields.fullscreen_enabled.checked) return;
      dom.fields.fullscreen_enabled.checked = false;
      onSettingsInput(controls.readSettingsForm());
    }

    function onMinimalModeToggle(enabled) {
      return applyMinimalMode(enabled);
    }

    function onWakeLockToggle(enabled) {
      applyWakeLockSetting(enabled);
    }

    function onExitMinimalMode() {
      if (!document.documentElement.hasAttribute("data-minimal-mode")) return;
      dom.fields.minimal_mode_enabled.checked = false;
      applyMinimalMode(false);
      onSettingsInput(controls.readSettingsForm());
    }

    function sameSettings(a, b) {
      return (
        a.prep === b.prep &&
        a.focus === b.focus &&
        a.recall === b.recall &&
        a.break === b.break &&
        a.long_break === b.long_break &&
        a.blocks_per_ultradian === b.blocks_per_ultradian &&
        a.prep_enabled === b.prep_enabled &&
        a.auto_start === b.auto_start &&
        a.sound_enabled === b.sound_enabled &&
        a.fullscreen_enabled === b.fullscreen_enabled &&
        a.minimal_mode_enabled === b.minimal_mode_enabled &&
        a.wake_lock_enabled === b.wake_lock_enabled
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
      syncStorageWarning(storage.setJSON(Core.STORAGE_KEYS.settings, appState.settings));

      if (!appState.timer.running) {
        const nextPhaseDuration = Core.phaseDurationSec(appState.timer.phase, appState.settings);
        appState.timer.remainingSec = Math.max(0, nextPhaseDuration - elapsedInPhase);
      }

      appState.ui.settingsDirty = false;
      const resetToFocus = applySettingsSideEffects({ correctPrepPhase: true });
      announce.flashMessage(a11y.formatAnnouncement("settings_saved"));

      if (resetToFocus) return;

      onStateChange();
    }

    function restoreDefaults() {
      appState.settings = Core.normalizeSettings(Core.DEFAULT_SETTINGS);
      syncStorageWarning(storage.setJSON(Core.STORAGE_KEYS.settings, appState.settings));

      appState.ui.settingsDirty = false;
      appState.ui.sessionFlags.changedAutoStart = false;
      appState.ui.sessionFlags.changedSound = false;

      applySettingsSideEffects();
      timer.reset();
      announce.flashMessage(a11y.formatAnnouncement("defaults_restored"));
    }

    function applySettingsSideEffects(options) {
      const config = Object.assign({ hydrateForm: true, correctPrepPhase: false }, options || {});
      if (config.hydrateForm) {
        render.hydrateSettingsForm(appState.settings);
      }
      applyWakeLockSetting(appState.settings.wake_lock_enabled);
      applyMinimalMode(appState.settings.minimal_mode_enabled);

      if (
        config.correctPrepPhase &&
        !appState.settings.prep_enabled &&
        appState.timer.phase === Core.PHASE.PREP
      ) {
        timer.resetToPhase(Core.PHASE.FOCUS);
        return true;
      }
      return false;
    }

    function setTheme(nextTheme) {
      appState.theme = nextTheme === "dark" ? "dark" : "light";
      syncStorageWarning(storage.setText(Core.STORAGE_KEYS.theme, appState.theme));
      render.hydrateTheme(appState.theme);
      onStateChange();
    }

    function applyFullscreenSetting(enabled) {
      return displayMode.applyFullscreen(enabled);
    }

    function reconcileFullscreenUnavailable() {
      if (dom.fields.fullscreen_enabled.checked) {
        dom.fields.fullscreen_enabled.checked = false;
      }

      if (appState.settings.fullscreen_enabled) {
        appState.settings = Core.normalizeSettings(
          Object.assign({}, appState.settings, { fullscreen_enabled: false })
        );
        syncStorageWarning(storage.setJSON(Core.STORAGE_KEYS.settings, appState.settings));
        render.hydrateSettingsForm(appState.settings);
      }

      onSettingsInput(controls.readSettingsForm());
    }

    function reconcileWakeLockUnavailable() {
      if (dom.fields.wake_lock_enabled.checked) {
        dom.fields.wake_lock_enabled.checked = false;
      }

      if (appState.settings.wake_lock_enabled) {
        appState.settings = Core.normalizeSettings(
          Object.assign({}, appState.settings, { wake_lock_enabled: false })
        );
        syncStorageWarning(storage.setJSON(Core.STORAGE_KEYS.settings, appState.settings));
        render.hydrateSettingsForm(appState.settings);
      }

      onSettingsInput(controls.readSettingsForm());
    }

    function applyWakeLockSetting(enabled) {
      return displayMode.applyWakeLock(enabled);
    }

    function enableWakeLockField() {
      displayMode.enableWakeLockField();
    }

    function applyMinimalMode(enabled) {
      return displayMode.applyMinimalMode(enabled, appState.settings);
    }

    function handleShortcut(action) {
      if (action === "toggle") {
        if (appState.timer.running) controller.pause();
        else controller.start();
        return;
      }
      if (action === "skip") controller.skip();
      if (action === "reset") controller.reset();
    }

    function onPhaseChange(payload) {
      haptics.phaseChange();
      if (appState.settings.sound_enabled) {
        audio.playPhaseChime();
      }
      announce.announce(a11y.formatAnnouncement("phase_started", { label: payload.label }));
    }

    function startTimer() {
      haptics.tap();
      timer.start();
    }

    function pauseTimer() {
      haptics.tap();
      timer.pause();
    }

    function skipPhase() {
      haptics.tap();
      timer.skip();
    }

    function resetBlock() {
      haptics.tap();
      timer.reset();
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
      syncStorageWarning(storage.setJSON(Core.STORAGE_KEYS.stats, appState.stats));
      lastSavedStats = cloneStats(appState.stats);
    }

    function storageIsMemoryOnly() {
      return typeof storage.mode === "function" && storage.mode() === "memory";
    }

    function syncStorageWarning(writeResult) {
      appState.ui.storageWarning = writeResult === false || storageIsMemoryOnly();
    }
  }

  return {
    create,
  };
});
