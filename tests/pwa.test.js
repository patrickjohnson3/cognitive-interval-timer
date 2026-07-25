const fs = require("fs");
const path = require("path");
const appShell = require("../app-shell-assets.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (err) {
    console.error("FAIL", name);
    console.error("  " + err.message);
    process.exitCode = 1;
  }
}

function readProjectFile(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

function pngDimensions(file) {
  const png = fs.readFileSync(path.join(__dirname, "..", file));
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

function appShellAssets() {
  return appShell.APP_SHELL;
}

function shellAssetGroup(name) {
  return appShell[name];
}

test("index links PWA manifest and registration script", function () {
  const html = readProjectFile("index.html");

  assert(
    html.includes('<link rel="manifest" href="manifest.webmanifest" />'),
    "missing manifest link"
  );
  assert(
    html.includes('<meta id="theme-color-meta" name="theme-color"'),
    "missing dynamic theme-color meta"
  );
  assert(html.includes('<script src="pwa.js"></script>'), "missing PWA registration script");
  assert(
    html.includes('<script src="pwa-prompts.js"></script>'),
    "missing PWA prompt helper script"
  );
});

test("index links a dedicated 180px Apple touch icon", function () {
  const html = readProjectFile("index.html");
  const iconPath = "assets/icons/apple-touch-icon.png";
  const dimensions = pngDimensions(iconPath);

  assert(
    html.includes('<link rel="apple-touch-icon" sizes="180x180" href="' + iconPath + '" />'),
    "missing dedicated Apple touch icon link"
  );
  assert(
    dimensions.width === 180 && dimensions.height === 180,
    "expected 180x180 Apple touch icon"
  );
});

test("index includes iOS standalone PWA metadata", function () {
  const html = readProjectFile("index.html");

  assert(
    html.includes('<meta name="apple-mobile-web-app-capable" content="yes" />'),
    "missing iOS capable meta"
  );
  assert(
    html.includes('<meta name="apple-mobile-web-app-title" content="CogTimer" />'),
    "iOS app title should match manifest short_name"
  );
  assert(
    html.includes('<meta name="apple-mobile-web-app-status-bar-style"'),
    "missing iOS status bar meta"
  );
});

test("app shell does not depend on external runtime assets", function () {
  const html = readProjectFile("index.html");

  assert(!/https?:\/\//.test(html), "expected index shell to avoid external runtime URLs");
});

test("manifest has installable app metadata and icons", function () {
  const manifest = JSON.parse(readProjectFile("manifest.webmanifest"));

  assert(manifest.name === "Cognitive Interval Timer", "unexpected manifest name");
  assert(manifest.short_name === "CogTimer", "unexpected manifest short_name");
  assert(manifest.id === "./", "expected path-independent PWA id");
  assert(manifest.display === "standalone", "expected standalone display mode");
  assert(manifest.start_url === "./", "expected path-independent start_url");
  assert(manifest.scope === "./", "expected path-independent scope");
  assert(
    !Object.prototype.hasOwnProperty.call(manifest, "orientation"),
    "manifest should not lock PWA orientation"
  );
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "expected manifest icons");
  manifest.icons.forEach(function eachIcon(icon) {
    assert(fs.existsSync(path.join(__dirname, "..", icon.src)), "missing icon file " + icon.src);
    assert(icon.type === "image/png", "expected png icon " + icon.src);
    const dimensions = pngDimensions(icon.src);
    const declaredSize = Number(icon.sizes.split("x")[0]);
    assert(
      dimensions.width === declaredSize && dimensions.height === declaredSize,
      "icon size mismatch " + icon.src
    );
  });
});

test("manifest includes dedicated maskable icons", function () {
  const manifest = JSON.parse(readProjectFile("manifest.webmanifest"));
  const maskableIcons = manifest.icons.filter(function isMaskable(icon) {
    return icon.purpose === "maskable";
  });

  assert(maskableIcons.length >= 2, "expected dedicated maskable icons");
  maskableIcons.forEach(function eachMaskableIcon(icon) {
    assert(icon.src.includes("maskable-"), "maskable icon should use dedicated asset " + icon.src);
  });
});

test("service worker caches the app shell", function () {
  const serviceWorker = readProjectFile("service-worker.js");
  const requiredAssets = shellAssetGroup("REQUIRED_APP_SHELL");
  const optionalAssets = shellAssetGroup("OPTIONAL_APP_SHELL");
  const expectedAssets = [
    "./index.html",
    "./manifest.webmanifest",
    "./styles.css",
    "./haptics.js",
    "./controller-persistence.js",
    "./controller-settings-effects.js",
    "./controller-timer-actions.js",
    "./app.js",
    "./pwa-prompts.js",
    "./pwa.js",
    "./assets/icons/apple-touch-icon.png",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./assets/icons/maskable-192.png",
    "./assets/icons/maskable-512.png",
  ];

  expectedAssets.forEach(function eachAsset(asset) {
    assert(appShellAssets().includes(asset), "missing cached asset " + asset);
  });
  assert(requiredAssets.includes("./app.js"), "runtime app code should be required");
  assert(
    optionalAssets.includes("./assets/icons/icon-512.png"),
    "icons should be optional cache assets"
  );
  assert(serviceWorker.includes("cacheOptionalAsset"), "missing optional asset cache helper");
  assert(serviceWorker.includes("function appShellAssetUrl"), "missing scope-aware asset helper");
  assert(
    serviceWorker.includes(".addAll(REQUIRED_APP_SHELL.map(appShellAssetUrl))"),
    "required shell should remain strict and scope-aware"
  );
});

test("service worker uses a stable app-scoped cache name", function () {
  const serviceWorker = readProjectFile("service-worker.js");

  assert(
    serviceWorker.includes('const CACHE_PREFIX = "cognitive-interval-timer-";'),
    "missing app-specific cache prefix"
  );
  assert(
    serviceWorker.includes('const CACHE_NAME = CACHE_PREFIX + "app-shell";'),
    "cache name should be stable and app-scoped"
  );
  assert(
    !serviceWorker.includes("APP_VERSION"),
    "service worker should not require manual version bumps"
  );
});

test("service worker only deletes this app's old caches", function () {
  const serviceWorker = readProjectFile("service-worker.js");

  assert(
    serviceWorker.includes("key.startsWith(CACHE_PREFIX)"),
    "old-cache cleanup should be scoped to app prefix"
  );
  assert(
    serviceWorker.includes("pruneCurrentAppShellCache"),
    "current app-shell cache should prune removed assets"
  );
});

test("every service worker app-shell asset exists locally", function () {
  const missing = appShellAssets()
    .filter(function ignoreRoot(asset) {
      return asset !== "./";
    })
    .filter(function isMissing(asset) {
      return !fs.existsSync(path.join(__dirname, "..", asset.replace(/^\.\//, "")));
    });

  assert(missing.length === 0, "missing app-shell assets: " + missing.join(", "));
});

test("service worker avoids cache-first navigation responses", function () {
  const serviceWorker = readProjectFile("service-worker.js");

  assert(
    serviceWorker.includes('request.mode === "navigate"'),
    "expected explicit navigation handling"
  );
  assert(
    serviceWorker.includes("useFreshNavigation"),
    "expected network-first navigation strategy"
  );
  assert(
    serviceWorker.includes("!response.ok"),
    "navigation caching should reject failed responses"
  );
  assert(
    serviceWorker.includes("event.waitUntil("),
    "fresh response cache writes should use event.waitUntil"
  );
  assert(
    !serviceWorker.includes("cacheFirstForAppShell"),
    "unexpected cache-first fetch handler name"
  );
  assert(serviceWorker.includes("useFreshAsset"), "expected network-first asset strategy");
  assert(
    !serviceWorker.includes("return cached || networkFetch"),
    "unexpected stale-first asset strategy"
  );
});

test("service worker only runtime-caches app-shell assets", function () {
  const serviceWorker = readProjectFile("service-worker.js");

  assert(serviceWorker.includes("function isAppShellRequest"), "missing app-shell request guard");
  assert(
    serviceWorker.includes("if (!isAppShellRequest(requestUrl))"),
    "runtime asset caching should skip non-app-shell requests"
  );
});

test("service worker returns a response for uncached offline assets", function () {
  const serviceWorker = readProjectFile("service-worker.js");

  assert(
    serviceWorker.includes("Offline app shell unavailable."),
    "missing uncached offline navigation fallback"
  );
  assert(
    serviceWorker.includes("Offline asset unavailable."),
    "missing uncached offline asset fallback"
  );
  assert(serviceWorker.includes("status: 503"), "expected explicit offline asset status");
});

test("PWA registration exposes a user-controlled update flow", function () {
  const pwa = readProjectFile("pwa.js");
  const prompts = readProjectFile("pwa-prompts.js");
  const serviceWorker = readProjectFile("service-worker.js");
  const css = readProjectFile("styles.css");

  assert(prompts.includes("pwa-update-button"), "missing update prompt button");
  assert(
    prompts.includes('createPromptCard("pwa-update"'),
    "update prompt should render as a settings card"
  );
  assert(
    !css.includes("#pwa-update {\n  position: fixed;"),
    "update prompt should not use fixed floating styles"
  );
  assert(pwa.includes("isInstalledDisplayMode"), "missing installed-mode update guard");
  assert(pwa.includes("(display-mode: standalone)"), "missing standalone display-mode check");
  assert(pwa.includes("(display-mode: fullscreen)"), "missing fullscreen display-mode check");
  assert(pwa.includes("(display-mode: minimal-ui)"), "missing minimal-ui display-mode check");
  assert(pwa.includes("controllerchange"), "missing reload-after-update handler");
  assert(pwa.includes("SKIP_WAITING"), "missing skip-waiting message from page");
  assert(prompts.includes("pwa-status"), "missing visible service-worker status card");
  assert(
    pwa.includes("Offline support is unavailable right now."),
    "missing registration failure status copy"
  );
  assert(!pwa.includes("ignoreRegistrationError"), "registration errors should not be silent");
  assert(serviceWorker.includes("SKIP_WAITING"), "missing skip-waiting message handler");
  assert(
    !serviceWorker.includes('self.skipWaiting();\n});\n\nself.addEventListener("activate"'),
    "install should not force skipWaiting"
  );
});

test("PWA registration handles browser install prompt", function () {
  const html = readProjectFile("index.html");
  const pwa = readProjectFile("pwa.js");
  const prompts = readProjectFile("pwa-prompts.js");
  const css = readProjectFile("styles.css");

  assert(html.includes('id="pwa-install-slot"'), "missing install prompt slot");
  assert(pwa.includes("beforeinstallprompt"), "missing install prompt event handler");
  assert(prompts.includes("pwa-install-slot"), "install prompt should render into settings slot");
  assert(pwa.includes("Install for offline use."), "missing install prompt copy");
  assert(prompts.includes("pwa-install-button"), "missing install button id");
  assert(pwa.includes("isIOSBrowser"), "missing iOS install guidance detection");
  assert(pwa.includes("Add to Home Screen"), "missing iOS install guidance copy");
  assert(pwa.includes("navigator.standalone"), "missing iOS installed-mode detection");
  assert(pwa.includes("deferredInstallPrompt"), "missing deferred install prompt state");
  assert(pwa.includes("appinstalled"), "missing installed cleanup handler");
  assert(css.includes(".pwa-prompt-card"), "missing shared prompt card styles");
  assert(
    !pwa.includes("pwa-install-card"),
    "shared PWA prompt class should not be install-specific"
  );
  assert(
    !css.includes("#pwa-install,\n#pwa-update"),
    "install prompt should not share fixed update styling"
  );
});
