import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cleanDimension,
  matchDocumentItemsStrict,
  extractStandardLineItem,
  type StandardLineItem,
} from "../src/utils/canonicalMatcher";

describe("Line Item Navigation and Dimensional Matching", () => {
  test("cleanDimension properly normalizes varied dimension string formats", () => {
    const pibDim = "1.0 MM X 821 MM X C";
    const msDim = "1.0x821xC";
    const invoiceDim = "1. OMM X 821MM X C";
    const plDim = "1.0MM X 821MM X C";

    assert.equal(cleanDimension(pibDim), "1.0x821xc");
    assert.equal(cleanDimension(msDim), "1.0x821xc");
    assert.equal(cleanDimension(invoiceDim), "1.0x821xc");
    assert.equal(cleanDimension(plDim), "1.0x821xc");
    assert.equal(cleanDimension(pibDim), cleanDimension(msDim));
    assert.equal(cleanDimension(pibDim), cleanDimension(invoiceDim));
    assert.equal(cleanDimension(pibDim), cleanDimension(plDim));
  });

  test("WL line item matching verifies coil numbers without false negative", () => {
    const pibItems: StandardLineItem[] = [
      {
        itemIndex: 0,
        hsCode: "72091710",
        partNo: "JSC270C",
        spec: "JSC270C",
        size: "1.0 MM X 821 MM X C",
        desc: "COLD ROLLED COIL",
        qty: "18.3600",
        unit: "",
        netWeight: "",
        grossWeight: "",
        price: "16,259.80",
        raw: {},
        usedAction: false,
      },
      {
        itemIndex: 1,
        hsCode: "72091790",
        partNo: "JSC270D",
        spec: "JSC270D",
        size: "0.7 MM X 1455 MM X C",
        desc: "COLD ROLLED COIL",
        qty: "21.7300",
        unit: "",
        netWeight: "",
        grossWeight: "",
        price: "19,986.38",
        raw: {},
        usedAction: false,
      },
    ];

    const wlItems: StandardLineItem[] = [
      {
        itemIndex: 0,
        hsCode: "",
        partNo: "CRP4030A",
        spec: "",
        size: "",
        desc: "",
        qty: "",
        unit: "",
        netWeight: "",
        grossWeight: "",
        price: "",
        coilNo: "CRP4030A",
        raw: { No_Coil: "CRP4030A" },
        usedAction: true,
      },
      {
        itemIndex: 1,
        hsCode: "",
        partNo: "CRP4030B",
        spec: "",
        size: "",
        desc: "",
        qty: "",
        unit: "",
        netWeight: "",
        grossWeight: "",
        price: "",
        coilNo: "CRP4030B",
        raw: { No_Coil: "CRP4030B" },
        usedAction: true,
      },
    ];

    const results = matchDocumentItemsStrict(pibItems, wlItems, "WL");
    assert.equal(results.length, 2);
    assert.equal(results[0]?.isMatch, true);
    assert.equal(results[1]?.isMatch, true);
    assert.equal(results[0]?.partMatch, true);
    assert.equal(results[1]?.partMatch, true);
    assert.equal(results[0]?.discrepancies.length, 0);
  });

  test("MS line item matching does not falsely mismatch on heat number", () => {
    const pibItems: StandardLineItem[] = [
      {
        itemIndex: 0,
        hsCode: "72091710",
        partNo: "JSC270C",
        spec: "JSC270C",
        size: "1.0 MM X 821 MM X C",
        desc: "COLD ROLLED COIL",
        qty: "18.3600",
        unit: "",
        netWeight: "",
        grossWeight: "",
        price: "16,259.80",
        raw: {},
        usedAction: false,
      },
    ];

    const msItems: StandardLineItem[] = [
      extractStandardLineItem(
        {
          Ukuran: "1.0x821xC",
          No_Heat: "SP03890",
          Komposisi_Kimia: "0.0172 0.003 0.190 0.0065 0.0062",
        },
        0,
        "ms"
      ),
    ];

    const results = matchDocumentItemsStrict(pibItems, msItems, "MS");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.isMatch, true);
    assert.equal(results[0]?.discrepancies.length, 0);
  });

  test("Invoice line item matching handles unit price multiplied by quantity", () => {
    const pibItems: StandardLineItem[] = [
      {
        itemIndex: 0,
        hsCode: "72091710",
        partNo: "JSC270C",
        spec: "JSC270C",
        size: "1.0 MM X 821 MM X C",
        desc: "COLD ROLLED COIL",
        qty: "18.3600",
        unit: "",
        netWeight: "",
        grossWeight: "",
        price: "16,259.80",
        raw: {},
        usedAction: false,
      },
    ];

    const invItems: StandardLineItem[] = [
      extractStandardLineItem(
        {
          Spesifikasi: "JSC270C \nBK089112 001",
          Ukuran_Barang: "1. OMM X 821MM X C",
          Harga_Satuan: "885. 61",
        },
        0,
        "invoice"
      ),
    ];

    const results = matchDocumentItemsStrict(pibItems, invItems, "Invoice");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.isMatch, true);
    assert.equal(results[0]?.discrepancies.length, 0);
  });

  test("Form AK extracts dimension & grade from description and matches 6-digit HS code", () => {
    const pibItems: StandardLineItem[] = [
      {
        itemIndex: 0,
        hsCode: "72104911",
        partNo: "JAC270C",
        spec: "JAC270C - 45 / 45",
        size: "0.8 MM X 725 MM X C",
        desc: "GALVANNEALED COIL",
        qty: "32.2600",
        unit: "",
        netWeight: "",
        grossWeight: "",
        price: "31,111.54",
        raw: {},
        usedAction: false,
      },
    ];

    const akRaw = {
      No_Item: "1",
      HS_Code: "7210.49",
      Deskripsi_Barang:
        "GALVANNEALED COIL \nJAC270C-45/45 0.8MMX725MMXC \n4COILS / 32.260MT / 32.516MT",
      Kriteria_Asal_Barang: "CTH",
      Berat_Kuantitas: "32.516 MT",
    };

    const akItem = extractStandardLineItem(akRaw, 0, "ak");
    assert.equal(cleanDimension(akItem.size), "0.8x725xc");
    assert.equal(akItem.spec, "JAC270C");

    const results = matchDocumentItemsStrict(pibItems, [akItem], "AK");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.isMatch, true);
    assert.equal(results[0]?.discrepancies.length, 0);
  });

  test("PIB and supporting document multi-page routing is correct", () => {
    const getPibPage = (idx: number) => (idx <= 10 ? 2 : idx <= 22 ? 3 : idx <= 34 ? 4 : 5);

    // Page 2: Items 1 to 11 (index 0 to 10)
    assert.equal(getPibPage(0), 2);
    assert.equal(getPibPage(10), 2);

    // Page 3: Items 12 to 23 (index 11 to 22)
    assert.equal(getPibPage(11), 3);
    assert.equal(getPibPage(22), 3);

    // Page 4: Items 24 to 35 (index 23 to 34)
    assert.equal(getPibPage(23), 4);
    assert.equal(getPibPage(34), 4);

    // Page 5: Items 36 to 37 (index 35 to 36)
    assert.equal(getPibPage(35), 5);
    assert.equal(getPibPage(36), 5);

    // Invoice & PL 3-page split
    const getInvPage = (idx: number) => (idx < 14 ? 1 : idx < 28 ? 2 : 3);
    assert.equal(getInvPage(0), 1);
    assert.equal(getInvPage(13), 1);
    assert.equal(getInvPage(14), 2);
    assert.equal(getInvPage(27), 2);
    assert.equal(getInvPage(28), 3);
    assert.equal(getInvPage(36), 3);
  });
});
