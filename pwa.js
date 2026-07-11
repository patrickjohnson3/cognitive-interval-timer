(function registerPWA() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function onWindowLoad() {
    navigator.serviceWorker.register("./service-worker.js").catch(function ignoreRegistrationError() {});
  });
})();
