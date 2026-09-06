(function initUIControls(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroUIControls = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeUIControls() {
  function create(dom, settingFields) {
    let settingsHistoryActive = false;
    let settingsHistoryToken = null;
    let nextSettingsHistoryToken = 1;
    const activatedTooltips = new WeakSet();

    function isInteractiveTarget(target) {
      if (!target) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "SELECT" ||
        tag === "TEXTAREA" ||
        tag === "BUTTON" ||
        tag === "A" ||
        target.isContentEditable
      );
    }

    function readSettingsForm() {
      return settingFields.reduce(function collectSettings(settings, descriptor) {
        const field = dom.fields[descriptor.key];
        settings[descriptor.key] = descriptor.type === "boolean" ? field.checked : field.value;
        return settings;
      }, {});
    }

    function validateSettingsForm() {
      const invalidDescriptor = settingFields.find(function findInvalidSetting(descriptor) {
        const field = dom.fields[descriptor.key];
        return descriptor.type === "number" && field.checkValidity && !field.checkValidity();
      });
      if (!invalidDescriptor) return true;

      const invalidField = dom.fields[invalidDescriptor.key];
      if (invalidField.reportValidity) invalidField.reportValidity();
      return false;
    }

    function bindControls(handlers) {
      setMinimalPanelOpen(false);
      setSettingsViewOpen(false, { focus: false, updateHistory: false });
      clearStaleSettingsHistory();
      bindTooltips();
      dom.controls.start.addEventListener("click", handlers.onPrimaryAction);
      dom.controls.skip.addEventListener("click", handlers.onSkip);
      dom.controls.reset.addEventListener("click", handlers.onReset);

      dom.controls.save.addEventListener("click", function saveClick() {
        if (!validateSettingsForm()) return;
        handlers.onSaveSettings(readSettingsForm());
      });

      dom.controls.defaults.addEventListener("click", handlers.onRestoreDefaults);
      dom.controls.restoreRecommendedTiming.addEventListener(
        "click",
        handlers.onRestoreRecommendedTiming
      );
      dom.controls.openSettings.addEventListener("click", function openSettingsClick() {
        setSettingsViewOpen(true);
      });
      dom.controls.closeSettings.addEventListener("click", function closeSettingsClick() {
        setSettingsViewOpen(false);
      });
      dom.controls.activateDisplayModes.addEventListener(
        "click",
        function activateDisplayModesClick() {
          let displayModeOptions = null;
          if (dom.fields.minimal_mode_enabled.checked) {
            displayModeOptions = closeSettingsForMinimalMode();
          }
          handlers.onActivateDisplayModes(displayModeOptions);
        }
      );
      dom.controls.exitMinimalModeReveal.addEventListener(
        "click",
        function onMinimalRevealClick(event) {
          if (event && event.preventDefault) event.preventDefault();
          if (event && event.stopPropagation) event.stopPropagation();
          const open = dom.controls.exitMinimalModeWrap.getAttribute("data-open") === "true";
          setMinimalPanelOpen(!open);
          if (open) focusMinimalModeReveal();
        }
      );
      dom.controls.minimalPrimaryAction.addEventListener(
        "click",
        function onMinimalPrimaryActionClick(event) {
          if (event && event.stopPropagation) event.stopPropagation();
          handlers.onPrimaryAction();
        }
      );
      dom.controls.nextMinimalPhase.addEventListener(
        "click",
        function onNextMinimalPhaseClick(event) {
          if (event && event.stopPropagation) event.stopPropagation();
          setMinimalPanelOpen(false);
          focusMinimalModeReveal();
          handlers.onSkip();
        }
      );
      dom.controls.restartMinimalBlock.addEventListener(
        "click",
        function onRestartMinimalBlockClick(event) {
          if (event && event.stopPropagation) event.stopPropagation();
          setMinimalPanelOpen(false);
          focusMinimalModeReveal();
          handlers.onReset();
        }
      );
      dom.controls.exitMinimalMode.addEventListener("click", function onExitMinimalModeClick() {
        setMinimalPanelOpen(false);
        handlers.onExitMinimalMode();
      });
      dom.theme.addEventListener("change", function themeChange(event) {
        handlers.onThemeChange(event.target.value);
      });

      settingFields
        .filter(function isNumberField(descriptor) {
          return descriptor.type === "number";
        })
        .forEach(function bindNumericSetting(descriptor) {
          bindNumberField(dom.fields[descriptor.key], handlers);
        });
      bindCheckbox(dom.fields.prep_enabled, function onPrepEnabledInput() {
        handlers.onSettingsInput(readSettingsForm());
      });
      bindCheckbox(dom.fields.auto_start, function onAutoStartInput() {
        handlers.onSettingsInput(readSettingsForm());
      });
      bindCheckbox(dom.fields.sound_enabled, function onSoundEnabledInput() {
        handlers.onSettingsInput(readSettingsForm());
      });
      bindCheckbox(dom.fields.quiet_mode_enabled, function onQuietModeInput() {
        handlers.onSettingsInput(readSettingsForm());
      });
      bindCheckbox(dom.fields.single_key_shortcuts_enabled, function onShortcutSettingInput() {
        handlers.onSettingsInput(readSettingsForm());
      });
      bindCheckbox(dom.fields.fullscreen_enabled, function onFullscreenInput(field) {
        handlers.onSettingsInput(readSettingsForm());
        handlers.onFullscreenToggle(field.checked);
      });
      bindCheckbox(dom.fields.minimal_mode_enabled, function onMinimalModeInput(field) {
        const displayModeOptions = field.checked ? closeSettingsForMinimalMode() : null;
        handlers.onSettingsInput(readSettingsForm());
        handlers.onMinimalModeToggle(field.checked, displayModeOptions);
      });
      bindCheckbox(dom.fields.wake_lock_enabled, function onWakeLockInput(field) {
        handlers.onSettingsInput(readSettingsForm());
        handlers.onWakeLockToggle(field.checked);
      });

      window.addEventListener("keydown", function onKeydown(event) {
        if (event.key === "Escape") {
          if (dismissActiveTooltip()) return;
          if (isSettingsViewOpen()) {
            setSettingsViewOpen(false);
            return;
          }
          if (isMinimalPanelOpen()) {
            setMinimalPanelOpen(false);
            focusMinimalModeReveal();
            return;
          }
          setMinimalPanelOpen(false);
          handlers.onExitMinimalMode();
          return;
        }
        if (isSettingsViewOpen()) return;
        if (isInteractiveTarget(event.target)) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (!dom.fields.single_key_shortcuts_enabled.checked) return;
        const key = event.key.toLowerCase();
        if (key === " ") {
          event.preventDefault();
          handlers.onShortcut("toggle");
          return;
        }
        if (key === "s") handlers.onShortcut("skip");
        if (key === "r") handlers.onShortcut("reset");
      });

      window.addEventListener("popstate", function onSettingsPopState(event) {
        if (!settingsHistoryActive) return;
        const activeToken = event && event.state && event.state.settingsViewToken;
        if (activeToken === settingsHistoryToken) return;
        settingsHistoryActive = false;
        settingsHistoryToken = null;
        if (isSettingsViewOpen()) setSettingsViewOpen(false, { updateHistory: false });
      });

      bindMinimalModeSurface(handlers);

      document.addEventListener("fullscreenchange", function onFullscreenChange() {
        handlers.onFullscreenChange(Boolean(document.fullscreenElement));
      });
    }

    function clearStaleSettingsHistory() {
      if (
        !window.history ||
        !window.history.state ||
        window.history.state.appState !== "settings" ||
        typeof window.history.replaceState !== "function"
      ) {
        return;
      }
      try {
        window.history.replaceState(null, "");
      } catch {
        // History cleanup must not prevent the timer from starting.
      }
    }

    function bindNumberField(field, handlers) {
      field.addEventListener("input", function onInput() {
        handlers.onSettingsInput(readSettingsForm());
      });
    }

    function bindCheckbox(field, onChange) {
      field.addEventListener("change", function onCheckboxChange() {
        onChange(field);
      });
    }

    function bindTooltips() {
      if (typeof document.querySelectorAll !== "function") return;
      document.querySelectorAll(".tip-wrap").forEach(function bindTooltip(wrapper) {
        const trigger = wrapper.querySelector(".tip-trigger");
        const bubble = wrapper.querySelector(".tip-bubble");
        if (!trigger || !bubble) return;

        hideTooltip(wrapper, bubble);
        wrapper.addEventListener("mouseenter", function showHoveredTooltip() {
          showTooltip(wrapper, bubble);
        });
        wrapper.addEventListener("mouseleave", function hideUnfocusedTooltip() {
          if (document.activeElement !== trigger) hideTooltip(wrapper, bubble);
        });
        trigger.addEventListener("focus", function showFocusedTooltip() {
          showTooltip(wrapper, bubble);
        });
        trigger.addEventListener("click", function toggleActivatedTooltip() {
          if (activatedTooltips.has(wrapper)) {
            hideTooltip(wrapper, bubble);
            return;
          }
          activatedTooltips.add(wrapper);
          showTooltip(wrapper, bubble);
        });
        trigger.addEventListener("blur", function hideBlurredTooltip() {
          hideTooltip(wrapper, bubble);
        });
      });
    }

    function showTooltip(wrapper, bubble) {
      bubble.hidden = false;
      wrapper.setAttribute("data-open", "true");
    }

    function hideTooltip(wrapper, bubble) {
      activatedTooltips.delete(wrapper);
      bubble.hidden = true;
      wrapper.setAttribute("data-open", "false");
    }

    function bindMinimalModeSurface(handlers) {
      window.addEventListener("click", function onMinimalSurfaceAction(event) {
        toggleMinimalTimer(event, handlers);
      });
    }

    function isSettingsViewOpen() {
      return !dom.views.settings.hidden;
    }

    function setSettingsViewOpen(open, options) {
      const config = Object.assign({ focus: true, updateHistory: true }, options || {});
      dom.views.session.hidden = open;
      dom.views.settings.hidden = !open;
      dom.controls.openSettings.setAttribute("aria-expanded", String(open));
      if (open) document.documentElement.setAttribute("data-settings-view", "true");
      else document.documentElement.removeAttribute("data-settings-view");

      if (config.updateHistory) updateSettingsHistory(open);

      if (!config.focus) return;
      if (open) dom.views.settingsHeading.focus();
      else dom.controls.openSettings.focus();
    }

    function updateSettingsHistory(open) {
      if (!window.history) return;
      if (open && !settingsHistoryActive && typeof window.history.pushState === "function") {
        try {
          settingsHistoryToken = nextSettingsHistoryToken;
          nextSettingsHistoryToken += 1;
          window.history.pushState(
            { appState: "settings", settingsViewToken: settingsHistoryToken },
            ""
          );
          settingsHistoryActive = true;
        } catch {
          settingsHistoryToken = null;
        }
        return;
      }
      if (!open && settingsHistoryActive && typeof window.history.back === "function") {
        settingsHistoryActive = false;
        settingsHistoryToken = null;
        try {
          window.history.back();
        } catch {
          // The visible Settings view has still closed.
        }
      }
    }

    function closeSettingsForMinimalMode() {
      const reuseHistoryEntry =
        settingsHistoryActive &&
        window.history &&
        typeof window.history.replaceState === "function";
      if (reuseHistoryEntry) {
        settingsHistoryActive = false;
        settingsHistoryToken = null;
      }
      setSettingsViewOpen(false, { focus: false, updateHistory: !reuseHistoryEntry });
      return { reuseHistoryEntry: reuseHistoryEntry };
    }

    function isMinimalPanelTarget(target) {
      return Boolean(target && target.closest && target.closest("#minimal-exit-wrap"));
    }

    function isMinimalPanelOpen() {
      return dom.controls.exitMinimalModeWrap.getAttribute("data-open") === "true";
    }

    function setMinimalPanelOpen(open) {
      dom.controls.exitMinimalModeWrap.setAttribute("data-open", String(open));
      dom.controls.exitMinimalModeReveal.setAttribute("aria-expanded", String(open));
      dom.controls.exitMinimalModePanel.hidden = !open;
    }

    function shouldHandleMinimalAction(event) {
      if (!document.documentElement.hasAttribute("data-minimal-mode")) return false;
      if (event.button != null && event.button !== 0) return false;
      if (isMinimalPanelTarget(event.target)) return false;
      if (isInteractiveTarget(event.target)) return false;
      return true;
    }

    function consumeMinimalEvent(event) {
      if (event.cancelable && event.preventDefault) event.preventDefault();
    }

    function toggleMinimalTimer(event, handlers) {
      if (!shouldHandleMinimalAction(event)) return;
      if (isMinimalPanelOpen()) {
        setMinimalPanelOpen(false);
        focusMinimalModeReveal();
        consumeMinimalEvent(event);
        return;
      }
      consumeMinimalEvent(event);
      handlers.onShortcut("toggle");
    }

    function focusMinimalModeReveal() {
      dom.controls.exitMinimalModeReveal.focus();
    }

    function focusPrimaryAction() {
      dom.controls.start.focus();
    }

    function dismissActiveTooltip() {
      const activeElement = document.activeElement;
      if (!activeElement || !activeElement.closest) return false;
      const wrapper = activeElement.closest(".tip-wrap");
      if (!wrapper || !wrapper.querySelector) return false;
      const bubble = wrapper.querySelector(".tip-bubble");
      if (!bubble || bubble.hidden) return false;
      hideTooltip(wrapper, bubble);
      return true;
    }

    return {
      bindControls,
      readSettingsForm,
      focusMinimalModeReveal,
      focusPrimaryAction,
    };
  }

  return {
    create,
  };
});
