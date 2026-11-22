import test from "node:test";
import assert from "node:assert";
import "../helpers/testHelpers";
import { filterCategoryData, extractNanonetsId } from "~/server/nanonets";
import { applyWorkflowStep, executeDataPipeline, applyDataActionsToFields } from "~/utils/workflowRunner";
import { WorkflowStep } from "~/types/workflow";
import { normalizeHsCode, normalizeIdentifier, parseNumericValue } from "../helpers/testHelpers";
import { cleanVal, cleanNum } from "~/utils/itemMatcher";

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: Boundary & Corner Cases
// ─────────────────────────────────────────────────────────────────────────────

test("Tier 2.1 (Boundary): Empty or null webhook payload returns empty fields and tables gracefully", () => {
  const emptyRes1 = filterCategoryData(null, "PIB");
  assert.deepStrictEqual(emptyRes1.fields, {});
  assert.deepStrictEqual(emptyRes1.table, []);

  const emptyRes2 = filterCategoryData({}, "Invoice");
  assert.deepStrictEqual(emptyRes2.fields, {});
  assert.deepStrictEqual(emptyRes2.table, []);

  const emptyRes3 = filterCategoryData({ result: [] }, "Packing List");
  assert.deepStrictEqual(emptyRes3.fields, {});
  assert.deepStrictEqual(emptyRes3.table, []);
});

test("Tier 2.2 (Boundary): Malformed prediction cells and missing labels handled without runtime crash", () => {
  const malformedPayload = {
    result: [
      {
        prediction: [
          null, // null prediction item
          {}, // empty prediction object
          { label: "unknown_label", text: "ignored value" },
          {
            type: "table",
            cells: [
              null, // null cell block
              {}, // empty cell
              { label: "unrelated", text: "skip" },
              { row: 0, label: "pos tarif", text: "7208.38.00" },
            ],
          },
        ],
      },
    ],
  };

  const extracted = filterCategoryData(malformedPayload, "PIB");
  assert.ok(extracted.fields);
  assert.ok(Array.isArray(extracted.table));
  assert.strictEqual(extracted.table.length, 1);
  assert.strictEqual(extracted.table[0]!["pos tarif"], "7208.38.00");
});

test("Tier 2.3 (Boundary): extractNanonetsId extracts candidate IDs across diverse payload formats", () => {
  // Format 1: Direct root string
  assert.strictEqual(extractNanonetsId({ request_file_id: "req-123" }), "req-123");
  // Format 2: Root id
  assert.strictEqual(extractNanonetsId({ id: "id-456" }), "id-456");
  // Format 3: Inside result object
  assert.strictEqual(extractNanonetsId({ result: { request_file_id: "res-obj-789" } }), "res-obj-789");
  // Format 4: Inside result array
  assert.strictEqual(extractNanonetsId({ result: [{ request_id: "res-arr-012" }] }), "res-arr-012");
  // Format 5: Null / undefined / empty
  assert.strictEqual(extractNanonetsId(null), null);
  assert.strictEqual(extractNanonetsId({}), null);
});

test("Tier 2.4 (Boundary): Zero, negative, and extreme weights parsed accurately", () => {
  assert.strictEqual(parseNumericValue("0"), 0);
  assert.strictEqual(parseNumericValue("0.00 kg"), 0);
  assert.strictEqual(parseNumericValue("-150.50"), -150.5);
  assert.strictEqual(parseNumericValue("999,999,999.50"), 999999999.5);
  assert.strictEqual(parseNumericValue(null), 0);
  assert.strictEqual(parseNumericValue(""), 0);
  assert.strictEqual(parseNumericValue("N/A"), 0);
});

test("Tier 2.5 (Boundary): Multi-currency parsing with symbols and comma-decimal formats", () => {
  assert.strictEqual(parseNumericValue("USD 58,450.00"), 58450);
  assert.strictEqual(parseNumericValue("$ 58,450.00"), 58450);
  assert.strictEqual(parseNumericValue("IDR 850,000,000"), 850000000);
  assert.strictEqual(parseNumericValue("EUR 12,345.67"), 12345.67);
  assert.strictEqual(parseNumericValue("JPY 1,500,000"), 1500000);
});

test("Tier 2.6 (Boundary): HS Code normalization handles various lengths, dots, spaces, and dashes", () => {
  // 8-digit standard with dots
  assert.strictEqual(normalizeHsCode("7208.38.00"), "72083800");
  // Without dots
  assert.strictEqual(normalizeHsCode("72083800"), "72083800");
  // Irregular spacing with dots
  assert.strictEqual(normalizeHsCode(" 7208 . 38 . 00 "), "72083800");
  // HS code with dashes
  assert.strictEqual(normalizeHsCode("7208-38-00"), "72083800");
  // 6-digit subheading
  assert.strictEqual(normalizeHsCode("7208.38"), "720838");
  // 10-digit extended customs tariff
  assert.strictEqual(normalizeHsCode("7208.38.00.00"), "7208380000");
  // Empty / null
  assert.strictEqual(normalizeHsCode(null), "");
  assert.strictEqual(normalizeHsCode(""), "");
});

test("Tier 2.7 (Boundary): Special characters in invoice numbers and reference codes", () => {
  const rawInvoice = " USC/INV-2026/8801#A (REV.1) ";
  const cleanedAlphaNum = normalizeIdentifier(rawInvoice);
  assert.strictEqual(cleanedAlphaNum, "uscinv20268801arev1");

  const cleanValRes = cleanVal(rawInvoice);
  assert.strictEqual(cleanValRes, "uscinv20268801arev1");
});

test("Tier 2.8 (Boundary): Whitespace boundary conditions (newlines, tabs, multiple spaces)", () => {
  const step: WorkflowStep = {
    id: "step_trim_hard",
    name: "Hard Trim",
    description: "Collapse all kinds of whitespace",
    docScope: "all",
    targetField: "No_Invoice",
    action: {
      type: "trim_whitespace",
      config: { trimEdges: true, collapseMultiple: true, removeAllSpaces: false },
    },
    enabled: true,
  };

  const messyInput = "\n\t  USC-INV \t\r\n 2026-8801  \n";
  const res = applyWorkflowStep(messyInput, step);
  assert.strictEqual(res.output, "USC-INV 2026-8801");
});

test("Tier 2.9 (Boundary): applyDataActionsToFields handles null, undefined, and non-object inputs", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.strictEqual(applyDataActionsToFields(null as any, "pib", []), null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.strictEqual(applyDataActionsToFields(undefined as any, "pib", []), undefined);
  // Empty steps return fields directly
  const sampleFields = { a: "1" };
  assert.strictEqual(applyDataActionsToFields(sampleFields, "pib", []), sampleFields);
});

test("Tier 2.10 (Boundary): Action with disabled status does not mutate input", () => {
  const disabledStep: WorkflowStep = {
    id: "step_disabled",
    name: "Disabled Step",
    description: "Should not run",
    docScope: "all",
    targetField: "No_Invoice",
    action: {
      type: "case_transform",
      config: { transform: "uppercase" },
    },
    enabled: false,
  };

  const res = applyWorkflowStep("lowercase-text", disabledStep);
  assert.strictEqual(res.output, "lowercase-text");
  assert.strictEqual(res.applied, false);
});

test("Tier 2.11 (Boundary): Number formatting with comma decimal format (European style)", () => {
  const commaStep: WorkflowStep = {
    id: "step_comma_fmt",
    name: "Comma Decimal Format",
    description: "Format with comma decimal",
    docScope: "all",
    targetField: "Berat_Bersih",
    action: {
      type: "number_formatting",
      config: {
        removeCommas: false,
        decimalFormat: "comma",
        roundDecimals: -1, // Keep original decimals, swap dot to comma
        stripCurrency: false,
        stripUnits: true,
      },
    },
    enabled: true,
  };

  const res = applyWorkflowStep("48500.75 kg", commaStep);
  assert.strictEqual(res.output, "48500,75");
});

test("Tier 2.12 (Boundary): Unknown or invalid action type reports error without throwing exception", () => {
  const badStep: WorkflowStep = {
    id: "step_bad",
    name: "Bad Step",
    description: "Invalid action",
    docScope: "all",
    targetField: "No_Invoice",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: { type: "non_existent_type" as any, config: {} as any },
    enabled: true,
  };

  const res = applyWorkflowStep("value", badStep);
  assert.strictEqual(res.output, "value");
  assert.strictEqual(res.applied, false);
});

test("Tier 2.13 (Boundary): Case-insensitive category detection in filterCategoryData", () => {
  const rawPib = {
    result: [{ prediction: [{ label: "no invoice", ocr_text: "INV-CASE-01", type: "field" }] }],
  };

  // Lowercase category
  const res1 = filterCategoryData(rawPib, "pib");
  assert.strictEqual(res1.fields["no invoice"], "INV-CASE-01");

  // Uppercase with spaces
  const res2 = filterCategoryData(rawPib, "PIB (FILE ACUAN)");
  assert.strictEqual(res2.fields["no invoice"], "INV-CASE-01");

  // Bill of Lading variations
  const res3 = filterCategoryData(rawPib, "bill of lading");
  assert.ok(res3.fields);
});

test("Tier 2.14 (Boundary): cleanNum removes trailing .00 and commas", () => {
  assert.strictEqual(cleanNum("3,000.00"), "3000");
  assert.strictEqual(cleanNum(" 48,500 "), "48500");
  assert.strictEqual(cleanNum("1200.00"), "1200");
  assert.strictEqual(cleanNum(""), "");
  assert.strictEqual(cleanNum(null), "");
});

test("Tier 2.15 (Boundary): Extremely long values (5000+ chars) processed without memory exhaustion", () => {
  const longDesc = "HOT ROLLED STEEL COILS ".repeat(250); // ~5750 characters
  const step: WorkflowStep = {
    id: "step_long",
    name: "Trim Long",
    description: "Trim huge string",
    docScope: "all",
    targetField: "Deskripsi_Barang",
    action: {
      type: "trim_whitespace",
      config: { trimEdges: true, collapseMultiple: true, removeAllSpaces: false },
    },
    enabled: true,
  };

  const res = applyWorkflowStep(longDesc, step);
  assert.ok(res.output.length > 5000);
  assert.strictEqual(res.applied, true);
});

test("Tier 2.16 (Boundary): Bounding box coordinates retention for viewer zoom and side-by-side inspection", () => {
  const payloadWithCoords = {
    result: [
      {
        prediction: [
          {
            label: "no invoice",
            ocr_text: "INV-USC-9900",
            type: "field",
            xmin: 120,
            ymin: 340,
            xmax: 280,
            ymax: 365,
            page: 1,
          },
          {
            type: "table",
            cells: [
              {
                row: 0,
                label: "pos tarif",
                text: "7208.38.00",
                xmin: 50,
                ymin: 400,
                xmax: 110,
                ymax: 420,
                page: 1,
              },
            ],
          },
        ],
      },
    ],
  };

  const res = filterCategoryData(payloadWithCoords, "PIB");
  assert.strictEqual(res.fields["no invoice"], "INV-USC-9900");
  assert.ok(res.coordinates, "coordinates should be present");
  assert.deepStrictEqual(res.coordinates["no invoice"], {
    xmin: 120,
    ymin: 340,
    xmax: 280,
    ymax: 365,
    page: 1,
  });
  assert.ok(res.tableCoordinates, "tableCoordinates should be present");
  assert.strictEqual(res.tableCoordinates.length, 1);
  assert.deepStrictEqual(res.tableCoordinates[0]?.["pos tarif"], {
    xmin: 50,
    ymin: 400,
    xmax: 110,
    ymax: 420,
    page: 1,
  });
});
