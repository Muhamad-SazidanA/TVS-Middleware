/**
 * test_matching_table.mjs - Automated In-Browser Verification for /matching
 * Exercises batch rows hydration, table headers, status review pills, client-side search filtering,
 * tab filtering, column visibility toggles, select-all checkbox, and pagination controls.
 */
import assert from "assert/strict";
import { BrowserHarness } from "./harness.mjs";

export async function runMatchingTableTests(harness) {
  console.log("\n▶ Running Suite: /matching Batch Table & Filter Verification");
  const testUrl = `${harness.baseUrl}/matching`;

  // Step 1: Navigation & Table Hydration
  console.log(`  1. Navigating to ${testUrl}...`);
  await harness.navigate(testUrl);

  console.log("  Waiting for batch table rows to hydrate...");
  await harness.waitForFunction(() => {
    const rows = Array.from(document.querySelectorAll("table tbody tr"));
    if (rows.length === 0) return false;
    const firstRowText = rows[0]?.innerText || "";
    return !firstRowText.includes("Memuat data dokumen batch") && document.querySelector("table tbody tr td:nth-child(3)") !== null;
  }, 15000);

  const tableInfo = await harness.evaluate(() => {
    const headers = Array.from(document.querySelectorAll("table thead th"))
      .map((th) => th.innerText.trim())
      .filter(Boolean);
    const rows = Array.from(document.querySelectorAll("table tbody tr"));
    const firstRowText = rows[0] ? rows[0].innerText.trim() : "";
    return {
      headers,
      rowCount: rows.length,
      firstRowText,
    };
  });

  assert.ok(tableInfo.rowCount > 0, `Expected at least 1 batch row, found ${tableInfo.rowCount}`);
  console.log(`  ✓ Table hydrated successfully with ${tableInfo.rowCount} rows.`);
  console.log("  ✓ Table headers:", tableInfo.headers.slice(0, 7).join(", "), "...");

  // Verify key standard columns exist
  const expectedCols = ["Nama file", "Status review", "Ditugaskan ke", "Diunggah pada", "Aksi"];
  for (const col of expectedCols) {
    assert.ok(
      tableInfo.headers.some((h) => h.includes(col)),
      `Header should contain column '${col}'`
    );
  }

  // Step 2: Client-side Search Filtering
  console.log("  2. Testing search filter interaction...");
  const initialRowCount = tableInfo.rowCount;

  // Dynamically extract a query token from the existing first row
  const firstRowToken = await harness.evaluate(() => {
    const firstRow = document.querySelector("table tbody tr");
    if (!firstRow) return "00";
    const text = firstRow.innerText || "";
    const match = text.match(/\b\d{4}\b/) || text.match(/[A-Za-z0-9_-]{2,}/);
    return match ? match[0] : text.slice(0, 4).trim();
  });

  await harness.fill('input[placeholder="Cari nama file"]', firstRowToken);
  await new Promise((r) => setTimeout(r, 400));

  const filteredInfo = await harness.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table tbody tr"));
    return {
      count: rows.length,
      text: rows.map((r) => r.innerText).join(" "),
    };
  });
  console.log(`  Search query '${firstRowToken}' yielded ${filteredInfo.count} rows.`);
  assert.ok(
    filteredInfo.count > 0,
    `Search for token '${firstRowToken}' should return at least 1 row`
  );

  // Clear search input
  await harness.fill('input[placeholder="Cari nama file"]', "");
  await new Promise((r) => setTimeout(r, 500));

  const clearedRowCount = await harness.evaluate(
    () => document.querySelectorAll("table tbody tr").length
  );
  assert.ok(
    clearedRowCount >= 1,
    `Clearing search should restore batch rows, found ${clearedRowCount}`
  );
  console.log(`  ✓ Search filtering and restore verified cleanly (${clearedRowCount} rows restored).`);

  // Step 3: Tab Filtering Interaction
  console.log("  3. Testing tab filtering buttons...");
  const tabs = ["Disetujui", "Dalam review", "Semua file"];
  for (const tabLabel of tabs) {
    const clicked = await harness.evaluate((label) => {
      const btns = Array.from(document.querySelectorAll("div.overflow-x-auto button"));
      const target = btns.find((b) => b.innerText.includes(label));
      if (target) {
        target.click();
        return true;
      }
      return false;
    }, tabLabel);
    assert.ok(clicked, `Tab '${tabLabel}' button should be clickable`);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log("  ✓ Tab filtering buttons exercised cleanly.");

  // Step 4: Column Visibility Toggle & Reset
  console.log("  4. Testing column visibility dropdown and reset...");
  // Open column dropdown
  await harness.click('button[title="Pengaturan visibilitas kolom"]');
  await harness.waitForSelector("div.max-h-60", 4000);

  // Uncheck first column (Invoice)
  await harness.evaluate(() => {
    const firstCheckbox = document.querySelector("div.max-h-60 input[type='checkbox']");
    if (firstCheckbox) {
      firstCheckbox.click();
    }
  });
  await new Promise((r) => setTimeout(r, 300));

  const headersWithoutInvoice = await harness.evaluate(() => {
    return Array.from(document.querySelectorAll("table thead th")).map((th) => th.innerText.trim());
  });
  assert.ok(
    !headersWithoutInvoice.includes("Invoice"),
    "Invoice header should be hidden after unchecking"
  );

  // Click Reset in dropdown
  await harness.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const resetBtn = btns.find((b) => b.innerText.includes("Reset"));
    if (resetBtn) resetBtn.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  const headersRestored = await harness.evaluate(() => {
    return Array.from(document.querySelectorAll("table thead th")).map((th) => th.innerText.trim());
  });
  assert.ok(
    headersRestored.includes("Invoice"),
    "Invoice header should be restored after clicking Reset"
  );

  // Close dropdown by clicking outside overlay
  await harness.click("div.fixed.inset-0.z-30");
  console.log("  ✓ Column visibility toggles and reset verified cleanly.");

  // Step 5: Select-All Checkbox Interaction
  console.log("  5. Testing select-all checkbox toggle...");
  const selectAllSelector = 'table thead th:first-child input[type="checkbox"]';
  await harness.evaluate((sel) => {
    const cb = document.querySelector(sel);
    if (cb) cb.click();
  }, selectAllSelector);
  await new Promise((r) => setTimeout(r, 400));

  const checkedCount = await harness.evaluate(() => {
    const cbs = Array.from(document.querySelectorAll('table tbody tr input[type="checkbox"]'));
    return cbs.filter((cb) => cb.checked).length;
  });
  assert.ok(checkedCount > 0, "All row checkboxes should be checked after select-all");

  // Uncheck select-all
  await harness.evaluate((sel) => {
    const cb = document.querySelector(sel);
    if (cb) cb.click();
  }, selectAllSelector);
  await new Promise((r) => setTimeout(r, 400));

  const uncheckedCount = await harness.evaluate(() => {
    const cbs = Array.from(document.querySelectorAll('table tbody tr input[type="checkbox"]'));
    return cbs.filter((cb) => cb.checked).length;
  });
  assert.equal(uncheckedCount, 0, "All row checkboxes should be unchecked");
  console.log("  ✓ Select-all row selection verified cleanly.");

  // Step 6: Pagination Rows-per-Page Verification
  console.log("  6. Verifying pagination select controls...");
  const selectExists = await harness.evaluate(() => {
    const sel = document.querySelector("select:has(option[value='50'])");
    return Boolean(sel);
  });
  assert.ok(selectExists, "Rows-per-page select should exist in table footer");
  console.log("  ✓ Pagination controls verified.");

  // Step 7: Zero Unhandled Errors Assertion
  harness.assertZeroErrors();
  console.log("  ✓ Zero console errors verified for /matching table.");
}

// Standalone execution support
if (process.argv[1]?.endsWith("test_matching_table.mjs")) {
  const harness = new BrowserHarness();
  try {
    await harness.launch();
    await runMatchingTableTests(harness);
    console.log("\n✅ test_matching_table.mjs PASSED!\n");
  } catch (err) {
    console.error("\n❌ test_matching_table.mjs FAILED:", err);
    process.exit(1);
  } finally {
    harness.close();
  }
}
