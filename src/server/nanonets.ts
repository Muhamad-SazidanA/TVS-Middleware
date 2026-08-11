import { env } from "~/env";

export const CATEGORY_MODEL_MAP: Record<string, string> = {
  PIB: env.MODEL_PIB || "f058f626-44d2-4b98-b529-bf1e521801aa",
  "PIB Lanjutan": env.MODEL_PIB_LANJUTAN || "422f529a-d099-470a-a194-8397f7c25056",
  Invoice: env.MODEL_INVOICE || "2774a4e1-671e-47d4-a7f4-30bde9406e3f",
  "Packing List": env.MODEL_PACKING_LIST || "83e76ec0-1396-4b05-a552-3bd4df81b951",
  BL: env.MODEL_BL || "3971b95f-eff3-4976-88da-9e48804d8f19",
  "Master BL": env.MODEL_MASTER_BL || "892d9b27-c846-480e-8737-4b27f74005fb",
  "Rekap Document": env.MODEL_RECAP_DOCUMENT || "e643773c-620d-488b-873d-3e9f043b1e75",
};

export function getModelIdForCategory(categoryTitle: string): string {
  const modelId = CATEGORY_MODEL_MAP[categoryTitle];
  if (!modelId) throw new Error(`No Nanonets model for category: ${categoryTitle}`);
  return modelId;
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
  "nomor pengajuan", "alamat importir", "alamat pemilik barang", "alamat pengirim",
  "alamat penjual", "berat bersih", "berat kotor", "house bl date", "invoice date",
  "invoice number", "jumlah", "master bl date", "merk", "nama importir",
  "nama pemilik barang", "nama pengirim", "nama penjual", "nama sarana pengangkutan",
  "nilai", "no house bl", "no master bl", "no peti", "no voy",
  "pelabuhan muat", "pelabuhan tujuan", "tipe peti",
]);
const PIB_TABLE = new Set(["pos tarif", "kode barang", "uraian", "jumlah barang", "jenis satuan barang"]);

const PIB_LANJUTAN_TABLE = new Set(["nama document", "no document", "tanggal document"]);

const REKAP_TABLE = new Set(["no part", "part no", "desc", "part desc", "qty", "hs code", "sat"]);

const INVOICE_FIELDS = new Set(["consignee", "exporter", "invoice date", "invoice number", "port of loading", "term of delivery", "terms of delivery", "total"]);

const PACKING_FIELDS = new Set(["invoice date", "invoice number", "total net weight"]);

const BL_FIELDS = new Set(["date", "npwp", "sea waybill number"]);
const BL_TABLE = new Set(["marks", "qty", "desc", "gross weight"]);

const MASTER_BL_FIELDS = new Set(["bl number", "container", "date of issue", "npwp", "shipped on board", "type"]);
const MASTER_BL_TABLE = new Set(["goods gross"]);

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
export function filterCategoryData(webhookBody: any, categoryTitle?: string): { fields: Record<string, string>; table: Record<string, string>[] } {
  const cat = norm(categoryTitle ?? "");

  let targetFields = new Set<string>();
  let targetTable = new Set<string>();

  if (cat.includes("master bl")) {
    targetFields = MASTER_BL_FIELDS; targetTable = MASTER_BL_TABLE;
  } else if (cat === "bl" || (cat.includes("bl") && !cat.includes("master"))) {
    targetFields = BL_FIELDS; targetTable = BL_TABLE;
  } else if (cat.includes("packing") || cat.includes("paking")) {
    targetFields = PACKING_FIELDS;
  } else if (cat.includes("lanjutan")) {
    targetTable = PIB_LANJUTAN_TABLE;
  } else if (cat.includes("rekap")) {
    targetTable = REKAP_TABLE;
  } else if (cat.includes("invoice")) {
    targetFields = INVOICE_FIELDS;
  } else {
    // Default / PIB
    targetFields = PIB_FIELDS; targetTable = PIB_TABLE;
  }

  const predictions = extractPredictions(webhookBody);

  const fields: Record<string, string> = {};
  const tableRows: Record<string, string>[] = [];

  for (const pred of predictions) {
    if (!pred) continue;
    const label = (pred.label ?? pred.name ?? "").toString();
    const labelNorm = norm(label);
    const type: string = pred.type ?? (Array.isArray(pred.cells) ? "table" : "field");

    if (type === "field" && targetFields.size > 0 && targetFields.has(labelNorm)) {
      fields[label] = (pred.ocr_text ?? pred.text ?? "").toString().trim();

    } else if (type === "table" && targetTable.size > 0 && Array.isArray(pred.cells)) {
      const rowMap: Record<number, Record<string, string>> = {};
      for (const cell of pred.cells) {
        const cellLabel = (cell.label ?? cell.name ?? "").toString();
        if (!targetTable.has(norm(cellLabel))) continue;
        const rowIdx: number = cell.row ?? 0;
        if (!rowMap[rowIdx]) rowMap[rowIdx] = {};
        rowMap[rowIdx]![cellLabel] = (cell.text ?? "").toString().trim();
      }
      for (const row of Object.values(rowMap)) {
        if (Object.values(row).some(Boolean)) tableRows.push(row);
      }
    }
  }

  return { fields, table: tableRows };
}

// Legacy alias
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filterPibData(rawJson: any) {
  return filterCategoryData(rawJson, "PIB");
}

function cleanVal(v: unknown): string {
  if (v === null || v === undefined) return "";
  return v
    .toString()
    .trim()
    .toLowerCase();
}

/**
 * Evaluates whether all document OCR results within a batch match or mismatch.
 * Cross-checks:
 *   1. Invoice Number (Invoice, Packing List, PIB, PIB Lanjutan)
 *   2. Master BL Number (Master BL, PIB No_Master_BL, PIB Lanjutan MASTER B/L)
 *   3. House BL / Sea Waybill Number (BL Sea_Waybill_Number, PIB No_House_BL, PIB Lanjutan B/L)
 *   4. Container Number (Master BL Container, PIB No_Peti, BL Marks)
 *
 * Returns "MATCHING" if all identifiers match across documents, otherwise "MISMATCHING".
 */
export function evaluateBatchMatching(
  details: Array<{ fileType: string; isi?: string | null }>
): "MATCHING" | "MISMATCHING" {
  const pibInvoiceNumbers = new Set<string>();
  const invoiceDocNumbers = new Set<string>();
  const packingInvoiceNumbers = new Set<string>();

  const masterBlNumbers = new Set<string>();
  const houseBlNumbers = new Set<string>();
  const containerNumbers = new Set<string>();

  for (const item of details) {
    if (!item.isi) continue;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any = typeof item.isi === "string" ? JSON.parse(item.isi) : item.isi;
      const fields: Record<string, string> = parsed?.fields || {};
      const table: Array<Record<string, string>> = Array.isArray(parsed?.table) ? parsed.table : [];
      const ft = (item.fileType || "").trim().toLowerCase();

      if (ft === "pib") {
        for (const [key, val] of Object.entries(fields)) {
          const k = norm(key);
          if (k.includes("invoice number")) {
            const cv = cleanVal(val);
            if (cv) pibInvoiceNumbers.add(cv);
          } else if (k.includes("no master bl") || k.includes("master bl")) {
            const cv = cleanVal(val);
            if (cv) masterBlNumbers.add(cv);
          } else if (k.includes("no house bl") || k.includes("house bl")) {
            const cv = cleanVal(val);
            if (cv) houseBlNumbers.add(cv);
          } else if (k.includes("no peti") || k.includes("container")) {
            const cv = cleanVal(val);
            if (cv && cv.length >= 4 && !cv.includes("fcl") && !cv.includes("ccl")) {
              containerNumbers.add(cv);
            }
          }
        }
      } else if (ft.includes("lanjutan")) {
        for (const row of table) {
          const docName = norm(row["Nama_Document"] || row["nama document"] || row["Nama Document"] || "");
          const docNo = cleanVal(row["No_Document"] || row["no document"] || row["No Document"] || "");
          if (docName.includes("invoice") && docNo) {
            pibInvoiceNumbers.add(docNo);
          } else if ((docName.includes("master b") || docName.includes("master bl")) && docNo) {
            masterBlNumbers.add(docNo);
          } else if ((docName === "b / l" || docName === "bl" || docName.includes("house")) && docNo) {
            houseBlNumbers.add(docNo);
          }
        }
      } else if (ft.includes("invoice")) {
        for (const [key, val] of Object.entries(fields)) {
          const k = norm(key);
          if (k.includes("invoice number")) {
            const cv = cleanVal(val);
            if (cv) invoiceDocNumbers.add(cv);
          }
        }
      } else if (ft.includes("packing") || ft.includes("paking")) {
        for (const [key, val] of Object.entries(fields)) {
          const k = norm(key);
          if (k.includes("invoice number")) {
            const cv = cleanVal(val);
            if (cv) packingInvoiceNumbers.add(cv);
          }
        }
      } else if (ft.includes("master bl") || ft.includes("master")) {
        for (const [key, val] of Object.entries(fields)) {
          const k = norm(key);
          if (k.includes("bl number")) {
            const cv = cleanVal(val);
            if (cv) masterBlNumbers.add(cv);
          } else if (k.includes("container")) {
            const cv = cleanVal(val);
            if (cv && cv.length >= 4) containerNumbers.add(cv);
          }
        }
      } else if (ft === "bl" || (ft.includes("bl") && !ft.includes("master"))) {
        for (const [key, val] of Object.entries(fields)) {
          const k = norm(key);
          if (k.includes("sea waybill")) {
            const cv = cleanVal(val);
            if (cv) houseBlNumbers.add(cv);
          }
        }
        for (const row of table) {
          const marks = cleanVal(row["Marks"] || row["marks"] || "");
          if (marks && marks.length >= 4) {
            containerNumbers.add(marks);
          }
        }
      }
    } catch (e) {
      console.warn("[evaluateBatchMatching] JSON parse error:", e);
    }
  }

  console.log("[Batch Matching Evaluation]", {
    pibInvoiceNumbers: Array.from(pibInvoiceNumbers),
    invoiceDocNumbers: Array.from(invoiceDocNumbers),
    packingInvoiceNumbers: Array.from(packingInvoiceNumbers),
    masterBlNumbers: Array.from(masterBlNumbers),
    houseBlNumbers: Array.from(houseBlNumbers),
    containerNumbers: Array.from(containerNumbers),
  });

  // Check Invoice documents against PIB / PIB Lanjutan
  if (invoiceDocNumbers.size > 0 && pibInvoiceNumbers.size > 0) {
    for (const invNo of invoiceDocNumbers) {
      if (!pibInvoiceNumbers.has(invNo)) return "MISMATCHING";
    }
  }

  // Check Packing List documents against PIB / Invoice list
  if (packingInvoiceNumbers.size > 0) {
    const validInvoices = new Set([...pibInvoiceNumbers, ...invoiceDocNumbers]);
    if (validInvoices.size > 0) {
      for (const pkgNo of packingInvoiceNumbers) {
        if (!validInvoices.has(pkgNo)) return "MISMATCHING";
      }
    }
  }

  // Check Master BL: single unique value
  if (masterBlNumbers.size > 1) return "MISMATCHING";

  // Check House BL: single unique value
  if (houseBlNumbers.size > 1) return "MISMATCHING";

  // Check Container: single unique value
  if (containerNumbers.size > 1) return "MISMATCHING";

  return "MATCHING";
}
