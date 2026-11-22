import { BrowserHarness } from "./harness.mjs";

async function checkNoLocation() {
  const harness = new BrowserHarness();
  await harness.launch();
  try {
    await harness.navigate(`${harness.baseUrl}/matching`);
    await harness.waitForSelector("table tbody tr td:nth-child(3)", 10000);
    await harness.click("table tbody tr:first-child td:nth-child(3)");
    await harness.waitForSelector("div.fixed.inset-0.z-50", 10000);
    await new Promise((r) => setTimeout(r, 1500));

    const docs = ["Invoice", "PL", "BL", "AK", "WL", "MS"];

    for (const docCode of docs) {
      // Click document button in ComparisonPanel
      await harness.evaluate((code) => {
        const panel = document.querySelector("div.lg\\:col-span-5");
        const buttons = Array.from(panel?.querySelectorAll("button") || []);
        const btn = buttons.find((b) => b.innerText.trim().startsWith(code));
        if (btn) btn.click();
      }, docCode);

      await new Promise((r) => setTimeout(r, 600));

      const missingLocations = await harness.evaluate((code) => {
        const panel = document.querySelector("div.lg\\:col-span-5");
        const cards = Array.from(panel?.querySelectorAll("div.space-y-2\\.5 > div") || []);
        const results = [];

        cards.forEach((card, idx) => {
          const title = card.querySelector("span.font-bold")?.innerText.trim();
          const subcards = card.querySelectorAll("div.grid > div");
          const pibSub = subcards[0];
          const supSub = subcards[1];

          const pibText = pibSub ? pibSub.innerText : "";
          const supText = supSub ? supSub.innerText : "";

          const pibNoLoc = pibText.includes("Lokasi tidak tersedia");
          const supNoLoc = supText.includes("Lokasi tidak tersedia");

          if (pibNoLoc || supNoLoc) {
            results.push({
              fieldIndex: idx + 1,
              title,
              pibNoLoc,
              pibValue: pibSub?.querySelector(".text-xs")?.innerText.trim(),
              supNoLoc,
              supValue: supSub?.querySelector(".text-xs")?.innerText.trim(),
            });
          }
        });

        return results;
      }, docCode);

      console.log(`\n=== Document [${docCode}] Missing Locations (${missingLocations.length}): ===`);
      missingLocations.forEach((m) => {
        console.log(`  ${m.title}:`);
        if (m.pibNoLoc) console.log(`    - PIB: Lokasi tidak tersedia (value: "${m.pibValue}")`);
        if (m.supNoLoc) console.log(`    - ${docCode}: Lokasi tidak tersedia (value: "${m.supValue}")`);
      });
    }
  } finally {
    await harness.close();
  }
}

checkNoLocation();
