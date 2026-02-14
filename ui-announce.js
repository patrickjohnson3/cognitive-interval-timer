(function initUIAnnounce(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroUIAnnounce = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeUIAnnounce() {
  function create(dom) {
    function flashMessage(message) {
      dom.saveMsg.textContent = message;
      setTimeout(function clearMessage() {
        if (dom.saveMsg.textContent === message) dom.saveMsg.textContent = "";
      }, 1800);
    }

    function announce(text) {
      dom.live.textContent = "";
      setTimeout(function writeAnnouncement() {
        dom.live.textContent = text;
      }, 10);
    }

    return {
      flashMessage,
      announce,
    };
  }

  return {
    create,
  };
});
