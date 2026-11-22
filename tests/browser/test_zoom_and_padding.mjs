/**
 * test_zoom_and_padding.mjs - Automated In-Browser Verification for Auto-Zoom & Bounding Box Padding
 * Covers Milestone M3 & M4 capabilities:
 * 1. Initial overview zoom is 100% on batch modal open.
 * 2. Clicking a header field card triggers auto-zoom to 160% and smooth centering.
 * 3. Bounding box padding verification: inspect active bounding box styling
 *    (border-2 border-blue-600 bg-blue-500/15 ring-2 ring-blue-400/40, badge offset -top-4).
 * 4. Clicking a line item card navigates to target page (e.g. Page 2), auto-zooms to 160%, and highlights target cell.
 * 5. Zoom preservation: if user changes zoom to 145% or 175%, subsequent field/line item clicks keep the user's zoom.
 * 6. Upper zoom reset: if user zooms to 200%, subsequent field click resets zoom to 160%.
 * 7. Thumbnail navigation guard: verify manual thumbnail click to Page 1 is stable and not clobbered by background slot swaps.
 */
import assert from "assert/strict";
import path from "path";
import { BrowserHarness } from "./harness.mjs";

const ARTIFACTS_DIR = path.resolve("tests/browser/artifacts");

export async function runZoomAndPaddingTests(externalHarness) {
  console.log("\n> Running Suite: Auto-Zoom Centering & Bounding Box Padding Verification");
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

    // Open first batch modal
    console.log("  2. Opening first batch with complete documents...");
    await harness.click("table tbody tr:first-child td:nth-child(3)");

    await harness.waitForSelector("div.fixed.inset-0.z-50", 10000);
    console.log("  [OK] MatchingDetailView modal mounted.");

    // Dynamic wait for comparison panel cards and line items to be mounted
    console.log("  Waiting for comparison cards and viewer canvas...");
    await harness.waitForFunction(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const hasHeaderField = spans.some((s) =>
        s.innerText.trim().includes("1. Deskripsi barang") ||
        s.innerText.trim().includes("Identitas penjual") ||
        s.innerText.trim().includes("No invoice")
      );
      const hasLineItem = spans.some((s) => s.innerText.trim() === "Baris barang #1");
      const hasViewer = Boolean(document.querySelector("div.flex-1.flex.overflow-hidden.relative"));
      return hasHeaderField && hasLineItem && hasViewer;
    }, 15000);

    // Criterion 1: Initial overview zoom is 100% on batch modal open
    console.log("  3. Verifying initial overview zoom is 100%...");
    await harness.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      return zoomBtn?.innerText.trim() === "100%";
    }, 10000);

    const initialZoom = await harness.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      return zoomBtn ? zoomBtn.innerText.trim() : null;
    });
    assert.strictEqual(initialZoom, "100%", "Initial overview zoom on modal open must be 100%");
    console.log("  [OK] Initial overview zoom verified at 100%.");

    // Criterion 2: Clicking a header field card triggers auto-zoom to 160% and smooth centering
    console.log("  4. Clicking header field card ('No invoice') to trigger auto-zoom to 160%...");
    const clickedHeader = await harness.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const span = spans.find((s) => s.innerText.trim().includes("No invoice"));
      const card = span?.closest("div.rounded-xl");
      if (card) {
        card.click();
        return span.innerText.trim();
      }
      return null;
    });
    assert.ok(clickedHeader, "Header field card 'No invoice' not found");

    // Dynamic wait for zoom transition to 160%
    await harness.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      return zoomBtn?.innerText.trim() === "160%";
    }, 10000);

    // Dynamic wait for active bounding box highlight to render on canvas
    await harness.waitForFunction(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const activeBtn = overlay?.querySelector("button.border-blue-600");
      return Boolean(activeBtn);
    }, 10000);

    const postHeaderZoom = await harness.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      return zoomBtn ? zoomBtn.innerText.trim() : null;
    });
    assert.strictEqual(postHeaderZoom, "160%", "Header field click must auto-zoom to 160%");
    console.log("  [OK] Auto-zoom to 160% verified for header field click.");

    // Centering check: verify active bounding box is within viewport
    const centeringMetrics = await harness.evaluate(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const activeBtn = overlay?.querySelector("button.border-blue-600");
      if (!activeBtn) return null;
      const boxRect = activeBtn.getBoundingClientRect();
      return {
        boxTop: boxRect.top,
        boxBottom: boxRect.bottom,
        boxLeft: boxRect.left,
        boxRight: boxRect.right,
        boxWidth: boxRect.width,
        boxHeight: boxRect.height,
        inViewportVertical: boxRect.top >= 0 && boxRect.bottom <= window.innerHeight,
        inViewportHorizontal: boxRect.left >= 0 && boxRect.right <= window.innerWidth,
      };
    });
    assert.ok(centeringMetrics, "Active bounding box rect could not be retrieved");
    assert.strictEqual(centeringMetrics.inViewportVertical, true, "Active bounding box must be vertically in viewport");
    assert.strictEqual(centeringMetrics.inViewportHorizontal, true, "Active bounding box must be horizontally in viewport");
    console.log("  [OK] Viewport centering verified for active bounding box.");

    // Criterion 3: Bounding box padding verification: inspect active bounding box styling
    console.log("  5. Inspecting active bounding box styling & badge offset...");
    const stylingMetrics = await harness.evaluate(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const activeBtn = overlay?.querySelector("button.border-blue-600");
      if (!activeBtn) return null;
      const badge = activeBtn.querySelector("span");
      return {
        className: activeBtn.className,
        hasBorder2: activeBtn.className.includes("border-2"),
        hasBorderBlue600: activeBtn.className.includes("border-blue-600"),
        hasBgBlue: activeBtn.className.includes("bg-blue-500/15"),
        hasRing: activeBtn.className.includes("ring-2 ring-blue-400/40"),
        badgeClass: badge ? badge.className : "",
        hasBadgeOffsetTop4: badge ? badge.className.includes("-top-4") : false,
      };
    });
    assert.ok(stylingMetrics, "Styling metrics could not be retrieved");
    assert.strictEqual(stylingMetrics.hasBorder2, true, "Active bounding box must have border-2");
    assert.strictEqual(stylingMetrics.hasBorderBlue600, true, "Active bounding box must have border-blue-600");
    assert.strictEqual(stylingMetrics.hasBgBlue, true, "Active bounding box must have bg-blue-500/15");
    assert.strictEqual(stylingMetrics.hasRing, true, "Active bounding box must have ring-2 ring-blue-400/40");
    assert.strictEqual(stylingMetrics.hasBadgeOffsetTop4, true, "Badge must have -top-4 offset");
    console.log("  [OK] Active bounding box styling (border-2, bg-blue-500/15, ring-2 ring-blue-400/40, badge offset -top-4) verified cleanly.");

    // Criterion 4: Line item card click: navigates to target page (Page 2), auto-zooms to 160%, highlights target cell
    console.log("  6. Clicking 'Baris barang #1' PIB card (navigates to Page 2, auto-zooms to 160%)...");
    const clickedPibSub = await harness.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const headerSpan = spans.find((s) => s.innerText.trim() === "Baris barang #1");
      const card = headerSpan?.closest("div.rounded-xl");
      const subcards = card ? Array.from(card.querySelectorAll("div.group")) : [];
      if (subcards[0]) {
        subcards[0].click();
        return true;
      }
      return false;
    });
    assert.ok(clickedPibSub, "Failed to click Baris barang #1 PIB subcard");

    // Dynamic wait for Page 2 navigation, 160% zoom, and active line item highlights
    await harness.waitForFunction(() => {
      const pageInput = document.querySelector("div.flex.items-center.gap-1.px-1 input");
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const activeBtns = overlay ? Array.from(overlay.querySelectorAll("button")).filter((b) => b.className.includes("border-blue-600")) : [];
      return pageInput?.value === "2" && zoomBtn?.innerText.trim() === "160%" && activeBtns.length > 0;
    }, 15000);

    const lineItemNavState = await harness.evaluate(() => {
      const pageInput = document.querySelector("div.flex.items-center.gap-1.px-1 input");
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const activeBtns = overlay ? Array.from(overlay.querySelectorAll("button")).filter((b) => b.className.includes("border-blue-600")) : [];
      return {
        page: pageInput ? pageInput.value : null,
        zoom: zoomBtn ? zoomBtn.innerText.trim() : null,
        activeCount: activeBtns.length,
      };
    });
    assert.strictEqual(lineItemNavState.page, "2", "Line item click must navigate to Page 2");
    assert.strictEqual(lineItemNavState.zoom, "160%", "Line item click must auto-zoom to 160%");
    assert.ok(lineItemNavState.activeCount > 0, "Line item click must render active bounding boxes");
    console.log(`  [OK] Line item navigation to Page ${lineItemNavState.page} at ${lineItemNavState.zoom} with ${lineItemNavState.activeCount} active boxes verified.`);

    // Criterion 5: Zoom preservation at 145% and 175%
    console.log("  7. Testing user zoom preservation at 145%...");
    // Zoom Out once (160% - 15% = 145%)
    await harness.click('button[title="Perkecil zoom"]');
    await harness.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      return zoomBtn?.innerText.trim() === "145%";
    }, 6000);

    // Click a field card while zoom is at 145%
    await harness.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const span = spans.find((s) => s.innerText.trim().includes("Tanggal invoice") || s.innerText.trim().includes("Identitas penjual"));
      const card = span?.closest("div.rounded-xl");
      if (card) card.click();
    });

    // Wait for active highlights to update
    await harness.waitForFunction(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const activeBtns = overlay ? Array.from(overlay.querySelectorAll("button")).filter((b) => b.className.includes("border-blue-600")) : [];
      return activeBtns.length > 0;
    }, 10000);

    const preserved145 = await harness.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      return zoomBtn ? zoomBtn.innerText.trim() : null;
    });
    assert.strictEqual(preserved145, "145%", "User zoom at 145% must be preserved across field switches");
    console.log("  [OK] Zoom preservation at 145% verified.");

    console.log("  8. Testing user zoom preservation at 175%...");
    // Zoom In twice (145% + 15% = 160%, + 15% = 175%)
    await harness.click('button[title="Perbesar zoom"]');
    await harness.click('button[title="Perbesar zoom"]');
    await harness.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      return zoomBtn?.innerText.trim() === "175%";
    }, 6000);

    // Click a field card while zoom is at 175%
    await harness.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const span = spans.find((s) => s.innerText.trim().includes("Identitas penjual"));
      const card = span?.closest("div.rounded-xl");
      if (card) card.click();
    });

    await harness.waitForFunction(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const activeBtns = overlay ? Array.from(overlay.querySelectorAll("button")).filter((b) => b.className.includes("border-blue-600")) : [];
      return activeBtns.length > 0;
    }, 10000);

    const preserved175 = await harness.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      return zoomBtn ? zoomBtn.innerText.trim() : null;
    });
    assert.strictEqual(preserved175, "175%", "User zoom at 175% must be preserved across field switches");
    console.log("  [OK] Zoom preservation at 175% verified.");

    // Criterion 6: Upper zoom reset: if user zooms to 200%, subsequent field click resets zoom to 160%
    console.log("  9. Testing upper zoom reset (200% -> 160%)...");
    // Zoom in until 200%
    await harness.click('button[title="Perbesar zoom"]'); // 175 -> 190
    await harness.click('button[title="Perbesar zoom"]'); // 190 -> 200
    await harness.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      return zoomBtn?.innerText.trim() === "200%";
    }, 6000);

    // Click field card while at 200%
    await harness.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const span = spans.find((s) => s.innerText.trim().includes("No invoice"));
      const card = span?.closest("div.rounded-xl");
      if (card) card.click();
    });

    // Dynamic wait for zoom to reset to 160%
    await harness.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      return zoomBtn?.innerText.trim() === "160%";
    }, 10000);

    const resetZoomVal = await harness.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const zoomBtn = btns.find((b) => b.title === "Reset zoom 100%" || /^\d+%$/.test(b.innerText.trim()));
      return zoomBtn ? zoomBtn.innerText.trim() : null;
    });
    assert.strictEqual(resetZoomVal, "160%", "Field click when zoom is >180% (200%) must reset zoom to 160%");
    console.log("  [OK] Upper zoom reset (200% -> 160%) verified.");

    // Criterion 7: Thumbnail navigation guard: verify manual thumbnail click to Page 1 is stable
    console.log("  10. Testing thumbnail navigation guard vs background slot swaps...");
    // First navigate to Page 2 via line item
    await harness.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const headerSpan = spans.find((s) => s.innerText.trim() === "Baris barang #1");
      const card = headerSpan?.closest("div.rounded-xl");
      const subcards = card ? Array.from(card.querySelectorAll("div.group")) : [];
      if (subcards[0]) subcards[0].click();
    });

    await harness.waitForFunction(() => {
      const pageInput = document.querySelector("div.flex.items-center.gap-1.px-1 input");
      return pageInput?.value === "2";
    }, 10000);

    // Click Page 1 thumbnail in vertical strip
    console.log("  Clicking Page 1 thumbnail in vertical strip...");
    await harness.click('button[title="Pindah ke Halaman 1"]');

    await harness.waitForFunction(() => {
      const pageInput = document.querySelector("div.flex.items-center.gap-1.px-1 input");
      return pageInput?.value === "1";
    }, 10000);

    // Monitor stability for 2500ms to guarantee no slot swap or targetPage clobbers Page 1
    const guardStart = Date.now();
    while (Date.now() - guardStart < 2500) {
      const pageVal = await harness.evaluate(() => {
        return document.querySelector("div.flex.items-center.gap-1.px-1 input")?.value;
      });
      assert.strictEqual(pageVal, "1", "Manual thumbnail navigation to Page 1 must remain stable and not clobbered");
      await new Promise((r) => setTimeout(r, 400));
    }
    console.log("  [OK] Thumbnail navigation guard stable across 2500ms observation window.");

    // Step 11: Capture verified screenshot and assert zero console errors
    const shotPath = path.join(ARTIFACTS_DIR, "zoom_and_padding_verified.png");
    await harness.captureScreenshot(shotPath);
    console.log(`  [OK] Verified screenshot saved to ${shotPath}`);

    harness.assertZeroErrors();
    console.log("  [OK] Zero console errors verified.");
    console.log("\n[PASS] All zoom and padding tests passed successfully!");
  } finally {
    if (!externalHarness) {
      await harness.close();
    }
  }
}

if (process.argv[1]?.includes("test_zoom_and_padding.mjs")) {
  runZoomAndPaddingTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}
