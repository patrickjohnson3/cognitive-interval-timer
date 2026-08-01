(function initAppShellAssets(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PomodoroAppShell = factory();
  }
})(typeof self !== "undefined" ? self : this, function makeAppShellAssets() {
  const REQUIRED_APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./themes/light.css",
    "./themes/dark.css",
    "./styles.css",
    "./app-version.js",
    "./app-config.js",
    "./content.js",
    "./core.js",
    "./ui-announce.js",
    "./ui-render.js",
    "./ui-controls.js",
    "./storage.js",
    "./audio.js",
    "./haptics.js",
    "./wake-lock.js",
    "./display-services.js",
    "./timer-engine.js",
    "./a11y.js",
    "./app-controller.js",
    "./app.js",
    "./pwa-prompts.js",
    "./pwa.js",
    "./app-shell-assets.js",
  ];
  const OPTIONAL_APP_SHELL = [
    "./assets/icons/apple-touch-icon.png",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./assets/icons/maskable-192.png",
    "./assets/icons/maskable-512.png",
  ];
  const APP_SHELL = REQUIRED_APP_SHELL.concat(OPTIONAL_APP_SHELL);

  return {
    REQUIRED_APP_SHELL,
    OPTIONAL_APP_SHELL,
    APP_SHELL,
  };
});
