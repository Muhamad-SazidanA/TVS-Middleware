import test from "node:test";
import assert from "node:assert";
import "../helpers/testHelpers";
import {
  evaluateCanonicalBatchMatching,
  compareFieldStrict,
  matchDocumentItemsStrict,
  extractStandardLineItem,
  getFieldVal,
  getVal,
  parseDocIsi,
  type StandardLineItem,
} from "~/utils/canonicalMatcher";
import {
  applyWorkflowStep,
  executeDataPipeline,
  applyDataActionsToFields,
  applyDataActionsToTableRows,
} from "~/utils/workflowRunner";
import { matchPibAndRekapItems, cleanVal, cleanNum } from "~/utils/itemMatcher";
import { isEquivalentMatch } from "~/utils/valueEquivalency";
import { createUscBatchFixture } from "../helpers/mockBatches";
import type { WorkflowStep } from "~/types/workflow";
import { evaluateBatchMatching } from "~/server/nanonets";
import { evaluateDbBatchStatus } from "~/server/matchingEngine";

// ─────────────────────────────────────────────────────────────────────────────
// TIER 5: ADVERSARIAL STRESS TESTING & COVERAGE HARDENING
// ─────────────────────────────────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1: Extreme Numeric Precision and Boundary Weights
// ═════════════════════════════════════════════════════════════════════════════

test("Tier 5.1 (Numeric Precision): Micro-currency amounts and fractional cents under Data Actions & Matching", () => {
  // Test unit price with micro-currency precision ($0.00005 vs $0.00005)
  const stepRound4: WorkflowStep = {
    id: "step-round-4",
    name: "Round 4 Decimals",
    description: "",
    enabled: true,
    docScope: "ci",
    targetField: "Harga_Satuan",
    targetFields: ["Harga_Satuan"],
    action: {
      type: "number_formatting",
      config: {
        stripCurrency: true,
        removeCommas: true,
        roundDecimals: 4,
        decimalFormat: "dot",
        stripUnits: false,
      },
    },
  };

  const formattedMicro = applyWorkflowStep("$0.000055", stepRound4, "ci");
  assert.strictEqual(formattedMicro.output, "0.0001", "0.000055 rounded to 4 decimals must be 0.0001");

  const formattedLargeMicro = applyWorkflowStep("USD 1234.56789", stepRound4, "ci");
  assert.strictEqual(formattedLargeMicro.output, "1234.5679", "1234.56789 rounded to 4 decimals must be 1234.5679");

  // In canonical matching, verify price discrepancy on fractional divergence
  const pibItem: StandardLineItem = {
    itemIndex: 0,
    hsCode: "7208.38.00",
    partNo: "SPHC 2.3 X 1219 X C",
    spec: "SPHC",
    size: "2.3 X 1219 X C",
    desc: "HOT ROLLED STEEL COIL",
    qty: "10",
    unit: "COIL",
    netWeight: "25000",
    grossWeight: "25200",
    price: "850.55",
    raw: {},
    usedAction: false,
  };

  const ciItemDivergent: StandardLineItem = {
    ...pibItem,
    price: "850.56", // 1 cent difference
  };

  const matchRes = matchDocumentItemsStrict([pibItem], [ciItemDivergent], "Invoice");
  assert.strictEqual(matchRes.length, 1);
  assert.strictEqual(matchRes[0]!.priceMatch, false, "1-cent price difference must flag priceMatch as false");
  assert.strictEqual(matchRes[0]!.isMatch, false, "Item must not match when price diverges");
  assert.ok(
    matchRes[0]!.discrepancies.some((d) => d.includes("Harga satuan berbeda")),
    "Discrepancy must explicitly report unit price divergence"
  );
});

test("Tier 5.2 (Numeric Precision): Extreme large numbers (> 10^9) and fractional kilogram weights", () => {
  // Test weights exceeding 1 billion kilograms (> 10^9 kg)
  const extremeWeight = "1,250,000,000.75";
  const matchingComp = compareFieldStrict("PL", "Berat Bersih", extremeWeight, "1,250,000,000.75");
  assert.strictEqual(matchingComp.status, "MATCH", "Identical billion-kg weights must match");
  assert.strictEqual(matchingComp.isMatch, true);

  // Divergence of just 0.05 kg on a 1.25 billion kg cargo must NOT be rounded away
  const divergentComp = compareFieldStrict("PL", "Berat Bersih", extremeWeight, "1,250,000,000.80");
  assert.strictEqual(divergentComp.status, "MISMATCH", "Small fractional weight divergence must strictly trigger MISMATCH");
  assert.strictEqual(divergentComp.isMatch, false);

  // Tiny fractional weights (e.g. 0.0001 kg lab sample or precious alloy test)
  const tinyMatch = compareFieldStrict("WL", "Berat Bersih", "0.0001", "0.0001");
  assert.strictEqual(tinyMatch.status, "MATCH");
  const tinyMismatch = compareFieldStrict("WL", "Berat Bersih", "0.0001", "0.0002");
  assert.strictEqual(tinyMismatch.status, "MISMATCH");
});

test("Tier 5.3 (Numeric Precision): Boundary zeroes, negative values, and scientific notation", () => {
  // Negative weights must strictly fail match against positive weights
  const negComp = compareFieldStrict("PL", "Berat Bersih", "48500", "-48500");
  assert.strictEqual(negComp.status, "MISMATCH");
  assert.strictEqual(negComp.isMatch, false);

  // Zero weight must not match genuine cargo weight
  const zeroComp = compareFieldStrict("PL", "Berat Bersih", "48500", "0");
  assert.strictEqual(zeroComp.status, "MISMATCH");
  assert.strictEqual(zeroComp.isMatch, false);

  // Trailing zeros normalization in cleanNum
  assert.strictEqual(cleanNum("48500.00"), "48500");
  assert.strictEqual(cleanNum("48,500.00"), "48500");
  assert.strictEqual(cleanNum("48500.50"), "48500.50"); // non-zero decimal preserved
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2: Unicode, Non-ASCII, and Weird Characters Handling
// ═════════════════════════════════════════════════════════════════════════════

test("Tier 5.4 (Unicode & CJK): International steel supplier names and buyer entities", () => {
  // Korean / Hanzi / Japanese entity names in customs documents
  const poscoFull = "POSCO 浦項製鐵 株式会社 (Pohang Iron & Steel Co., Ltd.)";
  const poscoMatch = compareFieldStrict("Invoice", "Identitas Penjual", poscoFull, poscoFull);
  assert.strictEqual(poscoMatch.status, "MATCH");
  assert.strictEqual(poscoMatch.isMatch, true);

  // Subtle Hanzi divergence (Pohang vs Hyundai in Hanzi)
  const poscoDivergent = "POSCO 現代製鐵 株式会社";
  const poscoHanziMismatch = compareFieldStrict("Invoice", "Identitas Penjual", poscoFull, poscoDivergent);
  assert.strictEqual(poscoHanziMismatch.status, "MISMATCH");
  assert.strictEqual(poscoHanziMismatch.isMatch, false);

  // Cyrillic and accented European entities
  const euroSupplier = "Société Générale de Métallurgie — ThyssenKrupp AG (Duisburg/Essen)";
  const euroMatch = compareFieldStrict("Invoice", "Identitas Penjual", euroSupplier, euroSupplier);
  assert.strictEqual(euroMatch.status, "MATCH");

  // Accented Latin vs non-accented Latin: strict mismatch without custom equivalency rule
  const accented = "Société de Métallurgie";
  const unaccented = "Societe de Metallurgie";
  const accentMismatch = compareFieldStrict("Invoice", "Identitas Penjual", accented, unaccented);
  assert.strictEqual(accentMismatch.status, "MISMATCH", "Unregistered accented vs unaccented names must mismatch");
});

test("Tier 5.5 (Unicode & Special Symbols): Steel specs with multiplication signs, degrees, Greek letters", () => {
  // Steel dimension with Unicode multiplication sign '×' (U+00D7) vs ASCII 'X' / 'x'
  const pibItem: StandardLineItem = {
    itemIndex: 0,
    hsCode: "7208.38.00",
    partNo: "SPHC 2.3 X 1219 X C",
    spec: "SPHC",
    size: "2.3 X 1219 X C",
    desc: "HOT ROLLED STEEL COIL SPHC 2.3MM",
    qty: "10",
    unit: "COIL",
    netWeight: "25000",
    grossWeight: "25200",
    price: "850",
    raw: {},
    usedAction: false,
  };

  // Target item with Unicode multiplication symbol '×' (U+00D7)
  const targetItemUnicode: StandardLineItem = {
    ...pibItem,
    size: "2.3 \u00D7 1219 \u00D7 C", // 2.3 × 1219 × C
  };

  // cleanVal strips non-alphanumeric, transforming "2.3 X 1219 X C" -> "23x1219xc"
  // and "2.3 × 1219 × C" -> "231219c" (since × is non-alphanumeric)
  // Let's test how data action replace_text can normalize Unicode multiplication sign to 'X'
  const stepNormMultiply: WorkflowStep = {
    id: "step-norm-mult",
    name: "Normalize Multiplication Sign",
    description: "",
    enabled: true,
    docScope: "ci",
    targetField: "Ukuran_Barang",
    targetFields: ["Ukuran_Barang"],
    action: {
      type: "replace_text",
      config: {
        findText: "\u00D7",
        replaceWith: "X",
        isRegex: true,
        matchCase: false,
      },
    },
  };

  const normalizedSize = applyWorkflowStep(targetItemUnicode.size, stepNormMultiply, "ci");
  assert.strictEqual(normalizedSize.output, "2.3 X 1219 X C", "Unicode multiplication sign must normalize to X");

  // With normalized size, strict item matcher achieves 100% match
  const normalizedTargetItem: StandardLineItem = {
    ...targetItemUnicode,
    size: normalizedSize.output,
  };
  const matchResult = matchDocumentItemsStrict([pibItem], [normalizedTargetItem], "Invoice");
  assert.strictEqual(matchResult.length, 1);
  assert.strictEqual(matchResult[0]!.isMatch, true, "Items with normalized dimension must match");
});

test("Tier 5.6 (Weird Whitespace & Non-Printable): Zero-width spaces, RTL marks, non-breaking spaces", () => {
  // Invoice number containing zero-width space (\u200B) and non-breaking space (\u00A0)
  const rawInvoiceDirty = "INV\u200B/2026\u00A0/USC-001\u200E";
  const cleanExpected = "INV/2026/USC-001";

  // Data action to strip non-printable zero-width characters
  const stepStripWeird: WorkflowStep = {
    id: "step-strip-weird",
    name: "Strip Weird Invisible Characters",
    description: "",
    enabled: true,
    docScope: "all",
    targetField: "No_Invoice",
    targetFields: ["No_Invoice"],
    action: {
      type: "replace_text",
      config: {
        findText: "[\u200B\u200E\u00A0]",
        replaceWith: "",
        isRegex: true,
        matchCase: false,
      },
    },
  };

  const pipeRes = applyWorkflowStep(rawInvoiceDirty, stepStripWeird);
  assert.strictEqual(pipeRes.output, cleanExpected, "Zero-width and non-breaking spaces must be stripped cleanly");

  // In canonical matching, verify raw dirty invoice mismatches clean PIB, but matches once cleaned
  const compDirty = compareFieldStrict("Invoice", "No Invoice", cleanExpected, rawInvoiceDirty);
  assert.strictEqual(compDirty.status, "MISMATCH");

  const compClean = compareFieldStrict("Invoice", "No Invoice", cleanExpected, pipeRes.output, true);
  assert.strictEqual(compClean.status, "MATCH");
  assert.strictEqual(compClean.usedActionValue, true);
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3: Mismatched Coil Counts across PL, WL, and PIB
// ═════════════════════════════════════════════════════════════════════════════

test("Tier 5.7 (Coil Count Mismatch): Packing List declared coil count differs from PIB", () => {
  // PIB declares 10 coils; PL declares 8 coils (2 missing coils)
  const batch = createUscBatchFixture({
    pibOverrides: {
      fields: {
        Jumlah_Coil: "10",
        "Jumlah Package": "10",
      },
    },
    plOverrides: {
      fields: {
        Total_Coils: "8",
        Total_Packages: "8",
      },
    },
  });

  const report = evaluateCanonicalBatchMatching(batch, 7, "batch-pl-coils-mismatch");
  assert.strictEqual(report.status, "MISMATCHING", "Batch with mismatched coil count must be MISMATCHING");
  assert.strictEqual(report.uiStatus, "Mismatching");

  // Check header comparison for PL
  const plHeaders = report.headerComparison["Packing List"] || [];
  const coilCheck = plHeaders.find((h) => h.fieldName === "Jumlah Coil");
  assert.ok(coilCheck, "Jumlah Coil check must exist in Packing List header comparison");
  assert.strictEqual(coilCheck.status, "MISMATCH");
  assert.strictEqual(coilCheck.pibValue, "10");
  assert.strictEqual(coilCheck.targetValue, "8");
});

test("Tier 5.8 (Coil Count Mismatch): Weight List declared coil count differs from PIB", () => {
  // PIB declares 4 coils; WL declares 5 coils
  const batch = createUscBatchFixture({
    pibOverrides: {
      fields: {
        Jumlah_Coil: "4",
      },
    },
    wlOverrides: {
      fields: {
        Total_Coils: "5",
        Jumlah_Coil: "5",
      },
    },
  });

  const report = evaluateCanonicalBatchMatching(batch, 7, "batch-wl-coils-mismatch");
  assert.strictEqual(report.status, "MISMATCHING", "Batch with mismatched WL coil count must evaluate to MISMATCHING");

  const wlHeaders = report.headerComparison["WL"] || [];
  const coilCheck = wlHeaders.find((h) => h.fieldName === "Jumlah Coil");
  assert.ok(coilCheck, "Jumlah Coil check must exist in WL header comparison");
  assert.strictEqual(coilCheck.status, "MISMATCH");
  assert.strictEqual(coilCheck.pibValue, "4");
  assert.strictEqual(coilCheck.targetValue, "5");
});

test("Tier 5.9 (Coil Table Row Mismatch): Weight List individual coil row missing coil number or weight", () => {
  // PIB has 3 items
  const pibItems: StandardLineItem[] = [
    { itemIndex: 0, hsCode: "7208.38.00", partNo: "SPHC 2.3 X 1219 X C", spec: "SPHC", size: "2.3 X 1219 X C", desc: "COIL 1", qty: "1", unit: "COIL", netWeight: "12000", grossWeight: "12050", price: "850", raw: {}, usedAction: false },
    { itemIndex: 1, hsCode: "7208.38.00", partNo: "SPHC 2.3 X 1219 X C", spec: "SPHC", size: "2.3 X 1219 X C", desc: "COIL 2", qty: "1", unit: "COIL", netWeight: "12000", grossWeight: "12050", price: "850", raw: {}, usedAction: false },
    { itemIndex: 2, hsCode: "7208.38.00", partNo: "SPHC 2.3 X 1219 X C", spec: "SPHC", size: "2.3 X 1219 X C", desc: "COIL 3", qty: "1", unit: "COIL", netWeight: "12000", grossWeight: "12050", price: "850", raw: {}, usedAction: false },
  ];

  // WL has 3 coils, but coil #2 has blank coilNo and blank weight (corrupted row)
  const wlCorruptedItems: StandardLineItem[] = [
    { itemIndex: 0, hsCode: "", partNo: "COIL-001", spec: "", size: "", desc: "", qty: "1", unit: "", netWeight: "12000", grossWeight: "12050", price: "", coilNo: "COIL-001", raw: {}, usedAction: false },
    { itemIndex: 1, hsCode: "", partNo: "", spec: "", size: "", desc: "", qty: "1", unit: "", netWeight: "", grossWeight: "", price: "", coilNo: "", raw: {}, usedAction: false }, // EMPTY
    { itemIndex: 2, hsCode: "", partNo: "COIL-003", spec: "", size: "", desc: "", qty: "1", unit: "", netWeight: "12000", grossWeight: "12050", price: "", coilNo: "COIL-003", raw: {}, usedAction: false },
  ];

  const matchResults = matchDocumentItemsStrict(pibItems, wlCorruptedItems, "WL");
  assert.strictEqual(matchResults.length, 3);
  assert.strictEqual(matchResults[0]!.isMatch, true);
  assert.strictEqual(matchResults[1]!.isMatch, false, "Corrupted coil row #2 must be flagged as non-matching");
  assert.ok(
    matchResults[1]!.discrepancies.some((d) => d.includes("Data coil baris #2 tidak lengkap")),
    "Discrepancy must indicate incomplete coil data on line #2"
  );
  assert.strictEqual(matchResults[2]!.isMatch, true);
});

test("Tier 5.10 (Coil Weight Mismatch): WL aggregate net weight divergence from PIB", () => {
  // PIB has net weight 48,500 kg, but WL total net weight is 46,000 kg (loss of 2,500 kg)
  const batch = createUscBatchFixture({
    wlOverrides: {
      fields: {
        Net_Weight: "46000",
        Total_Net_Weight: "46000",
        Berat_Bersih: "46000",
      },
    },
  });

  const report = evaluateCanonicalBatchMatching(batch, 7, "batch-wl-net-loss");
  assert.strictEqual(report.status, "MISMATCHING", "Net weight discrepancy on WL must fail batch matching");

  const wlHeaders = report.headerComparison["WL"] || [];
  const netWeightCheck = wlHeaders.find((h) => h.fieldName === "Berat Bersih");
  assert.ok(netWeightCheck);
  assert.strictEqual(netWeightCheck.status, "MISMATCH");
  assert.strictEqual(netWeightCheck.pibValue, "48500");
  assert.strictEqual(netWeightCheck.targetValue, "46000");
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4: Permutations of Out-of-Order Line Items across Documents
// ═════════════════════════════════════════════════════════════════════════════

const MULTI_PIB_ITEMS: StandardLineItem[] = [
  { itemIndex: 0, hsCode: "7208.38.00", partNo: "SPHC 2.3 X 1219 X C", spec: "SPHC", size: "2.3 X 1219 X C", desc: "COIL A", qty: "10", unit: "COIL", netWeight: "25000", grossWeight: "25200", price: "850", raw: {}, usedAction: false },
  { itemIndex: 1, hsCode: "7208.38.00", partNo: "SPHC 3.2 X 1219 X C", spec: "SPHC", size: "3.2 X 1219 X C", desc: "COIL B", qty: "15", unit: "COIL", netWeight: "36000", grossWeight: "36300", price: "830", raw: {}, usedAction: false },
  { itemIndex: 2, hsCode: "7208.37.00", partNo: "SS400 4.5 X 1500 X C", spec: "SS400", size: "4.5 X 1500 X C", desc: "COIL C", qty: "8", unit: "COIL", netWeight: "28000", grossWeight: "28250", price: "910", raw: {}, usedAction: false },
  { itemIndex: 3, hsCode: "7209.18.00", partNo: "SPCC 1.2 X 1000 X C", spec: "SPCC", size: "1.2 X 1000 X C", desc: "COIL D", qty: "20", unit: "COIL", netWeight: "30000", grossWeight: "30300", price: "950", raw: {}, usedAction: false },
  { itemIndex: 4, hsCode: "7208.39.00", partNo: "SAPH440 2.0 X 1250 X C", spec: "SAPH440", size: "2.0 X 1250 X C", desc: "COIL E", qty: "12", unit: "COIL", netWeight: "24000", grossWeight: "24200", price: "890", raw: {}, usedAction: false },
];

test("Tier 5.11 (Permutation Invariance): Multi-item steel shipment with reversed line items", () => {
  // Target items reversed: [4, 3, 2, 1, 0]
  const reversedTargetItems = [...MULTI_PIB_ITEMS].reverse().map((item, idx) => ({
    ...item,
    itemIndex: idx, // different target row index!
  }));

  const matchResults = matchDocumentItemsStrict(MULTI_PIB_ITEMS, reversedTargetItems, "Invoice");
  assert.strictEqual(matchResults.length, 5, "Must return 5 matched pairs");

  // Every PIB item must be matched to its genuine specification partner, NOT array index
  for (const res of matchResults) {
    assert.strictEqual(res.isMatch, true, `Item ${res.pibItemIndex} must be matched`);
    assert.strictEqual(res.discrepancies.length, 0);

    // Verify specification matches exactly
    assert.strictEqual(res.pibItem.size, res.targetItem?.size);
    assert.strictEqual(res.pibItem.spec, res.targetItem?.spec);
    assert.strictEqual(res.pibItem.price, res.targetItem?.price);
  }

  // Specifically verify that PIB[0] (2.3mm) matched targetItem at index 4 (where reversed item is located)
  const matchPib0 = matchResults.find((r) => r.pibItemIndex === 0);
  assert.ok(matchPib0);
  assert.strictEqual(matchPib0.targetItemIndex, 4, "PIB[0] must match targetItem at index 4, NEVER index 0");
});

test("Tier 5.12 (Permutation Invariance): Scrambled order with corrupted specification on single item", () => {
  // Scrambled permutation: indices [2, 0, 4, 1, 3]
  const scrambleOrder = [2, 0, 4, 1, 3];
  const scrambledTargetItems = scrambleOrder.map((origIdx, newIdx) => ({
    ...MULTI_PIB_ITEMS[origIdx]!,
    itemIndex: newIdx,
  }));

  // Tamper with the price of Item 4 ONLY (which is at scrambled index 2)
  scrambledTargetItems[2] = {
    ...scrambledTargetItems[2]!,
    price: "9999.00", // Corrupted price!
  };

  const matchResults = matchDocumentItemsStrict(MULTI_PIB_ITEMS, scrambledTargetItems, "Invoice");
  assert.strictEqual(matchResults.length, 5);

  // Items 0, 1, 2, 3 must be 100% MATCHED with 0 discrepancies
  for (const idx of [0, 1, 2, 3]) {
    const res = matchResults.find((r) => r.pibItemIndex === idx);
    assert.ok(res, `Result for PIB[${idx}] must exist`);
    assert.strictEqual(res.isMatch, true, `PIB[${idx}] must match without error`);
    assert.strictEqual(res.discrepancies.length, 0);
  }

  // Item 4 must be matched to target row 2, but flagged as MISMATCH due to corrupted price
  const res4 = matchResults.find((r) => r.pibItemIndex === 4);
  assert.ok(res4, "Result for PIB[4] must exist");
  assert.strictEqual(res4.targetItemIndex, 2, "PIB[4] must align to scrambled target row 2");
  assert.strictEqual(res4.isMatch, false, "PIB[4] must fail matching due to price discrepancy");
  assert.strictEqual(res4.priceMatch, false);
  assert.ok(res4.discrepancies.some((d) => d.includes("Harga satuan berbeda")));
});

test("Tier 5.13 (ItemMatcher): matchPibAndRekapItems permutation invariance across arbitrary shuffles", () => {
  const pibTable = [
    { Pos_Tarif: "7208.38.00", Kode_Barang: "COIL-A", QTY: "10", Uraian_Barang: "HOT ROLLED COIL A" },
    { Pos_Tarif: "7208.38.00", Kode_Barang: "COIL-B", QTY: "15", Uraian_Barang: "HOT ROLLED COIL B" },
    { Pos_Tarif: "7208.37.00", Kode_Barang: "COIL-C", QTY: "8", Uraian_Barang: "HOT ROLLED COIL C" },
  ];

  // Scramble rekapTable: [C, A, B]
  const rekapTableScrambled = [
    { HS_Code: "7208.37.00", Part_No: "COIL-C", QTY: "8", Part_Desc: "HOT ROLLED COIL C" },
    { HS_Code: "7208.38.00", Part_No: "COIL-A", QTY: "10", Part_Desc: "HOT ROLLED COIL A" },
    { HS_Code: "7208.38.00", Part_No: "COIL-B", QTY: "15", Part_Desc: "HOT ROLLED COIL B" },
  ];

  const pairs = matchPibAndRekapItems(pibTable, rekapTableScrambled);
  assert.strictEqual(pairs.length, 3);

  // Verify each pair aligns corresponding part number regardless of array index
  for (const pair of pairs) {
    assert.strictEqual(pair.isRowMatch, true);
    assert.strictEqual(pair.status, "match");
    assert.strictEqual(cleanVal(pair.pibItem?.partNo), cleanVal(pair.rekapItem?.partNo));
  }
});

test("Tier 5.14 (Asymmetric Item Counts): Extra spurious items in supporting document not in PIB", () => {
  const pibItems = [MULTI_PIB_ITEMS[0]!, MULTI_PIB_ITEMS[1]!]; // 2 items in PIB

  // CI has 4 items (2 genuine + 2 spurious extra items not in PIB)
  const ciItemsWithSpurious: StandardLineItem[] = [
    { ...MULTI_PIB_ITEMS[0]!, itemIndex: 0 },
    { ...MULTI_PIB_ITEMS[1]!, itemIndex: 1 },
    { itemIndex: 2, hsCode: "7210.49.00", partNo: "GALVANIZED 1.0 X 1219 X C", spec: "GI", size: "1.0 X 1219 X C", desc: "SPURIOUS EXTRA COIL 1", qty: "5", unit: "COIL", netWeight: "10000", grossWeight: "10100", price: "990", raw: {}, usedAction: false },
    { itemIndex: 3, hsCode: "7210.49.00", partNo: "GALVANIZED 1.2 X 1219 X C", spec: "GI", size: "1.2 X 1219 X C", desc: "SPURIOUS EXTRA COIL 2", qty: "7", unit: "COIL", netWeight: "14000", grossWeight: "14100", price: "990", raw: {}, usedAction: false },
  ];

  const results = matchDocumentItemsStrict(pibItems, ciItemsWithSpurious, "Invoice");
  assert.strictEqual(results.length, 4, "Must contain 2 matched + 2 extra unmatched items");

  const matches = results.filter((r) => r.isMatch);
  assert.strictEqual(matches.length, 2, "Only the 2 declared PIB items can match");

  const unmapped = results.filter((r) => !r.isMatch && r.pibItemIndex === -1);
  assert.strictEqual(unmapped.length, 2, "The 2 spurious CI items must be flagged as unmapped (pibItemIndex = -1)");
  assert.ok(unmapped[0]!.discrepancies.some((d) => d.includes("Item tambahan pada Invoice baris #3 tidak terdaftar di PIB")));
  assert.ok(unmapped[1]!.discrepancies.some((d) => d.includes("Item tambahan pada Invoice baris #4 tidak terdaftar di PIB")));
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5: Hostile Data Action Rule Chaining
// ═════════════════════════════════════════════════════════════════════════════

test("Tier 5.15 (Hostile Chaining): Multi-step cascading transformation pipeline execution", () => {
  const steps: WorkflowStep[] = [
    {
      id: "step-1",
      name: "Trim Whitespace",
      description: "",
      enabled: true,
      docScope: "ci",
      targetField: "No_Invoice",
      targetFields: ["No_Invoice"],
      action: { type: "trim_whitespace", config: { trimEdges: true, collapseMultiple: true } },
    },
    {
      id: "step-2",
      name: "Strip Prefix INV",
      description: "",
      enabled: true,
      docScope: "ci",
      targetField: "No_Invoice",
      targetFields: ["No_Invoice"],
      action: { type: "prefix_suffix", config: { operation: "remove_prefix", value: "INV-" } },
    },
    {
      id: "step-3",
      name: "Replace Slashes",
      description: "",
      enabled: true,
      docScope: "ci",
      targetField: "No_Invoice",
      targetFields: ["No_Invoice"],
      action: { type: "replace_text", config: { findText: "/", replaceWith: "-", isRegex: false, matchCase: false } },
    },
    {
      id: "step-4",
      name: "Uppercase Everything",
      description: "",
      enabled: true,
      docScope: "ci",
      targetField: "No_Invoice",
      targetFields: ["No_Invoice"],
      action: { type: "case_transform", config: { transform: "uppercase" } },
    },
    {
      id: "step-5",
      name: "Add Standard Prefix USC",
      description: "",
      enabled: true,
      docScope: "ci",
      targetField: "No_Invoice",
      targetFields: ["No_Invoice"],
      action: { type: "prefix_suffix", config: { operation: "add_prefix", value: "USC-" } },
    },
  ];

  const input = "  INV-2026/usc/099  ";
  const pipelineRes = executeDataPipeline(input, "No_Invoice", "ci", steps);

  assert.strictEqual(pipelineRes.hasError, false);
  assert.strictEqual(pipelineRes.stepResults.length, 5);
  assert.strictEqual(pipelineRes.finalValue, "USC-2026-USC-099");
  assert.ok(pipelineRes.durationMs < 50, "Chained pipeline execution must complete in under 50ms");
});

test("Tier 5.16 (Hostile Regex): Unclosed brackets, dangling operators, invalid lookbehinds", () => {
  const hostileSteps: WorkflowStep[] = [
    {
      id: "hostile-1",
      name: "Unclosed bracket regex",
      description: "",
      enabled: true,
      docScope: "all",
      targetField: "test_field",
      targetFields: ["test_field"],
      action: { type: "replace_text", config: { findText: "[a-z", replaceWith: "", isRegex: true, matchCase: false } },
    },
    {
      id: "hostile-2",
      name: "Dangling quantifier",
      description: "",
      enabled: true,
      docScope: "all",
      targetField: "test_field",
      targetFields: ["test_field"],
      action: { type: "replace_text", config: { findText: "+", replaceWith: "", isRegex: true, matchCase: false } },
    },
    {
      id: "hostile-3",
      name: "Empty find text",
      description: "",
      enabled: true,
      docScope: "all",
      targetField: "test_field",
      targetFields: ["test_field"],
      action: { type: "replace_text", config: { findText: "", replaceWith: "X", isRegex: false, matchCase: false } },
    },
  ];

  for (const step of hostileSteps) {
    // applyWorkflowStep must NOT throw unhandled exceptions
    let thrown = false;
    let res;
    try {
      res = applyWorkflowStep("SampleValue123", step);
    } catch {
      thrown = true;
    }
    assert.strictEqual(thrown, false, `Step ${step.name} must not throw uncaught exceptions`);
    // Output should safely preserve value or record error
    assert.ok(res);
    assert.ok(typeof res.output === "string");
  }
});

test("Tier 5.17 (ReDoS Resilience & Catastrophic Backtracking Benchmark)", () => {
  const redosStep: WorkflowStep = {
    id: "redos-step",
    name: "Potential ReDoS Pattern",
    description: "",
    enabled: true,
    docScope: "all",
    targetField: "spec",
    targetFields: ["spec"],
    action: {
      type: "validation_rule",
      config: {
        condition: "regex_match",
        paramValue: "^(a+)+$", // classic nested quantifier
        onFail: "warning",
      },
    },
  };

  // Safe pattern execution benchmark
  const safeStep: WorkflowStep = {
    ...redosStep,
    action: {
      type: "validation_rule",
      config: {
        condition: "regex_match",
        paramValue: "^[A-Za-z0-9_.-]+$",
        onFail: "warning",
      },
    },
  };

  const startSafe = performance.now();
  const safeRes = applyWorkflowStep("SPHC-HOT-ROLLED-STEEL-COIL-2026", safeStep);
  const safeElapsed = performance.now() - startSafe;
  assert.ok(safeElapsed < 10, "Standard safe regex must execute under 10ms");
  assert.strictEqual(safeRes.applied, true);

  // Measure catastrophic backtracking latency on 24 characters
  const startBacktrack = performance.now();
  const res = applyWorkflowStep("aaaaaaaaaaaaaaaaaaaaaaaa!", redosStep);
  const backtrackDuration = performance.now() - startBacktrack;

  // Document vulnerability: unconstrained regex takes > 300ms for just 24 characters (CPU lockup indicator)
  assert.ok(
    backtrackDuration > 300,
    `Empirical verification of ReDoS vulnerability: catastrophic backtracking took ${backtrackDuration.toFixed(1)}ms for 24 chars`
  );
  assert.ok(res);
});

test("Tier 5.18 (Extreme Sizing): 100,000-character payload through multi-step pipeline", () => {
  const hugeString = "   STEEL COIL SPECIFICATION ".repeat(4000); // 112,000 chars (> 100,000 chars)
  assert.ok(hugeString.length > 100000);

  const steps: WorkflowStep[] = [
    {
      id: "size-1",
      name: "Trim Huge String",
      description: "",
      enabled: true,
      docScope: "all",
      targetField: "desc",
      targetFields: ["desc"],
      action: { type: "trim_whitespace", config: { trimEdges: true, collapseMultiple: true } },
    },
    {
      id: "size-2",
      name: "Lowercase Huge String",
      description: "",
      enabled: true,
      docScope: "all",
      targetField: "desc",
      targetFields: ["desc"],
      action: { type: "case_transform", config: { transform: "lowercase" } },
    },
  ];

  const start = performance.now();
  const res = executeDataPipeline(hugeString, "desc", "pib", steps);
  const elapsed = performance.now() - start;

  assert.strictEqual(res.hasError, false);
  assert.ok(res.finalValue.startsWith("steel coil specification"));
  assert.ok(elapsed < 100, `Processing 100k characters took ${elapsed}ms (must be < 100ms)`);
});

test("Tier 5.19 (Contradictory and Fallback Chaining): Validation rule with fallback triggering number format", () => {
  const steps: WorkflowStep[] = [
    {
      id: "validate-fallback",
      name: "Require Numeric with Fallback",
      description: "",
      enabled: true,
      docScope: "ci",
      targetField: "Total_Amount",
      targetFields: ["Total_Amount"],
      action: {
        type: "validation_rule",
        config: {
          condition: "is_number",
          onFail: "fallback",
          fallbackValue: "0.00",
        },
      },
    },
    {
      id: "format-fallback",
      name: "Format Decimal",
      description: "",
      enabled: true,
      docScope: "ci",
      targetField: "Total_Amount",
      targetFields: ["Total_Amount"],
      action: {
        type: "number_formatting",
        config: {
          roundDecimals: 2,
          decimalFormat: "dot",
          stripUnits: false,
        },
      },
    },
  ];

  // Pass corrupted non-numeric amount "INVALID_AMOUNT"
  const pipeRes = executeDataPipeline("INVALID_AMOUNT", "Total_Amount", "ci", steps);
  assert.strictEqual(pipeRes.hasWarning, true, "Fallback should set warning flag");
  assert.strictEqual(pipeRes.finalValue, "0.00", "Corrupted value must safely fallback to formatted 0.00");
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6: Ensuring False Auto-Matches are IMPOSSIBLE
// ═════════════════════════════════════════════════════════════════════════════

test("Tier 5.20 (Near-Miss Collision Attack): Distinct coil dimensions with identical grade never match", () => {
  const pibItem: StandardLineItem = {
    itemIndex: 0,
    hsCode: "7208.38.00",
    partNo: "SPHC 2.3 X 1219 X C",
    spec: "SPHC",
    size: "2.3 X 1219 X C",
    desc: "HOT ROLLED STEEL COIL",
    qty: "10",
    unit: "COIL",
    netWeight: "25000",
    grossWeight: "25200",
    price: "850",
    raw: {},
    usedAction: false,
  };

  // Candidate 1: Different thickness (3.2mm vs 2.3mm)
  const diffThickness: StandardLineItem = {
    ...pibItem,
    itemIndex: 0,
    size: "3.2 X 1219 X C",
    partNo: "SPHC 3.2 X 1219 X C",
  };
  const res1 = matchDocumentItemsStrict([pibItem], [diffThickness], "Invoice");
  assert.strictEqual(res1.filter((r) => r.isMatch).length, 0, "Different thickness must NEVER match");

  // Candidate 2: Different width (1250mm vs 1219mm)
  const diffWidth: StandardLineItem = {
    ...pibItem,
    itemIndex: 0,
    size: "2.3 X 1250 X C",
    partNo: "SPHC 2.3 X 1250 X C",
  };
  const res2 = matchDocumentItemsStrict([pibItem], [diffWidth], "Invoice");
  assert.strictEqual(res2.filter((r) => r.isMatch).length, 0, "Different width must NEVER match");

  // Candidate 3: Different grade (SS400 vs SPHC) with same size
  const diffGrade: StandardLineItem = {
    ...pibItem,
    itemIndex: 0,
    spec: "SS400",
    partNo: "SS400 2.3 X 1219 X C",
  };
  const res3 = matchDocumentItemsStrict([pibItem], [diffGrade], "Invoice");
  assert.strictEqual(res3.filter((r) => r.isMatch).length, 0, "Different steel grade must NEVER match");
});

test("Tier 5.21 (Empty & Whitespace Pseudo-Match Prevention): Dash and blank values never match", () => {
  // Two documents having '-' in both must evaluate to isMatch = false
  const dashComp = compareFieldStrict("Invoice", "No Invoice", "-", "-");
  assert.strictEqual(dashComp.isMatch, false, "Two '-' missing values must NEVER evaluate to isMatch = true");

  const emptyComp = compareFieldStrict("Invoice", "Tanggal Invoice", "", "   ");
  assert.strictEqual(emptyComp.isMatch, false, "Empty strings must NEVER evaluate to isMatch = true");

  const oneMissing = compareFieldStrict("Invoice", "No Invoice", "INV-100", "-");
  assert.strictEqual(oneMissing.isMatch, false);
  assert.strictEqual(oneMissing.status, "INFO"); // Non-critical field missing in supporting doc
});

test("Tier 5.22 (Partial Substring / Single Shared Keyword Rejection)", () => {
  const pibItem: StandardLineItem = {
    itemIndex: 0,
    hsCode: "7208.38.00",
    partNo: "",
    spec: "",
    size: "",
    desc: "HOT ROLLED STEEL COIL SPHC 2.3MM",
    qty: "10",
    unit: "COIL",
    netWeight: "25000",
    grossWeight: "25200",
    price: "850",
    raw: {},
    usedAction: false,
  };

  const unrelatedStripItem: StandardLineItem = {
    itemIndex: 0,
    hsCode: "7209.18.00",
    partNo: "",
    spec: "",
    size: "",
    desc: "COLD ROLLED STEEL STRIP SPCC 0.8MM", // Shares words 'STEEL', but completely different commodity
    qty: "50",
    unit: "COIL",
    netWeight: "15000",
    grossWeight: "15100",
    price: "980",
    raw: {},
    usedAction: false,
  };

  const results = matchDocumentItemsStrict([pibItem], [unrelatedStripItem], "Invoice");
  assert.strictEqual(results.filter((r) => r.isMatch).length, 0, "Shared keywords 'STEEL' must not cause false auto-match");
});

test("Tier 5.23 (HS Code Match without Quantity Rejection)", () => {
  const pibItem: StandardLineItem = {
    itemIndex: 0,
    hsCode: "7208.38.00",
    partNo: "",
    spec: "",
    size: "",
    desc: "",
    qty: "10",
    unit: "COIL",
    netWeight: "",
    grossWeight: "",
    price: "",
    raw: {},
    usedAction: false,
  };

  const targetDifferingQty: StandardLineItem = {
    itemIndex: 0,
    hsCode: "7208.38.00", // Same HS code!
    partNo: "",
    spec: "",
    size: "",
    desc: "",
    qty: "999", // Vastly differing quantity
    unit: "COIL",
    netWeight: "",
    grossWeight: "",
    price: "",
    raw: {},
    usedAction: false,
  };

  const results = matchDocumentItemsStrict([pibItem], [targetDifferingQty], "Invoice");
  assert.strictEqual(results.filter((r) => r.isMatch).length, 0, "Identical HS code with divergent quantity must NOT auto-match");
});

test("Tier 5.24 (Adversarial Corrupted Payloads): Injection payloads, prototype pollution, malformed JSON", () => {
  // Test JSON parsing robustness against prototype pollution and script tags
  const hostilePayload = JSON.stringify({
    fields: {
      "__proto__": { "admin": true },
      "constructor": { "prototype": { "polluted": true } },
      "No_Invoice": "<script>alert('XSS')</script>",
      "Nilai_Pabean": "' OR '1'='1' -- DROP TABLE batches;",
    },
    table: [
      {
        "Pos_Tarif": "7208.38.00",
        "Ukuran_Barang": "\u0000NULL_BYTE_INJECTION",
      },
    ],
  });

  const parsed = parseDocIsi(hostilePayload);
  assert.ok(parsed.fields);
  assert.strictEqual(parsed.fields["No_Invoice"], "<script>alert('XSS')</script>");
  // Verify prototype was not polluted
  assert.strictEqual((Object.prototype as any).polluted, undefined);
  assert.strictEqual((Object.prototype as any).admin, undefined);

  // Run through canonical matcher
  const batchDetails = [
    { fileType: "PIB", isi: hostilePayload },
    {
      fileType: "Invoice",
      isi: JSON.stringify({
        fields: {
          No_Invoice: "INV-GENUINE-999",
          Nilai_Total_Invoice: "50000",
        },
        table: [],
      }),
    },
  ];

  const report = evaluateCanonicalBatchMatching(batchDetails, 2, "hostile-batch");
  assert.strictEqual(report.status, "MISMATCHING", "Hostile corrupted batch must safely evaluate to MISMATCHING without exploding");
  assert.ok(report.mismatches.length > 0);
});


test("Tier 5.25 (End-to-End Batch Invariance): Batch with divergent coil thickness (2.3mm vs 3.2mm)", () => {
  // PIB has 1 coil of 2.3mm thickness, Qty 10
  // CI has 1 coil of 3.2mm thickness, Qty 10 (same HS code 7208.38.00)
  const batch = createUscBatchFixture({
    pibOverrides: {
      table: [
        {
          Pos_Tarif: "7208.38.00",
          Spesifikasi_Grade: "SPHC",
          Ukuran_Barang: "2.3 X 1219 X C",
          Jumlah_Satuan_Barang: "10",
          Nilai_Pabean: "8500",
        },
      ],
    },
    ciOverrides: {
      table: [
        {
          Pos_Tarif: "7208.38.00",
          Spesifikasi_Grade: "SPHC",
          Ukuran_Barang: "3.2 X 1219 X C", // Divergent thickness!
          Jumlah_Barang: "10",
          Harga_Satuan: "850",
          Nilai_Total: "8500",
        },
      ],
    },
  });

  const report = evaluateCanonicalBatchMatching(batch, 7, "batch-diff-thickness");
  
  // Strict customs requirement: A batch where coil thickness differs must be MISMATCHING!
  assert.strictEqual(
    report.status,
    "MISMATCHING",
    "CRITICAL BUG CHECK: Batch with conflicting coil thickness (2.3mm vs 3.2mm) must evaluate to MISMATCHING, never MATCHING!"
  );
});
