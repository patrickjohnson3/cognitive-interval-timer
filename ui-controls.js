(function initUIControls(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroUIControls = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeUIControls() {
  function create(dom) {
    function isFormTarget(target) {
      if (!target) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target.isContentEditable;
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
        fullscreen_enabled: dom.fields.fullscreen_enabled.checked,
        minimal_mode_enabled: dom.fields.minimal_mode_enabled.checked,
        wake_lock_enabled: dom.fields.wake_lock_enabled.checked,
      };
    }

    function bindControls(handlers) {
      dom.controls.start.addEventListener("click", handlers.onPrimaryAction || handlers.onStart);
      dom.controls.skip.addEventListener("click", handlers.onSkip);
      dom.controls.reset.addEventListener("click", handlers.onReset);

      dom.controls.save.addEventListener("click", function saveClick() {
        handlers.onSaveSettings(readSettingsForm());
      });

      dom.controls.defaults.addEventListener("click", handlers.onRestoreDefaults);
      dom.controls.exitMinimalModeReveal.addEventListener("click", function onMinimalRevealClick() {
        const open = dom.controls.exitMinimalModeWrap.getAttribute("data-open") === "true";
        dom.controls.exitMinimalModeWrap.setAttribute("data-open", open ? "false" : "true");
      });
      dom.controls.restartMinimalBlock.addEventListener(
        "click",
        function onRestartMinimalBlockClick(event) {
          if (event && event.stopPropagation) event.stopPropagation();
          dom.controls.exitMinimalModeWrap.setAttribute("data-open", "false");
          if (handlers.onReset) handlers.onReset();
        }
      );
      dom.controls.exitMinimalMode.addEventListener("click", function onExitMinimalModeClick() {
        dom.controls.exitMinimalModeWrap.setAttribute("data-open", "false");
        if (handlers.onExitMinimalMode) handlers.onExitMinimalMode();
      });
      dom.theme.addEventListener("change", function themeChange(event) {
        handlers.onThemeChange(event.target.value);
      });

      Object.keys(dom.fields).forEach(function watchField(key) {
        const field = dom.fields[key];
        const tag = field.tagName;
        const type = field.type;

        if (type === "checkbox" || tag === "SELECT") {
          field.addEventListener("change", function onChange() {
            if (key === "fullscreen_enabled" && handlers.onFullscreenToggle) {
              handlers.onFullscreenToggle(field.checked);
            }
            if (key === "minimal_mode_enabled" && handlers.onMinimalModeToggle) {
              handlers.onMinimalModeToggle(field.checked);
            }
            if (key === "wake_lock_enabled" && handlers.onWakeLockToggle) {
              handlers.onWakeLockToggle(field.checked);
            }
            handlers.onSettingsInput(readSettingsForm());
          });
          return;
        }

        field.addEventListener("input", function onInput() {
          handlers.onSettingsInput(readSettingsForm());
        });
      });

      window.addEventListener("keydown", function onKeydown(event) {
        if (event.key === "Escape" && handlers.onExitMinimalMode) {
          dom.controls.exitMinimalModeWrap.setAttribute("data-open", "false");
          handlers.onExitMinimalMode();
          return;
        }
        if (isFormTarget(event.target)) return;
        const key = event.key.toLowerCase();
        if (key === " ") {
          event.preventDefault();
          handlers.onShortcut("toggle");
          return;
        }
        if (key === "s") handlers.onShortcut("skip");
        if (key === "r") handlers.onShortcut("reset");
      });

      let lastMinimalPointerToggleMs = 0;

      function shouldHandleMinimalToggle(event) {
        if (!document.documentElement.hasAttribute("data-minimal-mode")) return false;
        if (event.button != null && event.button !== 0) return false;
        if (event.target && event.target.closest && event.target.closest("#minimal-exit-wrap")) {
          return false;
        }
        if (isFormTarget(event.target)) return false;
        return true;
      }

      function toggleMinimalTimer(event, source) {
        if (!shouldHandleMinimalToggle(event)) return;
        const now = Date.now();
        if (source === "click" && now - lastMinimalPointerToggleMs < 500) return;
        if (source !== "click") lastMinimalPointerToggleMs = now;
        if (event.cancelable && event.preventDefault) event.preventDefault();
        handlers.onShortcut("toggle");
      }

      window.addEventListener("pointerup", function onWindowPointerUp(event) {
        toggleMinimalTimer(event, "pointer");
      });

      window.addEventListener("touchend", function onWindowTouchEnd(event) {
        toggleMinimalTimer(event, "touch");
      });

      window.addEventListener("click", function onWindowClick(event) {
        toggleMinimalTimer(event, "click");
      });

      document.addEventListener("fullscreenchange", function onFullscreenChange() {
        if (handlers.onFullscreenChange)
          handlers.onFullscreenChange(Boolean(document.fullscreenElement));
      });
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
