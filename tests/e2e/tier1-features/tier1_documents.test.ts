import test from "node:test";
import assert from "node:assert";
import "../helpers/testHelpers";
import { filterCategoryData } from "~/server/nanonets";
import { loadFixture } from "../helpers/testHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1: PIB Document Ingestion & Extraction (>= 5 tests)
// ─────────────────────────────────────────────────────────────────────────────

test("Feature 1.1 (PIB): Header identification and customs submission number extraction", () => {
  const pibRaw = loadFixture("usc_sample_pib.json");
  const extracted = filterCategoryData(pibRaw, "PIB");

  assert.ok(extracted.fields, "PIB extracted fields must exist");
  assert.strictEqual(extracted.fields["nomor pengajuan"], "040300-001892-20260320-008801");
  assert.strictEqual(extracted.fields["no invoice"], "USC-INV-2026-8801");
  assert.strictEqual(extracted.fields["tanggal invoice"], "15-03-2026");
  assert.strictEqual(extracted.fields["no bl"], "HDMU98234150");
  assert.strictEqual(extracted.fields["tanggal bl"], "20-03-2026");
});

test("Feature 1.2 (PIB): Commercial parties extraction (importer, shipper, seller)", () => {
  const pibRaw = loadFixture("usc_sample_pib.json");
  const extracted = filterCategoryData(pibRaw, "PIB");

  assert.strictEqual(extracted.fields["nama importir"], "PT. UNITED STEEL CENTER INDONESIA");
  assert.strictEqual(extracted.fields["nama pengirim"], "POSCO ASIA CO., LTD.");
  assert.strictEqual(extracted.fields["nama penjual"], "POSCO");
});

test("Feature 1.3 (PIB): Logistics, transport, and delivery terms extraction", () => {
  const pibRaw = loadFixture("usc_sample_pib.json");
  const extracted = filterCategoryData(pibRaw, "PIB");

  assert.strictEqual(extracted.fields["pelabuhan muat"], "BUSAN, KOREA");
  assert.strictEqual(extracted.fields["pelabuhan tujuan"], "TANJUNG PRIOK, JAKARTA");
  assert.strictEqual(extracted.fields["incoterms"], "CIF");
  assert.strictEqual(extracted.fields["nama sarana pengangkutan"], "MV HYUNDAI VOYAGER 042W");
});

test("Feature 1.4 (PIB): Physical cargo metrics extraction (weights, coils, container)", () => {
  const pibRaw = loadFixture("usc_sample_pib.json");
  const extracted = filterCategoryData(pibRaw, "PIB");

  assert.strictEqual(extracted.fields["berat bersih"], "48500");
  assert.strictEqual(extracted.fields["berat kotor"], "49120");
  assert.strictEqual(extracted.fields["jumlah coil"], "4");
  assert.strictEqual(extracted.fields["no peti"], "TEMU7192841");
  assert.strictEqual(extracted.fields["valuta"], "USD");
  assert.strictEqual(extracted.fields["nilai pabean"], "58450.00");
});

test("Feature 1.5 (PIB): Table line items extraction (HS codes, part specs, unit prices)", () => {
  const pibRaw = loadFixture("usc_sample_pib.json");
  const extracted = filterCategoryData(pibRaw, "PIB");

  assert.ok(Array.isArray(extracted.table), "PIB table rows must be an array");
  assert.strictEqual(extracted.table.length, 2, "PIB should extract 2 distinct item rows");

  const row1 = extracted.table[0]!;
  assert.strictEqual(row1["pos tarif"], "7208.38.00");
  assert.strictEqual(row1["kode barang"], "SPHC-2.3-1219");
  assert.strictEqual(row1["spesifikasi grade"], "SPHC");
  assert.strictEqual(row1["ukuran barang"], "2.3 X 1219 X C");
  assert.strictEqual(row1["jumlah barang"], "2");
  assert.strictEqual(row1["harga satuan"], "1200.00");

  const row2 = extracted.table[1]!;
  assert.strictEqual(row2["pos tarif"], "7208.38.00");
  assert.strictEqual(row2["kode barang"], "SPHC-3.2-1219");
  assert.strictEqual(row2["spesifikasi grade"], "SPHC");
  assert.strictEqual(row2["ukuran barang"], "3.2 X 1219 X C");
  assert.strictEqual(row2["jumlah barang"], "2");
  assert.strictEqual(row2["harga satuan"], "1210.00");
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2: Commercial Invoice (CI) Ingestion & Extraction (>= 5 tests)
// ─────────────────────────────────────────────────────────────────────────────

test("Feature 2.1 (CI): Invoice numbering and invoice date extraction", () => {
  const ciRaw = loadFixture("usc_sample_ci.json");
  const extracted = filterCategoryData(ciRaw, "Invoice");

  assert.strictEqual(extracted.fields["no invoice"], "USC-INV-2026-8801");
  assert.strictEqual(extracted.fields["tanggal invoice"], "15-03-2026");
});

test("Feature 2.2 (CI): Seller and buyer commercial entities extraction", () => {
  const ciRaw = loadFixture("usc_sample_ci.json");
  const extracted = filterCategoryData(ciRaw, "Invoice");

  assert.strictEqual(extracted.fields["identitas penjual"], "POSCO ASIA CO., LTD.");
  assert.strictEqual(extracted.fields["identitas pembeli"], "PT. UNITED STEEL CENTER INDONESIA");
});

test("Feature 2.3 (CI): Financial valuation, currency, and trade terms", () => {
  const ciRaw = loadFixture("usc_sample_ci.json");
  const extracted = filterCategoryData(ciRaw, "Invoice");

  assert.strictEqual(extracted.fields["nilai total invoice"], "58450.00");
  assert.strictEqual(extracted.fields["mata uang"], "USD");
  assert.strictEqual(extracted.fields["incoterms lokasi"], "CIF");
});

test("Feature 2.4 (CI): Weight totals and cargo coil count extraction", () => {
  const ciRaw = loadFixture("usc_sample_ci.json");
  const extracted = filterCategoryData(ciRaw, "Invoice");

  assert.strictEqual(extracted.fields["net weight"], "48500");
  assert.strictEqual(extracted.fields["gross weight"], "49120");
  assert.strictEqual(extracted.fields["jumlah coil"], "4");
  assert.strictEqual(extracted.fields["pelabuhan asal"], "BUSAN, KOREA");
  assert.strictEqual(extracted.fields["pelabuhan tujuan"], "TANJUNG PRIOK, JAKARTA");
});

test("Feature 2.5 (CI): Line items table extraction (specs, sizes, unit prices)", () => {
  const ciRaw = loadFixture("usc_sample_ci.json");
  const extracted = filterCategoryData(ciRaw, "Invoice");

  assert.ok(Array.isArray(extracted.table));
  assert.strictEqual(extracted.table.length, 2);
  assert.strictEqual(extracted.table[0]!["spesifikasi"], "JIS G3131 SPHC");
  assert.strictEqual(extracted.table[0]!["ukuran barang"], "2.3 X 1219 X C");
  assert.strictEqual(extracted.table[0]!["harga satuan"], "1200.00");
  assert.strictEqual(extracted.table[1]!["spesifikasi"], "JIS G3131 SPHC");
  assert.strictEqual(extracted.table[1]!["ukuran barang"], "3.2 X 1219 X C");
  assert.strictEqual(extracted.table[1]!["harga satuan"], "1210.00");
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3: Packing List (PL) Ingestion & Extraction (>= 5 tests)
// ─────────────────────────────────────────────────────────────────────────────

test("Feature 3.1 (PL): Invoice reference parity and document dating", () => {
  const plRaw = loadFixture("usc_sample_pl.json");
  const extracted = filterCategoryData(plRaw, "Packing List");

  assert.strictEqual(extracted.fields["no invoice"], "USC-INV-2026-8801");
  assert.strictEqual(extracted.fields["tanggal invoice"], "15-03-2026");
});

test("Feature 3.2 (PL): Supplier and buyer identification", () => {
  const plRaw = loadFixture("usc_sample_pl.json");
  const extracted = filterCategoryData(plRaw, "Packing List");

  assert.strictEqual(extracted.fields["identitas supplier"], "POSCO ASIA CO., LTD.");
  assert.strictEqual(extracted.fields["identitas buyer"], "PT. UNITED STEEL CENTER INDONESIA");
});

test("Feature 3.3 (PL): Origin and destination routing ports", () => {
  const plRaw = loadFixture("usc_sample_pl.json");
  const extracted = filterCategoryData(plRaw, "Packing List");

  assert.strictEqual(extracted.fields["pelabuhan asal"], "BUSAN, KOREA");
  assert.strictEqual(extracted.fields["pelabuhan tujuan"], "TANJUNG PRIOK, JAKARTA");
});

test("Feature 3.4 (PL): Net weight, gross weight, and coil total quantities", () => {
  const plRaw = loadFixture("usc_sample_pl.json");
  const extracted = filterCategoryData(plRaw, "Packing List");

  assert.strictEqual(extracted.fields["net weight"], "48500");
  assert.strictEqual(extracted.fields["gross weight"], "49120");
  assert.strictEqual(extracted.fields["total jumlah berat"], "49120");
  assert.strictEqual(extracted.fields["jumlah coil"], "4");
});

test("Feature 3.5 (PL): Table line item breakdown by specification and weight", () => {
  const plRaw = loadFixture("usc_sample_pl.json");
  const extracted = filterCategoryData(plRaw, "Packing List");

  assert.ok(Array.isArray(extracted.table));
  assert.strictEqual(extracted.table.length, 2);
  assert.strictEqual(extracted.table[0]!["spesifikasi"], "SPHC");
  assert.strictEqual(extracted.table[0]!["ukuran barang"], "2.3 X 1219 X C");
  assert.strictEqual(extracted.table[0]!["qty"], "2");
  assert.strictEqual(extracted.table[0]!["weight"], "24350");
  assert.strictEqual(extracted.table[1]!["spesifikasi"], "SPHC");
  assert.strictEqual(extracted.table[1]!["ukuran barang"], "3.2 X 1219 X C");
  assert.strictEqual(extracted.table[1]!["qty"], "2");
  assert.strictEqual(extracted.table[1]!["weight"], "24150");
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4: Bill of Lading (BL) Ingestion & Extraction (>= 5 tests)
// ─────────────────────────────────────────────────────────────────────────────

test("Feature 4.1 (BL): B/L number and transport document date", () => {
  const blRaw = loadFixture("usc_sample_bl.json");
  const extracted = filterCategoryData(blRaw, "Bill of Lading");

  assert.strictEqual(extracted.fields["no bl"], "HDMU98234150");
  assert.strictEqual(extracted.fields["date"], "20-03-2026");
});

test("Feature 4.2 (BL): Consignee party extraction", () => {
  const blRaw = loadFixture("usc_sample_bl.json");
  const extracted = filterCategoryData(blRaw, "Bill of Lading");

  assert.strictEqual(extracted.fields["consignee"], "PT. UNITED STEEL CENTER INDONESIA");
});

test("Feature 4.3 (BL): Vessel, voyage, and port itinerary", () => {
  const blRaw = loadFixture("usc_sample_bl.json");
  const extracted = filterCategoryData(blRaw, "Bill of Lading");

  assert.strictEqual(extracted.fields["vessel name"], "MV HYUNDAI VOYAGER");
  assert.strictEqual(extracted.fields["voyage number"], "042W");
  assert.strictEqual(extracted.fields["port of loading"], "BUSAN, KOREA");
  assert.strictEqual(extracted.fields["port of discharge"], "TANJUNG PRIOK, JAKARTA");
});

test("Feature 4.4 (BL): Gross weight and package totals with freight terms", () => {
  const blRaw = loadFixture("usc_sample_bl.json");
  const extracted = filterCategoryData(blRaw, "Bill of Lading");

  assert.strictEqual(extracted.fields["gross weight"], "49120");
  assert.strictEqual(extracted.fields["jumlah package"], "4");
  assert.strictEqual(extracted.fields["freight term"], "FREIGHT PREPAID");
});

test("Feature 4.5 (BL): Table cargo item with container mark and gross weight", () => {
  const blRaw = loadFixture("usc_sample_bl.json");
  const extracted = filterCategoryData(blRaw, "Bill of Lading");

  assert.ok(Array.isArray(extracted.table));
  assert.strictEqual(extracted.table.length, 1);
  assert.strictEqual(extracted.table[0]!["marks"], "TEMU7192841");
  assert.strictEqual(extracted.table[0]!["qty"], "4 COILS");
  assert.strictEqual(extracted.table[0]!["desc"], "HOT ROLLED STEEL COIL IN SPHC");
  assert.strictEqual(extracted.table[0]!["gross weight"], "49120");
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 5: Form AK (Certificate of Origin) Ingestion & Extraction (>= 5 tests)
// ─────────────────────────────────────────────────────────────────────────────

test("Feature 5.1 (AK): Form AK reference certificate number", () => {
  const akRaw = loadFixture("usc_sample_ak.json");
  const extracted = filterCategoryData(akRaw, "AK");

  assert.strictEqual(extracted.fields["no referensi"], "K001-26-004821");
});

test("Feature 5.2 (AK): Consignee and exporter commercial entities", () => {
  const akRaw = loadFixture("usc_sample_ak.json");
  const extracted = filterCategoryData(akRaw, "AK");

  assert.strictEqual(extracted.fields["nama exporter shipper"], "POSCO ASIA CO., LTD.");
  assert.strictEqual(extracted.fields["nama consignee"], "PT. UNITED STEEL CENTER INDONESIA");
});

test("Feature 5.3 (AK): Discharge port, vessel, and departure date", () => {
  const akRaw = loadFixture("usc_sample_ak.json");
  const extracted = filterCategoryData(akRaw, "AK");

  assert.strictEqual(extracted.fields["nama pelabuhan bongkar"], "TANJUNG PRIOK, JAKARTA");
  assert.strictEqual(extracted.fields["nama vessel"], "MV HYUNDAI VOYAGER 042W");
  assert.strictEqual(extracted.fields["tanggal keberangkatan"], "20-03-2026");
});

test("Feature 5.4 (AK): Invoice cross-referencing text", () => {
  const akRaw = loadFixture("usc_sample_ak.json");
  const extracted = filterCategoryData(akRaw, "AK");

  assert.ok(extracted.fields["no dan tanggal invoice"].includes("USC-INV-2026-8801"));
  assert.ok(extracted.fields["no dan tanggal invoice"].includes("15-03-2026"));
});

test("Feature 5.5 (AK): Table items with HS code and preferential origin criterion", () => {
  const akRaw = loadFixture("usc_sample_ak.json");
  const extracted = filterCategoryData(akRaw, "AK");

  assert.ok(Array.isArray(extracted.table));
  assert.strictEqual(extracted.table.length, 2);

  const item1 = extracted.table[0]!;
  assert.strictEqual(item1["no item"], "1");
  assert.strictEqual(item1["hs code"], "7208.38.00");
  assert.strictEqual(item1["kriteria asal barang"], "RVC 40%");
  assert.strictEqual(item1["berat kuantitas"], "24350 KG");

  const item2 = extracted.table[1]!;
  assert.strictEqual(item2["no item"], "2");
  assert.strictEqual(item2["hs code"], "7208.38.00");
  assert.strictEqual(item2["kriteria asal barang"], "RVC 40%");
  assert.strictEqual(item2["berat kuantitas"], "24150 KG");
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 6: Weight List (WL) Ingestion & Extraction (>= 5 tests)
// ─────────────────────────────────────────────────────────────────────────────

test("Feature 6.1 (WL): Weight list reference and supplier identity", () => {
  const wlRaw = loadFixture("usc_sample_wl.json");
  const extracted = filterCategoryData(wlRaw, "WL");

  assert.strictEqual(extracted.fields["no referensi"], "WL-POSCO-2026-8801");
  assert.strictEqual(extracted.fields["nama supplier"], "POSCO ASIA CO., LTD.");
});

test("Feature 6.2 (WL): Material description and coil aggregate count", () => {
  const wlRaw = loadFixture("usc_sample_wl.json");
  const extracted = filterCategoryData(wlRaw, "WL");

  assert.strictEqual(extracted.fields["deskripsi barang"], "HOT ROLLED STEEL COILS JIS G3131 SPHC");
  assert.strictEqual(extracted.fields["jumlah coil"], "4");
  assert.strictEqual(extracted.fields["satuan berat"], "KG");
});

test("Feature 6.3 (WL): Net weight and gross weight aggregate metrics", () => {
  const wlRaw = loadFixture("usc_sample_wl.json");
  const extracted = filterCategoryData(wlRaw, "WL");

  assert.strictEqual(extracted.fields["net weight"], "48500");
  assert.strictEqual(extracted.fields["gross weight"], "49120");
  assert.strictEqual(extracted.fields["total berat"], "48500");
});

test("Feature 6.4 (WL): Individual coil rows extraction", () => {
  const wlRaw = loadFixture("usc_sample_wl.json");
  const extracted = filterCategoryData(wlRaw, "WL");

  assert.ok(Array.isArray(extracted.table));
  assert.strictEqual(extracted.table.length, 4, "Should extract 4 coil records");

  assert.strictEqual(extracted.table[0]!["coil no"], "C-26-001");
  assert.strictEqual(extracted.table[0]!["net weight"], "12100");
  assert.strictEqual(extracted.table[0]!["gross weight"], "12255");

  assert.strictEqual(extracted.table[1]!["coil no"], "C-26-002");
  assert.strictEqual(extracted.table[1]!["net weight"], "12250");
  assert.strictEqual(extracted.table[1]!["gross weight"], "12405");
});

test("Feature 6.5 (WL): Sum of coil net weights equals aggregate net weight", () => {
  const wlRaw = loadFixture("usc_sample_wl.json");
  const extracted = filterCategoryData(wlRaw, "WL");

  const totalCalculatedNetWeight = extracted.table.reduce((sum, row) => {
    return sum + parseFloat(row["net weight"] || "0");
  }, 0);

  const declaredNetWeight = parseFloat(extracted.fields["net weight"] || "0");
  assert.strictEqual(totalCalculatedNetWeight, 48500);
  assert.strictEqual(totalCalculatedNetWeight, declaredNetWeight);
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 7: Mill Test Certificate (MTC/MS) Ingestion & Extraction (>= 5 tests)
// ─────────────────────────────────────────────────────────────────────────────

test("Feature 7.1 (MTC): Mill certificate number and producer steelworks identity", () => {
  const msRaw = loadFixture("usc_sample_ms.json");
  const extracted = filterCategoryData(msRaw, "MS");

  assert.strictEqual(extracted.fields["no sertifikat"], "MTC-PO-2026-9941");
  assert.strictEqual(extracted.fields["nama produsen"], "POSCO POHANG WORKS");
});

test("Feature 7.2 (MTC): Material specification grade and certificate date", () => {
  const msRaw = loadFixture("usc_sample_ms.json");
  const extracted = filterCategoryData(msRaw, "MS");

  assert.strictEqual(extracted.fields["spek material"], "JIS G3131 SPHC");
  assert.strictEqual(extracted.fields["tanggal sertifikat"], "14-03-2026");
  assert.strictEqual(extracted.fields["deskripsi barang"], "HOT ROLLED STEEL COIL IN SPHC");
});

test("Feature 7.3 (MTC): Certified material weight quantity", () => {
  const msRaw = loadFixture("usc_sample_ms.json");
  const extracted = filterCategoryData(msRaw, "MS");

  assert.strictEqual(extracted.fields["jumlah berat material"], "48500");
});

test("Feature 7.4 (MTC): Heat numbers and coil dimensions in mill sheet table", () => {
  const msRaw = loadFixture("usc_sample_ms.json");
  const extracted = filterCategoryData(msRaw, "MS");

  assert.ok(Array.isArray(extracted.table));
  assert.strictEqual(extracted.table.length, 2);

  assert.strictEqual(extracted.table[0]!["no heat"], "H82941");
  assert.strictEqual(extracted.table[0]!["ukuran"], "2.3 X 1219 X C");

  assert.strictEqual(extracted.table[1]!["no heat"], "H82942");
  assert.strictEqual(extracted.table[1]!["ukuran"], "3.2 X 1219 X C");
});

test("Feature 7.5 (MTC): Chemical analysis composition data retention", () => {
  const msRaw = loadFixture("usc_sample_ms.json");
  const extracted = filterCategoryData(msRaw, "MS");

  const chem1 = extracted.table[0]!["komposisi kimia"];
  assert.ok(chem1.includes("C: 0.05"));
  assert.ok(chem1.includes("Mn: 0.28"));
  assert.ok(chem1.includes("P: 0.015"));
});
