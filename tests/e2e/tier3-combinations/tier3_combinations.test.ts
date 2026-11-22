import test from "node:test";
import assert from "node:assert";
import "../helpers/testHelpers";
import { evaluateBatchMatching } from "~/server/nanonets";
import { evaluateDbBatchStatus } from "~/server/matchingEngine";
import { createUscBatchFixture } from "../helpers/mockBatches";
import { WorkflowStep } from "~/types/workflow";
import { cleanVal } from "~/utils/itemMatcher";

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3: Cross-Feature Combinations (Document Pairings & Data Actions Interop)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Pair 1: PIB + Commercial Invoice ────────────────────────────────────────

test("Tier 3.1 (PIB + CI): Valuation, currency, and invoice identifier alignment", () => {
  const pibCiBatch = createUscBatchFixture({
    includeDocTypes: ["PIB", "Invoice"],
  });

  const webhookResult = evaluateBatchMatching(pibCiBatch);
  assert.strictEqual(webhookResult, "MATCHING", "PIB + CI with identical invoice numbers must match");

  const dbResult = evaluateDbBatchStatus(pibCiBatch, 2);
  assert.strictEqual(dbResult, "Matching", "PIB + CI must evaluate to Matching in DB evaluator");
});

test("Tier 3.2 (PIB + CI): Valuation discrepancy between PIB Nilai Pabean and CI Total triggers mismatch", () => {
  const mismatchedBatch = createUscBatchFixture({
    includeDocTypes: ["PIB", "Invoice"],
    ciOverrides: {
      fields: {
        "nilai total invoice": "65000.00", // Differs from PIB 58450.00
      },
    },
  });

  const dbResult = evaluateDbBatchStatus(mismatchedBatch, 2);
  assert.strictEqual(dbResult, "Mismatching", "Valuation divergence between PIB and CI must cause Mismatching");
});

// ─── Pair 2: PIB + Packing List ──────────────────────────────────────────────

test("Tier 3.3 (PIB + PL): Net weight and gross weight physical alignment", () => {
  const pibPlBatch = createUscBatchFixture({
    includeDocTypes: ["PIB", "Packing List"],
  });

  const webhookResult = evaluateBatchMatching(pibPlBatch);
  assert.strictEqual(webhookResult, "MATCHING");

  const dbResult = evaluateDbBatchStatus(pibPlBatch, 2);
  assert.strictEqual(dbResult, "Matching");
});

test("Tier 3.4 (PIB + PL): Net weight discrepancy triggers mismatch", () => {
  const weightMismatchBatch = createUscBatchFixture({
    includeDocTypes: ["PIB", "Packing List"],
    plOverrides: {
      fields: {
        "net weight": "30000", // Differs from PIB 48500
      },
    },
  });

  const dbResult = evaluateDbBatchStatus(weightMismatchBatch, 2);
  assert.strictEqual(dbResult, "Mismatching", "Net weight discrepancy between PIB and PL must cause Mismatching");
});

// ─── Pair 3: PIB + Bill of Lading ────────────────────────────────────────────

test("Tier 3.5 (PIB + BL): B/L number, container number, and gross weight alignment", () => {
  const pibBlBatch = createUscBatchFixture({
    includeDocTypes: ["PIB", "Bill of Lading"],
  });

  const webhookResult = evaluateBatchMatching(pibBlBatch);
  assert.strictEqual(webhookResult, "MATCHING");

  const dbResult = evaluateDbBatchStatus(pibBlBatch, 2);
  assert.strictEqual(dbResult, "Matching");
});

test("Tier 3.6 (PIB + BL): Divergent B/L number strictly triggers mismatch", () => {
  const blMismatchBatch = createUscBatchFixture({
    includeDocTypes: ["PIB", "Bill of Lading"],
    blOverrides: {
      fields: {
        "no bl": "HDMU_DIFFERENT_9999",
      },
    },
  });

  const webhookResult = evaluateBatchMatching(blMismatchBatch);
  assert.strictEqual(webhookResult, "MISMATCHING");

  const dbResult = evaluateDbBatchStatus(blMismatchBatch, 2);
  assert.strictEqual(dbResult, "Mismatching");
});

// ─── Pair 4: PIB + Form AK (Certificate of Origin) ──────────────────────────

test("Tier 3.7 (PIB + AK): Preferential origin HS code and reference verification", () => {
  const pibAkBatch = createUscBatchFixture({
    includeDocTypes: ["PIB", "AK"],
  });

  const pibIsi = JSON.parse(pibAkBatch.find((b) => b.fileType === "PIB")!.isi);
  const akIsi = JSON.parse(pibAkBatch.find((b) => b.fileType === "AK")!.isi);

  // Cross-check item HS Codes
  const pibHs = cleanVal(pibIsi.table[0]["pos tarif"]);
  const akHs = cleanVal(akIsi.table[0]["hs code"]);
  assert.strictEqual(pibHs, akHs, "HS code on PIB and Form AK must match");

  const dbResult = evaluateDbBatchStatus(pibAkBatch, 2);
  assert.strictEqual(dbResult, "Matching");
});

// ─── Pair 5: PIB + Weight List ───────────────────────────────────────────────

test("Tier 3.8 (PIB + WL): Total net weight consistency across coil list", () => {
  const pibWlBatch = createUscBatchFixture({
    includeDocTypes: ["PIB", "WL"],
  });

  const pibIsi = JSON.parse(pibWlBatch.find((b) => b.fileType === "PIB")!.isi);
  const wlIsi = JSON.parse(pibWlBatch.find((b) => b.fileType === "WL")!.isi);

  const pibWeight = parseFloat(pibIsi.fields["berat bersih"]);
  const wlWeight = parseFloat(wlIsi.fields["net weight"]);
  assert.strictEqual(pibWeight, wlWeight, "PIB Net weight and WL Net weight must be identical");

  const dbResult = evaluateDbBatchStatus(pibWlBatch, 2);
  assert.strictEqual(dbResult, "Matching");
});

// ─── Pair 6: PIB + Mill Test Certificate ─────────────────────────────────────

test("Tier 3.9 (PIB + MS): Steel specification grade alignment", () => {
  const pibMsBatch = createUscBatchFixture({
    includeDocTypes: ["PIB", "MS"],
  });

  const pibIsi = JSON.parse(pibMsBatch.find((b) => b.fileType === "PIB")!.isi);
  const msIsi = JSON.parse(pibMsBatch.find((b) => b.fileType === "MS")!.isi);

  const pibGrade = pibIsi.table[0]["spesifikasi grade"].trim().toLowerCase();
  const msGrade = msIsi.fields["spek material"].trim().toLowerCase();
  assert.ok(msGrade.includes(pibGrade), "MTC material spec must contain PIB steel grade");

  const dbResult = evaluateDbBatchStatus(pibMsBatch, 2);
  assert.strictEqual(dbResult, "Matching");
});

// ─── Data Actions _action Fields Interacting with Matching Engine ────────────

test("Tier 3.10 (Action Prioritization): Matching engine prioritizes [fieldName]_action over dirty raw value", () => {
  // Scenario: Raw invoice number on CI has trailing suffix and punctuation: "USC-INV-2026-8801/REV"
  // PIB has clean invoice: "USC-INV-2026-8801"
  // Data Action strips "/REV" into No_Invoice_action = "USC-INV-2026-8801"

  const cleanupStep: WorkflowStep = {
    id: "step_clean_rev",
    name: "Strip Revision",
    description: "Remove /REV suffix from invoice",
    docScope: "invoice",
    targetField: "No_Invoice",
    action: {
      type: "replace_text",
      config: {
        findText: "/REV",
        replaceWith: "",
        isRegex: false,
        matchCase: false,
      },
    },
    enabled: true,
  };

  const batch = createUscBatchFixture({
    includeDocTypes: ["PIB", "Invoice"],
    ciOverrides: {
      fields: {
        "no invoice": "USC-INV-2026-8801/REV",
      },
    },
    activeDataActions: [cleanupStep],
  });

  const ciDoc = JSON.parse(batch.find((b) => b.fileType === "Invoice")!.isi);
  assert.strictEqual(ciDoc.fields["No_Invoice"], "USC-INV-2026-8801/REV");
  assert.strictEqual(ciDoc.fields["No_Invoice_action"], "USC-INV-2026-8801");

  // With the action value resolving to clean invoice number, evaluateDbBatchStatus uses _action and matches!
  const dbResult = evaluateDbBatchStatus(batch, 2);
  assert.strictEqual(
    dbResult,
    "Matching",
    "Matching engine must prioritize No_Invoice_action to resolve raw mismatch"
  );
});

test("Tier 3.11 (Action Prioritization): Raw weight with units resolved by number_formatting action", () => {
  // Scenario: Raw net weight on PL has "48,500.00 KGS"
  // Data Action strips commas and units to "48500"
  const weightStep: WorkflowStep = {
    id: "step_clean_wt",
    name: "Clean Weight",
    description: "Strip commas and KGS",
    docScope: "packing",
    targetField: "Total_Net_Weight",
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
  };

  const batch = createUscBatchFixture({
    includeDocTypes: ["PIB", "Packing List"],
    plOverrides: {
      fields: {
        "net weight": "48,500.00 KGS",
      },
    },
    activeDataActions: [weightStep],
  });

  const plDoc = JSON.parse(batch.find((b) => b.fileType === "Packing List")!.isi);
  assert.strictEqual(plDoc.fields["Total_Net_Weight_action"], "48500");

  const dbResult = evaluateDbBatchStatus(batch, 2);
  assert.strictEqual(dbResult, "Matching", "Cleaned weight via _action field should match PIB Berat Bersih");
});

test("Tier 3.12 (Multi-Action Pipeline): Combined invoice and date transformations on full batch", () => {
  const steps: WorkflowStep[] = [
    {
      id: "s_trim",
      name: "Trim Invoices",
      description: "Trim whitespace",
      docScope: "all",
      targetField: "No_Invoice",
      action: {
        type: "trim_whitespace",
        config: { trimEdges: true, collapseMultiple: true, removeAllSpaces: false },
      },
      enabled: true,
    },
    {
      id: "s_upper",
      name: "Upper Invoices",
      description: "Uppercase invoice",
      docScope: "all",
      targetField: "No_Invoice",
      action: {
        type: "case_transform",
        config: { transform: "uppercase" },
      },
      enabled: true,
    },
  ];

  const batch = createUscBatchFixture({
    activeDataActions: steps,
  });

  const dbResult = evaluateDbBatchStatus(batch, 7);
  assert.strictEqual(dbResult, "Matching");
});
