/**
 * harness.mjs - Zero-dependency Native Node.js CDP Browser Automation Harness
 * Connects to Google Chrome via Chrome DevTools Protocol (CDP) using native WebSocket & fetch.
 */
import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import net from "net";

const CHROME_PATH = process.env.CHROME_BIN || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

/**
 * Finds a free TCP port dynamically.
 */
async function getFreePort(defaultPort = 9222) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(defaultPort, "127.0.0.1", () => {
      server.close(() => resolve(defaultPort));
    });
    server.on("error", () => {
      const fallbackServer = net.createServer();
      fallbackServer.listen(0, "127.0.0.1", () => {
        const port = fallbackServer.address().port;
        fallbackServer.close(() => resolve(port));
      });
    });
  });
}

export class BrowserHarness {
  constructor(options = {}) {
    this.port = options.port || null;
    this.baseUrl = options.baseUrl || BASE_URL;
    this.headless = options.headless ?? true;
    this.tempProfile = path.join(
      os.tmpdir(),
      "usc_chrome_profile_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7)
    );
    this.chromeProc = null;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.consoleLogs = [];
    this.errors = [];
    this.networkErrors = [];
    this.networkResponses = [];
    this.dialogs = [];
    this.pdfRequests = [];
  }

  async launch() {
    if (!this.port) {
      this.port = await getFreePort(9225);
    }

    fs.mkdirSync(this.tempProfile, { recursive: true });

    const chromeArgs = [
      this.headless ? "--headless=new" : "--auto-open-devtools-for-tabs",
      `--remote-debugging-port=${this.port}`,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${this.tempProfile}`,
      "--window-size=1440,900",
      "about:blank",
    ];

    this.chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: "ignore" });

    // Poll for Chrome CDP endpoint
    let pages = null;
    const maxRetries = 40;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((r) => setTimeout(r, 150));
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/json/list`);
        if (res.ok) {
          pages = await res.json();
          if (Array.isArray(pages) && pages.length > 0) break;
        }
      } catch {}
    }

    const page = pages?.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
    if (!page) {
      this.close();
      throw new Error(`Failed to connect to Chrome CDP on port ${this.port}`);
    }

    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    this.setupListeners();

    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    // Enable essential CDP domains
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Network.enable");
    await this.send("DOM.enable");
  }

  setupListeners() {
    this.ws.onmessage = async (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
      }

      // Handle JavaScript Dialogs (e.g. alert, confirm, prompt)
      if (msg.method === "Page.javascriptDialogOpening") {
        const { message, type } = msg.params;
        this.dialogs.push({ message, type, timestamp: Date.now() });
        // Automatically dismiss dialogs so test execution is never blocked
        this.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
      }

      // Intercept browser console events
      if (msg.method === "Runtime.consoleAPICalled") {
        const type = msg.params.type;
        const text = msg.params.args
          .map((a) => {
            if (a.value !== undefined) return String(a.value);
            if (a.preview?.properties) {
              const msgProp = a.preview.properties.find((p) => p.name === "message");
              if (msgProp?.value) return `${a.className || "Error"}: ${msgProp.value}`;
            }
            return a.description ?? "";
          })
          .join(" ");
        this.consoleLogs.push({ type, text, timestamp: Date.now(), stack: msg.params.stackTrace });
        if (type === "error") {
          this.errors.push({ type: "console.error", text });
        }
      }

      // Intercept uncaught browser exceptions
      if (msg.method === "Runtime.exceptionThrown") {
        const text =
          msg.params.exceptionDetails.text +
          (msg.params.exceptionDetails.exception?.description || "");
        this.errors.push({ type: "exception", text });
      }

      // Intercept network responses
      if (msg.method === "Network.responseReceived") {
        const resp = msg.params.response;
        this.networkResponses.push(resp);

        // Track PDF streaming responses specifically
        if (resp.url.includes("/api/batches/") && resp.url.includes("/pdf")) {
          this.pdfRequests.push({
            url: resp.url,
            status: resp.status,
            statusText: resp.statusText,
            headers: resp.headers,
            mimeType: resp.mimeType,
          });
        }

        if (resp.status >= 500) {
          this.errors.push({
            type: "network_5xx",
            text: `${resp.status} on ${resp.url}`,
          });
        } else if (resp.status >= 400) {
          this.networkErrors.push({ status: resp.status, url: resp.url });
        }
      }
    };
  }

  send(method, params = {}) {
    const id = this.msgId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url, timeoutMs = 20000) {
    const navStart = Date.now();
    await this.send("Page.navigate", { url });
    // Await initial hydration and DOM settling
    await new Promise((r) => setTimeout(r, 1200));
    return Date.now() - navStart;
  }

  async evaluate(fnOrStr, ...args) {
    let expr;
    if (typeof fnOrStr === "function") {
      const serializedArgs = args.map((a) => JSON.stringify(a)).join(",");
      expr = `(${fnOrStr.toString()})(${serializedArgs})`;
    } else {
      expr = fnOrStr;
    }
    const res = await this.send("Runtime.evaluate", {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.result?.exceptionDetails) {
      const desc = res.result.exceptionDetails.exception?.description || res.result.exceptionDetails.text;
      throw new Error(`Browser evaluate error: ${desc}`);
    }
    return res.result?.result?.value;
  }

  async waitForFunction(fnOrStr, timeoutMs = 15000, intervalMs = 200) {
    const expr = typeof fnOrStr === "function" ? `(${fnOrStr.toString()})()` : fnOrStr;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await this.evaluate(expr);
        if (res) return true;
      } catch (err) {
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Timeout waiting for function condition after ${timeoutMs}ms`);
  }

  async waitForSelector(selector, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const exists = await this.evaluate(
        `Boolean(document.querySelector(${JSON.stringify(selector)}))`
      );
      if (exists) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Timeout waiting for selector: "${selector}" after ${timeoutMs}ms`);
  }

  async click(selector, timeoutMs = 10000) {
    await this.waitForSelector(selector, timeoutMs);
    return await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error("Element not found for click: " + ${JSON.stringify(selector)});
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
      el.click();
      return true;
    })()`);
  }

  async fill(selector, text, timeoutMs = 10000) {
    await this.waitForSelector(selector, timeoutMs);
    return await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error("Element not found for fill: " + ${JSON.stringify(selector)});
      el.value = ${JSON.stringify(text)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
  }

  /**
   * Sets files on an input[type="file"] element via CDP DOM.setFileInputFiles
   */
  async setInputFiles(selector, filePaths) {
    const absolutePaths = filePaths.map((p) => path.resolve(p));
    // Verify files exist locally
    for (const p of absolutePaths) {
      if (!fs.existsSync(p)) {
        throw new Error(`File to stage does not exist: ${p}`);
      }
    }

    const docRes = await this.send("DOM.getDocument");
    const rootNodeId = docRes.result?.root?.nodeId;
    if (!rootNodeId) {
      throw new Error("Failed to retrieve root DOM nodeId");
    }

    const queryRes = await this.send("DOM.querySelector", {
      nodeId: rootNodeId,
      selector,
    });
    const nodeId = queryRes.result?.nodeId;

    if (!nodeId) {
      throw new Error(`DOM node not found for file input: ${selector}`);
    }

    await this.send("DOM.setFileInputFiles", {
      files: absolutePaths,
      nodeId,
    });

    // Dispatch change event in DOM context
    await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el) {
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
  }

  /**
   * Simulates keyboard key press (e.g. "Escape", "Enter")
   */
  async pressKey(key) {
    await this.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
    });
    await new Promise((r) => setTimeout(r, 50));
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
    });
  }

  async captureScreenshot(destPath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    if (res.result?.data) {
      const dir = path.dirname(destPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(destPath, Buffer.from(res.result.data, "base64"));
      return destPath;
    }
    return null;
  }

  assertZeroErrors() {
    if (this.errors.length > 0) {
      const details = this.errors
        .map((e, i) => `[${i + 1}] ${e.type}: ${e.text}`)
        .join("\n");
      throw new Error(
        `Browser assertions failed: ${this.errors.length} unhandled errors detected:\n${details}`
      );
    }
  }

  clearBuffers() {
    this.errors = [];
    this.consoleLogs = [];
    this.networkResponses = [];
    this.networkErrors = [];
    this.pdfRequests = [];
    this.dialogs = [];
  }

  close() {
    try {
      if (this.ws) {
        this.ws.close();
      }
    } catch {}

    if (this.chromeProc && this.chromeProc.pid) {
      try {
        if (process.platform === "win32") {
          execSync(`taskkill /F /T /PID ${this.chromeProc.pid}`, { stdio: "ignore" });
        } else {
          this.chromeProc.kill("SIGKILL");
        }
      } catch {}
    }

    try {
      if (fs.existsSync(this.tempProfile)) {
        fs.rmSync(this.tempProfile, { recursive: true, force: true, maxRetries: 3 });
      }
    } catch {}
  }
}
