import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildBatchChangeLogs,
  extractManualNotesFromBatch,
  getChangeEventsForField,
} from "../src/utils/changeLogBuilder";
import { evaluateBatchComparison } from "../src/app/matching/_components/detailAdapter";
import type { DbEquivalencyGroup } from "../src/utils/valueEquivalency";

describe("Complete Change Log Builder (Data Action, Kamus, Edit, Setujui Satuan/All)", () => {
  it("keeps Data Action, multi-step Edits, Kamus, Setujui Satuan, Setujui Massal (All), and Notes intact chronologically", () => {
    const equivalencyGroups: DbEquivalencyGroup[] = [
      {
        id: 1,
        name: "Identitas_Penjual",
        category: "umum",
        canonical: "MARUBENI-ITOCHU",
        values: ["MARUBENI-ITOCHU STEEL INC", "MARUBENI ITOCHU"],
      },
    ];

    const rawBatch = {
      id: "0099",
      nama: "Batch #0099",
      status: "APPROVED",
      createdBy: { name: "Staff A" },
      details: [
        {
          id: 10,
          fileType: "PIB (File Acuan)",
          fileId: "PIB.pdf",
          isi: JSON.stringify({
            fields: {
              Identitas_Penjual: "MARUBENI-ITOCHU STEEL INC",
              No_Invoice: "INV-001",
              No_Invoice_action: "INV-001-REV2",
            },
            dataActionOriginals: {
              No_Invoice: {
                rawValue: "INV-001",
                actionValue: "INV001",
              },
            },
            manualNotes: [
              {
                id: "n1",
                targetType: "field",
                targetKey: "No_Invoice",
                docCode: "PIB",
                text: "Sudah dicek dengan invoice asli",
                author: "Staff A",
                createdAt: "2026-11-26T01:00:00.000Z",
              },
            ],
          }),
        },
        {
          id: 11,
          fileType: "Invoice",
          fileId: "Invoice.pdf",
          isi: JSON.stringify({
            fields: {
              Identitas_Penjual: "MARUBENI ITOCHU",
              No_Invoice: "INV-001",
              Valuta: "IDR",
            },
            manualMatches: {
              Valuta: {
                confirmed: true,
                confirmedAt: "2026-11-26T02:00:00.000Z",
                confirmedBy: "Admin",
              },
            },
          }),
        },
        {
          id: 12,
          fileType: "Bill of Lading",
          fileId: "BL.pdf",
          isi: JSON.stringify({
            fields: {
              No_BL: "BL-999",
            },
            manualMatches: {
              "bl-6": {
                confirmed: true,
                confirmedAt: "2026-11-26T03:00:00.000Z",
                confirmedBy: "Admin",
              },
            },
          }),
        },
      ],
      actionLogs: [
        {
          id: 1,
          docType: "PIB",
          fieldName: "No_Invoice",
          oldValue: "INV001",
          newValue: "INV-001-REV1",
          notes: "[Edit Nilai] Koreksi nilai manual oleh Staff A",
          actionBy: "Staff A",
          createdAt: "2026-11-26T01:10:00.000Z",
        },
        {
          id: 2,
          docType: "PIB",
          fieldName: "No_Invoice",
          oldValue: "INV-001-REV1",
          newValue: "INV-001-REV2",
          notes: "[Edit Nilai] Koreksi nilai manual oleh Staff A",
          actionBy: "Staff A",
          createdAt: "2026-11-26T01:20:00.000Z",
        },
        {
          id: 3,
          docType: "Invoice",
          fieldName: "Valuta",
          oldValue: "MISMATCH",
          newValue: "MATCH (Setujui Massal)",
          notes: "[Setujui Massal (All)] Disetujui via Setujui Invoice oleh Admin",
          actionBy: "Admin",
          createdAt: "2026-11-26T02:00:00.000Z",
        },
        {
          id: 4,
          docType: "BL",
          fieldName: "Nomor B/L",
          oldValue: "MISMATCH",
          newValue: "MATCH (Setujui Satuan)",
          notes: "[Setujui Satuan] Konfirmasi manual oleh Admin",
          actionBy: "Admin",
          createdAt: "2026-11-26T03:00:00.000Z",
        },
        {
          id: 5,
          docType: "Batch",
          fieldName: "Status Batch",
          oldValue: "MISMATCHING",
          newValue: "APPROVED",
          notes: "[Setujui Berkas] Selesaikan & Pindahkan File ke All Data oleh Admin",
          actionBy: "Admin",
          createdAt: "2026-11-26T03:30:00.000Z",
        },
      ],
    };

    const evalResult = evaluateBatchComparison(rawBatch, equivalencyGroups);
    const logs = buildBatchChangeLogs(rawBatch, evalResult.evaluatedFieldModels || []);

    const categories = logs.map((l) => l.category);
    assert.ok(categories.includes("DATA_ACTION"), "Must include preserved pre-edit Data Action");
    assert.ok(categories.includes("KAMUS"), "Must include Kamus Ekuivalensi match");
    assert.equal(logs.filter((l) => l.category === "EDIT").length, 2, "Must preserve both Edit 1 and Edit 2");
    assert.ok(categories.includes("SETUJUI_ALL"), "Must include Setujui Massal (All)");
    assert.ok(categories.includes("SETUJUI_SATUAN"), "Must include Setujui Satuan");
    assert.ok(categories.includes("SETUJUI_BERKAS"), "Must include Setujui Berkas");

    // Field-specific matching for No_Invoice should include BOTH Data Action AND Edit 1 & Edit 2
    const invNoEvents = getChangeEventsForField(logs, {
      id: "inv-2",
      fieldName: "No_Invoice",
      label: "Nomor invoice",
      docCode: "Invoice",
      pibKeys: ["No_Invoice", "Invoice_Number"],
      supportingKeys: ["No_Invoice", "Invoice_Number"],
    });
    assert.equal(invNoEvents.length, 3, "No_Invoice card must show 1 Data Action + 2 Edits");
    assert.equal(invNoEvents[0]!.oldValue, "INV-001");
    assert.equal(invNoEvents[0]!.newValue, "INV001");
    assert.equal(invNoEvents[1]!.newValue, "INV-001-REV1");
    assert.equal(invNoEvents[2]!.newValue, "INV-001-REV2");

    // Manual notes extraction supports `.text`
    const notes = extractManualNotesFromBatch(rawBatch);
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.note, "Sudah dicek dengan invoice asli");
  });

  it("falls back cleanly to JSON manualMatches and unedited Data Action when actionLogs are absent", () => {
    const legacyBatch = {
      id: "0012",
      createdBy: { name: "Staff B" },
      details: [
        {
          id: 21,
          fileType: "Invoice",
          fileId: "Inv.pdf",
          isi: JSON.stringify({
            fields: {
              Berat_Kotor: "1,053.689 MT",
              Berat_Kotor_action: "1053.689",
            },
            manualMatches: {
              "inv-1": {
                confirmed: true,
                confirmedAt: "2026-11-20T10:00:00.000Z",
                confirmedBy: "Approver X",
              },
              Identitas_Penjual: {
                confirmed: true,
                confirmedAt: "2026-11-20T10:00:00.000Z",
                confirmedBy: "Approver X",
              },
              identitaspenjual: {
                confirmed: true,
                confirmedAt: "2026-11-20T10:00:00.000Z",
                confirmedBy: "Approver X",
              },
            },
          }),
        },
      ],
      actionLogs: [],
    };

    const logs = buildBatchChangeLogs(legacyBatch, []);
    const da = logs.filter((l) => l.category === "DATA_ACTION");
    const manualFallback = logs.filter((l) => l.category === "SETUJUI_SATUAN");

    assert.equal(da.length, 1);
    assert.equal(da[0]!.oldValue, "1,053.689 MT");
    assert.equal(da[0]!.newValue, "1053.689");
    assert.ok(manualFallback.length >= 1, "Legacy manualMatches must still appear in logs");
  });
});
