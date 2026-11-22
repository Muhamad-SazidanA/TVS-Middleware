import assert from "assert/strict";
import { BrowserHarness } from "./harness.mjs";

export async function testFieldSwitchHighlights(externalHarness) {
  console.log("\n> Running Suite: Field Switch Bounding Box Isolation Verification");
  const harness = externalHarness || new BrowserHarness();
  if (!externalHarness) {
    await harness.launch();
  }

  try {
    const testUrl = `${harness.baseUrl}/matching`;
    console.log(`  1. Navigating to ${testUrl}...`);
    await harness.navigate(testUrl);

    await harness.waitForSelector("table tbody tr td:nth-child(3)", 10000);
    await harness.click("table tbody tr:first-child td:nth-child(3)");
    await harness.waitForSelector("div.fixed.inset-0.z-50", 10000);

    // Dynamic polling: await line items / subcards to be mounted in the DOM
    await harness.waitForFunction(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const span = spans.find(s => s.innerText.trim() === "Baris barang #1");
      const card = span?.closest("div.rounded-xl");
      return Boolean(card?.querySelector("div.group"));
    }, 15000);

    // Step 2: Select Baris barang #1
    console.log("  2. Clicking 'Baris barang #1'...");
    const clickedRow1 = await harness.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const span = spans.find(s => s.innerText.trim() === "Baris barang #1");
      const card = span?.closest("div.rounded-xl");
      const sub = card?.querySelector("div.group");
      if (sub) {
        sub.click();
        return true;
      }
      return false;
    });
    assert.ok(clickedRow1, "Baris barang #1 subcard not found");

    // Dynamic polling: wait for active row 1 highlights to mount
    await harness.waitForFunction(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const buttons = overlay ? Array.from(overlay.querySelectorAll("button")) : [];
      return buttons.some(b => b.className.includes("border-blue-600"));
    }, 15000);

    const row1State = await harness.evaluate(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const buttons = overlay ? Array.from(overlay.querySelectorAll("button")) : [];
      const activeBtns = buttons.filter(b => b.className.includes("border-blue-600"));
      const titles = activeBtns.map(b => b.getAttribute("title"));
      return {
        totalButtons: buttons.length,
        activeCount: activeBtns.length,
        titles: titles.slice(0, 3),
        hasHeaderFields: titles.some(t => !t.includes("Baris #1")),
      };
    });

    console.log("  Row 1 active boxes:", row1State);
    assert.ok(row1State.activeCount > 0, "Expected table boxes for Baris #1");
    assert.strictEqual(row1State.hasHeaderFields, false, "Header fields should NOT be shown when table row is selected");
    console.log("  [OK] ONLY Baris #1 boxes are visible. Header fields are hidden.");

    // Step 3: Switch to a Header field (e.g. click No invoice PIB subcard in right panel)
    console.log("  3. Switching to Header field in right panel...");
    const clickedHeaderField = await harness.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const span = spans.find(s =>
        s.innerText.trim().includes("No invoice") ||
        s.innerText.trim().includes("Identitas penjual")
      );
      const card = span?.closest("div.rounded-xl");
      const subcards = card ? Array.from(card.querySelectorAll("div.group")) : [];
      if (subcards[0]) {
        subcards[0].click();
        return span.innerText.trim();
      } else if (card) {
        card.click();
        return span.innerText.trim();
      }
      return null;
    });
    console.log("  Clicked header field:", clickedHeaderField);
    assert.ok(clickedHeaderField, "Header field card not found");

    // Dynamic polling: wait for active bounding box to update to header field and clear table boxes
    await harness.waitForFunction(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const buttons = overlay ? Array.from(overlay.querySelectorAll("button")) : [];
      const activeBtns = buttons.filter(b => b.className.includes("border-blue-600"));
      const titles = activeBtns.map(b => b.getAttribute("title") || "");
      return activeBtns.length > 0 && !titles.some(t => t.includes("Baris #"));
    }, 15000);

    const headerFieldState = await harness.evaluate(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const buttons = overlay ? Array.from(overlay.querySelectorAll("button")) : [];
      const activeBtns = buttons.filter(b => b.className.includes("border-blue-600"));
      const titles = activeBtns.map(b => b.getAttribute("title"));
      return {
        totalButtons: buttons.length,
        activeCount: activeBtns.length,
        titles,
        hasLingeringTableItems: titles.some(t => t.includes("Baris #")),
      };
    });

    console.log("  Header field active boxes:", headerFieldState);
    assert.strictEqual(headerFieldState.hasLingeringTableItems, false, "Table row boxes MUST NOT linger when header field is selected!");
    console.log("  [OK] Table boxes completely disappeared when switching to header field.");

    // Step 4: Switch back to Baris barang #2
    console.log("  4. Switching to 'Baris barang #2'...");
    const clickedRow2 = await harness.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const span = spans.find(s => s.innerText.trim() === "Baris barang #2");
      const card = span?.closest("div.rounded-xl");
      const sub = card?.querySelector("div.group");
      if (sub) {
        sub.click();
        return true;
      }
      return false;
    });
    assert.ok(clickedRow2, "Baris barang #2 not found");

    // Dynamic polling: wait for active bounding box to update to row 2 and clear row 1 boxes
    await harness.waitForFunction(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const buttons = overlay ? Array.from(overlay.querySelectorAll("button")) : [];
      const activeBtns = buttons.filter(b => b.className.includes("border-blue-600"));
      const titles = activeBtns.map(b => b.getAttribute("title") || "");
      return activeBtns.length > 0 && !titles.some(t => t.includes("Baris #1:"));
    }, 15000);

    const row2State = await harness.evaluate(() => {
      const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
      const buttons = overlay ? Array.from(overlay.querySelectorAll("button")) : [];
      const activeBtns = buttons.filter(b => b.className.includes("border-blue-600"));
      const titles = activeBtns.map(b => b.getAttribute("title"));
      return {
        totalButtons: buttons.length,
        activeCount: activeBtns.length,
        titles: titles.slice(0, 3),
        hasLingeringRow1: titles.some(t => t.includes("Baris #1:")),
      };
    });

    console.log("  Row 2 active boxes:", row2State);
    assert.ok(row2State.activeCount > 0, "Expected table boxes for Baris #2");
    assert.strictEqual(row2State.hasLingeringRow1, false, "Baris #1 boxes MUST NOT linger when Baris #2 is selected!");
    console.log("  [OK] ONLY Baris #2 boxes are visible. Baris #1 boxes completely disappeared.");

    console.log("\n[PASS] All field switch isolation tests passed successfully!");
  } finally {
    if (!externalHarness) {
      await harness.close();
    }
  }
}

if (process.argv[1]?.includes("test_field_switch_highlights.mjs")) {
  testFieldSwitchHighlights()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}
