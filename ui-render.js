(function initUIRender(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroUIRender = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeUIRender() {
  function create(deps) {
    const Core = deps.Core;
    const Content = deps.Content;
    const AppConfig = deps.AppConfig;
    const dom = deps.dom;
    const labels = Content.UI_COPY.labels;
    const phaseConfig = Content.PHASE_CONFIG;
    const themeColors = AppConfig.themeColors;

    function setTagline(text) {
      dom.tagline.textContent = text;
    }

    function hydrateStaticContent() {
      const uiCopy = Content.UI_COPY;
      dom.copy.phaseSettingsHeading.textContent = uiCopy.phaseSettingsHeading;
      dom.copy.blocks.textContent = uiCopy.blocksBeforeLongBreak;
      dom.copy.prepEnabled.textContent = uiCopy.startWithPrep;
      dom.copy.autoStart.textContent = uiCopy.autoStartNext;
      dom.copy.soundEnabled.textContent = uiCopy.soundOnPhaseChange;
      dom.copy.quietModeEnabled.textContent = uiCopy.quietMode;
      dom.copy.singleKeyShortcutsEnabled.textContent = uiCopy.singleKeyShortcuts;
      dom.copy.fullscreenEnabled.textContent = uiCopy.fullscreenMode;
      dom.copy.minimalModeEnabled.textContent = uiCopy.minimalMode;
      dom.copy.wakeLockEnabled.textContent = uiCopy.keepScreenAwake;

      Core.PHASES.forEach(function hydratePhaseLabel(phase) {
        dom.copy.phaseLabels[phase].textContent = phaseConfig[phase].displayName;
      });

      document.querySelectorAll("[data-tooltip-key]").forEach(function hydrateTooltip(wrapper) {
        const copy = uiCopy.tooltips[wrapper.getAttribute("data-tooltip-key")];
        const bubble = wrapper.querySelector(".tip-bubble");
        wrapper.querySelector(".tip-trigger").setAttribute("aria-label", copy.triggerLabel);
        bubble.querySelector("strong").textContent = copy.heading;
        bubble.querySelector("span").textContent = copy.body;
      });
    }

    function hydrateTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      const themeColor = document.getElementById("theme-color-meta");
      if (themeColor) themeColor.setAttribute("content", themeColors[theme]);
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

    function setSettingField(key, value) {
      const descriptor = Core.SETTING_FIELDS.find(function findSetting(candidate) {
        return candidate.key === key;
      });
      if (descriptor.type === "boolean") dom.fields[key].checked = value;
      else dom.fields[key].value = value;
    }

    function setMinimalModeActive(active) {
      if (active) document.documentElement.setAttribute("data-minimal-mode", "true");
      else document.documentElement.removeAttribute("data-minimal-mode");
    }

    function buildView(state) {
      const statusKey = state.timer.status;
      const sessionStarted = statusKey !== Core.STATUS.IDLE;
      const phaseCopy = phaseConfig[state.timer.phase];
      const phaseLabel = phaseCopy.displayName;

      return {
        stateText: phaseLabel,
        timeText: Core.formatTime(state.timer.remainingSec),
        hintText: phaseCopy.shortHint,
        longHintText: phaseCopy.longHint,
        cycleFocusText: String(state.settings.focus),
        cycleRecallText: String(state.settings.recall),
        cycleBreakText: String(state.settings.break),
        cycleSummaryAriaLabel:
          "Cycle: " +
          state.settings.focus +
          " minutes focus, " +
          state.settings.recall +
          " minutes recall, " +
          state.settings.break +
          " minutes short break",
        todayText:
          labels.focusBlocksTodayPrefix +
          state.stats.focusBlocksToday +
          labels.focusBlocksTodaySuffix,
        sinceLongText:
          labels.sinceLongBreakPrefix +
          state.stats.focusBlocksSinceLong +
          " / " +
          state.settings.blocks_per_ultradian,
        focusBlockText: sessionStarted
          ? labels.focusBlockPrefix + state.timer.focusBlockNumber
          : labels.focusBlockReady,
        focusBlockContextText: sessionStarted
          ? labels.focusBlockSessionSuffix
          : labels.focusBlockReadyContext,
        focusBlockAriaLabel: sessionStarted
          ? labels.focusBlockPrefix +
            state.timer.focusBlockNumber +
            " " +
            labels.focusBlockSessionSuffix
          : labels.focusBlockReady.replace(/\s+/g, " "),
        dirtyText: state.ui.sessionConflict
          ? labels.sessionInUse
          : state.ui.storageCorruption
            ? labels.storageRecovered
            : state.ui.storageWarning
              ? labels.storageUnavailable
              : state.ui.settingsDirty
                ? labels.unsavedChanges
                : labels.allSettingsSaved,
        primaryButtonIcon: labels.primaryActionIcons[statusKey],
        primaryButtonText: labels.primaryActionLabels[statusKey],
        primaryButtonAriaLabel: labels.primaryActionAriaLabels[statusKey],
        titleText: sessionStarted
          ? Core.formatTime(state.timer.remainingSec) +
            labels.documentTitleSeparator +
            phaseLabel +
            " | " +
            labels.documentTitleBase
          : labels.documentTitleBase,
      };
    }

    function render(state) {
      const vm = buildView(state);
      dom.state.textContent = vm.stateText;
      dom.time.textContent = vm.timeText;
      dom.hint.textContent = vm.hintText;
      dom.longHint.textContent = vm.longHintText;
      dom.cycleFocus.textContent = vm.cycleFocusText;
      dom.cycleRecall.textContent = vm.cycleRecallText;
      dom.cycleBreak.textContent = vm.cycleBreakText;
      dom.cycleSummary.setAttribute("aria-label", vm.cycleSummaryAriaLabel);
      dom.today.textContent = vm.todayText;
      dom.long.textContent = vm.sinceLongText;
      dom.focusBlockBadge.textContent = vm.focusBlockText;
      dom.focusBlockContext.textContent = vm.focusBlockContextText;
      dom.focusBlockBadge.setAttribute("aria-label", vm.focusBlockAriaLabel);
      dom.dirtyIndicator.textContent = vm.dirtyText;
      dom.controls.openSettings.setAttribute("data-dirty", String(state.ui.settingsDirty));
      dom.controls.openSettings.setAttribute(
        "aria-label",
        state.ui.settingsDirty ? "Settings, unsaved changes" : "Settings"
      );
      updatePrimaryButton(vm);
      document.title = vm.titleText;
    }

    function updatePrimaryButton(vm) {
      updateActionButton(dom.controls.start, vm);
      updateActionButton(dom.controls.minimalPrimaryAction, vm);
    }

    function updateActionButton(button, vm) {
      const icon = button.querySelector(".control-icon");
      const label = button.querySelector(".control-label");
      icon.textContent = vm.primaryButtonIcon;
      label.textContent = vm.primaryButtonText;
      button.setAttribute("aria-label", vm.primaryButtonAriaLabel);
    }

    return {
      setTagline,
      hydrateStaticContent,
      hydrateTheme,
      hydrateSettingsForm,
      setDisplayActivationAvailable,
      setSettingField,
      setMinimalModeActive,
      render,
    };
  }

  return {
    create,
  };
});
