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

test("index links PWA manifest and registration script", function () {
  const html = readProjectFile("index.html");

  assert(html.includes('<link rel="manifest" href="manifest.webmanifest" />'), "missing manifest link");
  assert(html.includes('<meta name="theme-color"'), "missing theme-color meta");
  assert(html.includes('<script src="pwa.js"></script>'), "missing PWA registration script");
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
    assert(icon.purpose === "any", "generated icons should not claim maskable support");
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
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
  ];

  expectedAssets.forEach(function eachAsset(asset) {
    assert(serviceWorker.includes('"' + asset + '"'), "missing cached asset " + asset);
  });
});

test("service worker avoids cache-first navigation responses", function () {
  const serviceWorker = readProjectFile("service-worker.js");

  assert(serviceWorker.includes('request.mode === "navigate"'), "expected explicit navigation handling");
  assert(serviceWorker.includes("useFreshNavigation"), "expected network-first navigation strategy");
  assert(!serviceWorker.includes("cacheFirstForAppShell"), "unexpected cache-first fetch handler name");
});
