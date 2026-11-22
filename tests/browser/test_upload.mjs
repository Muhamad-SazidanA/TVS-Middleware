/**
 * test_upload.mjs - Automated In-Browser Verification for /upload
 * Exercises document categories, single/multi-file badges, dynamic slot addition/removal,
 * file staging with real PDF, summary counters, and submit button states.
 */
import assert from "assert/strict";
import path from "path";
import { BrowserHarness, BASE_URL } from "./harness.mjs";

export async function runUploadTests(harness) {
  console.log("\n> Running Suite: /upload Route & Form Verification");
  const testUrl = `${harness.baseUrl}/upload`;

  // Step 1: Navigation & Page Header Assertion
  console.log(`  1. Navigating to ${testUrl}...`);
  await harness.navigate(testUrl);

  await harness.waitForSelector("main, div.space-y-4", 10000);
  const headerInfo = await harness.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1"));
    const pageHeading = headings.find((h) => h.innerText.includes("Upload Dokumen"));
    return {
      title: document.title,
      heading: pageHeading ? pageHeading.innerText.trim() : headings[0]?.innerText.trim(),
      filePill: document.querySelector("span.bg-blue-50")?.innerText.trim(),
    };
  });

  assert.match(headerInfo.heading, /Upload Dokumen/i, "Page heading should match 'Upload Dokumen'");
  console.log("  [OK] Header verified:", headerInfo.heading);

  // Step 2: 7 Category Cards & Single vs Multi-file Badges Assertion
  console.log("  2. Verifying 7 category cards & single/multi badges...");
  const cardsInfo = await harness.evaluate(() => {
    // Category cards reside inside the upload grid
    const cards = Array.from(document.querySelectorAll("div.grid > div.bg-white"));
    return cards.map((c) => {
      const h4 = c.querySelector("h4");
      const badge = c.querySelector("span.text-\\[9px\\]");
      const addBtn = c.querySelector("button.border-dashed");
      const fileInputs = c.querySelectorAll('input[type="file"]').length;
      return {
        title: h4 ? h4.innerText.trim() : "",
        badgeText: badge ? badge.innerText.trim() : "",
        hasAddButton: Boolean(addBtn),
        fileInputs,
      };
    }).filter((c) => c.title.length > 0);
  });

  assert.equal(cardsInfo.length, 7, `Expected exactly 7 category cards, found ${cardsInfo.length}`);

  // Cards 0..4 (PIB, AK, WL, MS, BL) must be Single File
  for (let i = 0; i < 5; i++) {
    assert.match(
      cardsInfo[i].badgeText,
      /Single File/i,
      `Card ${cardsInfo[i].title} should have 'Single File' badge`
    );
    assert.equal(
      cardsInfo[i].hasAddButton,
      false,
      `Card ${cardsInfo[i].title} should not have an add slot button`
    );
  }

  // Cards 5 and 6 (Packing List, Invoice) must be Multi-file
  assert.match(cardsInfo[5].badgeText, /Multi-file/i, "Packing List should have 'Multi-file' badge");
  assert.equal(cardsInfo[5].hasAddButton, true, "Packing List should have add button");
  assert.match(cardsInfo[6].badgeText, /Multi-file/i, "Invoice should have 'Multi-file' badge");
  assert.equal(cardsInfo[6].hasAddButton, true, "Invoice should have add button");
  console.log("  [OK] All 7 category cards & badge configurations verified cleanly.");

  // Step 3: Multi-Slot Dynamic Addition & Removal
  console.log("  3. Testing dynamic multi-slot addition & removal for Packing List...");
  // Ensure DOM and React hydration have completed for the add button before clicking
  await harness.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons.some((b) => b.innerText.includes("Tambah Upload Packing List"));
  }, 10000);

  // Click "+ Tambah Upload Packing List" and wait for dynamic slot addition
  await harness.waitForFunction(() => {
    const existingRemoveBtns = document.querySelectorAll('button[title="Hapus kolom ini"]');
    if (existingRemoveBtns.length >= 1) return true;

    const buttons = Array.from(document.querySelectorAll("button"));
    const pkgAddBtn = buttons.find((b) => b.innerText.includes("Tambah Upload Packing List"));
    if (pkgAddBtn) {
      pkgAddBtn.click();
    }
    return document.querySelectorAll('button[title="Hapus kolom ini"]').length >= 1;
  }, 12000, 300);

  const slotsAfterAdd = await harness.evaluate(() => {
    const removeSlotBtns = Array.from(document.querySelectorAll('button[title="Hapus kolom ini"]'));
    return {
      removeBtnCount: removeSlotBtns.length,
    };
  });
  assert.ok(
    slotsAfterAdd.removeBtnCount >= 1,
    "Expected at least 1 remove slot button after adding a slot"
  );

  // Click remove slot button
  await harness.click('button[title="Hapus kolom ini"]');
  await harness.waitForFunction(() => {
    return document.querySelectorAll('button[title="Hapus kolom ini"]').length === 0;
  }, 10000);

  const slotsAfterRemove = await harness.evaluate(() => {
    return document.querySelectorAll('button[title="Hapus kolom ini"]').length;
  });
  assert.equal(slotsAfterRemove, 0, "Remove slot button should disappear after deleting slot");
  console.log("  [OK] Dynamic slot addition and removal verified successfully.");

  // Step 4: Staging Real Sample File (PIB.pdf)
  console.log("  4. Staging authentic sample document (public/uploads/0004/PIB.pdf)...");
  const samplePdfPath = path.resolve("public/uploads/0004/PIB.pdf");

  // Verify initial submit button disabled state
  const initialSubmitState = await harness.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const submitBtn = btns.find((b) => b.innerText.includes("Submit"));
    return {
      text: submitBtn ? submitBtn.innerText.trim() : null,
      disabled: submitBtn ? submitBtn.disabled : null,
    };
  });
  assert.match(initialSubmitState.text, /Submit \(0\)/i);
  assert.equal(initialSubmitState.disabled, true, "Submit button should be disabled when 0 files staged");

  // Stage file into PIB slot
  await harness.setInputFiles('input[type="file"]', [samplePdfPath]);
  await harness.waitForFunction(() => {
    const fileBadge = document.querySelector("div.bg-emerald-50\\/70 span[title]");
    return Boolean(fileBadge);
  }, 10000);

  // Verify UI updated to reflect 1 staged file
  const stagedState = await harness.evaluate(() => {
    const fileBadge = document.querySelector("div.bg-emerald-50\\/70 span[title]");
    const btns = Array.from(document.querySelectorAll("button"));
    const submitBtn = btns.find((b) => b.innerText.includes("Submit"));
    const summarySpan = document.querySelector("div.bg-white span.bg-blue-50");
    return {
      badgeText: fileBadge ? fileBadge.innerText.trim() : null,
      submitText: submitBtn ? submitBtn.innerText.trim() : null,
      submitDisabled: submitBtn ? submitBtn.disabled : null,
      summaryText: summarySpan ? summarySpan.innerText.trim() : null,
    };
  });

  assert.equal(stagedState.badgeText, "PIB.pdf", "Staged badge should display 'PIB.pdf'");
  assert.match(stagedState.submitText, /Submit \(1\)/i, "Submit button text should update to 'Submit (1)'");
  assert.equal(stagedState.submitDisabled, false, "Submit button should now be enabled");
  console.log("  [OK] File staging verified. Submit button enabled with 1 file staged.");

  // Step 5: Removing Staged File
  console.log("  5. Testing staged file removal...");
  await harness.click('button[title="Hapus file"]');
  await harness.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const submitBtn = btns.find((b) => b.innerText.includes("Submit"));
    return submitBtn?.innerText.includes("Submit (0)") && submitBtn.disabled;
  }, 10000);

  const revertedState = await harness.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const submitBtn = btns.find((b) => b.innerText.includes("Submit"));
    return {
      submitText: submitBtn ? submitBtn.innerText.trim() : null,
      submitDisabled: submitBtn ? submitBtn.disabled : null,
    };
  });
  assert.match(revertedState.submitText, /Submit \(0\)/i);
  assert.equal(revertedState.submitDisabled, true, "Submit button should revert to disabled after file removal");
  console.log("  [OK] File removal verified cleanly. State reverted.");

  // Step 6: Strict Zero Console Error Check
  harness.assertZeroErrors();
  console.log("  [OK] Zero console errors verified for /upload.");
}

// Standalone execution support
if (process.argv[1]?.endsWith("test_upload.mjs")) {
  const harness = new BrowserHarness();
  try {
    await harness.launch();
    await runUploadTests(harness);
    console.log("\n[PASS] test_upload.mjs PASSED!\n");
  } catch (err) {
    console.error("\n[FAIL] test_upload.mjs FAILED:", err);
    process.exit(1);
  } finally {
    harness.close();
  }
}
