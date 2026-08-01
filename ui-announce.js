(function initUIAnnounce(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroUIAnnounce = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeUIAnnounce() {
  function create(dom) {
    let transitionTimeoutId = null;

    function flashMessage(message) {
      dom.saveMsg.textContent = message;
      setTimeout(function clearMessage() {
        if (dom.saveMsg.textContent === message) dom.saveMsg.textContent = "";
      }, 1800);
    }

    function showTransition(message) {
      if (!dom.transitionMessage) return;
      if (transitionTimeoutId) clearTimeout(transitionTimeoutId);

      dom.transitionMessage.hidden = false;
      dom.transitionMessage.textContent = message;
      transitionTimeoutId = setTimeout(function clearTransition() {
        if (dom.transitionMessage.textContent === message) {
          dom.transitionMessage.textContent = "";
          dom.transitionMessage.hidden = true;
        }
      }, 3600);
    }

    function announce(text) {
      dom.live.textContent = "";
      setTimeout(function writeAnnouncement() {
        dom.live.textContent = text;
      }, 10);
    }

    return {
      flashMessage,
      showTransition,
      announce,
    };
  }

  return {
    create,
  };
});
