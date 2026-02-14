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
    const storage = deps.storage;

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
    }

    function render(state) {
      dom.state.textContent = Core.stateLabel(state.timer.phase);
      dom.time.textContent = Core.formatTime(state.timer.remainingSec);
      dom.hint.textContent = Core.STATE_HINTS[state.timer.phase] || "";
      dom.longHint.textContent = Core.STATE_LONG_HINTS[state.timer.phase] || "";
      dom.today.textContent = "Focus Blocks Today: " + state.stats.focusBlocksToday;
      dom.long.textContent = "Since Long Break: " + state.stats.focusBlocksSinceLong + "/" + state.settings.blocks_per_ultradian;

      const storageSuffix = storage.mode() === "memory" ? " (Volatile Storage)" : "";
      dom.status.textContent = "Status: " + (state.timer.running ? "Running" : "Paused") + storageSuffix;

      dom.cycleBadge.textContent = "Cycle " + state.stats.focusBlocksToday;
      dom.controls.start.setAttribute("aria-pressed", state.timer.running ? "true" : "false");
      dom.controls.pause.setAttribute("aria-pressed", state.timer.running ? "false" : "true");

      if (state.ui.settingsDirty) {
        dom.dirtyIndicator.textContent = "Unsaved Changes";
      } else {
        dom.dirtyIndicator.textContent = "All Settings Saved";
      }

      const changed = [];
      if (state.ui.sessionFlags.changedAutoStart) changed.push("Auto-Start");
      if (state.ui.sessionFlags.changedSound) changed.push("Sound");
      dom.sessionNote.textContent = changed.length > 0 ? "Session Changes: " + changed.join(", ") : "Session Changes: None";

      document.title = Core.formatTime(state.timer.remainingSec) + " - " + Core.stateLabel(state.timer.phase);
    }

    return {
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
