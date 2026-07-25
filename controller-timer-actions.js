(function initControllerTimerActions(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroControllerTimerActions = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeControllerTimerActions() {
  function create(deps) {
    const state = deps.state;
    const timer = deps.timer;
    const haptics = deps.haptics;
    const audio = deps.audio;
    const announce = deps.announce;
    const a11y = deps.a11y;

    function start() {
      haptics.tap();
      timer.start();
    }

    function pause() {
      haptics.tap();
      timer.pause();
    }

    function skip() {
      haptics.tap();
      timer.skip();
    }

    function reset() {
      haptics.tap();
      timer.reset();
    }

    function onPrimaryAction() {
      if (state.timer.running) {
        pause();
        return;
      }
      start();
    }

    function handleShortcut(action) {
      if (action === "toggle") {
        onPrimaryAction();
        return;
      }
      if (action === "skip") skip();
      if (action === "reset") reset();
    }

    function onPhaseChange(payload) {
      haptics.phaseChange();
      if (state.settings.sound_enabled) {
        audio.playPhaseChime();
      }
      announce.announce(a11y.formatAnnouncement("phase_started", { label: payload.label }));
    }

    return {
      start,
      pause,
      skip,
      reset,
      onPrimaryAction,
      handleShortcut,
      onPhaseChange,
    };
  }

  return {
    create,
  };
});
