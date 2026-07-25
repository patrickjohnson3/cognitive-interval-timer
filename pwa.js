(function registerPWA() {
  const supportsServiceWorker = "serviceWorker" in navigator;
  const promptFactory = window.PomodoroPWAPrompts;
  const content = window.PomodoroContent || {};
  const pwaCopy = (content.UI_COPY && content.UI_COPY.pwa) || {};
  const prompts = promptFactory && promptFactory.create({ documentRef: document });
  let refreshing = false;
  let deferredInstallPrompt = null;

  if (!prompts) {
    throw new Error("Missing PWA prompt helpers. Ensure pwa-prompts.js loads before pwa.js");
  }

  function removeInstallCard() {
    prompts.removeCard("pwa-install");
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

  function showServiceWorkerStatus(message) {
    prompts.showStatus(message);
  }

  function showInstallPrompt() {
    if (!deferredInstallPrompt) return;

    prompts.showInstall({
      copyText: pwaCopy.installCopy || "Install for offline use.",
      buttonText: pwaCopy.installButton || "Install",
      ariaLabel: pwaCopy.installAriaLabel || "Install app",
      onInstall: function installApp() {
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        removeInstallCard();
        promptEvent.prompt();
        promptEvent.userChoice.catch(function ignoreInstallChoiceError() {});
      },
    });
  }

  function showIOSInstallGuidance() {
    if (!isIOSBrowser() || isInstalledDisplayMode()) return;

    prompts.showInstall({
      copyText: pwaCopy.iosInstallCopy || "To install on iOS, tap Share, then Add to Home Screen.",
    });
  }

  function showUpdatePrompt(registration) {
    if (!registration || !registration.waiting) return;

    prompts.showUpdate({
      copyText: pwaCopy.updateCopy || "A newer version is ready.",
      buttonText: pwaCopy.updateButton || "Update",
      pendingText: pwaCopy.updatePending || "Updating...",
      ariaLabel: pwaCopy.updateAriaLabel || "Update app to the latest version",
      onUpdate: function updateApp() {
        if (!registration.waiting) return false;
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
        return true;
      },
    });
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
      showServiceWorkerStatus(
        pwaCopy.unsupportedCopy || "Offline support is unavailable in this browser."
      );
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
        showServiceWorkerStatus(
          pwaCopy.registrationErrorCopy || "Offline support is unavailable right now."
        );
      });
  });
})();
