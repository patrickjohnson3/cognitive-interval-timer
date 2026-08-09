const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const ROOT = process.env.APP_ROOT || path.join(__dirname, "..");
const CHROME_CANDIDATES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "/usr/bin/google-chrome",
];

function findExecutableOnPath(name) {
  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function chromeBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

  for (const candidate of CHROME_CANDIDATES) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
    if (!path.isAbsolute(candidate)) {
      const resolved = findExecutableOnPath(candidate);
      if (resolved) return resolved;
    }
  }

  throw new Error("Chrome not found. Set CHROME_BIN to run the PWA offline smoke test.");
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".webmanifest")) return "application/manifest+json; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function startServer() {
  const server = http.createServer(function handleRequest(req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = path.normalize(path.join(ROOT, pathname));

    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(file, function sendFile(err, body) {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      res.writeHead(200, { "content-type": contentType(file) });
      res.end(body);
    });
  });

  return new Promise(function listen(resolve) {
    server.listen(0, "127.0.0.1", function onListening() {
      resolve(server);
    });
  });
}

function waitForDevTools(chrome) {
  return new Promise(function wait(resolve, reject) {
    let output = "";
    const timeout = setTimeout(function onTimeout() {
      reject(new Error("Timed out waiting for Chrome DevTools endpoint"));
    }, 10000);

    function inspect(chunk) {
      output += String(chunk);
      const match = output.match(/DevTools listening on (ws:\/\/.*)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1].trim());
      }
    }

    chrome.stderr.on("data", inspect);
    chrome.stdout.on("data", inspect);
    chrome.on("exit", function onExit(code) {
      clearTimeout(timeout);
      reject(new Error("Chrome exited before DevTools was ready: " + code));
    });
  });
}

function httpJSON(url) {
  return fetch(url).then(function parseResponse(response) {
    if (!response.ok) throw new Error("Request failed: " + url);
    return response.json();
  });
}

function createCDP(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();

  socket.addEventListener("message", function onMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result || {});
    }
  });

  function send(method, params) {
    id += 1;
    socket.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise(function waitForResponse(resolve, reject) {
      pending.set(id, { resolve, reject });
    });
  }

  return new Promise(function waitForOpen(resolve, reject) {
    socket.addEventListener("open", function onOpen() {
      resolve({
        send,
        close: function close() {
          socket.close();
        },
      });
    });
    socket.addEventListener("error", function onError() {
      reject(new Error("Failed to connect to Chrome DevTools"));
    });
  });
}

async function launchChrome(url, userDataDir) {
  const chrome = childProcess.spawn(chromeBinary(), [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    "--user-data-dir=" + userDataDir,
    url,
  ]);

  const devToolsUrl = await waitForDevTools(chrome);
  return { chrome, devToolsUrl };
}

async function evaluateValue(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const exception = result.exceptionDetails.exception;
    const details =
      (exception && exception.description) || result.exceptionDetails.text || "unknown error";
    throw new Error("Browser evaluation failed: " + details);
  }
  return result.result && result.result.value;
}

async function evaluateAfterNavigation(client, expression) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await evaluateValue(client, expression);
    } catch (err) {
      if (!/context was destroyed|Cannot find context/i.test(err.message)) throw err;
      await new Promise(function waitForReplacementContext(resolve) {
        setTimeout(resolve, 100);
      });
    }
  }
  throw new Error("Page execution context did not stabilize");
}

async function waitForPageReady(client) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const ready = await evaluateValue(
        client,
        'document.readyState === "complete" && "serviceWorker" in navigator'
      );
      if (ready) return;
    } catch (err) {
      if (!/context was destroyed|Cannot find context/i.test(err.message)) throw err;
    }
    await new Promise(function waitForPage(resolve) {
      setTimeout(resolve, 100);
    });
  }
  throw new Error("App page did not become service-worker ready");
}

async function waitForCondition(client, expression, message) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await evaluateAfterNavigation(client, expression)) return;
    await new Promise(function waitForConditionRetry(resolve) {
      setTimeout(resolve, 100);
    });
  }
  throw new Error(message);
}

async function settleLayout(client) {
  await evaluateValue(
    client,
    "new Promise(function (resolve) { requestAnimationFrame(function () { resolve(true); }); })"
  );
}

async function pressKey(client, key, code, virtualKeyCode, text) {
  const params = {
    key,
    code,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  };
  if (text) {
    params.text = text;
    params.unmodifiedText = text;
  }
  await client.send(
    "Input.dispatchKeyEvent",
    Object.assign({ type: text ? "keyDown" : "rawKeyDown" }, params)
  );
  await client.send("Input.dispatchKeyEvent", Object.assign({ type: "keyUp" }, params));
}

async function assertInteractiveAccessibility(client) {
  const fieldsOkay = await evaluateValue(
    client,
    `(() => {
      const ids = ["prep", "focus", "recall", "break", "long_break", "blocks_per_ultradian"];
      return ids.every((id) => {
        const input = document.getElementById(id);
        const description = input.getAttribute("aria-describedby");
        return input.labels.length === 1 &&
          input.labels[0].htmlFor === id &&
          Boolean(description && document.getElementById(description)?.textContent.trim());
      });
    })()`
  );
  if (!fieldsOkay) throw new Error("Duration fields do not have explicit labels and units");

  const tooltipOpened = await evaluateValue(
    client,
    `(() => {
      const trigger = document.querySelector(".tip-trigger");
      const bubble = trigger.closest(".tip-wrap").querySelector(".tip-bubble");
      trigger.focus();
      return document.activeElement === trigger && !bubble.hidden;
    })()`
  );
  if (!tooltipOpened) throw new Error("Keyboard focus did not open the tooltip");
  await pressKey(client, "Escape", "Escape", 27);
  const tooltipDismissed = await evaluateValue(
    client,
    `(() => {
      const trigger = document.querySelector(".tip-trigger");
      const bubble = trigger.closest(".tip-wrap").querySelector(".tip-bubble");
      return document.activeElement === trigger && bubble.hidden;
    })()`
  );
  if (!tooltipDismissed) throw new Error("Escape did not dismiss the tooltip and preserve focus");

  await evaluateValue(
    client,
    `(() => {
      document.documentElement.setAttribute("data-minimal-mode", "true");
      const reveal = document.getElementById("minimal-exit-reveal");
      reveal.focus();
      reveal.click();
      return true;
    })()`
  );
  await pressKey(client, "Tab", "Tab", 9);
  const minimalActionReached = await evaluateValue(
    client,
    `document.activeElement?.id === "minimal-primary-action" &&
      document.activeElement.getAttribute("aria-label") === "Start timer"`
  );
  if (!minimalActionReached) throw new Error("Minimal timer action is not the next keyboard stop");

  await pressKey(client, "Enter", "Enter", 13, "\r");
  await evaluateValue(
    client,
    "new Promise(function (resolve) { setTimeout(function () { resolve(true); }, 100); })"
  );
  const minimalActionWorked = await evaluateValue(
    client,
    `document.querySelector("#minimal-primary-action .control-label").textContent === "Pause"`
  );
  if (!minimalActionWorked) throw new Error("Minimal timer action did not start the timer");

  await evaluateValue(
    client,
    `(() => {
      document.getElementById("restart-minimal-block").click();
      document.documentElement.removeAttribute("data-minimal-mode");
      return true;
    })()`
  );
}

async function assertTimerPersistence(client, appUrl) {
  const persisted = await evaluateValue(
    client,
    `(() => {
      const label = document.querySelector("#start .control-label");
      if (label.textContent !== "Start") return null;
      document.getElementById("start").click();
      return true;
    })()`
  );
  if (!persisted) throw new Error("Timer persistence workflow did not begin from idle");

  await waitForCondition(
    client,
    'document.querySelector("#start .control-label")?.textContent === "Pause"',
    "Timer did not start"
  );
  await evaluateValue(client, 'document.getElementById("start").click(); true');
  await waitForCondition(
    client,
    `(() => {
      const saved = JSON.parse(localStorage.getItem("better_pomodoro_session_v2"));
      return document.querySelector("#start .control-label")?.textContent === "Resume" &&
        saved.timer.status === "paused" && saved.timer.focusBlockNumber === 1 &&
        saved.timer.remainingSec > 0;
    })()`,
    "Paused timer state was not persisted"
  );
  const remainingBeforeReload = await evaluateValue(
    client,
    'JSON.parse(localStorage.getItem("better_pomodoro_session_v2")).timer.remainingSec'
  );

  await client.send("Page.navigate", { url: appUrl });
  await waitForPageReady(client);
  await waitForCondition(
    client,
    'document.querySelector("#start .control-label")?.textContent === "Resume"',
    "Reloaded timer did not restore the paused state"
  );
  const restored = await evaluateValue(
    client,
    `(() => {
      const saved = JSON.parse(localStorage.getItem("better_pomodoro_session_v2"));
      return saved.timer.status === "paused" && saved.timer.focusBlockNumber === 1 &&
        Math.abs(saved.timer.remainingSec - ${JSON.stringify(remainingBeforeReload)}) < 0.001;
    })()`
  );
  if (!restored) throw new Error("Reloaded timer did not preserve its remaining time");

  await evaluateValue(client, 'document.getElementById("reset").click(); true');
  await waitForCondition(
    client,
    'document.querySelector("#start .control-label")?.textContent === "Start"',
    "Timer did not return to idle after persistence workflow"
  );
}

async function assertCombinedBackNavigation(client) {
  const entered = await evaluateValue(
    client,
    `(() => {
      window.__smokePopstateCount = 0;
      window.addEventListener("popstate", function countSmokePopstate() {
        window.__smokePopstateCount += 1;
      }, { once: true });
      document.getElementById("open-settings").click();
      const minimal = document.getElementById("minimal_mode_enabled");
      minimal.checked = true;
      minimal.dispatchEvent(new Event("change", { bubbles: true }));
      return document.documentElement.hasAttribute("data-minimal-mode") &&
        history.state?.appState === "minimal-mode";
    })()`
  );
  if (!entered) throw new Error("Settings-to-minimal history workflow did not initialize");

  await evaluateValue(client, "history.back(); true");
  await waitForCondition(
    client,
    `!document.documentElement.hasAttribute("data-minimal-mode") &&
      history.state === null && window.__smokePopstateCount === 1`,
    "One Back action did not exit minimal mode cleanly"
  );
  const restored = await evaluateValue(
    client,
    `(() => {
      return !document.getElementById("session-view").hidden &&
        document.getElementById("settings-view").hidden &&
        !document.getElementById("minimal_mode_enabled").checked &&
        document.activeElement?.id === "start";
    })()`
  );
  if (!restored) throw new Error("Back did not restore the timer after minimal mode");
}

async function assertSettingsNavigation(client) {
  const initialStateOkay = await evaluateValue(
    client,
    `(() => {
      const session = document.getElementById("session-view");
      const settings = document.getElementById("settings-view");
      const trigger = document.getElementById("open-settings");
      return !session.hidden && settings.hidden && trigger.getAttribute("aria-expanded") === "false";
    })()`
  );
  if (!initialStateOkay) throw new Error("Timer should be the initial view");

  const openedStateOkay = await evaluateValue(
    client,
    `(() => {
      const trigger = document.getElementById("open-settings");
      trigger.click();
      return document.getElementById("session-view").hidden &&
        !document.getElementById("settings-view").hidden &&
        trigger.getAttribute("aria-expanded") === "true" &&
        document.activeElement?.id === "settings-view-heading";
    })()`
  );
  if (!openedStateOkay) throw new Error("Settings did not open as a focused dedicated view");

  const tooltipsFit = await evaluateValue(
    client,
    `(() => {
      return ["prep-default-tip", "blocks-default-tip"].every((tooltipId) => {
        const bubble = document.getElementById(tooltipId);
        const trigger = document.querySelector('[aria-describedby="' + tooltipId + '"]');
        trigger.scrollIntoView({ block: "center" });
        trigger.focus();
        const rect = bubble.getBoundingClientRect();
        const fits = !bubble.hidden && rect.left >= 0 && rect.right <= window.innerWidth;
        trigger.blur();
        return fits;
      });
    })()`
  );
  if (!tooltipsFit) throw new Error("A mobile settings tooltip extends past the viewport");

  const settingsScaleOkay = await evaluateValue(
    client,
    `(() => {
      document.documentElement.style.fontSize = "200%";
      const header = document.querySelector(".settings-view-header");
      const back = document.getElementById("close-settings");
      const rect = back.getBoundingClientRect();
      const fits = rect.left >= 0 && rect.right <= window.innerWidth && rect.width > 0 &&
        header.scrollWidth <= header.clientWidth;
      document.documentElement.style.fontSize = "";
      return fits;
    })()`
  );
  if (!settingsScaleOkay) throw new Error("Settings header clips controls at 200% text size");

  const settingsTargetsOkay = await evaluateValue(
    client,
    `(() => {
      const controls = Array.from(
        document.querySelectorAll(
          ".settings button, .settings input[type='number'], .settings select, .settings .checks label"
        )
      ).filter((node) => !node.hidden && getComputedStyle(node).display !== "none");
      return controls.length > 0 && controls.every((node) => node.getBoundingClientRect().height >= 44);
    })()`
  );
  if (!settingsTargetsOkay) throw new Error("A mobile Settings target is smaller than 44px");

  const settingsScrollOkay = await evaluateValue(
    client,
    `(() => {
      const settings = document.getElementById("settings-view");
      const header = document.querySelector(".settings-view-header");
      const outerHeader = document.querySelector(".header");
      settings.scrollTop = settings.scrollHeight;
      const settingsRect = settings.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const settingsStyle = getComputedStyle(settings);
      return {
        outerHeaderDisplay: getComputedStyle(outerHeader).display,
        scrollTop: settings.scrollTop,
        clientHeight: settings.clientHeight,
        viewportHeight: window.innerHeight,
        headerTop: headerRect.top,
        settingsTop: settingsRect.top,
        settingsPaddingTop: parseFloat(settingsStyle.paddingTop)
      };
    })()`
  );
  if (
    settingsScrollOkay.outerHeaderDisplay !== "none" ||
    settingsScrollOkay.scrollTop <= 0 ||
    settingsScrollOkay.clientHeight > settingsScrollOkay.viewportHeight ||
    Math.abs(
      settingsScrollOkay.headerTop -
        settingsScrollOkay.settingsTop -
        settingsScrollOkay.settingsPaddingTop
    ) >= 1
  ) {
    throw new Error(
      "Settings is not an independent sticky scroll view: " + JSON.stringify(settingsScrollOkay)
    );
  }

  await evaluateValue(client, 'document.getElementById("settings-view-heading").focus(); true');

  await pressKey(client, "Escape", "Escape", 27);
  const closedStateOkay = await evaluateValue(
    client,
    `(() => {
      const trigger = document.getElementById("open-settings");
      return !document.getElementById("session-view").hidden &&
        document.getElementById("settings-view").hidden &&
        trigger.getAttribute("aria-expanded") === "false" &&
        document.activeElement === trigger;
    })()`
  );
  if (!closedStateOkay) throw new Error("Closing settings did not restore timer focus");
}

async function assertResponsiveUI(client) {
  for (const viewport of [
    { width: 320, height: 568, type: "portraitPrimary", angle: 0 },
    { width: 568, height: 320, type: "landscapePrimary", angle: 90 },
  ]) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: true,
      screenOrientation: { type: viewport.type, angle: viewport.angle },
    });
    await settleLayout(client);
    const primaryAction = await evaluateValue(
      client,
      `(() => {
        const rect = document.getElementById("start").getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          viewportHeight: window.innerHeight,
          headerBottom: document.querySelector(".header").getBoundingClientRect().bottom,
          panelTop: document.querySelector(".session-panel").getBoundingClientRect().top,
          hintBottom: document.getElementById("hint").getBoundingClientRect().bottom,
          summaryBottom: document.getElementById("cycle-summary").getBoundingClientRect().bottom
        };
      })()`
    );
    if (primaryAction.top < 0 || primaryAction.bottom > primaryAction.viewportHeight) {
      throw new Error(
        "Primary timer action is below the initial compact viewport: " +
          JSON.stringify({ viewport: viewport, action: primaryAction })
      );
    }

    if (viewport.type === "landscapePrimary") {
      const enlargedTextChecks = await evaluateValue(
        client,
        `(() => {
          document.documentElement.style.fontSize = "200%";
          const targets = [
            document.querySelector(".app"),
            document.querySelector(".header"),
            document.querySelector(".header-actions"),
            document.getElementById("open-settings"),
            document.querySelector(".main"),
            document.querySelector(".session-panel"),
            document.querySelector(".controls")
          ];
          const rectsFit = targets.every((target) => {
            const rect = target.getBoundingClientRect();
            return rect.left >= 0 && rect.right <= window.innerWidth;
          });
          const fits = document.documentElement.scrollWidth <= window.innerWidth && rectsFit;
          document.documentElement.style.fontSize = "";
          return fits;
        })()`
      );
      if (!enlargedTextChecks) {
        throw new Error("Short-landscape layout clips content at 200% text size");
      }
    }
  }

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenOrientation: { type: "portraitPrimary", angle: 0 },
  });
  await settleLayout(client);

  const portraitChecks = await evaluateValue(
    client,
    `(() => {
      const buttons = Array.from(document.querySelectorAll(".controls button"));
      const longHint = getComputedStyle(document.querySelector(".long-hint"));
      const hiddenFocusable = Array.from(document.querySelectorAll('[aria-hidden="true"]')).some(
        (node) => node.querySelector("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])")
      );
      const cycleSummary = document.getElementById("cycle-summary");
      return {
        fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
        controlTargets: buttons.every((button) => button.getBoundingClientRect().height >= 48),
        readableGuidance: parseFloat(longHint.lineHeight) / parseFloat(longHint.fontSize) >= 1.5,
        hiddenContentSafe: !hiddenFocusable,
        cycleSummary: cycleSummary.textContent.replace(/\\s+/g, " ").trim(),
        settingsLabels: Boolean(document.getElementById("label-timer-flow-settings")) &&
          Boolean(document.getElementById("label-display-settings"))
      };
    })()`
  );
  const portraitOkay =
    portraitChecks.fitsViewport &&
    portraitChecks.controlTargets &&
    portraitChecks.readableGuidance &&
    portraitChecks.hiddenContentSafe &&
    portraitChecks.cycleSummary === "45 focus · 3 recall · 15 break" &&
    portraitChecks.settingsLabels;
  if (!portraitOkay) {
    throw new Error("Rendered portrait checks failed: " + JSON.stringify(portraitChecks));
  }

  await assertSettingsNavigation(client);
  await assertInteractiveAccessibility(client);

  const minimalOkay = await evaluateValue(
    client,
    `(() => {
      document.documentElement.setAttribute("data-minimal-mode", "true");
      const panel = document.querySelector(".panel");
      const handle = document.getElementById("minimal-exit-reveal");
      const state = getComputedStyle(document.getElementById("state"));
      const time = getComputedStyle(document.getElementById("time"));
      const hint = getComputedStyle(document.getElementById("hint"));
      const handleRect = handle.getBoundingClientRect();
      return panel.getBoundingClientRect().height >= window.innerHeight &&
        Math.abs(handleRect.left + handleRect.width / 2 - window.innerWidth / 2) < 1 &&
        parseFloat(time.fontSize) > parseFloat(hint.fontSize) &&
        parseFloat(hint.fontSize) > parseFloat(state.fontSize);
    })()`
  );
  if (!minimalOkay) throw new Error("Rendered minimal-mode layout checks failed");
  await evaluateValue(
    client,
    'document.documentElement.removeAttribute("data-minimal-mode"); true'
  );

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
    mobile: true,
    screenOrientation: { type: "landscapePrimary", angle: 90 },
  });
  await settleLayout(client);

  const landscapeChecks = await evaluateValue(
    client,
    `(() => {
      const columns = getComputedStyle(document.querySelector(".main")).gridTemplateColumns
        .split(" ")
        .filter(Boolean);
      const touchTargets = [
        document.getElementById("open-settings"),
        document.querySelector(".tip-trigger"),
        document.getElementById("start")
      ];
      const targets = touchTargets.map((target) => {
          const rect = target.getBoundingClientRect();
          return { id: target.id || target.className, width: rect.width, height: rect.height };
        });
      return {
        landscape: matchMedia("(orientation: landscape)").matches,
        columnCount: columns.length,
        fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
        coarsePointer: matchMedia("(any-pointer: coarse)").matches,
        targets,
        targetsLargeEnough: targets.every((target) => target.width >= 44 && target.height >= 44)
      };
    })()`
  );
  if (
    !landscapeChecks.landscape ||
    landscapeChecks.columnCount !== 1 ||
    !landscapeChecks.fitsViewport ||
    !landscapeChecks.targetsLargeEnough
  ) {
    throw new Error(
      "Rendered short-landscape layout checks failed: " + JSON.stringify(landscapeChecks)
    );
  }

  const minimalLandscapeOkay = await evaluateValue(
    client,
    `(() => {
      document.documentElement.setAttribute("data-minimal-mode", "true");
      const hint = document.getElementById("hint").getBoundingClientRect();
      const reveal = document.getElementById("minimal-exit-reveal").getBoundingClientRect();
      const validTarget = reveal.width >= 44 && reveal.height >= 44;
      const separated = hint.bottom + 4 <= reveal.top;
      document.documentElement.removeAttribute("data-minimal-mode");
      return separated && validTarget;
    })()`
  );
  if (!minimalLandscapeOkay) {
    throw new Error("Minimal controls overlap the phase guidance in short landscape");
  }

  const themesOkay = await evaluateValue(
    client,
    `(() => {
      document.documentElement.setAttribute("data-theme", "light");
      const lightScheme = getComputedStyle(document.documentElement).colorScheme;
      document.documentElement.setAttribute("data-theme", "dark");
      const darkScheme = getComputedStyle(document.documentElement).colorScheme;
      return lightScheme === "light" && darkScheme === "dark";
    })()`
  );
  if (!themesOkay) throw new Error("Rendered theme application checks failed");
}

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const appUrl = "http://127.0.0.1:" + port + "/index.html";
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pwa-smoke-"));
  const launched = await launchChrome(appUrl, userDataDir);
  const chrome = launched.chrome;
  const debugBaseUrl = launched.devToolsUrl
    .replace(/^ws:/, "http:")
    .replace(/\/devtools\/browser\/.*$/, "");
  const targets = await httpJSON(debugBaseUrl + "/json/list");
  const page = targets.find(function isPage(target) {
    return target.type === "page" && target.url === appUrl;
  });
  if (!page) throw new Error("Unable to find Chrome page target");

  const client = await createCDP(page.webSocketDebuggerUrl);
  try {
    await client.send("Page.enable");
    await client.send("Network.enable");
    await waitForPageReady(client);
    await evaluateAfterNavigation(
      client,
      "navigator.serviceWorker.ready.then(function () { return true; })"
    );
    await assertTimerPersistence(client, appUrl);
    await assertCombinedBackNavigation(client);
    await assertResponsiveUI(client);
    await client.send("Page.navigate", { url: appUrl });
    await new Promise(function waitForController(resolve) {
      setTimeout(resolve, 1000);
    });
    await client.send("Runtime.evaluate", {
      expression: "caches.keys().then(function (keys) { return keys.length > 0; })",
      awaitPromise: true,
    });
    await client.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await client.send("Page.navigate", { url: appUrl });
    await new Promise(function settle(resolve) {
      setTimeout(resolve, 1000);
    });
    const result = await client.send("Runtime.evaluate", {
      expression:
        "Boolean(document.querySelector('.app')) && document.title === 'Cognitive Interval Timer'",
      returnByValue: true,
    });

    if (!result.result || result.result.value !== true) {
      throw new Error("Offline app shell did not load");
    }

    await waitForCondition(
      client,
      'document.querySelector("#start .control-label")?.textContent === "Start"',
      "Offline app did not initialize its timer controls"
    );
    await evaluateValue(client, 'document.getElementById("start").click(); true');
    await waitForCondition(
      client,
      `(() => {
        const saved = JSON.parse(localStorage.getItem("better_pomodoro_session_v2"));
        return document.querySelector("#start .control-label")?.textContent === "Pause" &&
          saved.timer.status === "running" && saved.timer.focusBlockNumber === 1;
      })()`,
      "Offline timer did not start and persist"
    );
    await evaluateValue(client, 'document.getElementById("reset").click(); true');
  } finally {
    client.close();
    chrome.kill();
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch(function onError(err) {
  console.error(err.message);
  process.exitCode = 1;
});
