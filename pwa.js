(function registerPWA() {
  if (!("serviceWorker" in navigator)) return;

  let refreshing = false;

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
