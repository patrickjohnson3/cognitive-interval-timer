(function registerPWA() {
  const supportsServiceWorker = "serviceWorker" in navigator;
  let refreshing = false;
  let deferredInstallPrompt = null;

  function getInstallSlot() {
    return document.getElementById("pwa-install-slot");
  }

  function removeInstallCard() {
    const card = document.getElementById("pwa-install");
    const slot = getInstallSlot();
    if (card) card.remove();
    hideSlotIfEmpty(slot);
  }

  function hideSlotIfEmpty(slot) {
    if (slot && slot.children.length === 0) slot.hidden = true;
  }

  function isInstalledDisplayMode() {
    const installedDisplayModeQueries = [
      "(display-mode: standalone)",
      "(display-mode: fullscreen)",
      "(display-mode: minimal-ui)",
    ];
    return (
      Boolean(navigator.standalone) ||
      installedDisplayModeQueries.some(function hasDisplayMode(query) {
        return window.matchMedia(query).matches;
      })
    );
  }

  function isIOSBrowser() {
    const platform = navigator.platform || "";
    const userAgent = navigator.userAgent || "";
    return (
      /iPad|iPhone|iPod/.test(userAgent) ||
      (platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function createPromptCard(id, copyText) {
    const card = document.createElement("div");
    card.id = id;
    card.className = "pwa-prompt-card";

    const copy = document.createElement("p");
    copy.className = "pwa-prompt-copy";
    copy.textContent = copyText;

    card.appendChild(copy);
    return card;
  }

  function showServiceWorkerStatus(message) {
    if (document.getElementById("pwa-status")) return;

    const slot = getInstallSlot();
    if (!slot) return;

    slot.hidden = false;
    slot.appendChild(createPromptCard("pwa-status", message));
  }

  function showInstallPrompt() {
    if (!deferredInstallPrompt || document.getElementById("pwa-install")) return;

    const slot = getInstallSlot();
    if (!slot) return;

    const card = createPromptCard("pwa-install", "Install for offline use.");

    const button = document.createElement("button");
    button.id = "pwa-install-button";
    button.type = "button";
    button.textContent = "Install";
    button.setAttribute("aria-label", "Install app");
    button.addEventListener("click", function installApp() {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      removeInstallCard();
      promptEvent.prompt();
      promptEvent.userChoice.catch(function ignoreInstallChoiceError() {});
    });

    card.appendChild(button);
    slot.hidden = false;
    slot.appendChild(card);
  }

  function showIOSInstallGuidance() {
    if (!isIOSBrowser() || isInstalledDisplayMode() || document.getElementById("pwa-install"))
      return;

    const slot = getInstallSlot();
    if (!slot) return;

    slot.hidden = false;
    slot.appendChild(
      createPromptCard("pwa-install", "To install on iOS, tap Share, then Add to Home Screen.")
    );
  }

  function showUpdatePrompt(registration) {
    if (!registration || !registration.waiting || document.getElementById("pwa-update")) return;

    const slot = getInstallSlot();
    if (!slot) return;

    const card = createPromptCard("pwa-update", "A newer version is ready.");
    const button = document.createElement("button");
    button.id = "pwa-update-button";
    button.type = "button";
    button.textContent = "Update";
    button.setAttribute("aria-label", "Update app to the latest version");
    button.addEventListener("click", function updateApp() {
      if (!registration.waiting) return;
      button.disabled = true;
      button.textContent = "Updating...";
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    });
    card.appendChild(button);
    slot.hidden = false;
    slot.appendChild(card);
  }

  if (supportsServiceWorker) {
    navigator.serviceWorker.addEventListener("controllerchange", function reloadAfterUpdate() {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  window.addEventListener("beforeinstallprompt", function onBeforeInstallPrompt(event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallPrompt();
  });

  window.addEventListener("appinstalled", function onAppInstalled() {
    deferredInstallPrompt = null;
    removeInstallCard();
  });

  window.addEventListener("load", function onWindowLoad() {
    showIOSInstallGuidance();

    if (!supportsServiceWorker) {
      showServiceWorkerStatus("Offline support is unavailable in this browser.");
      return;
    }

    navigator.serviceWorker
      .register("./service-worker.js")
      .then(function watchForUpdates(registration) {
        if (registration.waiting) {
          showUpdatePrompt(registration);
          return;
        }

        registration.addEventListener("updatefound", function onUpdateFound() {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener("statechange", function onWorkerStateChange() {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdatePrompt(registration);
            }
          });
        });
      })
      .catch(function showRegistrationError() {
        showServiceWorkerStatus("Offline support is unavailable right now.");
      });
  });
})();
