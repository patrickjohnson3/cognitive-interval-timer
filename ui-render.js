(function initUIRender(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroUIRender = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeUIRender() {
  function create(deps) {
    const dom = deps.dom;
    const Core = deps.Core;
    const Content = deps.Content || {};
    const storage = deps.storage;
    const uiCopy = Content.UI_COPY || {};
    const labels = uiCopy.labels || {};
    const statusLabels = uiCopy.statusLabels || {};

    function setTagline(text) {
      dom.tagline.textContent = text;
    }

    function hydrateTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      dom.theme.value = theme;
    }

    function hydrateSettingsForm(settings) {
      dom.fields.prime.value = settings.prime;
      dom.fields.focus.value = settings.focus;
      dom.fields.recall.value = settings.recall;
      dom.fields.break.value = settings.break;
      dom.fields.long_break.value = settings.long_break;
      dom.fields.blocks_per_ultradian.value = settings.blocks_per_ultradian;
      dom.fields.prime_enabled.checked = settings.prime_enabled;
      dom.fields.auto_start.checked = settings.auto_start;
      dom.fields.sound_enabled.checked = settings.sound_enabled;
      dom.fields.fullscreen_enabled.checked = settings.fullscreen_enabled;
    }

    function buildViewModel(state) {
      const statusKey = state.timer.running
        ? Core.STATUS.RUNNING
        : state.timer.hasStartedOnce
          ? Core.STATUS.PAUSED
          : Core.STATUS.IDLE;

      const storageSuffix = storage.mode() === "memory" ? (labels.storageVolatileSuffix || " (Volatile Storage)") : "";
      const statusLabel =
        statusLabels[statusKey] ||
        (statusKey ? statusKey.charAt(0).toUpperCase() + statusKey.slice(1) : "");
      const changed = [];
      if (state.ui.sessionFlags.changedAutoStart) changed.push(labels.autoStart || "Auto-Start");
      if (state.ui.sessionFlags.changedSound) changed.push(labels.sound || "Sound");

      return {
        stateText: Core.stateLabel(state.timer.phase),
        timeText: Core.formatTime(state.timer.remainingSec),
        hintText: Core.STATE_HINTS[state.timer.phase] || "",
        longHintText: Core.STATE_LONG_HINTS[state.timer.phase] || "",
        todayText: (labels.focusBlocksTodayPrefix || "Focus Blocks Today: ") + state.stats.focusBlocksToday,
        sinceLongText:
          (labels.sinceLongBreakPrefix || "Since Long Break: ") +
          state.stats.focusBlocksSinceLong +
          "/" +
          state.settings.blocks_per_ultradian,
        statusText: (labels.statusPrefix || "Status: ") + statusLabel + storageSuffix,
        cycleText: (labels.cyclePrefix || "Cycle ") + state.stats.focusBlocksToday,
        dirtyText: state.ui.settingsDirty
          ? labels.unsavedChanges || "Unsaved Changes"
          : labels.allSettingsSaved || "All Settings Saved",
        sessionChangesText:
          changed.length > 0
            ? (labels.sessionChangesPrefix || "Session Changes: ") + changed.join(", ")
            : (labels.sessionChangesPrefix || "Session Changes: ") + (labels.sessionChangesNone || "None"),
        titleText:
          Core.formatTime(state.timer.remainingSec) +
          (labels.documentTitleSeparator || " - ") +
          Core.stateLabel(state.timer.phase),
      };
    }

    function render(state) {
      const vm = buildViewModel(state);
      dom.state.textContent = vm.stateText;
      dom.time.textContent = vm.timeText;
      dom.hint.textContent = vm.hintText;
      dom.longHint.textContent = vm.longHintText;
      dom.today.textContent = vm.todayText;
      dom.long.textContent = vm.sinceLongText;
      dom.status.textContent = vm.statusText;
      dom.cycleBadge.textContent = vm.cycleText;
      dom.dirtyIndicator.textContent = vm.dirtyText;
      dom.sessionNote.textContent = vm.sessionChangesText;
      document.title = vm.titleText;
    }

    return {
      buildViewModel,
      setTagline,
      hydrateTheme,
      hydrateSettingsForm,
      render,
    };
  }

  return {
    create,
  };
});
