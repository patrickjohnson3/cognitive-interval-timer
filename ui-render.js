(function initUIRender(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroUIRender = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeUIRender() {
  function create(deps) {
    const Core = deps.Core;
    const Content = deps.Content || {};
    const AppConfig = deps.AppConfig || {};
    const dom = deps.dom;
    const uiCopy = Content.UI_COPY || {};
    const labels = uiCopy.labels || {};
    const phaseConfig = Content.PHASE_CONFIG || {};
    const themeColors = AppConfig.themeColors || { dark: "#0f172a", light: "#f5f7f9" };

    function setTagline(text) {
      dom.tagline.textContent = text;
    }

    function hydrateTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      const themeColor = document.getElementById("theme-color-meta");
      if (themeColor) themeColor.setAttribute("content", themeColors[theme] || themeColors.dark);
      dom.theme.value = theme;
    }

    function hydrateSettingsForm(settings) {
      Core.SETTING_FIELDS.forEach(function hydrateSetting(descriptor) {
        const field = dom.fields[descriptor.key];
        if (descriptor.type === "boolean") field.checked = settings[descriptor.key];
        else field.value = settings[descriptor.key];
      });
    }

    function setDisplayActivationAvailable(available) {
      dom.controls.activateDisplayModes.hidden = !available;
    }

    function buildView(state) {
      const statusKey = state.timer.status;
      const sessionStarted = statusKey !== Core.STATUS.IDLE;
      const primaryActionLabels = labels.primaryActionLabels || {};
      const primaryActionIcons = labels.primaryActionIcons || {};
      const primaryActionAriaLabels = labels.primaryActionAriaLabels || {};
      const phaseCopy = phaseConfig[state.timer.phase] || {};
      const phaseLabel = phaseCopy.displayName || String(state.timer.phase || "");

      return {
        stateText: phaseLabel,
        timeText: Core.formatTime(state.timer.remainingSec),
        hintText: phaseCopy.shortHint || "",
        longHintText: phaseCopy.longHint || "",
        todayText:
          (labels.focusBlocksTodayPrefix || "today: ") +
          state.stats.focusBlocksToday +
          (labels.focusBlocksTodaySuffix || " focus blocks"),
        sinceLongText:
          (labels.sinceLongBreakPrefix || "long break: ") +
          state.stats.focusBlocksSinceLong +
          " / " +
          state.settings.blocks_per_ultradian,
        focusBlockText: sessionStarted
          ? (labels.focusBlockPrefix || "Focus Block ") + state.timer.focusBlockNumber
          : labels.focusBlockReady || "Focus Block\nReady",
        focusBlockContextText: sessionStarted
          ? labels.focusBlockSessionSuffix || "of session"
          : labels.focusBlockReadyContext || "Ready to begin session.",
        focusBlockAriaLabel: sessionStarted
          ? (labels.focusBlockPrefix || "Focus Block ") +
            state.timer.focusBlockNumber +
            " " +
            (labels.focusBlockSessionSuffix || "of session")
          : (labels.focusBlockReady || "Focus Block Ready").replace(/\s+/g, " "),
        dirtyText: state.ui.storageWarning
          ? labels.storageUnavailable || "Settings are not being saved in this browser."
          : state.ui.settingsDirty
            ? labels.unsavedChanges || "Unsaved Changes"
            : labels.allSettingsSaved || "All Settings Saved",
        primaryButtonIcon:
          primaryActionIcons[statusKey] || (statusKey === Core.STATUS.RUNNING ? "⏸" : "▶"),
        primaryButtonText:
          primaryActionLabels[statusKey] ||
          (statusKey === Core.STATUS.RUNNING
            ? "Pause"
            : statusKey === Core.STATUS.PAUSED
              ? "Resume"
              : "Start"),
        primaryButtonAriaLabel:
          primaryActionAriaLabels[statusKey] ||
          (statusKey === Core.STATUS.RUNNING
            ? "Pause timer"
            : statusKey === Core.STATUS.PAUSED
              ? "Resume timer"
              : "Start timer"),
        titleText: sessionStarted
          ? Core.formatTime(state.timer.remainingSec) +
            (labels.documentTitleSeparator || " - ") +
            phaseLabel +
            " | " +
            (labels.documentTitleBase || "Cognitive Interval Timer")
          : labels.documentTitleBase || "Cognitive Interval Timer",
      };
    }

    function render(state) {
      const vm = buildView(state);
      dom.state.textContent = vm.stateText;
      dom.time.textContent = vm.timeText;
      dom.hint.textContent = vm.hintText;
      dom.longHint.textContent = vm.longHintText;
      dom.today.textContent = vm.todayText;
      dom.long.textContent = vm.sinceLongText;
      dom.focusBlockBadge.textContent = vm.focusBlockText;
      dom.focusBlockContext.textContent = vm.focusBlockContextText;
      dom.focusBlockBadge.setAttribute("aria-label", vm.focusBlockAriaLabel);
      dom.dirtyIndicator.textContent = vm.dirtyText;
      updatePrimaryButton(vm);
      document.title = vm.titleText;
    }

    function updatePrimaryButton(vm) {
      const icon =
        dom.controls.start.querySelector && dom.controls.start.querySelector(".control-icon");
      const label =
        dom.controls.start.querySelector && dom.controls.start.querySelector(".control-label");
      if (icon && label) {
        icon.textContent = vm.primaryButtonIcon;
        label.textContent = vm.primaryButtonText;
      } else {
        dom.controls.start.textContent = vm.primaryButtonIcon + " " + vm.primaryButtonText;
      }
      dom.controls.start.setAttribute("aria-label", vm.primaryButtonAriaLabel);
    }

    return {
      setTagline,
      hydrateTheme,
      hydrateSettingsForm,
      setDisplayActivationAvailable,
      render,
    };
  }

  return {
    create,
  };
});
