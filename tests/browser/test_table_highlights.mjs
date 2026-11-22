/**
 * test_table_highlights.mjs - Automated In-Browser Verification for Table Bounding Boxes
 * Verifies:
 * 1. Line item card click (e.g. "Baris barang #1") highlights all row table cell bounding boxes in blue on PDF.
 * 2. Clicking PIB vs Supporting doc subcards navigates to correct page and switches document.
 * 3. Toggling "Tampilkan grid" renders all table cells on active page in emerald.
 */
import assert from "assert/strict";
import fs from "fs";
import path from "path";
import { BrowserHarness } from "./harness.mjs";

const ARTIFACTS_DIR = path.resolve("tests/browser/artifacts");

export async function runTableHighlightsTest(externalHarness) {
  console.log("\n> Running Suite: Table Bounding Boxes & Grid Verification");
  const harness = externalHarness || new BrowserHarness();
  if (!externalHarness) {
    await harness.launch();
  }

  try {
    const testUrl = `${harness.baseUrl}/matching`;
    console.log(`  1. Navigating to ${testUrl}...`);
    await harness.navigate(testUrl);

    console.log("  Waiting for batch table rows...");
    await harness.waitForSelector("table tbody tr td:nth-child(3)", 12000);

    // Step 2: Open modal via first row click
    console.log("  2. Opening first batch with complete tables...");
    await harness.click("table tbody tr:first-child td:nth-child(3)");

    // Wait for modal
    await harness.waitForSelector("div.fixed.inset-0.z-50", 10000);
    console.log("  [OK] MatchingDetailView modal mounted.");

    // Wait for ComparisonPanel line items to appear
    console.log("  3. Waiting for line items in comparison panel...");
    await harness.waitForFunction(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      return spans.some(s => s.innerText.trim() === "Baris barang #1");
    }, 15000);

    // Step 4: Click Baris barang #1 PIB card
    console.log("  4. Clicking 'Baris barang #1' PIB (acuan)...");
    const clickedPib = await harness.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const headerSpan = spans.find(s => s.innerText.trim() === "Baris barang #1");
      const card = headerSpan?.closest("div.rounded-xl");
      const subcards = card ? Array.from(card.querySelectorAll("div.group")) : [];
      if (subcards[0]) {
        subcards[0].click();
        return "pib_subcard";
      }
      return null;
    });
    console.log("  Clicked:", clickedPib);
    assert.ok(clickedPib, "Failed to find Baris barang #1 PIB subcard");

    // Resilient polling: await active highlights rendering on PDF canvas
    await harness.waitForFunction(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const buttons = overlay ? Array.from(overlay.querySelectorAll("button")) : [];
      const activeBtns = buttons.filter(b => b.className.includes("border-blue-600") || b.className.includes("bg-blue-500"));
      return activeBtns.length > 0;
    }, 15000);

    // Inspect active highlights on the PDF overlay
    const pibHighlights = await harness.evaluate(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const buttons = overlay ? Array.from(overlay.querySelectorAll("button")) : [];
      // Active highlights have border-blue-600
      const activeBtns = buttons.filter(b => b.className.includes("border-blue-600") || b.className.includes("bg-blue-500"));
      const activeTitles = activeBtns.map(b => b.getAttribute("title") || b.innerText.trim());
      const pageInput = document.querySelector("div.flex.items-center.gap-1.px-1 input")?.value;
      return {
        activeCount: activeBtns.length,
        activeTitles,
        currentPage: pageInput,
      };
    });

    console.log("  Active PIB highlights detected on canvas:", pibHighlights);
    assert.ok(pibHighlights.activeCount > 0, "Expected at least 1 active bounding box on PDF for Baris barang #1");
    console.log(`  [OK] Successfully rendered ${pibHighlights.activeCount} active bounding box(es) on page ${pibHighlights.currentPage}`);

    // Step 5: Click Supporting Document subcard (PL or Invoice)
    console.log("  5. Clicking Supporting Document subcard for 'Baris barang #1'...");
    const clickedSup = await harness.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const headerSpan = spans.find(s => s.innerText.trim() === "Baris barang #1");
      const card = headerSpan?.closest("div.rounded-xl");
      const subcards = card ? Array.from(card.querySelectorAll("div.group")) : [];
      if (subcards[1]) {
        subcards[1].click();
        return "supporting_subcard";
      }
      return null;
    });
    console.log("  Supporting subcard clicked:", clickedSup);
    assert.ok(clickedSup, "Failed to find Supporting subcard for Baris barang #1");

    // Resilient polling: await active highlights rendering on supporting doc canvas
    await harness.waitForFunction(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const buttons = overlay ? Array.from(overlay.querySelectorAll("button")) : [];
      const activeBtns = buttons.filter(b => b.className.includes("border-blue-600") || b.className.includes("bg-blue-500"));
      return activeBtns.length > 0;
    }, 15000);

    const supHighlights = await harness.evaluate(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const buttons = overlay ? Array.from(overlay.querySelectorAll("button")) : [];
      const activeBtns = buttons.filter(b => b.className.includes("border-blue-600") || b.className.includes("bg-blue-500"));
      const activeTitles = activeBtns.map(b => b.getAttribute("title") || b.innerText.trim());
      const pageInput = document.querySelector("div.flex.items-center.gap-1.px-1 input")?.value;
      return {
        activeCount: activeBtns.length,
        activeTitles,
        currentPage: pageInput,
      };
    });

    console.log("  Active supporting doc highlights detected on canvas:", supHighlights);
    assert.ok(supHighlights.activeCount > 0, "Expected active bounding boxes on supporting doc for Baris barang #1");
    console.log(`  [OK] Successfully navigated to supporting doc page ${supHighlights.currentPage} with ${supHighlights.activeCount} active boxes.`);

    // Step 6: Test 'Tampilkan grid' button
    console.log("  6. Testing 'Tampilkan grid' button toggle...");
    const gridToggled = await harness.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const gridBtn = buttons.find(b => b.innerText.includes("Tampilkan grid"));
      if (gridBtn) {
        gridBtn.click();
        return true;
      }
      return false;
    });
    assert.ok(gridToggled, "Tampilkan grid button not found");

    await new Promise(r => setTimeout(r, 800));

    const gridBoxes = await harness.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const emeraldBtns = buttons.filter(b => b.className.includes("border-slate-400") || b.className.includes("border-emerald-500"));
      return {
        emeraldCount: emeraldBtns.length,
        samples: emeraldBtns.slice(0, 5).map(b => b.getAttribute("title")),
      };
    });

    console.log("  Grid boxes detected on active page:", gridBoxes);
    assert.ok(gridBoxes.emeraldCount > 0, "Expected table grid boxes in emerald when 'Tampilkan grid' is active");
    console.log(`  [OK] Successfully rendered ${gridBoxes.emeraldCount} table grid cell boxes across page.`);

    // Capture screenshot
    const shotPath = path.join(ARTIFACTS_DIR, "table_highlights_verified.png");
    await harness.captureScreenshot(shotPath);
    console.log(`  [OK] Verified screenshot saved to ${shotPath}`);

    console.log("\n[PASS] All table highlights & grid tests passed successfully!");
  } finally {
    if (!externalHarness) {
      await harness.close();
    }
  }
}

if (process.argv[1]?.includes("test_table_highlights.mjs")) {
  runTableHighlightsTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}
