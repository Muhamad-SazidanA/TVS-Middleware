import { env } from "~/env";
import { evaluateCanonicalBatchMatching } from "~/utils/canonicalMatcher";
import type { DbEquivalencyGroup } from "~/utils/valueEquivalency";

export const CATEGORY_MODEL_MAP: Record<string, string> = {
  // USC 7 Official Document Categories
  PIB: env.MODEL_PIB || "233e650f-2b0e-4c56-8d98-35f40e032a60",
  "PIB (File Acuan)": env.MODEL_PIB || "233e650f-2b0e-4c56-8d98-35f40e032a60",
  Invoice: env.MODEL_INVOICE || "dab11666-7657-46e7-8efb-3fed630ee96e",
  "Commercial Invoice": env.MODEL_INVOICE || "dab11666-7657-46e7-8efb-3fed630ee96e",
  CI: env.MODEL_INVOICE || "dab11666-7657-46e7-8efb-3fed630ee96e",
  "Packing List": env.MODEL_PACKING_LIST || "133a8cb8-762f-4002-9878-bbb333706775",
  PL: env.MODEL_PACKING_LIST || "133a8cb8-762f-4002-9878-bbb333706775",
  "Bill of Lading": env.MODEL_BL || "53b28ee1-0693-4d6a-8e16-844e405874c9",
  "Bill of Ladding": env.MODEL_BL || "53b28ee1-0693-4d6a-8e16-844e405874c9",
  BL: env.MODEL_BL || "53b28ee1-0693-4d6a-8e16-844e405874c9",
  AK: env.MODEL_AK || "12a16d1c-9b37-4a19-809f-84e594f541ea",
  "Form AK": env.MODEL_AK || "12a16d1c-9b37-4a19-809f-84e594f541ea",
  WL: env.MODEL_WL || "a43ce59b-e997-4fd5-8c7e-cd8eacc033ac",
  "Weight List": env.MODEL_WL || "a43ce59b-e997-4fd5-8c7e-cd8eacc033ac",
  MS: env.MODEL_MS || "09bd8ce7-8037-4ade-a5ed-7f49a9bfd6c8",
  MTC: env.MODEL_MS || "09bd8ce7-8037-4ade-a5ed-7f49a9bfd6c8",
  "Mill Test Certificate": env.MODEL_MS || "09bd8ce7-8037-4ade-a5ed-7f49a9bfd6c8",
  "Mill Sheet": env.MODEL_MS || "09bd8ce7-8037-4ade-a5ed-7f49a9bfd6c8",
};

export function getModelIdForCategory(categoryTitle: string): string {
  const trimmed = (categoryTitle || "").trim();
  const directMatch = CATEGORY_MODEL_MAP[trimmed];
  if (directMatch) return directMatch;

  const caseInsensitiveKey = Object.keys(CATEGORY_MODEL_MAP).find(
    (k) => k.toLowerCase() === trimmed.toLowerCase()
  );
  if (caseInsensitiveKey && CATEGORY_MODEL_MAP[caseInsensitiveKey]) {
    return CATEGORY_MODEL_MAP[caseInsensitiveKey]!;
  }

  // Fallback if not directly matched
  const lower = trimmed.toLowerCase();
  if (lower.includes("pib")) return CATEGORY_MODEL_MAP["PIB"]!;
  if (lower.includes("invoice") || lower === "ci") return CATEGORY_MODEL_MAP["Commercial Invoice"]!;
  if (lower.includes("packing") || lower === "pl") return CATEGORY_MODEL_MAP["Packing List"]!;
  if (lower.includes("lading") || lower.includes("ladding") || lower === "bl") return CATEGORY_MODEL_MAP["Bill of Lading"]!;
  if (lower.includes("weight") || lower === "wl") return CATEGORY_MODEL_MAP["Weight List"]!;
  if (lower.includes("mill") || lower.includes("sheet") || lower === "ms" || lower === "mtc" || lower.includes("mtc")) return CATEGORY_MODEL_MAP["Mill Test Certificate"]!;
  if (lower.includes("ak") || lower.includes("coo") || lower.includes("origin")) return CATEGORY_MODEL_MAP["Form AK"]!;

  return CATEGORY_MODEL_MAP["PIB"]!;
}

/**
 * Extracts request_file_id from Nanonets webhook or response body.
 * Handles BOTH formats:
 *   - Webhook POST: { result: { request_file_id, prediction } }  ← object
 *   - GET API:      { result: [{ request_file_id, prediction }] } ← array
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractNanonetsId(payload: any): string | null {
  if (!payload) return null;

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  // Top-level fields
  if (str(payload.request_file_id)) return str(payload.request_file_id);
  if (str(payload.request_id)) return str(payload.request_id);
  if (str(payload.id)) return str(payload.id);

  // result as OBJECT (actual webhook POST format)
  if (payload.result && !Array.isArray(payload.result) && typeof payload.result === "object") {
    const r = payload.result;
    if (str(r.request_file_id)) return str(r.request_file_id);
    if (str(r.request_id)) return str(r.request_id);
    if (str(r.id)) return str(r.id);
  }

  // result as ARRAY (GET API response format)
  if (Array.isArray(payload.result) && payload.result.length > 0) {
    const r = payload.result[0];
    if (str(r?.request_file_id)) return str(r.request_file_id);
    if (str(r?.request_id)) return str(r.request_id);
    if (str(r?.id)) return str(r.id);
  }

  // Root array
  if (Array.isArray(payload) && payload.length > 0) {
    const r = payload[0];
    if (str(r?.request_file_id)) return str(r.request_file_id);
    if (str(r?.request_id)) return str(r.request_id);
    if (str(r?.id)) return str(r.id);
  }

  return null;
}

// ─── Target labels per category (normalized: lowercase, space, no dots) ───────

const PIB_FIELDS = new Set([
  "nomor pengajuan", "no pengajuan", "no aju", "nomor aju",
  "alamat importir", "alamat pemilik barang", "alamat pengirim", "alamat penjual",
  "berat bersih", "berat kotor", "house bl date", "invoice date", "invoice number",
  "jumlah", "master bl date", "merk", "nama importir", "nama pemilik barang",
  "nama pengirim", "nama penjual", "nama sarana pengangkutan", "nilai",
  "no house bl", "house bl", "no master bl", "master bl", "no peti", "peti", "no voy", "voy",
  "pelabuhan muat", "pelabuhan tujuan", "pelabuhan asal",
  "ket fob", "cara penyerahan", "incoterm", "incoterms", "terms of delivery", "fob",
  // Model Nanonets PIB Actual Labels
  "no invoice", "tanggal invoice", "no bl", "tanggal bl",
  "nilai pabean", "valuta", "ndpbm", "jumlah coil", "moda",
  "pemilik barang", "identitas pengirim", "identitas penjual",
  "surat keputusan", "surat keputusan2", "pengecualian perijinan", "pengecualian perijinan2",
  "electronic certificate of origin eco", "surat persetujuan impor dep dag",
]);
const PIB_TABLE = new Set([
  "pos tarif", "kode barang", "uraian", "uraian barang", "ukuran barang",
  "spesifikasi grade", "negara asal country of origin", "tarif", "pph", "ppn",
  "jumlah barang", "jumlah satuan barang", "jumlah satuan coil", "jenis satuan barang",
  "harga satuan",
]);

const AK_FIELDS = new Set([
  "nama consignee", "nama exporter shipper", "nama pelabuhan bongkar", "nama vessel",
  "no referensi", "tanggal keberangkatan", "tempat dan waktu pembuatan akform",
  "third country invoicing", "urutan item lanjutan", "issued retroactively",
  "nama manufacturer", "no dan tanggal invoice",
  // Aliases
  "consignee", "exporter", "vessel", "invoice"
]);
const AK_TABLE = new Set([
  "no item", "hs code", "deskripsi barang", "kriteria asal barang", "berat kuantitas",
  "no part", "part no", "kode barang", "desc", "part desc", "uraian", "uraian barang", "qty", "sat"
]);

const WL_FIELDS = new Set([
  "jumlah coil", "satuan berat", "nama supplier", "deskripsi barang", "net weight",
  "spesifikasi", "gross weight", "no referensi", "identitas dokumen", "total berat",
  // Aliases
  "berat bersih", "berat kotor", "qty"
]);
const WL_TABLE = new Set(["no coil", "coil no", "weight", "net weight", "gross weight"]);

const MS_FIELDS = new Set([
  "spek material", "tanda tangan", "tanggal sertifikat", "deskripsi barang",
  "jumlah berat material", "identitas dokumen", "no sertifikat", "nama produsen",
  // Aliases
  "spesifikasi", "grade", "berat", "net weight", "gross weight"
]);
const MS_TABLE = new Set(["ukuran", "no heat", "komposisi kimia", "size", "heat no"]);

const BL_FIELDS = new Set([
  "identitas pengirim", "shipper", "pengirim", "identitas dokumen",
  "pemilik barang", "consignee",
  "moda", "vessel name", "vessel", "nama kapal", "shipped per",
  "pelabuhan asal", "port of loading", "from",
  "pelabuhan tujuan", "port of discharge", "to", "destination",
  "no bl", "nomor bl", "bl number", "sea waybill number", "waybill number", "b/l no", "no b/l",
  "tanggal bl", "tanggal b/l", "date of issue", "bl date", "shipped on board date", "date", "tanggal", "house bl date"
]);
const BL_TABLE = new Set<string>();

const PACKING_FIELDS = new Set([
  "section code", "no sc order no", "negara asal", "identitas supplier", "pelabuhan asal",
  "tanda tangan", "identitas buyer", "tanggal invoice", "negara tujuan", "pelabuhan tujuan",
  "deskripsi barang", "marks number", "no invoice", "moda", "total jumlah berat",
  "net weight", "gross weight", "jumlah coil",
  // Aliases
  "invoice date", "invoice number", "nomor invoice", "total net weight", "berat bersih",
  "total gross weight", "berat kotor", "total quantity", "qty", "jumlah"
]);
const PACKING_TABLE = new Set(["spesifikasi", "ukuran barang", "size", "spec", "qty", "weight"]);

const INVOICE_FIELDS = new Set([
  "negara asal", "marks number", "no sc order no", "moda", "no invoice",
  "identitas penjual", "pelabuhan tujuan", "identitas pembeli", "deskripsi barang",
  "tanda tangan", "tanggal invoice", "negara tujuan", "syarat pembayaran",
  "section code", "pelabuhan asal", "nilai total invoice", "gross weight",
  "incoterms lokasi", "jumlah coil", "mata uang", "net weight",
  // Aliases
  "consignee", "pemilik barang", "nama importir",
  "exporter", "nama penjual", "seller",
  "invoice date", "invoice number", "nomor invoice",
  "port of loading", "pelabuhan muat", "destination",
  "term of delivery", "terms of delivery", "incoterms", "incoterm", "cara penyerahan", "ket fob",
  "total", "nilai total", "nilai pabean", "amount", "total amount", "valuta"
]);
const INVOICE_TABLE = new Set(["spesifikasi", "ukuran barang", "harga satuan", "size", "spec", "price", "unit price"]);

function norm(s: string) {
  return s.toLowerCase().replace(/_/g, " ").replace(/\./g, "").trim();
}

/**
 * Extracts prediction array from Nanonets webhook body.
 * Handles BOTH formats:
 *   - Webhook POST: { result: { prediction: [...] } }  ← result is OBJECT
 *   - GET API:      { result: [{ prediction: [...] }] } ← result is ARRAY
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPredictions(webhookBody: any): any[] {
  // Format 1: result is OBJECT (actual webhook POST callback from Nanonets)
  if (webhookBody?.result && !Array.isArray(webhookBody.result) && Array.isArray(webhookBody.result.prediction)) {
    return webhookBody.result.prediction;
  }
  // Format 2: result is ARRAY (GET API response)
  if (Array.isArray(webhookBody?.result) && Array.isArray(webhookBody.result[0]?.prediction)) {
    return webhookBody.result[0].prediction;
  }
  // Format 3: prediction directly at root
  if (Array.isArray(webhookBody?.prediction)) {
    return webhookBody.prediction;
  }
  // Format 4: body is the array itself
  if (Array.isArray(webhookBody)) {
    return webhookBody;
  }
  return [];
}

/**
 * Filters OCR predictions and returns minimal { fields, table } structure.
 * No coordinates, no IDs, no metadata — just label → value mappings.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filterCategoryData(webhookBody: any, categoryTitle?: string): {
  fields: Record<string, string>;
  table: Record<string, string>[];
  coordinates?: Record<string, { xmin: number; ymin: number; xmax: number; ymax: number; page?: number }>;
  tableCoordinates?: Array<Record<string, { xmin: number; ymin: number; xmax: number; ymax: number; page?: number }>>;
} {
  const cat = norm(categoryTitle ?? "");

  let targetFields = new Set<string>();
  let targetTable = new Set<string>();

  if (cat === "ms" || cat === "mtc" || cat.startsWith("ms ") || cat.startsWith("mtc ") || cat.endsWith(" ms") || cat.endsWith(" mtc") || cat.includes("mill") || cat.includes("sheet")) {
    targetFields = MS_FIELDS; targetTable = MS_TABLE;
  } else if (cat === "wl" || cat.startsWith("wl ") || cat.endsWith(" wl") || cat.includes("weight")) {
    targetFields = WL_FIELDS; targetTable = WL_TABLE;
  } else if (cat === "ak" || cat.startsWith("ak ") || cat.endsWith(" ak") || cat.includes("coo") || cat.includes("origin")) {
    targetFields = AK_FIELDS; targetTable = AK_TABLE;
  } else if (cat.includes("ladding") || cat.includes("lading") || cat === "bl" || cat.includes("bl")) {
    targetFields = BL_FIELDS; targetTable = BL_TABLE;
  } else if (cat.includes("packing") || cat.includes("paking") || cat === "pl") {
    targetFields = PACKING_FIELDS; targetTable = PACKING_TABLE;
  } else if (cat.includes("invoice") || cat === "ci") {
    targetFields = INVOICE_FIELDS; targetTable = INVOICE_TABLE;
  } else {
    // Default / PIB / PIB (File Acuan)
    targetFields = PIB_FIELDS; targetTable = PIB_TABLE;
  }

  const docCodeUpper = (categoryTitle ?? "").toUpperCase().trim();
  const isLandscapeDoc =
    docCodeUpper === "WL" ||
    docCodeUpper === "MS" ||
    docCodeUpper.startsWith("WL") ||
    docCodeUpper.startsWith("MS") ||
    cat === "wl" ||
    cat === "ms" ||
    cat === "mtc" ||
    cat.startsWith("wl ") ||
    cat.endsWith(" wl") ||
    cat.includes("weight") ||
    cat.startsWith("ms ") ||
    cat.endsWith(" ms") ||
    cat.includes("mill") ||
    cat.includes("sheet");

  const isLandscape = Boolean(
    webhookBody?.isLandscape ||
    webhookBody?.docCode === "WL" ||
    webhookBody?.docCode === "MS" ||
    isLandscapeDoc
  );

  const pageH = isLandscape ? 2480 : 3508;
  const pageW = isLandscape ? 3508 : 2480;

  function normalizeCoord(
    raw: { xmin: number; ymin: number; xmax: number; ymax: number; page?: number }
  ): { xmin: number; ymin: number; xmax: number; ymax: number; page: number } {
    const xmin = raw.xmin;
    let ymin = raw.ymin;
    const xmax = raw.xmax;
    let ymax = raw.ymax;
    let page = Number(raw.page ?? 0);

    // If xmin=0 AND ymin=0 AND xmax=0 AND ymax=0: skip normalization, store as-is
    if (xmin === 0 && ymin === 0 && xmax === 0 && ymax === 0) {
      return { xmin: 0, ymin: 0, xmax: 0, ymax: 0, page };
    }

    // B1: Detect & fix cumulative Y-coordinate bug
    if (ymax > pageH * (page + 1) || ymin > pageH) {
      const actualPage = Math.floor(ymin / pageH);
      ymin = ymin - actualPage * pageH;
      ymax = ymax - actualPage * pageH;
      page = actualPage;
    }

    // B2: Normalize coords to 0-1 ratios (page stays integer 0-indexed)
    // Use 4 decimal places for sub-pixel precision while safely fitting in MySQL TEXT column
    return {
      xmin: Number((xmin / pageW).toFixed(4)),
      ymin: Number((ymin / pageH).toFixed(4)),
      xmax: Number((xmax / pageW).toFixed(4)),
      ymax: Number((ymax / pageH).toFixed(4)),
      page,
    };
  }

  const predictions = extractPredictions(webhookBody);

  const fields: Record<string, string> = {};
  const coordinates: Record<string, { xmin: number; ymin: number; xmax: number; ymax: number; page?: number }> = {};
  const tableRows: Record<string, string>[] = [];
  const tableCoordinates: Array<Record<string, { xmin: number; ymin: number; xmax: number; ymax: number; page?: number }>> = [];

  for (const pred of predictions) {
    if (!pred) continue;
    const label = (pred.label ?? pred.name ?? "").toString();
    const labelNorm = norm(label);
    const type: string = pred.type ?? (Array.isArray(pred.cells) ? "table" : "field");

    if (type === "field") {
      fields[label] = (pred.ocr_text ?? pred.text ?? "").toString().trim();
      if (pred.xmin !== undefined && pred.ymin !== undefined && pred.xmax !== undefined && pred.ymax !== undefined) {
        coordinates[label] = normalizeCoord({
          xmin: Number(pred.xmin),
          ymin: Number(pred.ymin),
          xmax: Number(pred.xmax),
          ymax: Number(pred.ymax),
          page: Number(pred.page ?? 0),
        });
      }
    } else if (type === "table" && targetTable.size > 0 && Array.isArray(pred.cells)) {
      const rowMap: Record<number, Record<string, string>> = {};
      const rowCoordsMap: Record<number, Record<string, { xmin: number; ymin: number; xmax: number; ymax: number; page?: number }>> = {};
      for (const cell of pred.cells) {
        if (!cell) continue; // Null safety: skip null cells in malformed OCR blocks
        const cellLabel = (cell.label ?? cell.name ?? "").toString();
        if (!targetTable.has(norm(cellLabel))) continue;
        const rowIdx: number = cell.row ?? 0;
        if (!rowMap[rowIdx]) rowMap[rowIdx] = {};
        if (!rowCoordsMap[rowIdx]) rowCoordsMap[rowIdx] = {};
        rowMap[rowIdx]![cellLabel] = (cell.text ?? "").toString().trim();
        if (cell.xmin !== undefined && cell.ymin !== undefined && cell.xmax !== undefined && cell.ymax !== undefined) {
          rowCoordsMap[rowIdx]![cellLabel] = normalizeCoord({
            xmin: Number(cell.xmin),
            ymin: Number(cell.ymin),
            xmax: Number(cell.xmax),
            ymax: Number(cell.ymax),
            page: Number(cell.page ?? 0),
          });
        }
      }
      for (const [rIdx, row] of Object.entries(rowMap)) {
        if (Object.values(row).some(Boolean)) {
          tableRows.push(row);
          tableCoordinates.push(rowCoordsMap[Number(rIdx)] || {});
        }
      }
    }
  }

  return { fields, table: tableRows, coordinates, tableCoordinates };
}

// Legacy alias
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filterPibData(rawJson: any) {
  return filterCategoryData(rawJson, "PIB");
}

/**
 * Evaluates whether all document OCR results within a batch match or mismatch.
 * Cross-checks key identifiers against PIB reference:
 *   1. Invoice Number (Invoice No_Invoice, PIB No_Invoice)
 *   2. Packing List Invoice Number (Packing List No_Invoice, PIB/Invoice No_Invoice)
 *   3. Bill of Lading Number (BL No_BL, PIB No_BL)
 *   4. Container Number (BL Marks, PIB No_Peti)
 *
 * Returns "MATCHING" if all identifiers match across documents, otherwise "MISMATCHING".
 */
export function evaluateBatchMatching(
  details: Array<{ fileType: string; isi?: string | null }>,
  dbGroups?: DbEquivalencyGroup[]
): "MATCHING" | "MISMATCHING" {
  const result = evaluateCanonicalBatchMatching(details, undefined, "0", dbGroups);
  return result.status === "MATCHING" ? "MATCHING" : "MISMATCHING";
}
