import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateBatchComparison,
  extractRawWebhookValue,
  parseDocumentIsi,
} from "../src/app/matching/_components/detailAdapter";
import type { WorkflowStep } from "../src/types/workflow";

test("Excel evaluation exposes raw Nanonets webhook values while Status reflects final edited/confirmed result", () => {
  const rawBatch = {
    id: "0001",
    status: "APPROVED",
    details: [
      {
        id: 1,
        fileType: "PIB",
        fileId: "PIB.pdf",
        isi: JSON.stringify({
          fields: {
            Ukuran_Barang: "1.0 MM X 821 MM X C",
            Berat_Bersih: "1.045.140.0000",
          },
        }),
      },
      {
        id: 2,
        fileType: "Invoice",
        fileId: "Invoice.pdf",
        isi: JSON.stringify({
          fields: {
            Ukuran_Barang: "1. 0MM X 821MM X C",
            Net_Weight: "1,045.140 KG",
          },
          manualEdits: {
            Ukuran_Barang: {
              oldValue: "1. 0MM X 821MM X C",
              newValue: "1.0 MM X 821 MM X C",
            },
          },
          manualMatches: {
            "inv-7": { confirmed: true, confirmedBy: "User A" },
          },
        }),
      },
    ],
  };

  const liveSteps: WorkflowStep[] = [
    {
      id: "step-weight",
      name: "Clean Weight",
      docScope: "ci",
      targetField: "Net_Weight",
      targetFields: ["Net_Weight"],
      outputMode: "new_field",
      outputFieldName: "Net_Weight_action",
      enabled: true,
      action: {
        type: "remove_characters",
        config: { mode: "custom", customChars: " KG", removeWhitespace: false },
      },
    },
  ];

  // Raw parser preserves untouched Nanonets values regardless of Data Actions or manualEdits
  const parsedInv = parseDocumentIsi(rawBatch.details[1]!.isi, "Invoice", liveSteps);
  assert.equal(
    extractRawWebhookValue(parsedInv, ["Ukuran_Barang"]),
    "1. 0MM X 821MM X C"
  );
  assert.equal(
    extractRawWebhookValue(parsedInv, ["Net_Weight"]),
    "1,045.140 KG"
  );

  // Evaluation returns raw webhook values for Excel columns AND final MATCH status
  const evalResult = evaluateBatchComparison(rawBatch, [], liveSteps);
  const sizeField = evalResult.allFields.find((f) => f.fieldName === "Ukuran barang");
  const weightField = evalResult.allFields.find((f) => f.fieldName === "Berat Bersih");

  assert.equal(sizeField?.rawPibValue, "1.0 MM X 821 MM X C");
  assert.equal(sizeField?.rawTargetValue, "1. 0MM X 821MM X C");
  assert.equal(sizeField?.pibValue, "1.0 MM X 821 MM X C");
  assert.equal(sizeField?.targetValue, "1.0 MM X 821 MM X C");
  assert.equal(sizeField?.status, "MATCH");

  assert.equal(weightField?.rawPibValue, "1.045.140.0000");
  assert.equal(weightField?.rawTargetValue, "1,045.140 KG");
  assert.equal(weightField?.status, "MATCH");
});
