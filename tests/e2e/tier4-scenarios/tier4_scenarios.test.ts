import test from "node:test";
import assert from "node:assert";
import "../helpers/testHelpers";
import { evaluateBatchMatching } from "~/server/nanonets";
import { evaluateDbBatchStatus } from "~/server/matchingEngine";
import { createUscBatchFixture } from "../helpers/mockBatches";
import { WorkflowStep } from "~/types/workflow";
import { extractPibItem, cleanVal, cleanNum } from "~/utils/itemMatcher";
import { parseNumericValue } from "../helpers/testHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4: Real-World Application Scenarios (PT. UNITED STEEL CENTER INDONESIA)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Scenario 1: Golden Batch (Perfect Steel Shipment) ──────────────────────

test("Tier 4.1 (Scenario 1 - Golden Batch): Full 7-document steel shipment matches with zero discrepancies", () => {
  const goldenBatch = createUscBatchFixture();

  // 1. Webhook evaluation check
  const webhookResult = evaluateBatchMatching(goldenBatch);
  assert.strictEqual(webhookResult, "MATCHING", "Golden batch must match in webhook evaluator");

  // 2. DB REST evaluation check
  const dbResult = evaluateDbBatchStatus(goldenBatch, 7);
  assert.strictEqual(dbResult, "Matching", "Golden batch must evaluate to Matching in DB status evaluator");

  // 3. Document inventory completeness
  assert.strictEqual(goldenBatch.length, 7, "All 7 USC documents must be present");

  const docTypes = goldenBatch.map((d) => d.fileType);
  assert.ok(docTypes.includes("PIB"));
  assert.ok(docTypes.includes("Invoice"));
  assert.ok(docTypes.includes("Packing List"));
  assert.ok(docTypes.includes("Bill of Lading"));
  assert.ok(docTypes.includes("AK"));
  assert.ok(docTypes.includes("WL"));
  assert.ok(docTypes.includes("MS"));

  // 4. Verify weight reconciliation across documents
  const pibIsi = JSON.parse(goldenBatch.find((d) => d.fileType === "PIB")!.isi);
  const ciIsi = JSON.parse(goldenBatch.find((d) => d.fileType === "Invoice")!.isi);
  const plIsi = JSON.parse(goldenBatch.find((d) => d.fileType === "Packing List")!.isi);
  const blIsi = JSON.parse(goldenBatch.find((d) => d.fileType === "Bill of Lading")!.isi);
  const wlIsi = JSON.parse(goldenBatch.find((d) => d.fileType === "WL")!.isi);

  const pibNet = parseNumericValue(pibIsi.fields["berat bersih"]);
  const ciNet = parseNumericValue(ciIsi.fields["net weight"]);
  const plNet = parseNumericValue(plIsi.fields["net weight"]);
  const wlNet = parseNumericValue(wlIsi.fields["net weight"]);

  assert.strictEqual(pibNet, 48500);
  assert.strictEqual(ciNet, 48500);
  assert.strictEqual(plNet, 48500);
  assert.strictEqual(wlNet, 48500);

  const pibGross = parseNumericValue(pibIsi.fields["berat kotor"]);
  const ciGross = parseNumericValue(ciIsi.fields["gross weight"]);
  const plGross = parseNumericValue(plIsi.fields["gross weight"]);
  const blGross = parseNumericValue(blIsi.fields["gross weight"]);
  const wlGross = parseNumericValue(wlIsi.fields["gross weight"]);

  assert.strictEqual(pibGross, 49120);
  assert.strictEqual(ciGross, 49120);
  assert.strictEqual(plGross, 49120);
  assert.strictEqual(blGross, 49120);
  assert.strictEqual(wlGross, 49120);
});

// ─── Scenario 2: Multi-Item Steel Batch (Diverse HS & Sizes) ─────────────────

test("Tier 4.2 (Scenario 2 - Multi-Item Batch): 4-coil batch with distinct HS codes and dimensions", () => {
  const multiItemPibTable = [
    { "pos tarif": "7208.39.00", "kode barang": "SPHC-1.6", "spesifikasi grade": "SPHC", "ukuran barang": "1.6 X 1219 X C", "jumlah barang": "1", "harga satuan": "1250.00" },
    { "pos tarif": "7208.38.00", "kode barang": "SPHC-2.3", "spesifikasi grade": "SPHC", "ukuran barang": "2.3 X 1219 X C", "jumlah barang": "1", "harga satuan": "1200.00" },
    { "pos tarif": "7208.38.00", "kode barang": "SPHC-3.2", "spesifikasi grade": "SPHC", "ukuran barang": "3.2 X 1219 X C", "jumlah barang": "1", "harga satuan": "1200.00" },
    { "pos tarif": "7208.37.00", "kode barang": "SS400-4.5", "spesifikasi grade": "SS400", "ukuran barang": "4.5 X 1500 X C", "jumlah barang": "1", "harga satuan": "1180.00" },
  ];

  const multiItemCiTable = [
    { spesifikasi: "SPHC", "ukuran barang": "1.6 X 1219 X C", "harga satuan": "1250.00" },
    { spesifikasi: "SPHC", "ukuran barang": "2.3 X 1219 X C", "harga satuan": "1200.00" },
    { spesifikasi: "SPHC", "ukuran barang": "3.2 X 1219 X C", "harga satuan": "1200.00" },
    { spesifikasi: "SS400", "ukuran barang": "4.5 X 1500 X C", "harga satuan": "1180.00" },
  ];

  const multiItemBatch = createUscBatchFixture({
    pibOverrides: {
      fields: { "jumlah coil": "4" },
      table: multiItemPibTable,
    },
    ciOverrides: {
      fields: { "jumlah coil": "4" },
      table: multiItemCiTable,
    },
  });

  const pibDoc = JSON.parse(multiItemBatch.find((d) => d.fileType === "PIB")!.isi);
  assert.strictEqual(pibDoc.table.length, 4);

  // Cross-verify each item corresponds accurately
  for (let i = 0; i < pibDoc.table.length; i++) {
    const item = extractPibItem(pibDoc.table[i], i);
    assert.ok(item.hs.startsWith("7208"), `Item ${i} HS must be hot-rolled steel`);
    assert.strictEqual(cleanNum(item.qty), "1");
  }

  const webhookResult = evaluateBatchMatching(multiItemBatch);
  assert.strictEqual(webhookResult, "MATCHING");

  const dbResult = evaluateDbBatchStatus(multiItemBatch, 7);
  assert.strictEqual(dbResult, "Matching");
});

// ─── Scenario 3: Discrepancy Reporting Batch ─────────────────────────────────

test("Tier 4.3 (Scenario 3 - Discrepancy Detection): Gross weight inflation on BL flags batch as MISMATCHING", () => {
  // Scenario: Carrier B/L indicates 55,000 kg gross weight due to scale discrepancy,
  // but PIB and Packing List declare 49,120 kg.
  const discrepancyBatch = createUscBatchFixture({
    blOverrides: {
      fields: {
        "gross weight": "55000", // Inflated by +5,880 kg
      },
    },
  });

  const dbResult = evaluateDbBatchStatus(discrepancyBatch, 7);
  assert.strictEqual(
    dbResult,
    "Mismatching",
    "Gross weight discrepancy between PIB and B/L must strictly evaluate to Mismatching"
  );

  const pibDoc = JSON.parse(discrepancyBatch.find((d) => d.fileType === "PIB")!.isi);
  const blDoc = JSON.parse(discrepancyBatch.find((d) => d.fileType === "Bill of Lading")!.isi);

  const pibGross = parseNumericValue(pibDoc.fields["berat kotor"]);
  const blGross = parseNumericValue(blDoc.fields["gross weight"]);
  const discrepancy = blGross - pibGross;

  assert.strictEqual(discrepancy, 5880, "Discrepancy quantity must be exactly 5,880 kg");
});

// ─── Scenario 4: OCR Noise Resolution via Data Actions Pipeline ──────────────

test("Tier 4.4 (Scenario 4 - Data Actions Pipeline Resolution): Dirty OCR noise resolved by chained rules into MATCHING", () => {
  // Real-world scenario:
  // - Invoice number on CI extracted with OCR prefix: "INV# USC-INV-2026-8801"
  // - Weight extracted with commas and text: "48,500.00 KGS"
  // - Without Data Actions, raw values cause MISMATCHING.
  // - With Data Actions applied, fields become clean, resulting in MATCHING.

  const rawDirtyBatch = createUscBatchFixture({
    ciOverrides: {
      fields: {
        "no invoice": "INV# USC-INV-2026-8801",
      },
    },
    plOverrides: {
      fields: {
        "net weight": "48,500.00 KGS",
      },
    },
  });

  // Verify that raw dirty values fail matching without Data Actions
  const rawDbResult = evaluateDbBatchStatus(rawDirtyBatch, 7);
  assert.strictEqual(
    rawDbResult,
    "Mismatching",
    "Dirty raw values without Data Actions must produce Mismatching"
  );

  // Now configure the active Data Actions pipeline
  const pipelineSteps: WorkflowStep[] = [
    {
      id: "step_clean_inv_prefix",
      name: "Remove INV# Prefix",
      description: "Strip OCR prefix INV# ",
      docScope: "invoice",
      targetField: "No_Invoice",
      action: {
        type: "replace_text",
        config: {
          findText: "INV# ",
          replaceWith: "",
          isRegex: false,
          matchCase: false,
        },
      },
      enabled: true,
    },
    {
      id: "step_format_net_wt",
      name: "Format Net Weight",
      description: "Strip commas and KGS from net weight",
      docScope: "all",
      targetField: "Total_Net_Weight",
      targetFields: ["Net_Weight", "Total_Net_Weight"],
      action: {
        type: "number_formatting",
        config: {
          removeCommas: true,
          decimalFormat: "dot",
          roundDecimals: 0,
          stripCurrency: false,
          stripUnits: true,
        },
      },
      enabled: true,
    },
  ];

  const resolvedBatch = createUscBatchFixture({
    ciOverrides: {
      fields: {
        "no invoice": "INV# USC-INV-2026-8801",
      },
    },
    plOverrides: {
      fields: {
        "net weight": "48,500.00 KGS",
      },
    },
    activeDataActions: pipelineSteps,
  });

  // Verify that Data Actions created the cleaned action values
  const ciDoc = JSON.parse(resolvedBatch.find((d) => d.fileType === "Invoice")!.isi);
  assert.strictEqual(ciDoc.fields["No_Invoice_action"], "USC-INV-2026-8801");

  const plDoc = JSON.parse(resolvedBatch.find((d) => d.fileType === "Packing List")!.isi);
  assert.strictEqual(plDoc.fields["Total_Net_Weight_action"], "48500");

  // Verify that the matching engine prioritizes _action and resolves the batch to Matching!
  const resolvedDbResult = evaluateDbBatchStatus(resolvedBatch, 7);
  assert.strictEqual(
    resolvedDbResult,
    "Matching",
    "Batch must resolve to Matching once Data Actions pipeline computes clean _action values"
  );
});

// ─── Scenario 5: Form AK Origin Verification ─────────────────────────────────

test("Tier 4.5 (Scenario 5 - Form AK Verification): Exporter and preferential origin validation", () => {
  const batch = createUscBatchFixture();
  const akDoc = JSON.parse(batch.find((d) => d.fileType === "AK")!.isi);

  assert.strictEqual(akDoc.fields["nama exporter shipper"], "POSCO ASIA CO., LTD.");
  assert.strictEqual(akDoc.fields["nama consignee"], "PT. UNITED STEEL CENTER INDONESIA");
  assert.strictEqual(akDoc.fields["nama pelabuhan bongkar"], "TANJUNG PRIOK, JAKARTA");

  for (const item of akDoc.table) {
    assert.strictEqual(item["kriteria asal barang"], "RVC 40%", "Origin criterion must meet RVC 40% rule");
    assert.ok(item["berat kuantitas"].endsWith("KG"), "Weight must be denominated in KG");
  }
});

// ─── Scenario 6: Coil-by-Coil Weight Reconciliation ──────────────────────────

test("Tier 4.6 (Scenario 6 - Weight Reconciliation): Weight List individual coil breakdown matches batch total", () => {
  const batch = createUscBatchFixture();
  const wlDoc = JSON.parse(batch.find((d) => d.fileType === "WL")!.isi);

  assert.strictEqual(wlDoc.table.length, 4, "Batch must contain exactly 4 coils");

  let totalNet = 0;
  let totalGross = 0;

  for (const coil of wlDoc.table) {
    const net = parseFloat(coil["net weight"]);
    const gross = parseFloat(coil["gross weight"]);
    assert.ok(net > 10000 && net < 15000, "Coil weight must fall within standard steel mill coil range (10-15 tons)");
    assert.ok(gross > net, "Gross weight must exceed net weight due to packaging/banding");
    totalNet += net;
    totalGross += gross;
  }

  assert.strictEqual(totalNet, 48500, "Sum of coil net weights must equal 48,500 kg");
  assert.strictEqual(totalGross, 49120, "Sum of coil gross weights must equal 49,120 kg");
});
