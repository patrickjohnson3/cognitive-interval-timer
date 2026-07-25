// Builds derived UI text from app state so rendering stays focused on DOM updates.
(function initViewModel(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroViewModel = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeViewModel() {
  function create(deps) {
    const Core = deps.Core;
    const Content = deps.Content || {};
    const uiCopy = Content.UI_COPY || {};
    const labels = uiCopy.labels || {};

    function build(state) {
      const statusKey = state.timer.running
        ? Core.STATUS.RUNNING
        : state.timer.hasStartedOnce
          ? Core.STATUS.PAUSED
          : Core.STATUS.IDLE;

      const primaryActionLabels = labels.primaryActionLabels || {};
      const primaryActionAriaLabels = labels.primaryActionAriaLabels || {};
      const changed = [];
      if (state.ui.sessionFlags.changedAutoStart) changed.push(labels.autoStart || "Auto-Start");
      if (state.ui.sessionFlags.changedSound) changed.push(labels.sound || "Sound");

      return {
        stateText: Core.stateLabel(state.timer.phase),
        timeText: Core.formatTime(state.timer.remainingSec),
        hintText: Core.STATE_HINTS[state.timer.phase] || "",
        longHintText: Core.STATE_LONG_HINTS[state.timer.phase] || "",
        todayText:
          (labels.focusBlocksTodayPrefix || "today: ") +
          state.stats.focusBlocksToday +
          (labels.focusBlocksTodaySuffix || " focus blocks"),
        sinceLongText:
          (labels.sinceLongBreakPrefix || "long break: ") +
          state.stats.focusBlocksSinceLong +
          " / " +
          state.settings.blocks_per_ultradian,
        focusBlockText: state.timer.hasStartedOnce
          ? (labels.focusBlockPrefix || "Focus Block ") + (state.stats.focusBlocksToday + 1)
          : labels.focusBlockReady || "Focus Block\nReady",
        focusBlockAriaLabel: state.timer.hasStartedOnce
          ? (labels.focusBlockPrefix || "Focus Block ") + (state.stats.focusBlocksToday + 1)
          : (labels.focusBlockReady || "Focus Block Ready").replace(/\s+/g, " "),
        dirtyText: state.ui.settingsDirty
          ? labels.unsavedChanges || "Unsaved Changes"
          : labels.allSettingsSaved || "All Settings Saved",
        sessionChangesText:
          changed.length > 0
            ? (labels.sessionChangesPrefix || "Session Changes: ") + changed.join(", ")
            : (labels.sessionChangesPrefix || "Session Changes: ") +
              (labels.sessionChangesNone || "None"),
        primaryButtonText:
          primaryActionLabels[statusKey] ||
          (statusKey === Core.STATUS.RUNNING
            ? "⏸ Pause"
            : statusKey === Core.STATUS.PAUSED
              ? "▶ Resume"
              : "▶ Start"),
        primaryButtonAriaLabel:
          primaryActionAriaLabels[statusKey] ||
          (statusKey === Core.STATUS.RUNNING
            ? "Pause timer"
            : statusKey === Core.STATUS.PAUSED
              ? "Resume timer"
              : "Start timer"),
        titleText: state.timer.hasStartedOnce
          ? Core.formatTime(state.timer.remainingSec) +
            (labels.documentTitleSeparator || " - ") +
            Core.stateLabel(state.timer.phase) +
            " | " +
            (labels.documentTitleBase || "Cognitive Interval Timer")
          : labels.documentTitleBase || "Cognitive Interval Timer",
      };
    }

    return {
      build,
    };
  }

  return {
    create,
  };
});
