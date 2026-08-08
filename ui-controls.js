(function initUIControls(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroUIControls = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeUIControls() {
  function create(dom) {
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
      return {
        prep: dom.fields.prep.value,
        focus: dom.fields.focus.value,
        recall: dom.fields.recall.value,
        break: dom.fields.break.value,
        long_break: dom.fields.long_break.value,
        blocks_per_ultradian: dom.fields.blocks_per_ultradian.value,
        prep_enabled: dom.fields.prep_enabled.checked,
        auto_start: dom.fields.auto_start.checked,
        sound_enabled: dom.fields.sound_enabled.checked,
        quiet_mode_enabled: dom.fields.quiet_mode_enabled.checked,
        fullscreen_enabled: dom.fields.fullscreen_enabled.checked,
        minimal_mode_enabled: dom.fields.minimal_mode_enabled.checked,
        wake_lock_enabled: dom.fields.wake_lock_enabled.checked,
      };
    }

    function bindControls(handlers) {
      dom.controls.start.addEventListener("click", handlers.onPrimaryAction);
      dom.controls.skip.addEventListener("click", handlers.onSkip);
      dom.controls.reset.addEventListener("click", handlers.onReset);

      dom.controls.save.addEventListener("click", function saveClick() {
        handlers.onSaveSettings(readSettingsForm());
      });

      dom.controls.defaults.addEventListener("click", handlers.onRestoreDefaults);
      dom.controls.exitMinimalModeReveal.addEventListener(
        "click",
        function onMinimalRevealClick(event) {
          if (event && event.preventDefault) event.preventDefault();
          if (event && event.stopPropagation) event.stopPropagation();
          const open = dom.controls.exitMinimalModeWrap.getAttribute("data-open") === "true";
          dom.controls.exitMinimalModeWrap.setAttribute("data-open", open ? "false" : "true");
        }
      );
      dom.controls.restartMinimalBlock.addEventListener(
        "click",
        function onRestartMinimalBlockClick(event) {
          if (event && event.stopPropagation) event.stopPropagation();
          dom.controls.exitMinimalModeWrap.setAttribute("data-open", "false");
          handlers.onReset();
        }
      );
      dom.controls.exitMinimalMode.addEventListener("click", function onExitMinimalModeClick() {
        dom.controls.exitMinimalModeWrap.setAttribute("data-open", "false");
        handlers.onExitMinimalMode();
      });
      dom.theme.addEventListener("change", function themeChange(event) {
        handlers.onThemeChange(event.target.value);
      });

      bindNumberField(dom.fields.prep, handlers);
      bindNumberField(dom.fields.focus, handlers);
      bindNumberField(dom.fields.recall, handlers);
      bindNumberField(dom.fields.break, handlers);
      bindNumberField(dom.fields.long_break, handlers);
      bindNumberField(dom.fields.blocks_per_ultradian, handlers);
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
      bindCheckbox(dom.fields.fullscreen_enabled, function onFullscreenInput(field) {
        handlers.onSettingsInput(readSettingsForm());
        handlers.onFullscreenToggle(field.checked);
      });
      bindCheckbox(dom.fields.minimal_mode_enabled, function onMinimalModeInput(field) {
        handlers.onSettingsInput(readSettingsForm());
        handlers.onMinimalModeToggle(field.checked);
      });
      bindCheckbox(dom.fields.wake_lock_enabled, function onWakeLockInput(field) {
        handlers.onSettingsInput(readSettingsForm());
        handlers.onWakeLockToggle(field.checked);
      });

      window.addEventListener("keydown", function onKeydown(event) {
        if (event.key === "Escape") {
          dom.controls.exitMinimalModeWrap.setAttribute("data-open", "false");
          handlers.onExitMinimalMode();
          return;
        }
        if (isInteractiveTarget(event.target)) return;
        const key = event.key.toLowerCase();
        if (key === " ") {
          event.preventDefault();
          handlers.onShortcut("toggle");
          return;
        }
        if (key === "s") handlers.onShortcut("skip");
        if (key === "r") handlers.onShortcut("reset");
      });

      bindMinimalModeSurface(handlers);

      document.addEventListener("fullscreenchange", function onFullscreenChange() {
        handlers.onFullscreenChange(Boolean(document.fullscreenElement));
      });
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

    function bindMinimalModeSurface(handlers) {
      const eventName =
        "PointerEvent" in window ? "pointerup" : "TouchEvent" in window ? "touchend" : "click";
      window.addEventListener(eventName, function onMinimalSurfaceAction(event) {
        toggleMinimalTimer(event, handlers);
      });
    }

    function isMinimalPanelTarget(target) {
      return Boolean(target && target.closest && target.closest("#minimal-exit-wrap"));
    }

    function isMinimalPanelOpen() {
      return dom.controls.exitMinimalModeWrap.getAttribute("data-open") === "true";
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
        dom.controls.exitMinimalModeWrap.setAttribute("data-open", "false");
        consumeMinimalEvent(event);
        return;
      }
      consumeMinimalEvent(event);
      handlers.onShortcut("toggle");
    }

    return {
      bindControls,
      readSettingsForm,
    };
  }

  return {
    create,
  };
});
