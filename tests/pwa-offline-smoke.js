const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CHROME_BIN = process.env.CHROME_BIN || "/usr/bin/google-chrome";

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
  const chrome = childProcess.spawn(CHROME_BIN, [
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
    return target.type === "page";
  });
  if (!page) throw new Error("Unable to find Chrome page target");

  const client = await createCDP(page.webSocketDebuggerUrl);
  try {
    await client.send("Page.enable");
    await client.send("Network.enable");
    await client.send("Runtime.evaluate", {
      expression: "navigator.serviceWorker.ready.then(function () { return true; })",
      awaitPromise: true,
    });
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
