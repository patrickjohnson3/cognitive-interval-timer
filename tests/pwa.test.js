const fs = require("fs");
const path = require("path");

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
  const serviceWorker = readProjectFile("service-worker.js");
  const match = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/);
  assert(match, "missing APP_SHELL asset list");
  return Array.from(match[1].matchAll(/"([^"]+)"/g)).map(function toAsset(entry) {
    return entry[1];
  });
}

test("index links PWA manifest and registration script", function () {
  const html = readProjectFile("index.html");

  assert(html.includes('<link rel="manifest" href="manifest.webmanifest" />'), "missing manifest link");
  assert(html.includes('<meta name="theme-color"'), "missing theme-color meta");
  assert(html.includes('<script src="pwa.js"></script>'), "missing PWA registration script");
});

test("index links a dedicated 180px Apple touch icon", function () {
  const html = readProjectFile("index.html");
  const iconPath = "assets/icons/apple-touch-icon.png";
  const dimensions = pngDimensions(iconPath);

  assert(
    html.includes('<link rel="apple-touch-icon" sizes="180x180" href="' + iconPath + '" />'),
    "missing dedicated Apple touch icon link"
  );
  assert(dimensions.width === 180 && dimensions.height === 180, "expected 180x180 Apple touch icon");
});

test("index includes iOS standalone PWA metadata", function () {
  const html = readProjectFile("index.html");

  assert(html.includes('<meta name="apple-mobile-web-app-capable" content="yes" />'), "missing iOS capable meta");
  assert(html.includes('<meta name="apple-mobile-web-app-title"'), "missing iOS app title meta");
  assert(html.includes('<meta name="apple-mobile-web-app-status-bar-style"'), "missing iOS status bar meta");
});

test("app shell does not depend on external runtime assets", function () {
  const html = readProjectFile("index.html");

  assert(!/https?:\/\//.test(html), "expected index shell to avoid external runtime URLs");
});

test("manifest has installable app metadata and icons", function () {
  const manifest = JSON.parse(readProjectFile("manifest.webmanifest"));

  assert(manifest.name === "Cognitive Interval Timer", "unexpected manifest name");
  assert(manifest.display === "standalone", "expected standalone display mode");
  assert(manifest.start_url === "./index.html", "expected local start_url");
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "expected manifest icons");
  manifest.icons.forEach(function eachIcon(icon) {
    assert(fs.existsSync(path.join(__dirname, "..", icon.src)), "missing icon file " + icon.src);
    assert(icon.type === "image/png", "expected png icon " + icon.src);
    const dimensions = pngDimensions(icon.src);
    const declaredSize = Number(icon.sizes.split("x")[0]);
    assert(dimensions.width === declaredSize && dimensions.height === declaredSize, "icon size mismatch " + icon.src);
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
  const expectedAssets = [
    "./index.html",
    "./manifest.webmanifest",
    "./styles.css",
    "./app.js",
    "./pwa.js",
    "./assets/icons/apple-touch-icon.png",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./assets/icons/maskable-192.png",
    "./assets/icons/maskable-512.png",
  ];

  expectedAssets.forEach(function eachAsset(asset) {
    assert(serviceWorker.includes('"' + asset + '"'), "missing cached asset " + asset);
  });
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

  assert(serviceWorker.includes('request.mode === "navigate"'), "expected explicit navigation handling");
  assert(serviceWorker.includes("useFreshNavigation"), "expected network-first navigation strategy");
  assert(!serviceWorker.includes("cacheFirstForAppShell"), "unexpected cache-first fetch handler name");
  assert(serviceWorker.includes("useFreshAsset"), "expected network-first asset strategy");
  assert(!serviceWorker.includes("return cached || networkFetch"), "unexpected stale-first asset strategy");
});

test("service worker returns a response for uncached offline assets", function () {
  const serviceWorker = readProjectFile("service-worker.js");

  assert(serviceWorker.includes("Offline asset unavailable."), "missing uncached offline asset fallback");
  assert(serviceWorker.includes("status: 503"), "expected explicit offline asset status");
});

test("PWA registration exposes a user-controlled update flow", function () {
  const pwa = readProjectFile("pwa.js");
  const serviceWorker = readProjectFile("service-worker.js");

  assert(pwa.includes("Update Available"), "missing update prompt text");
  assert(pwa.includes("controllerchange"), "missing reload-after-update handler");
  assert(pwa.includes("SKIP_WAITING"), "missing skip-waiting message from page");
  assert(serviceWorker.includes("SKIP_WAITING"), "missing skip-waiting message handler");
  assert(!serviceWorker.includes("self.skipWaiting();\n});\n\nself.addEventListener(\"activate\""), "install should not force skipWaiting");
});

test("PWA registration handles browser install prompt", function () {
  const pwa = readProjectFile("pwa.js");

  assert(pwa.includes("beforeinstallprompt"), "missing install prompt event handler");
  assert(pwa.includes("Install App"), "missing install button text");
  assert(pwa.includes("deferredInstallPrompt"), "missing deferred install prompt state");
  assert(pwa.includes("appinstalled"), "missing installed cleanup handler");
});
