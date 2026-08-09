(function registerPWA() {
  const supportsServiceWorker = "serviceWorker" in navigator;
  const promptFactory = window.PomodoroPWAPrompts;
  const content = window.PomodoroContent || {};
  const pwaCopy = (content.UI_COPY && content.UI_COPY.pwa) || {};
  const prompts = promptFactory && promptFactory.create({ documentRef: document });
  let refreshing = false;
  let updateRequested = false;
  let updateTimeoutId = null;
  let deferredInstallPrompt = null;
  let hasControlledPage = Boolean(supportsServiceWorker && navigator.serviceWorker.controller);

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
        try {
          promptEvent.prompt();
          Promise.resolve(promptEvent.userChoice)
            .catch(function ignoreInstallChoiceError() {})
            .then(focusSettingsAfterInstallPrompt);
        } catch {
          focusSettingsAfterInstallPrompt();
        }
      },
    });
  }

  function focusSettingsAfterInstallPrompt() {
    const themeControl = document.getElementById("theme");
    if (themeControl && typeof themeControl.focus === "function") themeControl.focus();
  }

  function showIOSInstallGuidance() {
    if (!isIOSBrowser() || isInstalledDisplayMode()) return;

    prompts.showInstall({
      copyText: pwaCopy.iosInstallCopy || "To install on iOS, tap Share, then Add to Home Screen.",
    });
  }

  function showUpdatePrompt(registration) {
    if (!registration || !registration.waiting) return;

    const updateIndicator = document.getElementById("pwa-update-indicator");
    const settingsButton = document.getElementById("open-settings");
    if (updateIndicator) updateIndicator.hidden = false;
    if (settingsButton) settingsButton.setAttribute("aria-describedby", "pwa-update-indicator");

    prompts.showUpdate({
      copyText: pwaCopy.updateCopy || "A newer version is ready.",
      buttonText: pwaCopy.updateButton || "Update",
      pendingText: pwaCopy.updatePending || "Updating...",
      ariaLabel: pwaCopy.updateAriaLabel || "Update app to the latest version",
      onUpdate: function updateApp(button) {
        if (!registration.waiting) return false;
        if (!confirmDiscardingSettings()) return false;
        try {
          updateRequested = true;
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          updateTimeoutId = window.setTimeout(function updateTimedOut() {
            resetUpdateRequest(button, true);
          }, 10000);
          return true;
        } catch {
          resetUpdateRequest(button, true);
          return false;
        }
      },
    });
  }

  function settingsAreDirty() {
    const settingsButton = document.getElementById("open-settings");
    return Boolean(settingsButton && settingsButton.getAttribute("data-dirty") === "true");
  }

  function confirmDiscardingSettings() {
    if (!settingsAreDirty()) return true;
    try {
      return window.confirm(
        pwaCopy.updateDiscardConfirmation || "Reload and discard unsaved settings changes?"
      );
    } catch {
      return false;
    }
  }

  function reloadApp() {
    if (refreshing) return false;
    refreshing = true;
    window.location.reload();
    return true;
  }

  function showReloadPrompt() {
    prompts.removeCard("pwa-update");
    prompts.showUpdate({
      copyText:
        pwaCopy.reloadCopy ||
        "The update is ready. Save settings before reloading if you want to keep them.",
      buttonText: pwaCopy.reloadButton || "Reload",
      pendingText: pwaCopy.reloadPending || "Reloading...",
      ariaLabel: pwaCopy.reloadAriaLabel || "Reload app to use the latest version",
      onUpdate: function reloadUpdatedApp() {
        if (!confirmDiscardingSettings()) return false;
        return reloadApp();
      },
    });
  }

  function resetUpdateRequest(button, showError) {
    if (updateTimeoutId) window.clearTimeout(updateTimeoutId);
    updateTimeoutId = null;
    updateRequested = false;
    if (button) {
      button.disabled = false;
      button.textContent = pwaCopy.updateButton || "Update";
    }
    if (showError) {
      showServiceWorkerStatus(pwaCopy.updateErrorCopy || "The update could not start. Try again.");
    }
  }

  if (supportsServiceWorker) {
    navigator.serviceWorker.addEventListener("controllerchange", function reloadAfterUpdate() {
      if (refreshing) return;
      if (!updateRequested && !hasControlledPage) {
        hasControlledPage = true;
        return;
      }
      if (updateTimeoutId) window.clearTimeout(updateTimeoutId);
      updateTimeoutId = null;
      updateRequested = false;
      hasControlledPage = true;
      if (settingsAreDirty()) {
        showReloadPrompt();
        return;
      }
      reloadApp();
    });
    navigator.serviceWorker.addEventListener("message", function handleWorkerMessage(event) {
      if (!event.data || event.data.type !== "SKIP_WAITING_RESULT" || event.data.ok !== false)
        return;
      resetUpdateRequest(document.getElementById("pwa-update-button"), true);
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
