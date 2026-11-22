import test from "node:test";
import assert from "node:assert";
import "../helpers/testHelpers";
import { evaluateBatchMatching } from "~/server/nanonets";
import { evaluateDbBatchStatus } from "~/server/matchingEngine";
import { extractPibItem, cleanVal, cleanNum } from "~/utils/itemMatcher";
import { createUscBatchFixture } from "../helpers/mockBatches";

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 10: Canonical Matching Engine Status & Line-Item Matching
// ─────────────────────────────────────────────────────────────────────────────

test("Feature 10.1 (Matching): Fully aligned 7-document batch evaluates to MATCHING", () => {
  const batchDetails = createUscBatchFixture();

  // Test webhook matching evaluation
  const webhookResult = evaluateBatchMatching(batchDetails);
  assert.strictEqual(webhookResult, "MATCHING", "Full aligned USC batch should match in webhook evaluator");

  // Test REST matching status evaluation
  const dbResult = evaluateDbBatchStatus(batchDetails, 7);
  assert.strictEqual(dbResult, "Matching", "Full aligned USC batch should evaluate to Matching in DB evaluator");
});

test("Feature 10.2 (Matching): Invoice number divergence strictly evaluates to MISMATCHING", () => {
  const mismatchedBatch = createUscBatchFixture({
    ciOverrides: {
      fields: {
        "no invoice": "DIFFERENT-INV-9999",
      },
    },
  });

  const webhookResult = evaluateBatchMatching(mismatchedBatch);
  assert.strictEqual(webhookResult, "MISMATCHING", "Divergent invoice number must trigger MISMATCHING");

  const dbResult = evaluateDbBatchStatus(mismatchedBatch, 7);
  assert.strictEqual(dbResult, "Mismatching", "Divergent invoice number must trigger Mismatching in DB evaluator");
});

test("Feature 10.3 (Matching): Valuation / amount divergence triggers MISMATCHING", () => {
  const valuationMismatchBatch = createUscBatchFixture({
    ciOverrides: {
      fields: {
        "nilai total invoice": "999999.00",
      },
    },
  });

  // DB evaluator verifies invoice amounts against PIB Nilai Pabean
  const dbResult = evaluateDbBatchStatus(valuationMismatchBatch, 7);
  assert.strictEqual(dbResult, "Mismatching", "Valuation divergence must trigger Mismatching");
});

test("Feature 10.4 (Matching): Container number discrepancy triggers MISMATCHING", () => {
  const containerMismatchBatch = createUscBatchFixture({
    blOverrides: {
      table: [
        {
          marks: "WRONG_CONTAINER_999",
          qty: "4 COILS",
          desc: "HOT ROLLED STEEL COILS",
          "gross weight": "49120",
        },
      ],
    },
  });

  const webhookResult = evaluateBatchMatching(containerMismatchBatch);
  assert.strictEqual(webhookResult, "MISMATCHING", "Discrepant container number must trigger MISMATCHING");
});

test("Feature 10.5 (Matching): Unfilled or incomplete documents maintain PROSES status", () => {
  const pendingBatch = [
    {
      fileType: "PIB",
      fileId: "f_pib",
      isi: JSON.stringify({ fields: { "no invoice": "USC-INV-2026-8801" } }),
    },
    {
      fileType: "Invoice",
      fileId: "f_ci",
      isi: null, // Still processing
    },
  ];

  const dbResult = evaluateDbBatchStatus(pendingBatch, 2);
  assert.strictEqual(dbResult, "Proses", "Incomplete batch with pending file must return Proses");
});

test("Feature 10.6 (Line-Item Extraction): extractPibItem parses HS codes, part numbers, and quantities", () => {
  const rawPibRow = {
    Pos_Tarif: "7208.38.00",
    Kode_Barang: "SPHC-2.3-1219",
    Spesifikasi_Grade: "SPHC",
    Ukuran_Barang: "2.3 X 1219 X C",
    Jumlah_Satuan_Barang: "2",
    Uraian_Barang: "HOT ROLLED STEEL COIL",
  };

  const extracted = extractPibItem(rawPibRow, 0);

  assert.strictEqual(extracted.hs, "7208.38.00");
  assert.strictEqual(extracted.partNo, "SPHC");
  assert.strictEqual(extracted.qty, "2");
  assert.strictEqual(extracted.desc, "HOT ROLLED STEEL COIL");
  assert.strictEqual(extracted.originalIndex, 0);
  assert.strictEqual(cleanVal(extracted.hs), "72083800");
  assert.strictEqual(cleanNum(extracted.qty), "2");
});

test("Feature 10.7 (No False Match on Empty): Empty strings or '-' do not match genuine identifiers", () => {
  const v1 = cleanVal("-");
  const v2 = cleanVal("USC-INV-2026-8801");
  const vEmpty = cleanVal("");

  assert.strictEqual(v1, "");
  assert.strictEqual(vEmpty, "");
  assert.notStrictEqual(v1, v2);

  // Assert that '-' cannot match a valid value
  const isMatch = v1 !== "" && v2 !== "" && v1 === v2;
  assert.strictEqual(isMatch, false, "Hyphen/placeholder '-' must never match a genuine identifier");
});
