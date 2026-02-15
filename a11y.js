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
        if (!trigger.getAttribute("aria-haspopup")) {
          trigger.setAttribute("aria-haspopup", "true");
        }

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
