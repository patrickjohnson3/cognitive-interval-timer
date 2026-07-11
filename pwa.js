(function registerPWA() {
  if (!("serviceWorker" in navigator)) return;

  let refreshing = false;
  let deferredInstallPrompt = null;

  function getInstallSlot() {
    return document.getElementById("pwa-install-slot");
  }

  function removeInstallButton() {
    const card = document.getElementById("pwa-install");
    const slot = getInstallSlot();
    if (card) card.remove();
    if (slot) slot.hidden = true;
  }

  function showInstallPrompt() {
    if (!deferredInstallPrompt || document.getElementById("pwa-install")) return;

    const slot = getInstallSlot();
    if (!slot) return;

    const card = document.createElement("div");
    card.id = "pwa-install";
    card.className = "pwa-install-card";

    const copy = document.createElement("p");
    copy.className = "pwa-install-copy";
    copy.textContent = "Install for offline use.";

    const button = document.createElement("button");
    button.id = "pwa-install-button";
    button.type = "button";
    button.textContent = "Install";
    button.setAttribute("aria-label", "Install app");
    button.addEventListener("click", function installApp() {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      removeInstallButton();
      promptEvent.prompt();
      promptEvent.userChoice.catch(function ignoreInstallChoiceError() {});
    });

    card.append(copy, button);
    slot.hidden = false;
    slot.appendChild(card);
  }

  function showUpdatePrompt(registration) {
    if (!registration || !registration.waiting || document.getElementById("pwa-update")) return;

    const button = document.createElement("button");
    button.id = "pwa-update";
    button.type = "button";
    button.textContent = "Update Available";
    button.setAttribute("aria-label", "Update app to the latest version");
    button.addEventListener("click", function updateApp() {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      button.disabled = true;
      button.textContent = "Updating...";
    });
    document.body.appendChild(button);
  }

  navigator.serviceWorker.addEventListener("controllerchange", function reloadAfterUpdate() {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("beforeinstallprompt", function onBeforeInstallPrompt(event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallPrompt();
  });

  window.addEventListener("appinstalled", function onAppInstalled() {
    deferredInstallPrompt = null;
    removeInstallButton();
  });

  window.addEventListener("load", function onWindowLoad() {
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
      .catch(function ignoreRegistrationError() {});
  });
})();
