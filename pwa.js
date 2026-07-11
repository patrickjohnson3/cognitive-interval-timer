(function registerPWA() {
  if (!("serviceWorker" in navigator)) return;

  let refreshing = false;
  let deferredInstallPrompt = null;

  function removeInstallButton() {
    const button = document.getElementById("pwa-install");
    if (button) button.remove();
  }

  function showInstallPrompt() {
    if (!deferredInstallPrompt || document.getElementById("pwa-install")) return;

    const button = document.createElement("button");
    button.id = "pwa-install";
    button.type = "button";
    button.textContent = "Install App";
    button.setAttribute("aria-label", "Install app");
    button.addEventListener("click", function installApp() {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      removeInstallButton();
      promptEvent.prompt();
      promptEvent.userChoice.catch(function ignoreInstallChoiceError() {});
    });
    document.body.appendChild(button);
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
