/**
 * run_all.mjs - Unified Automated Browser Test Suite Orchestrator
 * Executes all 7 browser test suites sequentially using host Google Chrome via native CDP.
 * Aggregates results, captures failure screenshots, logs summary metrics, and exits with 0 on pass or 1 on fail.
 */
import fs from "fs";
import path from "path";
import { BrowserHarness, BASE_URL } from "./harness.mjs";
import { runUploadTests } from "./test_upload.mjs";
import { runMatchingTableTests } from "./test_matching_table.mjs";
import { runMatchingDetailTests } from "./test_matching_detail.mjs";
import { runPdfStreamingTests } from "./test_pdf_streaming.mjs";
import { runTableHighlightsTest } from "./test_table_highlights.mjs";
import { testFieldSwitchHighlights } from "./test_field_switch_highlights.mjs";
import { runZoomAndPaddingTests } from "./test_zoom_and_padding.mjs";

const ARTIFACTS_DIR = path.resolve("tests/browser/artifacts");

const SUITES = [
  {
    name: "Tier 1/2: /upload Route & Form Verification",
    fn: runUploadTests,
    id: "test_upload",
  },
  {
    name: "Tier 1/2: /matching Batch Table & Filters",
    fn: runMatchingTableTests,
    id: "test_matching_table",
  },
  {
    name: "Tier 3: MatchingDetailView Modal & Document Switcher",
    fn: runMatchingDetailTests,
    id: "test_matching_detail",
  },
  {
    name: "Tier 4: PDF Streaming & Canvas Rasterization",
    fn: runPdfStreamingTests,
    id: "test_pdf_streaming",
  },
  {
    name: "Tier 5: Table Bounding Boxes & Grid Overlay",
    fn: runTableHighlightsTest,
    id: "test_table_highlights",
  },
  {
    name: "Tier 6: Field Switch Highlight Isolation",
    fn: testFieldSwitchHighlights,
    id: "test_field_switch_highlights",
  },
  {
    name: "Tier 7: Auto-Zoom Centering & Bounding Box Padding",
    fn: runZoomAndPaddingTests,
    id: "test_zoom_and_padding",
  },
];

async function main() {
  console.log("=====================================================================");
  console.log("  USC-Middleware Automated In-Browser Verification Suite");
  console.log(`  Target Base URL : ${BASE_URL}`);
  console.log("  Automation Engine: Zero-Dependency Native Node.js 24 CDP Runner");
  console.log("  Target Browser  : Google Chrome (Host)");
  console.log("=====================================================================\n");

  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const suiteResults = [];
  const globalStart = Date.now();
  let anyFailed = false;

  const harness = new BrowserHarness();
  try {
    console.log("Launching headless Google Chrome...");
    await harness.launch();
    console.log("Browser connected via CDP WebSocket.\n");

    // Authenticate browser session via direct session cookie injection
    console.log("Authenticating browser session as Admin via CDP Network.setCookie...");
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
    const csrfData = await csrfRes.json();
    const csrfCookie = csrfRes.headers.get("set-cookie")?.split(";")[0] || "";

    const formParams = new URLSearchParams({
      csrfToken: csrfData.csrfToken,
      email: "admin@docmatch.id",
      password: "password123",
      redirect: "false",
    }).toString();

    const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: csrfCookie,
      },
      body: formParams,
    });

    const setCookieHeaders = loginRes.headers.getSetCookie?.() || [];
    for (const rawCookie of setCookieHeaders) {
      const [nameVal] = rawCookie.split(";");
      const [name, ...valParts] = nameVal.split("=");
      const val = valParts.join("=");
      if (name && val) {
        await harness.send("Network.setCookie", {
          name: name.trim(),
          value: val.trim(),
          domain: "localhost",
          path: "/",
        });
      }
    }
    console.log("Browser authenticated successfully via cookie injection.\n");

    for (const suite of SUITES) {
      const suiteStart = Date.now();
      harness.clearBuffers();

      try {
        await suite.fn(harness);
        const duration = Date.now() - suiteStart;
        suiteResults.push({
          id: suite.id,
          name: suite.name,
          status: "PASSED",
          durationMs: duration,
          error: null,
        });
        console.log(`  [OK] ${suite.name} completed successfully in ${(duration / 1000).toFixed(2)}s.\n`);
      } catch (err) {
        anyFailed = true;
        const duration = Date.now() - suiteStart;
        const screenshotPath = path.join(ARTIFACTS_DIR, `failure_${suite.id}_${Date.now()}.png`);
        try {
          await harness.captureScreenshot(screenshotPath);
          console.error(`  Captured failure screenshot: ${screenshotPath}`);
        } catch {}

        suiteResults.push({
          id: suite.id,
          name: suite.name,
          status: "FAILED",
          durationMs: duration,
          error: err.message,
          screenshot: screenshotPath,
        });
        console.error(`  [FAIL] ${suite.name} FAILED: ${err.message}\n`);
      }
    }
  } finally {
    harness.close();
    console.log("Chrome session closed and temporary user profile cleaned.");
  }

  const totalDuration = Date.now() - globalStart;
  const passedCount = suiteResults.filter((r) => r.status === "PASSED").length;
  const failedCount = suiteResults.filter((r) => r.status === "FAILED").length;

  // Print Summary Table
  console.log("\n=====================================================================");
  console.log("                     TEST SUITE EXECUTION SUMMARY                    ");
  console.log("=====================================================================");
  for (const r of suiteResults) {
    const icon = r.status === "PASSED" ? "[PASS]" : "[FAIL]";
    const time = `${(r.durationMs / 1000).toFixed(2)}s`.padStart(7);
    console.log(`  ${icon} [${time}] ${r.name}`);
    if (r.error) {
      console.log(`         Error: ${r.error}`);
    }
  }
  console.log("---------------------------------------------------------------------");
  console.log(
    `  Total Suites: ${SUITES.length} | Passed: ${passedCount} | Failed: ${failedCount} | Duration: ${(
      totalDuration / 1000
    ).toFixed(2)}s`
  );
  console.log("=====================================================================\n");

  // Write summary.json
  const summaryJson = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalSuites: SUITES.length,
    passed: passedCount,
    failed: failedCount,
    totalDurationMs: totalDuration,
    results: suiteResults,
  };
  const summaryPath = path.join(ARTIFACTS_DIR, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summaryJson, null, 2));
  console.log(`Report summary saved to: ${summaryPath}`);

  if (anyFailed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error in test runner:", err);
  process.exit(1);
});
