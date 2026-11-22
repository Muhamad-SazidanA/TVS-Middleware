import test from "node:test";
import assert from "node:assert";
import "../helpers/testHelpers";
import {
  applyWorkflowStep,
  executeDataPipeline,
  applyDataActionsToFields,
  applyDataActionsToTableRows,
} from "~/utils/workflowRunner";
import { DOCUMENT_FIELD_REGISTRY, getFieldOptionsForDocument } from "~/utils/documentRegistry";
import { WorkflowStep } from "~/types/workflow";

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 8: Data Actions Rule Execution (all 9 action types)
// ─────────────────────────────────────────────────────────────────────────────

test("Feature 8.1 (Action: remove_characters): Punctuation, non-alphanumeric, and custom mode", () => {
  const punctStep: WorkflowStep = {
    id: "step_rm_punct",
    name: "Remove Punctuation",
    description: "Strips punctuation",
    docScope: "all",
    targetField: "No_Invoice",
    action: {
      type: "remove_characters",
      config: { mode: "punctuation" },
    },
    enabled: true,
  };
  const res1 = applyWorkflowStep("INV/2026-001#A", punctStep);
  assert.strictEqual(res1.output, "INV2026001A");

  const nonAlphaStep: WorkflowStep = {
    id: "step_rm_nonalpha",
    name: "Remove Non-Alphanumeric",
    description: "Keep only letters and digits",
    docScope: "all",
    targetField: "No_Invoice",
    action: {
      type: "remove_characters",
      config: { mode: "non_alphanumeric" },
    },
    enabled: true,
  };
  const res2 = applyWorkflowStep("INV 2026 @ 001!", nonAlphaStep);
  assert.strictEqual(res2.output, "INV2026001");

  const customStep: WorkflowStep = {
    id: "step_rm_custom",
    name: "Remove Custom Chars",
    description: "Remove slash and dash",
    docScope: "all",
    targetField: "No_Invoice",
    action: {
      type: "remove_characters",
      config: { mode: "custom", customChars: "/-" },
    },
    enabled: true,
  };
  const res3 = applyWorkflowStep("INV/2026-001", customStep);
  assert.strictEqual(res3.output, "INV2026001");
});

test("Feature 8.2 (Action: number_formatting): Stripping currency symbols, units, commas, and decimal rounding", () => {
  const numStep: WorkflowStep = {
    id: "step_num_fmt",
    name: "Number Formatting",
    description: "Format weight/amount string",
    docScope: "all",
    targetField: "Berat_Bersih",
    action: {
      type: "number_formatting",
      config: {
        removeCommas: true,
        decimalFormat: "dot",
        roundDecimals: 2,
        stripCurrency: true,
        stripUnits: true,
      },
    },
    enabled: true,
  };

  const resWeight = applyWorkflowStep("48,500.559 kgs", numStep);
  assert.strictEqual(resWeight.output, "48500.56");

  const resCurrency = applyWorkflowStep("USD 58,450.00", numStep);
  assert.strictEqual(resCurrency.output, "58450.00");
});

test("Feature 8.3 (Action: replace_text): Exact string replacement and regex pattern substitution", () => {
  const plainStep: WorkflowStep = {
    id: "step_replace_plain",
    name: "Replace Plain",
    description: "Replace supplier name",
    docScope: "all",
    targetField: "Nama_Pengirim",
    action: {
      type: "replace_text",
      config: {
        findText: "POSCO ASIA CO., LTD.",
        replaceWith: "POSCO ASIA",
        isRegex: false,
        matchCase: false,
      },
    },
    enabled: true,
  };
  const res1 = applyWorkflowStep("POSCO ASIA CO., LTD.", plainStep);
  assert.strictEqual(res1.output, "POSCO ASIA");

  const regexStep: WorkflowStep = {
    id: "step_replace_regex",
    name: "Replace Regex",
    description: "Replace dates with slash",
    docScope: "all",
    targetField: "Tanggal_Invoice",
    action: {
      type: "replace_text",
      config: {
        findText: "(\\d{2})-(\\d{2})-(\\d{4})",
        replaceWith: "$1/$2/$3",
        isRegex: true,
        matchCase: false,
      },
    },
    enabled: true,
  };
  const res2 = applyWorkflowStep("15-03-2026", regexStep);
  assert.strictEqual(res2.output, "15/03/2026");
});

test("Feature 8.4 (Action: trim_whitespace): Edge trimming, multiple space collapsing, and full space removal", () => {
  const trimStep: WorkflowStep = {
    id: "step_trim_edges",
    name: "Trim Edges and Multi-spaces",
    description: "Collapse multiple spaces",
    docScope: "all",
    targetField: "No_BL",
    action: {
      type: "trim_whitespace",
      config: {
        trimEdges: true,
        collapseMultiple: true,
        removeAllSpaces: false,
      },
    },
    enabled: true,
  };
  const res1 = applyWorkflowStep("   HDMU   98234150   ", trimStep);
  assert.strictEqual(res1.output, "HDMU 98234150");

  const removeAllStep: WorkflowStep = {
    id: "step_trim_all",
    name: "Remove All Spaces",
    description: "Strips all spaces",
    docScope: "all",
    targetField: "Pos_Tarif",
    action: {
      type: "trim_whitespace",
      config: {
        trimEdges: true,
        collapseMultiple: true,
        removeAllSpaces: true,
      },
    },
    enabled: true,
  };
  const res2 = applyWorkflowStep(" 7208 . 38 . 00 ", removeAllStep);
  assert.strictEqual(res2.output, "7208.38.00");
});

test("Feature 8.5 (Action: case_transform): Uppercase, lowercase, and titlecase conversion", () => {
  const upperStep: WorkflowStep = {
    id: "step_upper",
    name: "Uppercase",
    description: "Convert to uppercase",
    docScope: "all",
    targetField: "Spesifikasi",
    action: {
      type: "case_transform",
      config: { transform: "uppercase" },
    },
    enabled: true,
  };
  const res1 = applyWorkflowStep("jis g3131 sphc", upperStep);
  assert.strictEqual(res1.output, "JIS G3131 SPHC");

  const lowerStep: WorkflowStep = {
    id: "step_lower",
    name: "Lowercase",
    description: "Convert to lowercase",
    docScope: "all",
    targetField: "Valuta",
    action: {
      type: "case_transform",
      config: { transform: "lowercase" },
    },
    enabled: true,
  };
  const res2 = applyWorkflowStep("USD", lowerStep);
  assert.strictEqual(res2.output, "usd");

  const titleStep: WorkflowStep = {
    id: "step_title",
    name: "Titlecase",
    description: "Convert to titlecase",
    docScope: "all",
    targetField: "Nama_Vessel",
    action: {
      type: "case_transform",
      config: { transform: "titlecase" },
    },
    enabled: true,
  };
  const res3 = applyWorkflowStep("hyundai voyager", titleStep);
  assert.strictEqual(res3.output, "Hyundai Voyager");
});

test("Feature 8.6 (Action: date_normalize): Standardizing diverse date formats into DD/MM/YYYY", () => {
  const dateStep: WorkflowStep = {
    id: "step_date_norm",
    name: "Normalize Dates",
    description: "Normalize to DD/MM/YYYY",
    docScope: "all",
    targetField: "Tanggal_Invoice",
    action: {
      type: "date_normalize",
      config: { targetFormat: "DD/MM/YYYY" },
    },
    enabled: true,
  };

  const res1 = applyWorkflowStep("2026-03-15", dateStep);
  assert.strictEqual(res1.output, "15/03/2026");

  const res2 = applyWorkflowStep("15-03-2026", dateStep);
  assert.strictEqual(res2.output, "15/03/2026");
});

test("Feature 8.7 (Action: prefix_suffix): Adding and removing prefixes/suffixes", () => {
  const addPrefixStep: WorkflowStep = {
    id: "step_prefix",
    name: "Add Prefix",
    description: "Add prefix INV-",
    docScope: "all",
    targetField: "No_Invoice",
    action: {
      type: "prefix_suffix",
      config: { operation: "add_prefix", value: "INV-" },
    },
    enabled: true,
  };
  const res1 = applyWorkflowStep("2026-8801", addPrefixStep);
  assert.strictEqual(res1.output, "INV-2026-8801");

  const removeSuffixStep: WorkflowStep = {
    id: "step_suffix_rm",
    name: "Remove Suffix",
    description: "Remove suffix KG",
    docScope: "all",
    targetField: "Berat_Bersih",
    action: {
      type: "prefix_suffix",
      config: { operation: "remove_suffix", value: " KG" },
    },
    enabled: true,
  };
  const res2 = applyWorkflowStep("48500 KG", removeSuffixStep);
  assert.strictEqual(res2.output, "48500");
});

test("Feature 8.8 (Action: validation_rule): Condition checks and fallback substitutions", () => {
  const validStep: WorkflowStep = {
    id: "step_valid_num",
    name: "Validate Numeric",
    description: "Fallback if not a valid number",
    docScope: "all",
    targetField: "Berat_Bersih",
    action: {
      type: "validation_rule",
      config: {
        condition: "is_number",
        onFail: "fallback",
        fallbackValue: "0",
      },
    },
    enabled: true,
  };

  const resValid = applyWorkflowStep("48500", validStep);
  assert.strictEqual(resValid.output, "48500");
  assert.strictEqual(resValid.warning, undefined);

  const resInvalid = applyWorkflowStep("N/A", validStep);
  assert.strictEqual(resInvalid.output, "0");
  assert.ok(resInvalid.warning, "Should trigger a warning on validation failure");
});

test("Feature 8.9 (Action: value_mapping): Mapping terms via replace and append mode", () => {
  const mapReplaceStep: WorkflowStep = {
    id: "step_map_replace",
    name: "Map Incoterm",
    description: "Standardize CIF",
    docScope: "all",
    targetField: "Incoterms",
    action: {
      type: "value_mapping",
      config: {
        mappings: [
          { keyword: "cost insurance freight", mappedValue: "CIF" },
          { keyword: "c&f", mappedValue: "CFR" },
        ],
        mode: "replace",
      },
    },
    enabled: true,
  };
  const res1 = applyWorkflowStep("Cost Insurance Freight", mapReplaceStep);
  assert.strictEqual(res1.output, "CIF");

  const mapAppendStep: WorkflowStep = {
    id: "step_map_append",
    name: "Map Append",
    description: "Append country code",
    docScope: "all",
    targetField: "Pelabuhan_Muat",
    action: {
      type: "value_mapping",
      config: {
        mappings: [{ keyword: "busan", mappedValue: "KR" }],
        mode: "append",
      },
    },
    enabled: true,
  };
  const res2 = applyWorkflowStep("BUSAN", mapAppendStep);
  assert.strictEqual(res2.output, "BUSAN (KR)");
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 9: Data Actions Scoping & Target Field Scoping (>= 5 tests)
// ─────────────────────────────────────────────────────────────────────────────

test("Feature 9.1 (Scoping): Document scope filtering prevents execution on non-targeted documents", () => {
  const invoiceOnlyStep: WorkflowStep = {
    id: "step_inv_only",
    name: "Invoice Only Step",
    description: "Apply only to invoice",
    docScope: "invoice",
    targetField: "No_Invoice",
    action: {
      type: "case_transform",
      config: { transform: "uppercase" },
    },
    enabled: true,
  };

  // Applied to invoice
  const resInvoice = applyWorkflowStep("usc-inv-8801", invoiceOnlyStep, "invoice");
  assert.strictEqual(resInvoice.output, "USC-INV-8801");
  assert.strictEqual(resInvoice.applied, true);

  // Filtered out for PIB
  const resPib = applyWorkflowStep("usc-inv-8801", invoiceOnlyStep, "pib");
  assert.strictEqual(resPib.output, "usc-inv-8801");
  assert.strictEqual(resPib.applied, false);

  // Filtered out for BL
  const resBl = applyWorkflowStep("usc-inv-8801", invoiceOnlyStep, "bl");
  assert.strictEqual(resBl.output, "usc-inv-8801");
  assert.strictEqual(resBl.applied, false);
});

test("Feature 9.2 (Scoping): Target field filtering applies only to designated field name", () => {
  const steps: WorkflowStep[] = [
    {
      id: "step_single_field",
      name: "Uppercase Invoice Only",
      description: "Target only No_Invoice",
      docScope: "all",
      targetField: "No_Invoice",
      action: {
        type: "case_transform",
        config: { transform: "uppercase" },
      },
      enabled: true,
    },
  ];

  const resInvoice = executeDataPipeline("usc-inv-8801", "No_Invoice", "all", steps);
  assert.strictEqual(resInvoice.finalValue, "USC-INV-8801");

  const resWeight = executeDataPipeline("48500 kg", "Berat_Bersih", "all", steps);
  assert.strictEqual(resWeight.finalValue, "48500 kg"); // untouched
});

test("Feature 9.3 (Scoping): Multi-field targeting transforms all specified fields in targetFields array", () => {
  const steps: WorkflowStep[] = [
    {
      id: "step_multi_field",
      name: "Strip Units from Weights",
      description: "Strip kg from net and gross weights",
      docScope: "all",
      targetField: "",
      targetFields: ["Berat_Bersih", "Berat_Kotor"],
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

  const resNet = executeDataPipeline("48,500 kg", "Berat_Bersih", "all", steps);
  assert.strictEqual(resNet.finalValue, "48500");

  const resGross = executeDataPipeline("49,120 kg", "Berat_Kotor", "all", steps);
  assert.strictEqual(resGross.finalValue, "49120");

  const resDesc = executeDataPipeline("Steel Coils 50 kg", "Deskripsi_Barang", "all", steps);
  assert.strictEqual(resDesc.finalValue, "Steel Coils 50 kg"); // not targeted
});

test("Feature 9.4 (Scoping): Ingestion enrichment creates [fieldName]_action alongside original field", () => {
  const rawFields = {
    No_Invoice: "  inv/2026/8801  ",
    Berat_Bersih: "48,500 kg",
    Valuta: "usd",
  };

  const steps: WorkflowStep[] = [
    {
      id: "step_clean_inv",
      name: "Normalize Invoice",
      description: "Uppercase and remove punctuation",
      docScope: "all",
      targetField: "No_Invoice",
      action: {
        type: "remove_characters",
        config: { mode: "punctuation" },
      },
      enabled: true,
    },
    {
      id: "step_upper_inv",
      name: "Upper Invoice",
      description: "Uppercase invoice",
      docScope: "all",
      targetField: "No_Invoice",
      action: {
        type: "case_transform",
        config: { transform: "uppercase" },
      },
      enabled: true,
    },
    {
      id: "step_trim_inv",
      name: "Trim Invoice",
      description: "Trim whitespace",
      docScope: "all",
      targetField: "No_Invoice",
      action: {
        type: "trim_whitespace",
        config: { trimEdges: true, collapseMultiple: true, removeAllSpaces: false },
      },
      enabled: true,
    },
  ];

  const enriched = applyDataActionsToFields(rawFields, "invoice", steps);

  // Original field remains pristine
  assert.strictEqual(enriched["No_Invoice"], "  inv/2026/8801  ");
  // Enriched action field contains transformed value
  assert.strictEqual(enriched["No_Invoice_action"], "INV20268801");
  // Non-targeted fields remain pristine
  assert.strictEqual(enriched["Berat_Bersih"], "48,500 kg");
  assert.strictEqual(enriched["Valuta"], "usd");
});

test("Feature 9.5 (Scoping): Sequential pipeline chaining applies transformations cumulatively", () => {
  const steps: WorkflowStep[] = [
    {
      id: "s1",
      name: "Trim whitespace",
      description: "trim",
      docScope: "all",
      targetField: "Pos_Tarif",
      action: { type: "trim_whitespace", config: { trimEdges: true, collapseMultiple: true, removeAllSpaces: true } },
      enabled: true,
    },
    {
      id: "s2",
      name: "Remove punctuation",
      description: "strip dots",
      docScope: "all",
      targetField: "Pos_Tarif",
      action: { type: "remove_characters", config: { mode: "punctuation" } },
      enabled: true,
    },
    {
      id: "s3",
      name: "Add prefix",
      description: "prefix HS-",
      docScope: "all",
      targetField: "Pos_Tarif",
      action: { type: "prefix_suffix", config: { operation: "add_prefix", value: "HS-" } },
      enabled: true,
    },
  ];

  const res = executeDataPipeline(" 7208 . 38 . 00 ", "Pos_Tarif", "all", steps);
  assert.strictEqual(res.finalValue, "HS-72083800");
  assert.strictEqual(res.stepResults.length, 3);
  assert.strictEqual(res.hasError, false);
});

test("Feature 9.6 (Scoping): Table rows line-item transformation creates [fieldName]_action alongside original fields", () => {
  const steps: WorkflowStep[] = [
    {
      id: "step_table_hs",
      name: "Strip HS Dots",
      description: "Strip dots from HS code in table rows",
      docScope: "pib",
      targetField: "Pos_Tarif",
      action: { type: "remove_characters", config: { mode: "punctuation" } },
      enabled: true,
    },
    {
      id: "step_table_grade",
      name: "Uppercase Material Grade",
      description: "Uppercase steel grade in table rows",
      docScope: "pib",
      targetField: "Spesifikasi_Grade",
      action: { type: "case_transform", config: { transform: "uppercase" } },
      enabled: true,
    },
  ];

  const rawTable = [
    { Pos_Tarif: "7208.38.00", Spesifikasi_Grade: "sphc", Ukuran_Barang: "2.3 X 1219 X C" },
    { Pos_Tarif: "7208.39.00", Spesifikasi_Grade: "spcc", Ukuran_Barang: "3.2 X 1219 X C" },
  ];

  const transformedTable = applyDataActionsToTableRows(rawTable, "pib", steps);

  assert.strictEqual(transformedTable.length, 2);
  // Verify original field is preserved unmodified
  assert.strictEqual(transformedTable[0]!["Pos_Tarif"], "7208.38.00");
  assert.strictEqual(transformedTable[0]!["Spesifikasi_Grade"], "sphc");
  assert.strictEqual(transformedTable[0]!["Ukuran_Barang"], "2.3 X 1219 X C");

  // Verify [fieldName]_action is created with transformed value
  assert.strictEqual(transformedTable[0]!["Pos_Tarif_action"], "72083800");
  assert.strictEqual(transformedTable[0]!["Spesifikasi_Grade_action"], "SPHC");
  assert.strictEqual(transformedTable[0]!["Ukuran_Barang_action"], "2.3 X 1219 X C");

  assert.strictEqual(transformedTable[1]!["Pos_Tarif_action"], "72083900");
  assert.strictEqual(transformedTable[1]!["Spesifikasi_Grade_action"], "SPCC");
});

test("Feature 9.7 (Scoping): DOCUMENT_FIELD_REGISTRY provides dynamic document-scoped fields for all 7 USC document types", () => {
  const docTypes = ["pib", "ci", "pl", "bl", "ak", "wl", "ms"] as const;

  for (const doc of docTypes) {
    const def = DOCUMENT_FIELD_REGISTRY[doc];
    assert.ok(def, `Definition for ${doc} must exist`);
    assert.ok(def.expectedFields.length > 0, `${doc} must have expectedFields`);
    assert.ok(def.itemFields.length > 0, `${doc} must have itemFields`);

    const options = getFieldOptionsForDocument(doc);
    assert.ok(options.length > 0, `Field options for ${doc} must not be empty`);
    assert.strictEqual(options[0]!.value, "*", "First option must be wildcard *");

    // All options must have label and value
    for (const opt of options) {
      assert.ok(opt.label, "Option must have label");
      assert.ok(opt.value, "Option must have value");
    }
  }

  // Global scope should return wildcard plus unified options
  const globalOptions = getFieldOptionsForDocument("all");
  assert.ok(globalOptions.length >= 25, "Global options should aggregate fields from all docs");
});

test("Feature 9.8 (Scoping): European comma-decimal number formatting with roundDecimals maintains numeric integrity", () => {
  const commaRoundStep: WorkflowStep = {
    id: "step_comma_round",
    name: "Comma Rounding",
    description: "Round comma decimal to 2 places and keep comma format",
    docScope: "all",
    targetField: "Berat_Bersih",
    action: {
      type: "number_formatting",
      config: {
        removeCommas: false,
        decimalFormat: "comma",
        roundDecimals: 2,
        stripCurrency: false,
        stripUnits: true,
      },
    },
    enabled: true,
  };

  const res = applyWorkflowStep("48500.755 kg", commaRoundStep);
  assert.strictEqual(res.output, "48500,76");

  // European input format "48500,755" should also not be corrupted into millions
  const resEuropeanInput = applyWorkflowStep("48500,755 kg", commaRoundStep);
  assert.strictEqual(resEuropeanInput.output, "48500,76");
});

test("Feature 9.9 (Scoping): Document scope filter correctly matches normalized snake_case and spaced document types", () => {
  const plStep: WorkflowStep = {
    id: "step_pl_only",
    name: "PL Only Step",
    description: "Applies only to Packing List",
    docScope: "packing_list",
    targetField: "No_Invoice",
    action: {
      type: "case_transform",
      config: { transform: "uppercase" },
    },
    enabled: true,
  };

  // Target doc as "packing_list"
  const res1 = applyWorkflowStep("inv-001", plStep, "packing_list");
  assert.strictEqual(res1.applied, true);
  assert.strictEqual(res1.output, "INV-001");

  // Target doc as "Packing List"
  const res2 = applyWorkflowStep("inv-001", plStep, "Packing List");
  assert.strictEqual(res2.applied, true);
  assert.strictEqual(res2.output, "INV-001");

  // Non-matching doc as "Commercial Invoice"
  const res3 = applyWorkflowStep("inv-001", plStep, "Commercial Invoice");
  assert.strictEqual(res3.applied, false);
  assert.strictEqual(res3.output, "inv-001");
});
