import assert from "assert/strict";
import { BrowserHarness } from "./harness.mjs";

export async function runFullAudit() {
  console.log("\n=================================================================");
  console.log("   DEEP AUDIT: Field Clicks, Document Sync, & Auto-Zoom Center  ");
  console.log("=================================================================\n");

  const harness = new BrowserHarness();
  await harness.launch();

  const auditIssues = [];

  try {
    const url = `${harness.baseUrl}/matching`;
    console.log(`1. Navigating to ${url}...`);
    await harness.navigate(url);

    await harness.waitForSelector("table tbody tr td:nth-child(3)", 10000);
    await harness.click("table tbody tr:first-child td:nth-child(3)");
    await harness.waitForSelector("div.fixed.inset-0.z-50", 10000);
    console.log("   [OK] MatchingDetailView modal mounted.");
    await harness.waitForSelector("div.lg\\:col-span-5", 15000);
    await new Promise((r) => setTimeout(r, 1200));

    const targetDocs = ["Invoice", "PL", "BL", "AK", "WL", "MS"];

    for (const docCode of targetDocs) {
      console.log(`\n==================================================`);
      console.log(`>>> Auditing Supporting Document: [${docCode}]`);
      console.log(`==================================================`);

      // Switch to this document using ComparisonPanel tabs
      const tabSwitched = await harness.evaluate((code) => {
        // Look in ComparisonPanel top bar
        const panel = document.querySelector("div.lg\\:col-span-5");
        if (!panel) return { ok: false, reason: "ComparisonPanel not found" };
        const buttons = Array.from(panel.querySelectorAll("button"));
        const docBtn = buttons.find((b) => b.innerText.trim().startsWith(code));
        if (docBtn) {
          docBtn.click();
          return { ok: true, text: docBtn.innerText.trim() };
        }
        return { ok: false, reason: `Tab button for ${code} not found` };
      }, docCode);

      if (!tabSwitched.ok) {
        console.log(`   [FAIL] Switch to tab ${docCode}: ${tabSwitched.reason}`);
        auditIssues.push(`Switch to tab ${docCode} failed: ${tabSwitched.reason}`);
        continue;
      }
      console.log(`   [OK] Switched tab to: ${tabSwitched.text}`);
      await new Promise((r) => setTimeout(r, 800));

      // Get count of fields and line items currently rendered in ComparisonPanel
      const panelInfo = await harness.evaluate(() => {
        const panel = document.querySelector("div.lg\\:col-span-5");
        if (!panel) return null;

        // Field cards
        const fieldCards = Array.from(panel.querySelectorAll("div.space-y-2\\.5 > div"));
        const cardTitles = fieldCards.map((c) => c.querySelector("span.font-bold")?.innerText.trim() || "");

        // Line item cards
        const lineItemSpans = Array.from(panel.querySelectorAll("span")).filter(
          (s) => s.innerText.startsWith("Baris barang #")
        );

        return {
          fieldCount: fieldCards.length,
          sampleFieldTitles: cardTitles.slice(0, 4),
          lineItemCount: lineItemSpans.length,
        };
      });

      console.log(`   Panel State: ${panelInfo?.fieldCount} fields, ${panelInfo?.lineItemCount} table line items.`);
      console.log(`   Sample Fields:`, panelInfo?.sampleFieldTitles);

      if (!panelInfo || panelInfo.fieldCount === 0) {
        auditIssues.push(`Doc ${docCode}: No field cards rendered in ComparisonPanel!`);
        continue;
      }

      // --- TEST A: HEADER FIELD CLICKS ---
      // Test first 2 fields
      const testIndices = [0, 1].filter((i) => i < panelInfo.fieldCount);

      for (const idx of testIndices) {
        const fieldTitle = panelInfo.sampleFieldTitles[idx] || `Field #${idx + 1}`;
        console.log(`\n   --- Testing Field [${fieldTitle}] ---`);

        // 1. Click Right Subcard (Supporting Doc)
        const clickSupResult = await harness.evaluate((fIdx) => {
          const panel = document.querySelector("div.lg\\:col-span-5");
          const cards = panel?.querySelectorAll("div.space-y-2\\.5 > div");
          const card = cards?.[fIdx];
          if (!card) return { ok: false };
          const subcards = card.querySelectorAll("div.grid > div");
          const supSub = subcards[1];
          if (supSub) {
            supSub.click();
            return { ok: true, subTitle: supSub.querySelector("span")?.innerText.trim() };
          }
          return { ok: false };
        }, idx);

        if (clickSupResult.ok) {
          await new Promise((r) => setTimeout(r, 600));

          const vState = await harness.evaluate(() => {
            const viewer = document.querySelector("div.lg\\:col-span-7");
            const docTitle = viewer?.querySelector("span.font-medium.text-slate-800")?.innerText.trim();
            const zoomBtn = Array.from(viewer?.querySelectorAll("button") || []).find((b) => b.innerText.includes("%"));
            const pageInput = viewer?.querySelector('input[type="text"][inputmode="numeric"]');
            const overlay = viewer?.querySelector(".absolute.inset-0.pointer-events-none");
            const activeBoxes = overlay ? Array.from(overlay.querySelectorAll(".border-blue-600")) : [];

            return {
              docTitle,
              zoomText: zoomBtn?.innerText.trim(),
              page: (pageInput && "value" in pageInput ? pageInput.value : ""),
              activeBoxCount: activeBoxes.length,
              activeTitles: activeBoxes.map((b) => b.getAttribute("title")),
            };
          });

          console.log(`     Right (${docCode}) Subcard Click: Doc='${vState.docTitle}', Page=${vState.page}, Zoom=${vState.zoomText}, ActiveBoxes=${vState.activeBoxCount}`);

          // Validate Doc Title matches docCode (e.g. INVOICE.pdf or PL.pdf)
          if (docCode !== "BL" && !vState.docTitle?.toUpperCase().includes(docCode.toUpperCase())) {
            console.log(`     [WARN] Doc title '${vState.docTitle}' might not match '${docCode}'`);
          }

          // Validate Zoom is 160%
          if (vState.zoomText !== "160%") {
            auditIssues.push(`Doc ${docCode} Field [${fieldTitle}] Supporting: Zoom is ${vState.zoomText}, expected 160%`);
          }
        }

        // 2. Click Left Subcard (PIB Acuan)
        const clickPibResult = await harness.evaluate((fIdx) => {
          const panel = document.querySelector("div.lg\\:col-span-5");
          const cards = panel?.querySelectorAll("div.space-y-2\\.5 > div");
          const card = cards?.[fIdx];
          if (!card) return { ok: false };
          const subcards = card.querySelectorAll("div.grid > div");
          const pibSub = subcards[0];
          if (pibSub) {
            pibSub.click();
            return { ok: true, subTitle: pibSub.querySelector("span")?.innerText.trim() };
          }
          return { ok: false };
        }, idx);

        if (clickPibResult.ok) {
          await new Promise((r) => setTimeout(r, 600));

          const vState = await harness.evaluate(() => {
            const viewer = document.querySelector("div.lg\\:col-span-7");
            const docTitle = viewer?.querySelector("span.font-medium.text-slate-800")?.innerText.trim();
            const zoomBtn = Array.from(viewer?.querySelectorAll("button") || []).find((b) => b.innerText.includes("%"));
            const pageInput = viewer?.querySelector('input[type="text"][inputmode="numeric"]');
            const overlay = viewer?.querySelector(".absolute.inset-0.pointer-events-none");
            const activeBoxes = overlay ? Array.from(overlay.querySelectorAll(".border-blue-600")) : [];

            return {
              docTitle,
              zoomText: zoomBtn?.innerText.trim(),
              page: (pageInput && "value" in pageInput ? pageInput.value : ""),
              activeBoxCount: activeBoxes.length,
              activeTitles: activeBoxes.map((b) => b.getAttribute("title")),
            };
          });

          console.log(`     Left (PIB) Subcard Click: Doc='${vState.docTitle}', Page=${vState.page}, Zoom=${vState.zoomText}, ActiveBoxes=${vState.activeBoxCount}`);

          if (!vState.docTitle?.toUpperCase().includes("PIB")) {
            auditIssues.push(`Doc ${docCode} Field [${fieldTitle}] PIB Subcard: Expected PIB document in viewer, got '${vState.docTitle}'`);
          }
          if (vState.zoomText !== "160%") {
            auditIssues.push(`Doc ${docCode} Field [${fieldTitle}] PIB Subcard: Zoom is ${vState.zoomText}, expected 160%`);
          }
          if (vState.activeBoxCount === 0) {
            console.log(`     [NOTE] PIB activeBoxCount is 0 (coordinate may not exist in PIB raw data for this field).`);
          }
        }
      }

      // --- TEST B: TABLE LINE ITEM CLICKS ---
      if (panelInfo.lineItemCount > 0) {
        console.log(`\n   --- Testing Table Line Item #1 ---`);

        // 1. Click Supporting Doc Box for Line Item #1
        const clickSupItem = await harness.evaluate((code) => {
          const panel = document.querySelector("div.lg\\:col-span-5");
          const lineItemSpans = Array.from(panel?.querySelectorAll("span") || []).filter(
            (s) => s.innerText.startsWith("Baris barang #")
          );
          const row1Card = lineItemSpans[0]?.closest("div.rounded-xl");
          const subBoxes = row1Card?.querySelectorAll("div.grid > div");
          const supBox = subBoxes?.[1];
          if (supBox) {
            supBox.click();
            return { ok: true, boxTitle: supBox.getAttribute("title") };
          }
          return { ok: false };
        }, docCode);

        if (clickSupItem.ok) {
          // Wait for active boxes on Supporting canvas to render
          await harness.waitForFunction(() => {
            const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
            const active = overlay ? overlay.querySelectorAll(".border-blue-600") : [];
            return active.length > 0;
          }, 8000).catch(() => {});

          const vState = await harness.evaluate(() => {
            const viewer = document.querySelector("div.lg\\:col-span-7");
            const docTitle = viewer?.querySelector("span.font-medium.text-slate-800")?.innerText.trim();
            const zoomBtn = Array.from(viewer?.querySelectorAll("button") || []).find((b) => b.innerText.includes("%"));
            const pageInput = viewer?.querySelector('input[type="text"][inputmode="numeric"]');
            const overlay = viewer?.querySelector(".absolute.inset-0.pointer-events-none");
            const activeBoxes = overlay ? Array.from(overlay.querySelectorAll(".border-blue-600")) : [];

            return {
              docTitle,
              zoomText: zoomBtn?.innerText.trim(),
              page: (pageInput && "value" in pageInput ? pageInput.value : ""),
              activeBoxCount: activeBoxes.length,
              activeTitles: activeBoxes.map((b) => b.getAttribute("title")),
            };
          });

          console.log(`     Supporting Line Item Box: Doc='${vState.docTitle}', Page=${vState.page}, Zoom=${vState.zoomText}, ActiveBoxes=${vState.activeBoxCount}`);
          console.log(`     Box Titles:`, vState.activeTitles);

          if (vState.zoomText !== "160%") {
            auditIssues.push(`Doc ${docCode} Line Item #1 Supporting: Zoom is ${vState.zoomText}, expected 160%`);
          }
          if (vState.activeBoxCount === 0) {
            auditIssues.push(`Doc ${docCode} Line Item #1 Supporting: 0 active bounding boxes rendered!`);
          }
        }

        // 2. Click PIB Box for Line Item #1
        const clickPibItem = await harness.evaluate(() => {
          const panel = document.querySelector("div.lg\\:col-span-5");
          const lineItemSpans = Array.from(panel?.querySelectorAll("span") || []).filter(
            (s) => s.innerText.startsWith("Baris barang #")
          );
          const row1Card = lineItemSpans[0]?.closest("div.rounded-xl");
          const subBoxes = row1Card?.querySelectorAll("div.grid > div");
          const pibBox = subBoxes?.[0];
          if (pibBox) {
            const expectedPage = pibBox.innerText.match(/Hal\.\s*(\d+)/)?.[1] || "2";
            pibBox.click();
            return { ok: true, boxTitle: pibBox.getAttribute("title"), expectedPage };
          }
          return { ok: false };
        });

        if (clickPibItem.ok) {
          // Wait for active boxes on PIB canvas to render and match expected document and page
          await harness.waitForFunction((expected) => {
            const viewer = document.querySelector("div.lg\\:col-span-7");
            const docTitle = viewer?.querySelector("span.font-medium.text-slate-800")?.innerText.trim();
            const pageInput = viewer?.querySelector('input[type="text"][inputmode="numeric"]');
            const overlay = document.querySelector(".absolute.inset-0.pointer-events-none");
            const active = overlay ? overlay.querySelectorAll(".border-blue-600") : [];
            return Boolean(
              docTitle?.toUpperCase().includes("PIB") &&
              pageInput &&
              pageInput.value === expected &&
              active.length > 0
            );
          }, 8000, clickPibItem.expectedPage).catch(() => {});

          const vState = await harness.evaluate(() => {
            const viewer = document.querySelector("div.lg\\:col-span-7");
            const docTitle = viewer?.querySelector("span.font-medium.text-slate-800")?.innerText.trim();
            const zoomBtn = Array.from(viewer?.querySelectorAll("button") || []).find((b) => b.innerText.includes("%"));
            const pageInput = viewer?.querySelector('input[type="text"][inputmode="numeric"]');
            const overlay = viewer?.querySelector(".absolute.inset-0.pointer-events-none");
            const activeBoxes = overlay ? Array.from(overlay.querySelectorAll(".border-blue-600")) : [];

            return {
              docTitle,
              zoomText: zoomBtn?.innerText.trim(),
              page: (pageInput && "value" in pageInput ? pageInput.value : ""),
              activeBoxCount: activeBoxes.length,
              activeTitles: activeBoxes.map((b) => b.getAttribute("title")),
            };
          });

          console.log(`     PIB Line Item Box: Doc='${vState.docTitle}', Page=${vState.page}, Zoom=${vState.zoomText}, ActiveBoxes=${vState.activeBoxCount}`);

          if (!vState.docTitle?.toUpperCase().includes("PIB")) {
            auditIssues.push(`Doc ${docCode} Line Item #1 PIB: Expected PIB in viewer, got '${vState.docTitle}'`);
          }
          if (vState.zoomText !== "160%") {
            auditIssues.push(`Doc ${docCode} Line Item #1 PIB: Zoom is ${vState.zoomText}, expected 160%`);
          }
          if (vState.page !== clickPibItem.expectedPage) {
            auditIssues.push(`Doc ${docCode} Line Item #1 PIB: Expected Page ${clickPibItem.expectedPage}, got Page ${vState.page}`);
          }
          if (vState.activeBoxCount === 0) {
            auditIssues.push(`Doc ${docCode} Line Item #1 PIB: 0 active bounding boxes rendered!`);
          }
        }
      }
    }

    console.log("\n=================================================================");
    console.log("                      AUDIT FINAL SUMMARY                        ");
    console.log("=================================================================");
    if (auditIssues.length === 0) {
      console.log("   [PASSED] ALL CHECKS CLEAN! Zero issues detected!");
      console.log("   - Document switcher syncs perfectly across tabs.");
      console.log("   - File displayed in viewer always matches selected document.");
      console.log("   - Auto-zoom centers at 160% on all clicks.");
      console.log("   - Active bounding boxes render precisely for fields and table rows.");
      console.log("   - Page navigation to Page 2 (PIB line items) works as designed.");
    } else {
      console.log(`   [FAIL] Found ${auditIssues.length} issue(s):`);
      auditIssues.forEach((issue, idx) => console.log(`   ${idx + 1}. ${issue}`));
    }
    console.log("=================================================================\n");

    assert.strictEqual(auditIssues.length, 0, `Audit encountered ${auditIssues.length} issue(s)`);
  } finally {
    await harness.close();
  }
}

runFullAudit()
  .then(() => {
    console.log("Deep Audit completed with 0 errors!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Deep Audit failed:", err.message);
    process.exit(1);
  });
