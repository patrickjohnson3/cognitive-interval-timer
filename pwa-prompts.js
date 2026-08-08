(function initPWAPrompts(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroPWAPrompts = factory();
  }
})(typeof self !== "undefined" ? self : this, function makePWAPrompts() {
  function create(deps) {
    const doc = deps.documentRef || document;
    const slotId = deps.slotId || "pwa-install-slot";

    function getSlot() {
      return doc.getElementById(slotId);
    }

    function hideSlotIfEmpty(slot) {
      if (slot && slot.children.length === 0) slot.hidden = true;
    }

    function removeCard(id) {
      const card = doc.getElementById(id);
      const slot = getSlot();
      if (card) card.remove();
      hideSlotIfEmpty(slot);
    }

    function createPromptCard(id, copyText) {
      const card = doc.createElement("div");
      card.id = id;
      card.className = "pwa-prompt-card";

      const copy = doc.createElement("p");
      copy.className = "pwa-prompt-copy";
      copy.textContent = copyText;
      copy.setAttribute("role", "status");
      copy.setAttribute("aria-live", "polite");
      copy.setAttribute("aria-atomic", "true");

      card.appendChild(copy);
      return card;
    }

    function appendCard(card) {
      const slot = getSlot();
      if (!slot) return null;
      slot.hidden = false;
      slot.appendChild(card);
      return card;
    }

    function showStatus(message) {
      if (doc.getElementById("pwa-status")) return null;
      return appendCard(createPromptCard("pwa-status", message));
    }

    function showInstall(options) {
      const config = options || {};
      if (doc.getElementById("pwa-install")) return null;

      const card = createPromptCard("pwa-install", config.copyText);
      if (config.onInstall) {
        const button = doc.createElement("button");
        button.id = "pwa-install-button";
        button.type = "button";
        button.textContent = config.buttonText;
        button.setAttribute("aria-label", config.ariaLabel);
        button.addEventListener("click", config.onInstall);
        card.appendChild(button);
      }
      return appendCard(card);
    }

    function showUpdate(options) {
      const config = options || {};
      if (doc.getElementById("pwa-update")) return null;

      const card = createPromptCard("pwa-update", config.copyText);
      const button = doc.createElement("button");
      button.id = "pwa-update-button";
      button.type = "button";
      button.textContent = config.buttonText;
      button.setAttribute("aria-label", config.ariaLabel);
      button.addEventListener("click", function onUpdateClick() {
        const handled = config.onUpdate && config.onUpdate(button);
        if (!handled) return;
        button.disabled = true;
        button.textContent = config.pendingText;
      });
      card.appendChild(button);
      return appendCard(card);
    }

    return {
      removeCard,
      showStatus,
      showInstall,
      showUpdate,
    };
  }

  return {
    create,
  };
});
