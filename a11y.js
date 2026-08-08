// Accessibility helpers for tooltip ARIA wiring and live-region announcement text.
(function initA11y(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroA11y = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeA11y() {
  function create(deps) {
    const Content = deps.Content || {};
    const copy = Content.UI_COPY || {};
    const announcements = copy.announcements || {};

    function applyAriaDefaults(rootNode) {
      const root = rootNode || document;
      const triggers = root.querySelectorAll(".tip-trigger");
      triggers.forEach(function eachTrigger(trigger) {
        const describedBy = trigger.getAttribute("aria-describedby");
        if (describedBy) return;

        const wrapper = trigger.closest(".tip-wrap");
        if (!wrapper) return;
        const bubble = wrapper.querySelector(".tip-bubble");
        if (!bubble || !bubble.id) return;

        trigger.setAttribute("aria-describedby", bubble.id);
      });
    }

    function formatAnnouncement(type, payload) {
      const data = payload || {};
      if (type === "phase_started") {
        return data.label + " " + (announcements.phaseStartedSuffix || "Started");
      }
      if (type === "settings_saved") {
        return announcements.settingsSaved || "Settings Saved.";
      }
      if (type === "defaults_restored") {
        return announcements.defaultsRestored || "Defaults Restored.";
      }
      if (type === "fullscreen_unavailable") {
        return announcements.fullscreenUnavailable || "Fullscreen is unavailable.";
      }
      if (type === "wake_lock_unavailable") {
        return announcements.wakeLockUnavailable || "Keep Screen Awake is unavailable.";
      }
      if (type === "wake_lock_request_failed") {
        return announcements.wakeLockRequestFailed || "The screen could not be kept awake.";
      }
      return "";
    }

    return {
      applyAriaDefaults,
      formatAnnouncement,
    };
  }

  return {
    create,
  };
});
