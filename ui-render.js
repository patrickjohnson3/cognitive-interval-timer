(function initUIRender(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroUIRender = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeUIRender() {
  function create(deps) {
    const dom = deps.dom;
    const viewModel = deps.viewModel;
    const themeColors = {
      dark: "#0f172a",
      light: "#f5f7f9",
    };

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
      dom.fields.prep.value = settings.prep;
      dom.fields.focus.value = settings.focus;
      dom.fields.recall.value = settings.recall;
      dom.fields.break.value = settings.break;
      dom.fields.long_break.value = settings.long_break;
      dom.fields.blocks_per_ultradian.value = settings.blocks_per_ultradian;
      dom.fields.prep_enabled.checked = settings.prep_enabled;
      dom.fields.auto_start.checked = settings.auto_start;
      dom.fields.sound_enabled.checked = settings.sound_enabled;
      dom.fields.fullscreen_enabled.checked = settings.fullscreen_enabled;
      dom.fields.minimal_mode_enabled.checked = settings.minimal_mode_enabled;
      dom.fields.wake_lock_enabled.checked = settings.wake_lock_enabled;
    }

    function render(state) {
      const vm = viewModel.build(state);
      dom.state.textContent = vm.stateText;
      dom.time.textContent = vm.timeText;
      dom.hint.textContent = vm.hintText;
      dom.longHint.textContent = vm.longHintText;
      dom.today.textContent = vm.todayText;
      dom.long.textContent = vm.sinceLongText;
      dom.focusBlockBadge.textContent = vm.focusBlockText;
      dom.focusBlockBadge.setAttribute("aria-label", vm.focusBlockAriaLabel);
      dom.dirtyIndicator.textContent = vm.dirtyText;
      dom.sessionNote.textContent = vm.sessionChangesText;
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
      updatePrimaryButton,
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
