import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adaptBatchToModel,
  buildComparisonFields,
  buildAllComparisonGroups,
} from "../src/app/matching/_components/detailAdapter";

describe("Detail View Adapter & Dynamic Tabs", () => {
  it("dynamically derives 6 supporting document tabs for Batch 0009", () => {
    const rawBatch0009 = {
      id: "0009",
      nama: "PT UNITED STEEL CENTER INDONESIA",
      status: "MISMATCHING",
      details: [
        { id: 63, fileType: "WL", fileId: "WL.pdf", isi: JSON.stringify({ fields: { Total_Berat: "1000" } }) },
        { id: 64, fileType: "MS", fileId: "MS.pdf", isi: JSON.stringify({ fields: { Spek_Material: "SPHC" } }) },
        { id: 65, fileType: "Bill of Lading", fileId: "BL.pdf", isi: JSON.stringify({ fields: { No_BL: "BL123" } }) },
        { id: 66, fileType: "Invoice", fileId: "Invoice.pdf", isi: JSON.stringify({ fields: { No_Invoice: "INV99" } }) },
        { id: 67, fileType: "Packing List", fileId: "PL.pdf", isi: JSON.stringify({ fields: { Gross_Weight: "5000" } }) },
        { id: 68, fileType: "PIB (File Acuan)", fileId: "PIB.pdf", isi: JSON.stringify({ fields: { No_Invoice: "INV99", No_BL: "BL123" } }) },
        { id: 69, fileType: "AK", fileId: "AK.pdf", isi: JSON.stringify({ fields: { No_Referensi: "AK-ECO-01" } }) },
      ],
    };

    const model = adaptBatchToModel(rawBatch0009);
    assert.equal(model.pib.code, "PIB");
    assert.equal(model.pib.name, "PIB (acuan)");
    assert.equal(model.pib.fileUrl, "/api/batches/0009/pdf?type=pib&detailId=68");
    assert.equal(model.supporting.length, 6, "Batch 0009 must have exactly 6 supporting documents");

    const supportingCodes = model.supporting.map((d) => d.code);
    assert.deepEqual(supportingCodes, ["Invoice", "PL", "BL", "AK", "WL", "MS"]);
    assert.equal(model.supporting[0]!.fileUrl, "/api/batches/0009/pdf?type=Invoice&detailId=66");
  });

  it("dynamically derives exactly 1 supporting document tab for Batch 0005", () => {
    const rawBatch0005 = {
      id: "0005",
      nama: "Batch #0005",
      status: "Matching",
      details: [
        { id: 51, fileType: "PIB (File Acuan)", fileId: "PIB.pdf", isi: JSON.stringify({ fields: { No_Invoice: "INV-555" } }) },
        { id: 52, fileType: "Invoice", fileId: "Invoice.pdf", isi: JSON.stringify({ fields: { No_Invoice: "INV-555" } }) },
      ],
    };

    const model = adaptBatchToModel(rawBatch0005);
    assert.equal(model.pib.code, "PIB");
    assert.equal(model.pib.fileUrl, "/api/batches/0005/pdf?type=pib&detailId=51");
    assert.equal(model.supporting.length, 1, "Batch 0005 must have exactly 1 supporting document");
    assert.equal(model.supporting[0]!.code, "Invoice");
    assert.equal(model.supporting[0]!.fileUrl, "/api/batches/0005/pdf?type=Invoice&detailId=52");
  });

  it("formats comparison cards with sentence case labels and correct inner values", () => {
    const pibDoc = {
      id: 1,
      code: "PIB",
      name: "PIB (acuan)",
      fileName: "PIB.pdf",
      fileUrl: "/api/batches/0009/pdf?type=pib",
      fields: {},
      lineItems: [],
      rawIsi: {
        fields: {
          No_Invoice: "INV-100",
          Identitas_Penjual: "MARUBENI-ITOCHU STEEL INC",
        },
        coordinates: {},
        table: [],
        tableCoordinates: [],
        manualEdits: {},
      },
    };

    const invoiceDoc = {
      id: 2,
      code: "Invoice",
      name: "Invoice",
      fileName: "Invoice.pdf",
      fileUrl: "/api/batches/0009/pdf?type=Invoice",
      fields: {},
      lineItems: [],
      rawIsi: {
        fields: {
          No_Invoice: "INV-100",
          Identitas_Penjual: "POSCO STEEL",
        },
        coordinates: {},
        table: [],
        tableCoordinates: [],
        manualEdits: {},
      },
    };

    const fields = buildComparisonFields(pibDoc, invoiceDoc);
    assert.ok(fields.length > 0);

    const noInvField = fields.find((f) => f.fieldName === "No_Invoice");
    assert.ok(noInvField);
    assert.equal(noInvField?.label, "No invoice", "Label must be sentence case");
    assert.equal(noInvField?.status, "MATCH", "Matching values evaluate to MATCH");
    assert.equal(noInvField?.pibValue, "INV-100");
    assert.equal(noInvField?.supportingValue, "INV-100");

    const sellerField = fields.find((f) => f.fieldName === "Identitas_Penjual");
    assert.ok(sellerField);
    assert.equal(sellerField?.label, "Identitas penjual", "Label must be sentence case");
    assert.equal(sellerField?.status, "MISMATCH", "Divergent values evaluate to MISMATCH");

    // Absent field fallback
    const missingField = fields.find((f) => f.fieldName === "Negara_Asal");
    assert.ok(missingField);
    assert.equal(missingField?.supportingValue, "Tidak ada di dokumen ini");
  });

  it("builds all comparison groups and line item comparisons grouped by supporting document", () => {
    const rawBatch0009 = {
      id: "0009",
      nama: "PT UNITED STEEL CENTER INDONESIA",
      status: "MISMATCHING",
      details: [
        {
          id: 63,
          fileType: "WL",
          fileId: "WL.pdf",
          isi: JSON.stringify({
            fields: { Total_Berat: "1000" },
            table: [{ Pos_Tarif: "72091710", Uraian_Barang: "COLD ROLLED COIL", Jumlah_Barang: "10" }],
          }),
        },
        {
          id: 66,
          fileType: "Invoice",
          fileId: "Invoice.pdf",
          isi: JSON.stringify({
            fields: { No_Invoice: "INV99", Nilai_Total_Invoice: "50000" },
            table: [{ Pos_Tarif: "72091710", Uraian_Barang: "COLD ROLLED COIL", Jumlah_Barang: "10" }],
          }),
        },
        {
          id: 67,
          fileType: "Packing List",
          fileId: "PL.pdf",
          isi: JSON.stringify({
            fields: { Gross_Weight: "5000" },
            table: [{ Pos_Tarif: "72091710", Uraian_Barang: "COLD ROLLED COIL", Jumlah_Barang: "10" }],
          }),
        },
        {
          id: 68,
          fileType: "PIB (File Acuan)",
          fileId: "PIB.pdf",
          isi: JSON.stringify({
            fields: { No_Invoice: "INV99", Nilai_Total_Invoice: "50000", Gross_Weight: "5000" },
            table: [{ Pos_Tarif: "72091710", Uraian_Barang: "COLD ROLLED COIL", Jumlah_Barang: "10" }],
          }),
        },
      ],
    };

    const model = adaptBatchToModel(rawBatch0009);
    const groups = buildAllComparisonGroups(model.pib, model.supporting);

    assert.equal(groups.length, 3, "Must have 3 supporting document groups");
    assert.equal(groups[0]?.docCode, "Invoice", "First group must be Invoice");
    assert.equal(groups[1]?.docCode, "PL", "Second group must be PL");
    assert.equal(groups[2]?.docCode, "WL", "Third group must be WL");

    // Line items verification
    assert.ok(groups[0]?.lineItems.length > 0, "Invoice group must have line items");
    assert.equal(groups[0]?.lineItems[0]?.isMatch, true, "Matching line item must be true");
  });
});
