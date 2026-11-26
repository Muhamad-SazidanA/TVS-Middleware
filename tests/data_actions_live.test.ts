import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  syncDataActionsConfigIfNeeded,
  LEGACY_HIDDEN_GLOBAL_STEP_IDS,
} from "../scripts/sync-data-actions.mjs";
import {
  evaluateBatchComparison,
  parseDocumentIsi,
} from "../src/app/matching/_components/detailAdapter";
import { buildBatchChangeLogs } from "../src/utils/changeLogBuilder";
import type { WorkflowStep } from "../src/types/workflow";

test("syncDataActionsConfigIfNeeded removes hidden legacy docScope=all rules once while keeping user rules", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docmatch-da-sync-"));
  const configPath = path.join(tmpDir, "data_actions.json");
  const markerPath = path.join(tmpDir, ".data-actions-v2-synced");

  const initialSteps = [
    { id: "step-user-ci", docScope: "ci", name: "User CI Rule" },
    { id: "step-1794889000001", docScope: "all", name: "Legacy Hidden 1" },
    { id: "step-1794889000002", docScope: "all", name: "Legacy Hidden 2" },
    { id: "step-user-all", docScope: "all", name: "User Global Rule" },
  ];
  fs.writeFileSync(configPath, JSON.stringify(initialSteps, null, 2), "utf-8");

  const silent = { log: () => {} };
  const firstRun = syncDataActionsConfigIfNeeded({ configPath, markerPath, logger: silent });
  assert.deepEqual(firstRun, { skipped: false, removedCount: 2 });

  const after = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Array<{ id: string }>;
  assert.deepEqual(
    after.map((s) => s.id),
    ["step-user-ci", "step-user-all"]
  );
  assert.equal(
    after.some((s) => LEGACY_HIDDEN_GLOBAL_STEP_IDS.has(s.id)),
    false
  );

  // Subsequent runs skip automatically without altering future edits
  const secondRun = syncDataActionsConfigIfNeeded({ configPath, markerPath, logger: silent });
  assert.deepEqual(secondRun, { skipped: true, removedCount: 0 });
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("live empty dataActions strips stale phantom _action fields and emits zero Data Action logs", () => {
  const rawBatch = {
    id: "0001",
    status: "APPROVED",
    details: [
      {
        id: 1,
        fileType: "PIB",
        fileId: "PIB.pdf",
        isi: JSON.stringify({
          fields: { Ukuran_Barang: "1.0 MM X 821 MM X C" },
        }),
      },
      {
        id: 2,
        fileType: "Invoice",
        fileId: "Invoice.pdf",
        isi: JSON.stringify({
          fields: {
            Ukuran_Barang: "1. 0MM X 821MM X C",
            Ukuran_Barang_action: "1. 0 MM X 821 MM X C",
          },
        }),
      },
    ],
  };

  // Passing empty live config [] (no rules configured for Ukuran_Barang)
  const parsedEmpty = parseDocumentIsi(rawBatch.details[1]!.isi, "Invoice", []);
  assert.equal(parsedEmpty.fields.Ukuran_Barang, "1. 0MM X 821MM X C");
  assert.equal(parsedEmpty.fields.Ukuran_Barang_action, undefined);

  const evalWithoutRule = evaluateBatchComparison(rawBatch, [], []);
  const invField = evalWithoutRule.evaluatedFieldModels?.find(
    (f) => f.fieldName === "Ukuran_Barang"
  );
  assert.equal(invField?.supportingValue, "1. 0MM X 821MM X C");
  assert.equal(Boolean(invField?.supportingIsDataAction), false);

  const logsWithoutRule = buildBatchChangeLogs(rawBatch, [], []);
  assert.equal(
    logsWithoutRule.filter((l) => l.category === "DATA_ACTION").length,
    0
  );

  // Passing an explicit live saved rule transforms identically and logs DATA_ACTION
  const liveSteps: WorkflowStep[] = [
    {
      id: "step-live-1",
      name: "Live Replace",
      docScope: "ci",
      targetField: "Ukuran_Barang",
      targetFields: ["Ukuran_Barang"],
      outputMode: "new_field",
      outputFieldName: "Ukuran_Barang_action",
      enabled: true,
      action: {
        type: "replace_text",
        config: { findText: "1. 0MM X 821MM X C", replaceWith: "1.0 MM X 821 MM X C" },
      },
    },
  ];
  const evalWithRule = evaluateBatchComparison(rawBatch, [], liveSteps);
  const invWithRule = evalWithRule.evaluatedFieldModels?.find(
    (f) => f.fieldName === "Ukuran_Barang"
  );
  assert.equal(invWithRule?.supportingValue, "1.0 MM X 821 MM X C");
  assert.equal(invWithRule?.supportingIsDataAction, true);

  const logsWithRule = buildBatchChangeLogs(rawBatch, [], liveSteps);
  assert.equal(logsWithRule.filter((l) => l.category === "DATA_ACTION").length, 1);
});
