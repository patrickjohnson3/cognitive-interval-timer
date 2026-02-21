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
        prime: dom.fields.prime.value,
        focus: dom.fields.focus.value,
        recall: dom.fields.recall.value,
        break: dom.fields.break.value,
        long_break: dom.fields.long_break.value,
        blocks_per_ultradian: dom.fields.blocks_per_ultradian.value,
        prime_enabled: dom.fields.prime_enabled.checked,
        auto_start: dom.fields.auto_start.checked,
        sound_enabled: dom.fields.sound_enabled.checked,
        fullscreen_enabled: dom.fields.fullscreen_enabled.checked,
        minimal_mode_enabled: dom.fields.minimal_mode_enabled.checked,
      };
    }

    function bindControls(handlers) {
      dom.controls.start.addEventListener("click", handlers.onStart);
      dom.controls.pause.addEventListener("click", handlers.onPause);
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
