(function initControllerSettingsEffects(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroControllerSettingsEffects = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeControllerSettingsEffects() {
  function create(deps) {
    const Core = deps.Core;
    const Content = deps.Content;
    const controls = deps.controls;
    const displayMode = deps.displayMode;
    const documentRef = deps.documentRef || document;
    const dom = deps.dom;
    const persistence = deps.persistence;
    const render = deps.render;
    const state = deps.state;
    const timer = deps.timer;
    const onStateChange = deps.onStateChange;

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
      if (!documentRef.querySelectorAll) return;
      const tooltips = Content.UI_COPY.tooltips || {};
      const wrappers = documentRef.querySelectorAll("[data-tooltip-key]");
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

    function onSettingsInput(rawSettings) {
      const normalized = Core.normalizeSettings(rawSettings);
      state.ui.settingsDirty = !sameSettings(normalized, state.settings);
      onStateChange();
    }

    function applySettingsSideEffects(options) {
      const config = Object.assign({ hydrateForm: true, correctPrepPhase: false }, options || {});
      if (config.hydrateForm) {
        render.hydrateSettingsForm(state.settings);
      }
      applyWakeLockSetting(state.settings.wake_lock_enabled);
      applyMinimalMode(state.settings.minimal_mode_enabled);

      if (
        config.correctPrepPhase &&
        !state.settings.prep_enabled &&
        state.timer.phase === Core.PHASE.PREP
      ) {
        timer.resetToPhase(Core.PHASE.FOCUS);
        return true;
      }
      return false;
    }

    function applyFullscreenSetting(enabled) {
      return displayMode.applyFullscreen(enabled);
    }

    function onFullscreenToggle(enabled) {
      if (enabled) {
        enableWakeLockField();
      }
      return applyFullscreenSetting(enabled);
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
      if (!documentRef.documentElement.hasAttribute("data-minimal-mode")) return;
      dom.fields.minimal_mode_enabled.checked = false;
      applyMinimalMode(false);
      onSettingsInput(controls.readSettingsForm());
    }

    function reconcileFullscreenUnavailable() {
      if (dom.fields.fullscreen_enabled.checked) {
        dom.fields.fullscreen_enabled.checked = false;
      }

      if (state.settings.fullscreen_enabled) {
        state.settings = Core.normalizeSettings(
          Object.assign({}, state.settings, { fullscreen_enabled: false })
        );
        persistence.persistSettings(state.settings);
        render.hydrateSettingsForm(state.settings);
      }

      onSettingsInput(controls.readSettingsForm());
    }

    function reconcileWakeLockUnavailable() {
      if (dom.fields.wake_lock_enabled.checked) {
        dom.fields.wake_lock_enabled.checked = false;
      }

      if (state.settings.wake_lock_enabled) {
        state.settings = Core.normalizeSettings(
          Object.assign({}, state.settings, { wake_lock_enabled: false })
        );
        persistence.persistSettings(state.settings);
        render.hydrateSettingsForm(state.settings);
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
      return displayMode.applyMinimalMode(enabled, state.settings);
    }

    return {
      applySettingsSideEffects,
      applyStaticCopy,
      onExitMinimalMode,
      onFullscreenChange,
      onFullscreenToggle,
      onMinimalModeToggle,
      onSettingsInput,
      onWakeLockToggle,
      reconcileFullscreenUnavailable,
      reconcileWakeLockUnavailable,
    };
  }

  return {
    create,
  };
});
