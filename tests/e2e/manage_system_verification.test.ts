import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import { GET, POST } from "~/app/api/data-actions/route";
import { validateWorkflowStep } from "~/utils/workflowRunner";
import type { WorkflowStep } from "~/types/workflow";

// ─────────────────────────────────────────────────────────────────────────────
// Verification Test Suite for Manage System & WorkflowBuilder Updates
// ─────────────────────────────────────────────────────────────────────────────

test("R1: ManageSystemPage completely removes Kamus Ekuivalensi Nilai tab and component", () => {
  const pagePath = path.join(process.cwd(), "src", "app", "manage-system", "page.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  // Must not import ValueEquivalencyManager
  assert.strictEqual(
    content.includes("ValueEquivalencyManager"),
    false,
    "page.tsx must not reference ValueEquivalencyManager"
  );

  // Must not contain 'equivalency' in tab definitions
  assert.strictEqual(
    content.includes('"equivalency"'),
    false,
    "page.tsx must not have 'equivalency' in tabs"
  );

  // Must retain workflow, models, matching
  assert.ok(content.includes('"workflow"'), "Must have workflow tab");
  assert.ok(content.includes('"models"'), "Must have models tab");
  assert.ok(content.includes('"matching"'), "Must have matching tab");
});

test("R2: Output Settings contains descriptive helper guidance in WorkflowBuilder.tsx", () => {
  const wbPath = path.join(
    process.cwd(),
    "src",
    "app",
    "manage-system",
    "_components",
    "WorkflowBuilder.tsx"
  );
  const content = fs.readFileSync(wbPath, "utf-8");

  // Must contain descriptive helper text explaining Create as new field vs Update existing field
  assert.ok(
    content.includes("Panduan Output Settings"),
    "Output Settings must contain guidance header"
  );
  assert.ok(
    content.includes("Create as new field"),
    "Must explain Create as new field mode"
  );
  assert.ok(
    content.includes("Update existing field"),
    "Must explain Update existing field mode"
  );
  assert.ok(
    content.includes("[fieldName]_action") || content.includes("_action"),
    "Must mention _action convention"
  );
});

test("R3.1: Action buttons in WorkflowBuilder match USC dark navy palette and avoid bg-blue-600", () => {
  const wbPath = path.join(
    process.cwd(),
    "src",
    "app",
    "manage-system",
    "_components",
    "WorkflowBuilder.tsx"
  );
  const content = fs.readFileSync(wbPath, "utf-8");

  // Done button must use bg-blue-950 hover:bg-blue-900
  assert.ok(
    content.includes("bg-blue-950 hover:bg-blue-900 text-white text-xs font-semibold"),
    "Done button must use USC dark navy palette"
  );

  // Must not contain bg-blue-600 (standalone light blue action button)
  assert.strictEqual(
    content.includes("bg-blue-600"),
    false,
    "WorkflowBuilder must not contain bright light blue bg-blue-600 buttons"
  );
});

test("R3.2: /api/data-actions handles GET and POST persistence correctly", async () => {
  const configPath = path.join(process.cwd(), "src", "config", "data_actions.json");
  const hadOriginal = fs.existsSync(configPath);
  const originalContent = hadOriginal ? fs.readFileSync(configPath, "utf-8") : null;

  try {
    // Test GET
    const getRes = await GET();
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.strictEqual(getData.success, true);
    assert.ok(Array.isArray(getData.steps));

    // Test POST with pipeline steps
    const testSteps: WorkflowStep[] = [
      {
        id: "step-test-unit-1",
        name: "Trim Whitespace (PIB)",
        docScope: "pib",
        targetFields: ["Nomor_Pengajuan"],
        targetField: "Nomor_Pengajuan",
        outputMode: "new_field",
        outputFieldName: "Nomor_Pengajuan_action",
        action: {
          type: "trim_whitespace",
          config: { trimEdges: true, collapseMultiple: true },
        },
        enabled: true,
      },
    ];

    const req = new Request("http://localhost:3000/api/data-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: testSteps }),
    });

    const postRes = await POST(req);
    assert.strictEqual(postRes.status, 200);
    const postData = await postRes.json();
    assert.strictEqual(postData.success, true);
    assert.strictEqual(postData.count, 1);

    // Verify GET retrieves saved steps
    const verifyRes = await GET();
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.success, true);
    assert.strictEqual(verifyData.steps.length, 1);
    assert.strictEqual(verifyData.steps[0].id, "step-test-unit-1");
  } finally {
    if (hadOriginal && originalContent !== null) {
      fs.writeFileSync(configPath, originalContent, "utf-8");
    } else if (!hadOriginal && fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
});

test("R3.2b: /api/data-actions rejects non-array payload with 400 without wiping data", async () => {
  const configPath = path.join(process.cwd(), "src", "config", "data_actions.json");
  const hadOriginal = fs.existsSync(configPath);
  const originalContent = hadOriginal ? fs.readFileSync(configPath, "utf-8") : null;

  try {
    // Ensure seed data exists
    const seedReq = new Request("http://localhost:3000/api/data-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        steps: [
          {
            id: "step-preserve-check",
            name: "Preserve Check",
            docScope: "pib",
            targetFields: ["Nomor_Pengajuan"],
            action: { type: "trim_whitespace", config: { trimEdges: true } },
            enabled: true,
          },
        ],
      }),
    });
    await POST(seedReq);

    // Test POST with missing/invalid steps
    const invalidReq = new Request("http://localhost:3000/api/data-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(invalidReq);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);

    // Verify existing data was NOT wiped
    const getRes = await GET();
    const getData = await getRes.json();
    assert.strictEqual(getData.success, true);
    assert.ok(getData.steps.length > 0, "Existing steps must be preserved");
    assert.strictEqual(getData.steps[0].id, "step-preserve-check");
  } finally {
    if (hadOriginal && originalContent !== null) {
      fs.writeFileSync(configPath, originalContent, "utf-8");
    } else if (!hadOriginal && fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
});

test("R3.3: validateWorkflowStep production utility correctly detects empty required data", () => {
  // 0. Null / non-object input -> invalid
  assert.strictEqual(validateWorkflowStep(null as unknown as WorkflowStep).isValid, false);
  assert.strictEqual(validateWorkflowStep(null as unknown as WorkflowStep).warning, "Data masih kosong");
  assert.strictEqual(validateWorkflowStep(undefined as unknown as WorkflowStep).isValid, false);
  assert.strictEqual(validateWorkflowStep({} as unknown as WorkflowStep).isValid, false);

  // 1. Step with no target fields -> invalid
  const stepNoTarget: WorkflowStep = {
    id: "s1",
    name: "Trim",
    docScope: "pib",
    targetFields: [],
    targetField: "",
    action: { type: "trim_whitespace", config: { trimEdges: true } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepNoTarget).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepNoTarget).warning, "Data masih kosong");

  // 1b. Step with empty string / whitespace target fields -> invalid
  const stepWhitespaceTarget: WorkflowStep = {
    id: "s1b",
    name: "Trim",
    docScope: "pib",
    targetFields: ["", "   "],
    targetField: "   ",
    action: { type: "trim_whitespace", config: { trimEdges: true } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepWhitespaceTarget).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepWhitespaceTarget).warning, "Data masih kosong");

  // 1c. Step with empty name -> invalid
  const stepEmptyName: WorkflowStep = {
    id: "s1c",
    name: "   ",
    docScope: "pib",
    targetFields: ["Nomor_Pengajuan"],
    targetField: "Nomor_Pengajuan",
    action: { type: "trim_whitespace", config: { trimEdges: true } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyName).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyName).warning, "Data masih kosong");

  // 2. Step replace_text with empty findText -> invalid
  const stepEmptyReplace: WorkflowStep = {
    id: "s2",
    name: "Replace",
    docScope: "ci",
    targetFields: ["No_Invoice"],
    targetField: "No_Invoice",
    action: { type: "replace_text", config: { findText: "", replaceWith: "INV" } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyReplace).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyReplace).warning, "Data masih kosong");

  // 3. Step prefix_suffix with empty value -> invalid
  const stepEmptyPrefix: WorkflowStep = {
    id: "s3",
    name: "Prefix",
    docScope: "ci",
    targetFields: ["No_Invoice"],
    targetField: "No_Invoice",
    action: { type: "prefix_suffix", config: { operation: "add_prefix", value: "" } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyPrefix).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyPrefix).warning, "Data masih kosong");

  // 4. Step remove_characters with no options -> invalid
  const stepEmptyRemove: WorkflowStep = {
    id: "s4",
    name: "Remove",
    docScope: "ci",
    targetFields: ["No_Invoice"],
    targetField: "No_Invoice",
    action: {
      type: "remove_characters",
      config: {
        mode: "custom",
        customChars: "",
        removePunctuation: false,
        removeNumbers: false,
        removeAlphabets: false,
        removeSpecialChars: false,
        removeWhitespace: false,
      },
    },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyRemove).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyRemove).warning, "Data masih kosong");

  // 5. Step value_mapping with empty mappings -> invalid
  const stepEmptyMapping: WorkflowStep = {
    id: "s5",
    name: "Mapping",
    docScope: "ci",
    targetFields: ["Seller"],
    targetField: "Seller",
    action: { type: "value_mapping", config: { mappings: [], mode: "replace" } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyMapping).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyMapping).warning, "Data masih kosong");

  // 5b. Step value_mapping with empty keyword -> invalid
  const stepEmptyKeywordMapping: WorkflowStep = {
    id: "s5b",
    name: "Mapping",
    docScope: "ci",
    targetFields: ["Seller"],
    targetField: "Seller",
    action: {
      type: "value_mapping",
      config: { mappings: [{ keyword: "  ", mappedValue: "TANJUNG" }], mode: "replace" },
    },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyKeywordMapping).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyKeywordMapping).warning, "Data masih kosong");

  // 5c. Step trim_whitespace with all options false -> invalid
  const stepEmptyTrim: WorkflowStep = {
    id: "s5c",
    name: "Trim",
    docScope: "ci",
    targetFields: ["No_Invoice"],
    targetField: "No_Invoice",
    action: {
      type: "trim_whitespace",
      config: { trimEdges: false, collapseMultiple: false, removeAllSpaces: false },
    },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyTrim).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyTrim).warning, "Data masih kosong");

  // 5d. Step number_formatting with all options inactive -> invalid
  const stepEmptyNumber: WorkflowStep = {
    id: "s5d",
    name: "Format Number",
    docScope: "ci",
    targetFields: ["Total_Amount"],
    targetField: "Total_Amount",
    action: {
      type: "number_formatting",
      config: {
        removeCommas: false,
        stripCurrency: false,
        stripUnits: false,
        roundDecimals: -1,
      },
    },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyNumber).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyNumber).warning, "Data masih kosong");

  // 5e. Step with empty docScope -> invalid
  const stepEmptyDocScope: WorkflowStep = {
    id: "s5e",
    name: "Trim",
    docScope: "" as any,
    targetFields: ["No_Invoice"],
    targetField: "No_Invoice",
    action: { type: "trim_whitespace", config: { trimEdges: true } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyDocScope).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyDocScope).warning, "Data masih kosong");

  // 5f. Step case_transform with empty transform -> invalid
  const stepEmptyCase: WorkflowStep = {
    id: "s5f",
    name: "Case",
    docScope: "ci",
    targetFields: ["No_Invoice"],
    targetField: "No_Invoice",
    action: { type: "case_transform", config: { transform: "" as any } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyCase).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyCase).warning, "Data masih kosong");

  // 5g. Step date_normalize with empty targetFormat -> invalid
  const stepEmptyDate: WorkflowStep = {
    id: "s5g",
    name: "Date",
    docScope: "ci",
    targetFields: ["Tgl_Invoice"],
    targetField: "Tgl_Invoice",
    action: { type: "date_normalize", config: { targetFormat: "" as any } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyDate).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyDate).warning, "Data masih kosong");

  // 5h. Step validation_rule with empty condition -> invalid
  const stepEmptyValidation: WorkflowStep = {
    id: "s5h",
    name: "Validation",
    docScope: "ci",
    targetFields: ["No_Invoice"],
    targetField: "No_Invoice",
    action: { type: "validation_rule", config: { condition: "" as any, onFail: "warning" } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepEmptyValidation).isValid, false);
  assert.strictEqual(validateWorkflowStep(stepEmptyValidation).warning, "Data masih kosong");

  // 6. Valid steps -> valid
  const stepValidReplace: WorkflowStep = {
    id: "s6",
    name: "Replace",
    docScope: "ci",
    targetFields: ["No_Invoice"],
    targetField: "No_Invoice",
    action: { type: "replace_text", config: { findText: "INV", replaceWith: "USC" } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepValidReplace).isValid, true);

  const stepValidTrim: WorkflowStep = {
    id: "s7",
    name: "Trim",
    docScope: "ci",
    targetFields: ["No_Invoice"],
    targetField: "No_Invoice",
    action: { type: "trim_whitespace", config: { trimEdges: true, collapseMultiple: true } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepValidTrim).isValid, true);

  // 6b. Number formatting with decimalFormat is valid
  const stepValidDecimalFormat: WorkflowStep = {
    id: "s8",
    name: "Decimal Format",
    docScope: "ci",
    targetFields: ["Total_Amount"],
    targetField: "Total_Amount",
    action: {
      type: "number_formatting",
      config: {
        removeCommas: false,
        stripCurrency: false,
        stripUnits: false,
        decimalFormat: "comma",
        roundDecimals: -1,
      },
    },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepValidDecimalFormat).isValid, true);

  // 6c. Case transform and date normalize valid configurations
  const stepValidCase: WorkflowStep = {
    id: "s9",
    name: "Uppercase",
    docScope: "ci",
    targetFields: ["No_Invoice"],
    targetField: "No_Invoice",
    action: { type: "case_transform", config: { transform: "uppercase" } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepValidCase).isValid, true);

  const stepValidDate: WorkflowStep = {
    id: "s10",
    name: "Date Normalization",
    docScope: "ci",
    targetFields: ["Tgl_Invoice"],
    targetField: "Tgl_Invoice",
    action: { type: "date_normalize", config: { targetFormat: "DD/MM/YYYY" } },
    enabled: true,
  };
  assert.strictEqual(validateWorkflowStep(stepValidDate).isValid, true);
});

