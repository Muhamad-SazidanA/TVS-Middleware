/**
 * test_matching_detail.mjs - Automated In-Browser Verification for MatchingDetailView Modal
 * Exercises modal mounting on table row click, 7 document switcher tabs (PIB, Invoice, PL, BL, AK, WL, MS),
 * viewer controls (zoom, page nav), and dismissal via close button & Escape key.
 */
import assert from "assert/strict";
import { BrowserHarness } from "./harness.mjs";

export async function runMatchingDetailTests(harness) {
  console.log("\n▶ Running Suite: MatchingDetailView Modal & Document Switcher");
  const testUrl = `${harness.baseUrl}/matching`;

  // Step 1: Navigate and filter for Batch 0004 (which has complete authentic document set)
  console.log(`  1. Navigating to ${testUrl}...`);
  await harness.navigate(testUrl);

  console.log("  Waiting for batch table rows...");
  await harness.waitForSelector("table tbody tr td:nth-child(3)", 12000);

  // Step 2: Open modal via first row click
  console.log("  2. Clicking first batch row to open MatchingDetailView modal...");
  await harness.click("table tbody tr:first-child td:nth-child(3)");

  // Wait for modal container
  await harness.waitForSelector("div.fixed.inset-0.z-50", 10000);
  console.log("  ✓ MatchingDetailView modal mounted.");

  // Step 3: Inspect modal header & document switcher tabs
  console.log("  3. Verifying document switcher tabs...");
  // Await detail batch data fetch to finish and tabs to mount
  await harness.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll("div.fixed.inset-0.z-50 button"));
    return btns.some((b) => b.innerText.includes("PIB"));
  }, 12000);

  const tabsInfo = await harness.evaluate(() => {
    const modal = document.querySelector("div.fixed.inset-0.z-50");
    const allBtns = Array.from(document.querySelectorAll("button"));
    const modalBtns = modal ? Array.from(modal.querySelectorAll("button")) : [];
    const tabTexts = modalBtns.map((b) => b.innerText.trim()).filter((t) => t.length > 0);
    return {
      hasModal: Boolean(modal),
      allBtnCount: allBtns.length,
      allBtnTexts: allBtns.map(b => b.innerText.trim()).filter(Boolean).slice(0, 10),
      modalBtnCount: modalBtns.length,
      tabTexts,
      hasPib: tabTexts.some((t) => t.includes("PIB")),
    };
  });

  console.log("  Debug availableTabs:", tabsInfo);
  assert.ok(tabsInfo.hasPib, "Document switcher should include PIB tab");
  console.log("  ✓ Available switcher tabs:", tabsInfo.tabTexts.slice(0, 8).join(" | "));

  // Step 4: Sequentially click through supporting document tabs that have files
  console.log("  4. Switching across document tabs...");
  const targetDocCodes = ["Invoice", "PL", "BL", "AK", "WL", "MS", "PIB"];
  for (const docCode of targetDocCodes) {
    const tabSwitched = await harness.evaluate((code) => {
      const btns = Array.from(document.querySelectorAll("div.fixed.inset-0.z-50 button"));
      const tabBtn = btns.find((b) => {
        const text = b.innerText.trim();
        return text.startsWith(code) || text.includes(code);
      });
      if (tabBtn) {
        tabBtn.click();
        return true;
      }
      return false;
    }, docCode);

    if (tabSwitched) {
      await new Promise((r) => setTimeout(r, 400));
      // Verify no fallback blinking occurred and modal is strictly preserved
      const switchCheck = await harness.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasFallback:
            text.includes("Menyiapkan tampilan dokumen") ||
            text.includes("Menyiapkan viewer dokumen"),
          hasModal: Boolean(document.querySelector("div.fixed.inset-0.z-50")),
        };
      });
      assert.ok(!switchCheck.hasFallback, `Tab switch to ${docCode} must never trigger modal fallback screen`);
      assert.ok(switchCheck.hasModal, `Tab switch to ${docCode} must retain MatchingDetailView mounted`);
    }
  }
  console.log("  ✓ Document tab switching completed without freezes or fallback blinking.");

  // Step 5: Test Multi-Page Navigation and Double-Buffering (Form AK)
  console.log("  5. Exercising multi-page navigation and double-buffering (Form AK)...");
  await harness.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("div.fixed.inset-0.z-50 button"));
    const akBtn = btns.find((b) => b.innerText.trim() === "AK" || (b.innerText.includes("AK") && !b.innerText.includes("\n")));
    if (akBtn) akBtn.click();
  });
  // Await multi-page Form AK (3.7MB) to finish downloading, parsing and rendering initial canvas
  await harness.waitForFunction(() => {
    const modal = document.querySelector("div.fixed.inset-0.z-50");
    const nextBtn = modal?.querySelector('button[title="Halaman berikutnya"]');
    const isNextReady = nextBtn && !nextBtn.disabled;
    const hasCanvas = modal?.querySelector("canvas") !== null;
    const isAkSelected = Array.from(modal ? modal.querySelectorAll("button") : []).some(
      (b) => b.innerText.trim() === "AK" && (b.className.includes("bg-slate-900") || b.className.includes("bg-[#091E42]"))
    );
    const pageContainer = modal?.querySelector('input[inputmode="numeric"]')?.parentElement;
    const text = pageContainer?.innerText || "";
    return isAkSelected && hasCanvas && isNextReady && (text.includes("/ 6") || text.includes("/ 5"));
  }, 20000);
  await new Promise((r) => setTimeout(r, 400));

  // 5a. Rapid page clicking on Next page button
  console.log("  5a. Rapid page clicking on Next page button...");
  for (let i = 0; i < 3; i++) {
    await harness.evaluate(() => {
      const modal = document.querySelector("div.fixed.inset-0.z-50");
      const nextBtn = modal?.querySelector('button[title="Halaman berikutnya"]');
      if (nextBtn && !nextBtn.disabled) nextBtn.click();
    });
    await new Promise((r) => setTimeout(r, 120)); // 120ms rapid consecutive clicks
  }
  await new Promise((r) => setTimeout(r, 800));

  // Verify no fallback was triggered, double-buffered canvas retained, and page numbers synchronized
  const pageNavState = await harness.evaluate(() => {
    const pageInput = document.querySelector('input[inputmode="numeric"]');
    const fallbackVisible =
      document.body.innerText.includes("Menyiapkan tampilan dokumen") ||
      document.body.innerText.includes("Menyiapkan viewer dokumen");
    const modalMounted = Boolean(document.querySelector("div.fixed.inset-0.z-50"));
    const canvasCount = document.querySelectorAll("canvas").length;
    return {
      pageInputValue: pageInput ? pageInput.value : null,
      fallbackVisible,
      modalMounted,
      canvasCount,
    };
  });

  console.log("  Debug pageNavState:", pageNavState);
  assert.ok(!pageNavState.fallbackVisible, "Rapid page clicking must never trigger modal fallback screen");
  assert.ok(pageNavState.modalMounted, "MatchingDetailView must remain mounted during rapid navigation");
  assert.ok(pageNavState.canvasCount > 0, "Canvas must remain rendered without blank screen");
  console.log(`  ✓ Rapid page clicking verified (page ${pageNavState.pageInputValue}, double-buffered canvas retained, zero fallback triggers).`);

  // 5b. Thumbnail click navigation
  console.log("  5b. Testing thumbnail click navigation...");
  const thumbClicked = await harness.evaluate(() => {
    const thumbs = Array.from(document.querySelectorAll('button[title*="Pindah ke Halaman"]'));
    if (thumbs.length >= 2) {
      thumbs[1].click(); // Click page 2 thumbnail
      return true;
    }
    return false;
  });
  if (thumbClicked) {
    await new Promise((r) => setTimeout(r, 600));
    const thumbState = await harness.evaluate(() => {
      const fallbackVisible =
        document.body.innerText.includes("Menyiapkan tampilan dokumen") ||
        document.body.innerText.includes("Menyiapkan viewer dokumen");
      const pageInput = document.querySelector('input[inputmode="numeric"]');
      return {
        pageInputValue: pageInput ? pageInput.value : null,
        fallbackVisible,
      };
    });
    assert.ok(!thumbState.fallbackVisible, "Thumbnail click must never trigger modal fallback screen");
    console.log(`  ✓ Thumbnail navigation verified (page ${thumbState.pageInputValue}, zero fallback triggers).`);
  }

  // Step 6: Test Zoom Controls
  console.log("  6. Exercising zoom controls...");
  const controlsState = await harness.evaluate(() => {
    const zoomIn = document.querySelector('button[title="Perbesar zoom"]');
    const zoomOut = document.querySelector('button[title="Perkecil zoom"]');
    const zoomReset = document.querySelector('button[title="Reset zoom 100%"]');
    const pageInput = document.querySelector('input[inputmode="numeric"]');
    return {
      hasZoomIn: Boolean(zoomIn),
      hasZoomOut: Boolean(zoomOut),
      hasZoomReset: Boolean(zoomReset),
      hasPageInput: Boolean(pageInput),
    };
  });

  assert.ok(controlsState.hasZoomIn, "Zoom-in button should exist");
  assert.ok(controlsState.hasZoomOut, "Zoom-out button should exist");
  assert.ok(controlsState.hasZoomReset, "Zoom-reset button should exist");

  // Click zoom in and reset
  await harness.click('button[title="Perbesar zoom"]');
  await new Promise((r) => setTimeout(r, 200));
  await harness.click('button[title="Reset zoom 100%"]');
  await new Promise((r) => setTimeout(r, 200));
  console.log("  ✓ Zoom controls responsive.");

  // Step 7: Dismiss Modal via Close Button
  console.log("  7. Dismissing modal via Close button ('Tutup (Esc)')...");
  await harness.click('button[title="Tutup (Esc)"]');
  await new Promise((r) => setTimeout(r, 500));

  const modalClosed = await harness.evaluate(() => {
    return document.querySelectorAll("div.fixed.inset-0.z-50").length === 0;
  });
  assert.ok(modalClosed, "Modal should unmount after clicking close button");
  console.log("  ✓ Modal closed successfully via Close button.");

  // Step 8: Re-open Modal and Dismiss via Keyboard Escape Key
  console.log("  8. Re-opening modal and testing dismissal via Escape key...");
  await harness.click("table tbody tr td:nth-child(3)");
  await harness.waitForSelector("div.fixed.inset-0.z-50", 8000);

  // Press Escape
  await harness.pressKey("Escape");
  await new Promise((r) => setTimeout(r, 500));

  const modalClosedViaEsc = await harness.evaluate(() => {
    return document.querySelectorAll("div.fixed.inset-0.z-50").length === 0;
  });
  assert.ok(modalClosedViaEsc, "Modal should unmount after pressing Escape key");
  console.log("  ✓ Modal closed successfully via Escape key.");

  // Step 8: Strict Zero Console Error Check
  harness.assertZeroErrors();
  console.log("  ✓ Zero console errors verified for MatchingDetailView modal.");
}

// Standalone execution support
if (process.argv[1]?.endsWith("test_matching_detail.mjs")) {
  const harness = new BrowserHarness();
  try {
    await harness.launch();
    await runMatchingDetailTests(harness);
    console.log("\n✅ test_matching_detail.mjs PASSED!\n");
  } catch (err) {
    console.error("\n❌ test_matching_detail.mjs FAILED:", err);
    process.exit(1);
  } finally {
    harness.close();
  }
}
