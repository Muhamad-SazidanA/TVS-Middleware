import { isEquivalentMatch, type DbEquivalencyGroup } from "~/utils/valueEquivalency";
import type {
  NormalizedBbox,
  DocumentFieldData,
  BatchDocumentModel,
  BatchComparisonModel,
  ComparisonFieldModel,
  DocumentComparisonGroup,
  ManualNote,
} from "./detailTypes";
import type { FieldMatchStatus } from "~/types/documentComparison";
import defaultDataActions from "~/config/data_actions.json";
import { applyDataActionsToFields, applyDataActionsToTableRows } from "~/utils/workflowRunner";

// Bounded proportional padding expansion algorithm for OCR boxes
export function expandBboxPadding(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  // Balanced padding: gives breathing room around letters without bleeding into adjacent columns
  const pad_x = Math.max(0.15, Math.min(0.50, width * 0.05));
  const pad_y = Math.max(0.12, Math.min(0.40, height * 0.10));
  const x_new = Math.max(0, Math.min(100, x - pad_x));
  const y_new = Math.max(0, Math.min(100, y - pad_y));
  const w_new = Math.max(0, Math.min(100 - x_new, width + 2 * pad_x));
  const h_new = Math.max(0, Math.min(100 - y_new, height + 2 * pad_y));

  return {
    x: Number(x_new.toFixed(2)),
    y: Number(y_new.toFixed(2)),
    width: Number(w_new.toFixed(2)),
    height: Number(h_new.toFixed(2)),
  };
}

// Helper to resolve physical page for header fields
export function resolveHeaderPage(coord?: { page?: number }, pageDefault: number = 1, _docCode?: string | boolean): number {
  if (coord?.page !== undefined && !isNaN(Number(coord.page))) {
    return Number(coord.page) + 1;
  }
  return pageDefault;
}

// Coordinate normalizer for Nanonets OCR boxes
export function normalizeBbox(
  rawCoord?: { xmin?: number; ymin?: number; xmax?: number; ymax?: number; page?: number },
  pageFallback?: number,
  docCode?: string | boolean
): NormalizedBbox | undefined {
  if (!rawCoord || rawCoord.xmin === undefined || rawCoord.ymin === undefined) return undefined;

  const xmin = rawCoord.xmin;
  const ymin = rawCoord.ymin;
  const xmax = rawCoord.xmax ?? xmin;
  const ymax = rawCoord.ymax ?? ymin;

  // Ignore empty/unpositioned boxes (0, 0, 0, 0)
  if (xmin === 0 && ymin === 0 && xmax === 0 && ymax === 0) {
    return undefined;
  }

  // Dual format detection:
  // - If xmax <= 1 AND ymax <= 1: already normalized to 0-1 ratio
  // - If xmax > 1: old pixel format
  const isPixel = xmax > 1 || ymax > 1;

  // Ignore glitch phantom dots (0, 0, 0, 0) in pixel coords (<= 25px)
  if (isPixel && xmin <= 1 && ymin <= 1 && xmax <= 25 && ymax <= 25) {
    return undefined;
  }

  const dCode = typeof docCode === "string" ? docCode.toUpperCase() : "";
  const pageNum = resolveHeaderPage(rawCoord, pageFallback ?? 1, typeof docCode === "string" ? docCode : undefined);

  // WL and MS are landscape (842x595 pt, 3508x2480 px). All others are portrait (2480x3508 px).
  const isLandscape = dCode === "WL" || dCode === "MS" || (isPixel && xmax > 2480);
  const baseW = isPixel ? (isLandscape ? 3508 : 2480) : 1;
  const baseH = isPixel ? (isLandscape ? 2480 : 3508) : 1;

  const rawX = Math.max(0, Math.min(100, (xmin / baseW) * 100));
  const rawY = Math.max(0, Math.min(100, (ymin / baseH) * 100));
  const rawWidth = Math.max(0.5, Math.min(100, ((xmax - xmin) / baseW) * 100));
  const rawHeight = Math.max(0.3, Math.min(100, ((ymax - ymin) / baseH) * 100));

  const padded = expandBboxPadding(rawX, rawY, rawWidth, rawHeight);

  return {
    page: pageNum,
    x: padded.x,
    y: padded.y,
    width: padded.width,
    height: padded.height,
  };
}

interface ParsedIsi {
  fields: Record<string, string>;
  table: Array<Record<string, unknown>>;
  coordinates: Record<string, { xmin?: number; ymin?: number; xmax?: number; ymax?: number; page?: number }>;
  tableCoordinates: Array<Record<string, { xmin?: number; ymin?: number; xmax?: number; ymax?: number; page?: number }>>;
  manualEdits: Record<string, { oldValue?: string; newValue?: string; editedAt?: string }>;
  manualNotes?: ManualNote[];
}

export function parseDocumentIsi(isi?: unknown, docCode?: string): ParsedIsi {
  if (!isi) {
    return { fields: {}, table: [], coordinates: {}, tableCoordinates: [], manualEdits: {}, manualNotes: [] };
  }
  try {
    const p = typeof isi === "string" ? JSON.parse(isi) : isi;
    let fields = { ...(p.fields || {}) };
    let table = Array.isArray(p.table) ? p.table.map((r: Record<string, unknown>) => ({ ...r })) : [];

    // Dynamically apply active Data Actions from config if not yet applied
    try {
      if (Array.isArray(defaultDataActions) && defaultDataActions.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fields = applyDataActionsToFields(fields, docCode || "all", defaultDataActions as any);
        if (table.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          table = applyDataActionsToTableRows(table, docCode || "all", defaultDataActions as any);
        }
      }
    } catch {
      // ignore
    }

    return {
      fields,
      table,
      coordinates: p.coordinates || {},
      tableCoordinates: Array.isArray(p.tableCoordinates) ? p.tableCoordinates : [],
      manualEdits: p.manualEdits || {},
      manualNotes: Array.isArray(p.manualNotes) ? p.manualNotes : [],
    };
  } catch {
    return { fields: {}, table: [], coordinates: {}, tableCoordinates: [], manualEdits: {}, manualNotes: [] };
  }
}

// Standard fallback coordinates for PIB BC 2.0 (portrait 2480x3508 px)
export const PIB_STANDARD_COORDINATES: Record<string, { xmin: number; ymin: number; xmax: number; ymax: number; page: number }> = {
  // Lembar 1 Box 30: Berat Kotor (Gross Weight)
  berat_kotor: { xmin: 1779, ymin: 1707, xmax: 2008, ymax: 1734, page: 0 },
  total_gross_weight: { xmin: 1779, ymin: 1707, xmax: 2008, ymax: 1734, page: 0 },
  gross_weight: { xmin: 1779, ymin: 1707, xmax: 2008, ymax: 1734, page: 0 },
  berat_kuantitas: { xmin: 1779, ymin: 1707, xmax: 2008, ymax: 1734, page: 0 },

  // Lembar 1 Box 31: Berat Bersih (Net Weight)
  berat_bersih: { xmin: 2158, ymin: 1707, xmax: 2389, ymax: 1734, page: 0 },
  total_net_weight: { xmin: 2158, ymin: 1707, xmax: 2389, ymax: 1734, page: 0 },
  net_weight: { xmin: 2158, ymin: 1707, xmax: 2389, ymax: 1734, page: 0 },
  total_berat: { xmin: 2158, ymin: 1707, xmax: 2389, ymax: 1734, page: 0 },
  jumlah_berat_material: { xmin: 2158, ymin: 1707, xmax: 2389, ymax: 1734, page: 0 },
  berat_bersih_item: { xmin: 2158, ymin: 1707, xmax: 2389, ymax: 1734, page: 0 },

  // Lembar 2 Pos 18: Uraian Barang / Deskripsi Barang
  uraian_barang: { xmin: 252, ymin: 532, xmax: 494, ymax: 563, page: 1 },
  deskripsi_barang: { xmin: 252, ymin: 532, xmax: 494, ymax: 563, page: 1 },
};

function applyPibCoordFallback(
  res: DocumentFieldData,
  keys: string[],
  docCode?: string
): DocumentFieldData {
  if (!res.bbox && docCode?.toUpperCase() === "PIB") {
    for (const k of keys) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9_]/g, "");
      const std = PIB_STANDARD_COORDINATES[cleanK] || PIB_STANDARD_COORDINATES[k.toLowerCase()];
      if (std) {
        res.bbox = normalizeBbox(std, std.page + 1, "PIB");
        res.page = std.page + 1;
        break;
      }
    }
  }
  return res;
}

// Coordinate lookup helper that searches matched key and candidate keys in docIsi.coordinates
function resolveFieldCoord(
  docIsi: ParsedIsi,
  matchedKey: string,
  candidateKeys: string[]
): { xmin?: number; ymin?: number; xmax?: number; ymax?: number; page?: number } | undefined {
  if (!docIsi || !docIsi.coordinates) return undefined;

  // 1. Direct lookup for matchedKey or its non-action base
  const baseMatched = matchedKey.replace(/_action$/i, "");
  if (docIsi.coordinates[matchedKey]) return docIsi.coordinates[matchedKey];
  if (docIsi.coordinates[baseMatched]) return docIsi.coordinates[baseMatched];
  if (docIsi.coordinates[`${baseMatched}_action`]) return docIsi.coordinates[`${baseMatched}_action`];

  // 2. Normalized lookup for matchedKey
  const normMatched = baseMatched.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [ck, cv] of Object.entries(docIsi.coordinates)) {
    const normCk = ck.toLowerCase().replace(/_action$/i, "").replace(/[^a-z0-9]/g, "");
    if (normCk === normMatched) return cv;
  }

  // 3. Fallback to candidateKeys in docIsi.coordinates
  for (const cand of candidateKeys) {
    if (docIsi.coordinates[cand]) return docIsi.coordinates[cand];
    const b = cand.replace(/_action$/i, "");
    if (docIsi.coordinates[b]) return docIsi.coordinates[b];
    if (docIsi.coordinates[`${b}_action`]) return docIsi.coordinates[`${b}_action`];
  }

  const normCandidates = new Set(
    candidateKeys.map((c) => c.replace(/_action$/i, "").toLowerCase().replace(/[^a-z0-9]/g, ""))
  );
  for (const [ck, cv] of Object.entries(docIsi.coordinates)) {
    const normCk = ck.toLowerCase().replace(/_action$/i, "").replace(/[^a-z0-9]/g, "");
    if (normCandidates.has(normCk)) return cv;
  }

  return undefined;
}

function extractFieldValueRaw(
  docIsi: ParsedIsi,
  keys: string[],
  pageDefault: number = 1,
  docCode?: string
): DocumentFieldData {
  // 1. Manual edits check
  if (docIsi.manualEdits) {
    for (const k of keys) {
      if (docIsi.manualEdits[k]?.newValue !== undefined) {
        const coord = resolveFieldCoord(docIsi, k, keys);
        const oldVal = docIsi.manualEdits[k].oldValue ? String(docIsi.manualEdits[k].oldValue) : undefined;
        return {
          value: String(docIsi.manualEdits[k].newValue),
          originalValue: oldVal,
          isManual: true,
          page: resolveHeaderPage(coord, pageDefault, docCode),
          bbox: normalizeBbox(coord, pageDefault, docCode),
        };
      }
      const nk = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      for (const [mk, mv] of Object.entries(docIsi.manualEdits)) {
        if (mk.toLowerCase().replace(/[^a-z0-9]/g, "") === nk && mv?.newValue !== undefined) {
          const coord = resolveFieldCoord(docIsi, mk, keys);
          const oldVal = mv.oldValue ? String(mv.oldValue) : undefined;
          return {
            value: String(mv.newValue),
            originalValue: oldVal,
            isManual: true,
            page: resolveHeaderPage(coord, pageDefault, docCode),
            bbox: normalizeBbox(coord, pageDefault, docCode),
          };
        }
      }
    }
  }

  // 2. Action fields
  if (docIsi.fields) {
    for (const k of keys) {
      const actionKey = `${k}_action`;
      if (docIsi.fields[actionKey] !== undefined && docIsi.fields[actionKey] !== "") {
        const coord = resolveFieldCoord(docIsi, actionKey, keys);
        const transVal = String(docIsi.fields[actionKey]).trim();
        const rawOrig = docIsi.fields[k] !== undefined && docIsi.fields[k] !== null ? String(docIsi.fields[k]).trim() : undefined;
        const isDataAction = rawOrig !== undefined && rawOrig !== "" && rawOrig !== transVal;
        const dataActionNote = isDataAction ? `Data Action: "${rawOrig}" -> "${transVal}"` : undefined;
        return {
          value: transVal,
          originalValue: rawOrig,
          isManual: false,
          isDataAction,
          dataActionNote,
          page: resolveHeaderPage(coord, pageDefault, docCode),
          bbox: normalizeBbox(coord, pageDefault, docCode),
        };
      }
    }
  }

  // 3. Original fields
  if (docIsi.fields) {
    for (const k of keys) {
      if (docIsi.fields[k] !== undefined && docIsi.fields[k] !== "") {
        const coord = resolveFieldCoord(docIsi, k, keys);
        return {
          value: String(docIsi.fields[k]),
          isManual: false,
          page: resolveHeaderPage(coord, pageDefault, docCode),
          bbox: normalizeBbox(coord, pageDefault, docCode),
        };
      }
    }

    // Normalized lookup
    const normMap: Record<string, { val: string; key: string }> = {};
    for (const [fk, fv] of Object.entries(docIsi.fields)) {
      normMap[fk.toLowerCase().replace(/[^a-z0-9]/g, "")] = { val: String(fv), key: fk };
    }
    for (const k of keys) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normMap[cleanK]) {
        const origKey = normMap[cleanK]!.key;
        const coord = resolveFieldCoord(docIsi, origKey, keys);
        return {
          value: normMap[cleanK]!.val,
          isManual: false,
          page: resolveHeaderPage(coord, pageDefault, docCode),
          bbox: normalizeBbox(coord, pageDefault, docCode),
        };
      }
    }
  }

  // 4. Table row 0
  if (docIsi.table && docIsi.table.length > 0) {
    const row = docIsi.table[0];
    const rowCoords = docIsi.tableCoordinates?.[0];
    if (row) {
      for (const k of keys) {
        const actionKey = `${k}_action`;
        if (row[actionKey] !== undefined && row[actionKey] !== "") {
          const coord = rowCoords?.[actionKey] || rowCoords?.[k] || resolveFieldCoord(docIsi, actionKey, keys);
          const transVal = String(row[actionKey]).trim();
          const rawOrig = row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : undefined;
          const isDataAction = rawOrig !== undefined && rawOrig !== "" && rawOrig !== transVal;
          const dataActionNote = isDataAction ? `Data Action: "${rawOrig}" -> "${transVal}"` : undefined;
          return {
            value: transVal,
            originalValue: rawOrig,
            isManual: false,
            isDataAction,
            dataActionNote,
            page: resolveHeaderPage(coord, pageDefault, docCode),
            bbox: normalizeBbox(coord, pageDefault, docCode),
          };
        }
      }
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== "") {
          const coord = rowCoords?.[k] || resolveFieldCoord(docIsi, k, keys);
          return {
            value: String(row[k]),
            isManual: false,
            page: resolveHeaderPage(coord, pageDefault, docCode),
            bbox: normalizeBbox(coord, pageDefault, docCode),
          };
        }
      }
      for (const [rk, rv] of Object.entries(row)) {
        const cleanRk = rk.toLowerCase().replace(/[^a-z0-9]/g, "");
        for (const k of keys) {
          if (cleanRk === k.toLowerCase().replace(/[^a-z0-9]/g, "")) {
            const coord = rowCoords?.[rk] || resolveFieldCoord(docIsi, rk, keys);
            return {
              value: String(rv),
              isManual: false,
              page: resolveHeaderPage(coord, pageDefault, docCode),
              bbox: normalizeBbox(coord, pageDefault, docCode),
            };
          }
        }
      }
    }
  }

  return { value: "-", isManual: false };
}

export function extractFieldValue(
  docIsi: ParsedIsi,
  keys: string[],
  pageDefault: number = 1,
  docCode?: string
): DocumentFieldData {
  const res = extractFieldValueRaw(docIsi, keys, pageDefault, docCode);
  return applyPibCoordFallback(res, keys, docCode);
}

export function checkFieldMatch(
  v1: string,
  v2: string,
  fieldName: string,
  equivalencyGroups: DbEquivalencyGroup[] = []
): { status: FieldMatchStatus; reason?: string } {
  if (!v1 || !v2 || v1 === "-" || v2 === "-" || v2 === "Tidak ada di dokumen ini") {
    return { status: "NEUTRAL", reason: undefined };
  }

  const result = isEquivalentMatch(v1, v2, fieldName, equivalencyGroups);
  if (result.isMatch) {
    return {
      status: "MATCH",
      reason: result.reason ? `(${result.reason})` : undefined,
    };
  }

  return { status: "MISMATCH", reason: undefined };
}

export function normalizeDocMeta(fileTypeRaw: string): { code: string; name: string } {
  const ft = (fileTypeRaw || "").trim().toLowerCase();
  if (ft === "pib" || ft.includes("file acuan") || ft.startsWith("pib")) {
    return { code: "PIB", name: "PIB (acuan)" };
  }
  if (ft.includes("invoice") || ft === "ci") {
    return { code: "Invoice", name: "Invoice" };
  }
  if (ft.includes("packing") || ft.includes("paking") || ft === "pl") {
    return { code: "PL", name: "PL (Packing List)" };
  }
  if (ft.includes("lading") || ft.includes("bl") || ft === "bill of lading") {
    return { code: "BL", name: "BL (Bill of Lading)" };
  }
  // TODO: Full name for AK is unknown; keeping the code alone per specification.
  if (ft.includes("ak") || ft.includes("coo")) {
    return { code: "AK", name: "AK" };
  }
  // TODO: Full name for WL is unknown; keeping the code alone per specification.
  if (ft.includes("weight") || ft === "wl") {
    return { code: "WL", name: "WL" };
  }
  if (ft.includes("mill") || ft.includes("test") || ft === "ms" || ft.includes("mtc")) {
    return { code: "MS", name: "MS (Mill Test Certificate)" };
  }
  return { code: fileTypeRaw, name: fileTypeRaw };
}

// Transform raw batch details from backend into Normalized Batch Model
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adaptBatchToModel(rawBatch: any): BatchComparisonModel {
  const batchId = String(rawBatch.id);
  const details: Array<any> = Array.isArray(rawBatch.details) ? rawBatch.details : [];

  // Identify PIB Detail
  const rawPib = details.find((d) => {
    const ft = (d.fileType || "").trim().toLowerCase();
    return ft === "pib" || ft.includes("file acuan") || ft.startsWith("pib");
  });

  const parsedPibIsi = parseDocumentIsi(rawPib?.isi);

  // Auto-enrich composite and item-level PIB fields:
  // 1. Negara_Asal: (Kotak D.1 Hal. 1 / Table Row 0)
  if (!parsedPibIsi.fields.Negara_Asal && !parsedPibIsi.fields.Country_of_Origin) {
    const tableOrigin = parsedPibIsi.table?.[0]?.Negara_Asal_Country_Of_Origin || parsedPibIsi.table?.[0]?.Country_of_Origin;
    if (tableOrigin) {
      parsedPibIsi.fields.Negara_Asal = String(tableOrigin);
      if (parsedPibIsi.tableCoordinates?.[0]?.Negara_Asal_Country_Of_Origin) {
        parsedPibIsi.coordinates["Negara_Asal"] = parsedPibIsi.tableCoordinates[0].Negara_Asal_Country_Of_Origin;
      }
    } else if (parsedPibIsi.fields.Negara_Pemasok) {
      parsedPibIsi.fields.Negara_Asal = String(parsedPibIsi.fields.Negara_Pemasok);
    }
  }

  // 2. Jumlah_Coil_Item & Jumlah_Satuan_Coil: Per pos barang (Pos 1: Hal. 2 Kol. 35) dipisah dari Total Header (118)
  if (parsedPibIsi.table?.[0]) {
    const row0 = parsedPibIsi.table[0];
    const coilVal = row0.Jumlah_Satuan_Coil_action || row0.Jumlah_Satuan_Coil || row0.Jumlah_Coil;
    if (coilVal) {
      parsedPibIsi.fields.Jumlah_Satuan_Coil = String(coilVal);
      parsedPibIsi.fields.Jumlah_Satuan_Coil_action = String(coilVal);
      parsedPibIsi.fields.Jumlah_Coil_Item = String(coilVal);
      parsedPibIsi.fields.Jumlah_Coil_Item_action = String(coilVal);
      if (parsedPibIsi.tableCoordinates?.[0]?.Jumlah_Satuan_Coil) {
        parsedPibIsi.coordinates["Jumlah_Satuan_Coil"] = parsedPibIsi.tableCoordinates[0].Jumlah_Satuan_Coil;
        parsedPibIsi.coordinates["Jumlah_Coil_Item"] = parsedPibIsi.tableCoordinates[0].Jumlah_Satuan_Coil;
      }
    }
  }

  // 3. Berat_Bersih_Item & Jumlah_Satuan_Barang: Per pos barang (Pos 1: Hal. 2 Kol. 35) dipisah dari Total Header
  if (parsedPibIsi.table?.[0]) {
    const row0 = parsedPibIsi.table[0];
    const netVal = row0.Jumlah_Satuan_Barang_action || row0.Jumlah_Satuan_Barang || row0.Berat_Bersih;
    if (netVal) {
      parsedPibIsi.fields.Berat_Bersih_Item = String(netVal);
      parsedPibIsi.fields.Berat_Bersih_Item_action = String(netVal);
      parsedPibIsi.fields.Jumlah_Satuan_Barang = String(netVal);
      parsedPibIsi.fields.Jumlah_Satuan_Barang_action = String(netVal);
      if (parsedPibIsi.tableCoordinates?.[0]?.Jumlah_Satuan_Barang) {
        parsedPibIsi.coordinates["Berat_Bersih_Item"] = parsedPibIsi.tableCoordinates[0].Jumlah_Satuan_Barang;
        parsedPibIsi.coordinates["Jumlah_Satuan_Barang"] = parsedPibIsi.tableCoordinates[0].Jumlah_Satuan_Barang;
      }
    }
  }

  // 4. No_Dan_Tanggal_Invoice: Gabungan Nomor & Tanggal Invoice (Hal. 1 Kotak D.15)
  if (!parsedPibIsi.fields.No_Dan_Tanggal_Invoice) {
    const invNo = parsedPibIsi.fields.No_Invoice || parsedPibIsi.fields.Invoice_Number || "";
    const invDate = parsedPibIsi.fields.Tanggal_Invoice || parsedPibIsi.fields.Invoice_Date || "";
    if (invNo && invDate) {
      parsedPibIsi.fields.No_Dan_Tanggal_Invoice = `${invNo} / ${invDate}`;
    } else if (invNo) {
      parsedPibIsi.fields.No_Dan_Tanggal_Invoice = String(invNo);
    }
  }

  // 5. Ukuran_Barang on PIB: Per pos barang (Pos 1: Hal. 2 Kol. 35)
  if (!parsedPibIsi.fields.Ukuran_Barang && parsedPibIsi.table?.[0]) {
    const row0 = parsedPibIsi.table[0];
    const sizeVal = row0.Ukuran_Barang || row0.Ukuran_Barang_action || row0.Ukuran || row0.Size;
    if (sizeVal) {
      parsedPibIsi.fields.Ukuran_Barang = String(sizeVal);
      if (parsedPibIsi.tableCoordinates?.[0]?.Ukuran_Barang) {
        parsedPibIsi.coordinates["Ukuran_Barang"] = parsedPibIsi.tableCoordinates[0].Ukuran_Barang;
      }
    }
  }

  // 6. Uraian_Barang on PIB: Per pos barang (Pos 1: Hal. 2 Kol. 35)
  if (!parsedPibIsi.fields.Uraian_Barang && parsedPibIsi.table?.[0]) {
    const row0 = parsedPibIsi.table[0];
    const descVal = row0.Uraian_Barang || row0.Uraian_Barang_action || row0.Deskripsi_Barang || row0.Description;
    if (descVal) {
      parsedPibIsi.fields.Uraian_Barang = String(descVal);
      if (parsedPibIsi.tableCoordinates?.[0]?.Uraian_Barang) {
        parsedPibIsi.coordinates["Uraian_Barang"] = parsedPibIsi.tableCoordinates[0].Uraian_Barang;
      }
    }
  }

  // 7. Spesifikasi_Grade on PIB: Per pos barang (Pos 1: Hal. 2 Kol. 35)
  if (!parsedPibIsi.fields.Spesifikasi_Grade && parsedPibIsi.table?.[0]) {
    const row0 = parsedPibIsi.table[0];
    const specVal = row0.Spesifikasi_Grade || row0.Spesifikasi_Grade_action || row0.Spek_Material || row0.Spesifikasi;
    if (specVal) {
      parsedPibIsi.fields.Spesifikasi_Grade = String(specVal);
      if (parsedPibIsi.tableCoordinates?.[0]?.Spesifikasi_Grade) {
        parsedPibIsi.coordinates["Spesifikasi_Grade"] = parsedPibIsi.tableCoordinates[0].Spesifikasi_Grade;
      }
    }
  }

  // 8. Harga_Satuan on PIB: Per pos barang (Pos 1: Hal. 2 Kol. 35)
  if (!parsedPibIsi.fields.Harga_Satuan && parsedPibIsi.table?.[0]) {
    const row0 = parsedPibIsi.table[0];
    const priceVal = row0.Harga_Satuan || row0.Harga_Satuan_action || row0.Unit_Price || row0.Price;
    if (priceVal) {
      parsedPibIsi.fields.Harga_Satuan = String(priceVal);
      if (parsedPibIsi.tableCoordinates?.[0]?.Harga_Satuan) {
        parsedPibIsi.coordinates["Harga_Satuan"] = parsedPibIsi.tableCoordinates[0].Harga_Satuan;
      }
    }
  }

  const pibDoc: BatchDocumentModel = {
    id: rawPib?.id ?? 0,
    code: "PIB",
    name: "PIB (acuan)",
    fileName: rawPib?.fileId && rawPib.fileId.toLowerCase().endsWith(".pdf") ? rawPib.fileId : "PIB.pdf",
    fileUrl: rawPib?.id
      ? `/api/batches/${batchId}/pdf?type=pib&detailId=${rawPib.id}`
      : `/api/batches/${batchId}/pdf?type=pib`,
    fields: {},
    lineItems: parsedPibIsi.table,
    manualNotes: parsedPibIsi.manualNotes,
    rawIsi: parsedPibIsi,
  };

  // Identify Supporting Documents (Restricted to Invoice and BL only)
  const supportingDocs: BatchDocumentModel[] = [];

  for (const d of details) {
    const ft = (d.fileType || "").trim().toLowerCase();
    if (ft === "pib" || ft.includes("file acuan") || ft.startsWith("pib")) {
      continue;
    }
    const meta = normalizeDocMeta(d.fileType);
    if (meta.code !== "Invoice" && meta.code !== "BL") {
      continue;
    }
    const parsedIsi = parseDocumentIsi(d.isi, meta.code);

    supportingDocs.push({
      id: d.id,
      code: meta.code,
      name: meta.name,
      fileName: d.fileId && d.fileId.toLowerCase().endsWith(".pdf") ? d.fileId : `${meta.code}.pdf`,
      fileUrl: d.id
        ? `/api/batches/${batchId}/pdf?type=${encodeURIComponent(meta.code)}&detailId=${d.id}`
        : `/api/batches/${batchId}/pdf?type=${encodeURIComponent(meta.code)}`,
      fields: {},
      lineItems: parsedIsi.table,
      manualNotes: parsedIsi.manualNotes,
      rawIsi: parsedIsi,
    });
  }

  // Desired ordering: Invoice, BL
  const orderMap: Record<string, number> = {
    Invoice: 1,
    BL: 2,
  };
  supportingDocs.sort((a, b) => {
    const ordA = orderMap[a.code] ?? 99;
    const ordB = orderMap[b.code] ?? 99;
    return ordA - ordB;
  });

  return {
    id: batchId,
    nama: rawBatch.nama || `Batch #${batchId}`,
    status: rawBatch.status || "Perlu review manual",
    pib: pibDoc,
    supporting: supportingDocs,
  };
}

// Generate Comparison Field Cards for PIB vs Selected Supporting Document
export function buildComparisonFields(
  pibDoc: BatchDocumentModel,
  supportingDoc: BatchDocumentModel | null,
  equivalencyGroups: DbEquivalencyGroup[] = []
): ComparisonFieldModel[] {
  if (!supportingDoc) return [];

  const pibIsi = pibDoc.rawIsi as ParsedIsi;
  const supIsi = supportingDoc.rawIsi as ParsedIsi;

  interface FieldDef {
    id: string;
    number: string;
    label: string;
    pibKeys: string[];
    supportingKeys: string[];
    fieldName: string;
    pibPageDefault?: number;
    supPageDefault?: number;
  }

  let defs: FieldDef[] = [];
  const code = String(supportingDoc.code || "").toUpperCase();

  if (code === "INVOICE" || code === "CI") {
    defs = [
      { id: "inv-1", number: "1", label: "Identitas penjual / supplier", pibKeys: ["Identitas_Penjual", "Nama_Penjual", "Nama_Pengirim", "Pengirim", "Supplier"], supportingKeys: ["Identitas_Penjual", "Exporter", "Seller", "Shipper", "Supplier", "Nama_Penjual", "Identitas_Supplier"], fieldName: "Identitas_Penjual", pibPageDefault: 1, supPageDefault: 1 },
      { id: "inv-2", number: "2", label: "Nomor invoice", pibKeys: ["No_Invoice", "Invoice_Number", "Nomor_Invoice", "No Invoice"], supportingKeys: ["No_Invoice", "Invoice_Number", "Invoice Number", "Nomor_Invoice"], fieldName: "No_Invoice", pibPageDefault: 1, supPageDefault: 1 },
      { id: "inv-3", number: "3", label: "Tanggal invoice", pibKeys: ["Tanggal_Invoice", "Invoice_Date", "Tanggal Invoice"], supportingKeys: ["Tanggal_Invoice", "Invoice_Date", "Invoice Date", "Tanggal"], fieldName: "Tanggal_Invoice", pibPageDefault: 1, supPageDefault: 1 },
      { id: "inv-4", number: "4", label: "Valuta", pibKeys: ["Valuta", "Mata_Uang", "Currency", "Jenis_Valuta"], supportingKeys: ["Mata_Uang", "Valuta", "Currency", "Curr"], fieldName: "Valuta", pibPageDefault: 1, supPageDefault: 1 },
      { id: "inv-5", number: "5", label: "Incoterms dan lokasi", pibKeys: ["Incoterms_Lokasi", "Incoterms", "Ket_FOB", "Cara_Penyerahan", "Terms_of_Delivery"], supportingKeys: ["Incoterms_Lokasi", "Incoterms", "Terms_of_Delivery", "Delivery_Terms", "Cara_Penyerahan"], fieldName: "Incoterms_Lokasi", pibPageDefault: 1, supPageDefault: 1 },
      { id: "inv-6", number: "6", label: "Nilai pabean", pibKeys: ["Nilai_Pabean", "Nilai_Total_Invoice", "Nilai Pabean", "Nilai Total"], supportingKeys: ["Nilai_Total_Invoice", "Total", "Nilai Total", "Total_Amount", "Invoice_Total", "Nilai_Pabean", "Amount"], fieldName: "Nilai_Pabean", pibPageDefault: 1, supPageDefault: 1 },
      { id: "inv-7", number: "7", label: "Jumlah coil", pibKeys: ["Jumlah_Coil", "Jumlah", "Jumlah_Kemasan", "Total_Packages"], supportingKeys: ["Jumlah_Coil", "Total_Coils", "Jumlah", "QTY", "Total_Packages", "Coils"], fieldName: "Jumlah_Coil", pibPageDefault: 1, supPageDefault: 1 },
      { id: "inv-8", number: "8", label: "Berat Bersih", pibKeys: ["Berat_Bersih", "Net_Weight", "Total_Net_Weight"], supportingKeys: ["Net_Weight", "Total_Net_Weight", "Berat_Bersih", "Net Weight", "N.W.", "Total_Jumlah_Berat"], fieldName: "Berat_Bersih", pibPageDefault: 1, supPageDefault: 1 },
      { id: "inv-9", number: "9", label: "Berat Kotor", pibKeys: ["Berat_Kotor", "Gross_Weight", "Total_Gross_Weight"], supportingKeys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor", "Gross Weight", "G.W."], fieldName: "Berat_Kotor", pibPageDefault: 1, supPageDefault: 1 },
      { id: "inv-10", number: "10", label: "Uraian barang", pibKeys: ["Uraian_Barang", "Deskripsi_Barang", "Description", "Description_of_Goods"], supportingKeys: ["Deskripsi_Barang", "Uraian_Barang", "Description", "Commodity", "Item_Description", "Description_of_Goods"], fieldName: "Uraian_Barang", pibPageDefault: 2, supPageDefault: 1 },
      { id: "inv-11", number: "11", label: "Ukuran barang", pibKeys: ["Ukuran_Barang", "Ukuran", "Size", "Dimension", "Dimensions", "Ukuran_Dimensi"], supportingKeys: ["Ukuran_Barang", "Size", "Dimension", "Dimensions", "Ukuran", "Thickness", "Ukuran_Dimensi"], fieldName: "Ukuran_Barang", pibPageDefault: 2, supPageDefault: 2 },
      { id: "inv-12", number: "12", label: "Spesifikasi / grade", pibKeys: ["Spesifikasi_Grade", "Spek_Material", "Spesifikasi", "Grade", "Specification"], supportingKeys: ["Spesifikasi_Grade", "Spek_Material", "Spesifikasi", "Grade", "Specification", "Steel_Grade"], fieldName: "Spesifikasi_Grade", pibPageDefault: 2, supPageDefault: 2 },
      { id: "inv-13", number: "13", label: "Jumlah Satuan Barang", pibKeys: ["Jumlah_Satuan_Barang", "Berat_Bersih_Item", "Jumlah_Satuan_Barang_action", "Berat_Bersih"], supportingKeys: ["Jumlah_Satuan_Barang", "Berat_Bersih_Item", "Net_Weight_Item", "Weight_Item"], fieldName: "Jumlah_Satuan_Barang", pibPageDefault: 2, supPageDefault: 2 },
      { id: "inv-14", number: "14", label: "Jumlah Satuan Coil", pibKeys: ["Jumlah_Satuan_Coil", "Jumlah_Coil_Item"], supportingKeys: ["Jumlah_Satuan_Coil", "Jumlah_Coil_Item", "Qty_Coil_Item", "Coils_Item"], fieldName: "Jumlah_Satuan_Coil", pibPageDefault: 2, supPageDefault: 2 },
      { id: "inv-15", number: "15", label: "Harga satuan", pibKeys: ["Harga_Satuan", "Nilai_Pabean_Item", "Nilai_Barang"], supportingKeys: ["Harga_Satuan", "Unit_Price", "Price", "UnitPrice"], fieldName: "Harga_Satuan", pibPageDefault: 2, supPageDefault: 2 },
    ];
  } else if (code === "PL" || code.includes("PACKING")) {
    defs = [
      { id: "pl-1", number: "1", label: "Deskripsi barang", pibKeys: ["Uraian_Barang", "Deskripsi_Barang", "Description"], supportingKeys: ["Deskripsi_Barang", "Description", "Description_of_Goods"], fieldName: "Deskripsi_Barang", pibPageDefault: 2, supPageDefault: 1 },
      { id: "pl-2", number: "2", label: "Gross weight", pibKeys: ["Berat_Kotor", "Gross_Weight", "Total_Gross_Weight"], supportingKeys: ["Gross_Weight", "Total_Gross_Weight", "G.W.", "Gross Weight"], fieldName: "Gross_Weight", pibPageDefault: 1, supPageDefault: 1 },
      { id: "pl-3", number: "3", label: "Identitas buyer", pibKeys: ["Pemilik_Barang", "Nama_Importir", "Importir", "Identitas_Pembeli"], supportingKeys: ["Identitas_Buyer", "Buyer", "Consignee", "Identitas_Pembeli"], fieldName: "Identitas_Buyer", pibPageDefault: 1, supPageDefault: 1 },
      { id: "pl-4", number: "4", label: "Identitas supplier", pibKeys: ["Identitas_Penjual", "Nama_Penjual", "Nama_Pengirim", "Pengirim", "Supplier"], supportingKeys: ["Identitas_Supplier", "Supplier", "Exporter", "Shipper", "Seller", "Identitas_Penjual"], fieldName: "Identitas_Supplier", pibPageDefault: 1, supPageDefault: 1 },
      { id: "pl-5", number: "5", label: "Jumlah coil", pibKeys: ["Jumlah_Coil", "Jumlah", "Jumlah_Kemasan"], supportingKeys: ["Jumlah_Coil", "Total_Coils", "Coils", "Qty_Coil", "Jumlah"], fieldName: "Jumlah_Coil", pibPageDefault: 1, supPageDefault: 1 },
      { id: "pl-6", number: "6", label: "Moda", pibKeys: ["Moda", "Nama_Sarana_Pengangkutan", "Nama_Sarana_Pengangkut", "Nama_Kapal"], supportingKeys: ["Moda", "Shipped_Per", "Vessel", "Vessel_Name"], fieldName: "Moda", pibPageDefault: 1, supPageDefault: 1 },
      { id: "pl-7", number: "7", label: "Negara asal", pibKeys: ["Negara_Asal", "Country_of_Origin", "Origin_Country", "Negara_Asal_Country_Of_Origin"], supportingKeys: ["Negara_asal", "Negara_Asal", "Country_of_Origin", "Origin"], fieldName: "Negara_Asal", pibPageDefault: 1, supPageDefault: 1 },
      { id: "pl-8", number: "8", label: "Net weight", pibKeys: ["Berat_Bersih", "Net_Weight", "Total_Net_Weight"], supportingKeys: ["Net_Weight", "Total_Net_Weight", "N.W.", "Net Weight"], fieldName: "Net_Weight", pibPageDefault: 1, supPageDefault: 1 },
      { id: "pl-9", number: "9", label: "No invoice", pibKeys: ["No_Invoice", "Invoice_Number", "Nomor_Invoice"], supportingKeys: ["No_Invoice", "Invoice_Number", "Invoice Number"], fieldName: "No_Invoice", pibPageDefault: 1, supPageDefault: 1 },
      { id: "pl-10", number: "10", label: "Pelabuhan asal", pibKeys: ["Pelabuhan_Muat", "Pelabuhan_Asal", "Port_of_Loading"], supportingKeys: ["Pelabuhan_Asal", "Port_of_Loading", "Pelabuhan_Muat"], fieldName: "Pelabuhan_Asal", pibPageDefault: 1, supPageDefault: 1 },
      { id: "pl-11", number: "11", label: "Pelabuhan tujuan", pibKeys: ["Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar"], supportingKeys: ["Pelabuhan_Tujuan", "Destination", "Port_of_Discharge"], fieldName: "Pelabuhan_Tujuan", pibPageDefault: 1, supPageDefault: 1 },
      { id: "pl-12", number: "12", label: "Tanggal invoice", pibKeys: ["Tanggal_Invoice", "Invoice_Date", "Tanggal Invoice"], supportingKeys: ["Tanggal_Invoice", "Invoice_Date", "Invoice Date"], fieldName: "Tanggal_Invoice", pibPageDefault: 1, supPageDefault: 1 },
    ];
  } else if (code === "BL" || code.includes("LADING")) {
    defs = [
      { id: "bl-1", number: "1", label: "Identitas PENGIRIM", pibKeys: ["Identitas_Pengirim", "Nama_Pengirim", "Pengirim", "Identitas_Penjual", "Nama_Penjual", "Shipper"], supportingKeys: ["Shipper", "Identitas_Pengirim", "Shipping_Marks", "Exporter", "Nama_Pengirim", "Nama_Penjual", "Pengirim"], fieldName: "Identitas_Pengirim", pibPageDefault: 1, supPageDefault: 1 },
      { id: "bl-2", number: "2", label: "Pemilik Barang", pibKeys: ["Pemilik_Barang", "Nama_Importir", "Importir", "Identitas_Pembeli"], supportingKeys: ["Notify_Party", "Consignee", "Pemilik_Barang", "Nama_Consignee", "Buyer", "Importir", "Customer"], fieldName: "Pemilik_Barang", pibPageDefault: 1, supPageDefault: 1 },
      { id: "bl-3", number: "3", label: "Moda / nama kapal (Shipped Per)", pibKeys: ["Moda", "Nama_Sarana_Pengangkut", "Nama_Sarana_Pengangkutan", "Nama_Kapal", "Vessel_Name"], supportingKeys: ["Vessel_Name", "Moda", "Vessel", "Nama_Kapal", "Shipped_Per", "Shipped Per"], fieldName: "Moda", pibPageDefault: 1, supPageDefault: 1 },
      { id: "bl-4", number: "4", label: "Pelabuhan asal (From)", pibKeys: ["Pelabuhan_Muat", "Pelabuhan_Asal", "Port_of_Loading"], supportingKeys: ["Port_of_Loading", "Pelabuhan_Asal", "Pelabuhan_Muat", "Loading_Port", "From"], fieldName: "Pelabuhan_Asal", pibPageDefault: 1, supPageDefault: 1 },
      { id: "bl-5", number: "5", label: "Pelabuhan tujuan (To)", pibKeys: ["Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar"], supportingKeys: ["Port_of_Discharge", "Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar", "To"], fieldName: "Pelabuhan_Tujuan", pibPageDefault: 1, supPageDefault: 1 },
      { id: "bl-6", number: "6", label: "Nomor B/L", pibKeys: ["No_BL", "Nomor_BL", "BL_Number", "Nomor_B/L", "No_B/L", "House_BL_No", "B/L_No", "No_Dokumen", "No_Dokumen_BL", "No_House_BL", "House_BL"], supportingKeys: ["No_BL", "BL_Number", "Nomor_BL", "No_B/L", "Sea_Waybill_Number", "Waybill_Number", "House_BL", "No_House_BL", "B/L_No", "Nomor_B/L"], fieldName: "No_BL", pibPageDefault: 1, supPageDefault: 1 },
      { id: "bl-7", number: "7", label: "Tanggal B/L", pibKeys: ["Tanggal_BL", "Tanggal BL", "House_BL_Date", "Date_of_Issue", "Tanggal_B/L", "Master_BL_Date"], supportingKeys: ["Tanggal_BL", "Date_of_Issue", "BL_Date", "Shipped_on_Board_Date", "Date", "Tanggal_B/L", "Tanggal", "House_BL_Date"], fieldName: "Tanggal_BL", pibPageDefault: 1, supPageDefault: 1 },
      { id: "bl-8", number: "8", label: "Negara asal (Country of Origin)", pibKeys: ["Negara_Asal", "Country_of_Origin", "Origin_Country", "Negara_Asal_Country_Of_Origin"], supportingKeys: ["Country_of_Origin", "Negara_Asal", "Origin_Country", "Negara_asal", "Origin"], fieldName: "Negara_Asal", pibPageDefault: 1, supPageDefault: 1 },
    ];
  } else if (code === "AK") {
    defs = [
      { id: "ak-1", number: "1", label: "No referensi (ECO)", pibKeys: ["Electronic_Certificate_Of_Origin_ECO", "Pengecualian_Perijinan2", "No_Referensi", "ECO"], supportingKeys: ["No_Referensi", "Reference_No", "Certificate_No"], fieldName: "No_Referensi", pibPageDefault: 1, supPageDefault: 1 },
      { id: "ak-2", number: "2", label: "Nama exporter / shipper", pibKeys: ["Identitas_Pengirim", "Nama_Pengirim", "Pengirim", "Identitas_Penjual"], supportingKeys: ["Nama_Exporter_Shipper", "Exporter", "Producer", "Shipper"], fieldName: "Nama_Exporter_Shipper", pibPageDefault: 1, supPageDefault: 1 },
      { id: "ak-3", number: "3", label: "Nama consignee", pibKeys: ["Pemilik_Barang", "Nama_Importir", "Importir", "Identitas_Pembeli"], supportingKeys: ["Nama_Consignee", "Consignee", "Buyer", "Nama_Importir"], fieldName: "Nama_Consignee", pibPageDefault: 1, supPageDefault: 1 },
      { id: "ak-4", number: "4", label: "Nama vessel", pibKeys: ["Moda", "Nama_Sarana_Pengangkut", "Nama_Sarana_Pengangkutan"], supportingKeys: ["Nama_Vessel", "Vessel_Name", "Vessel", "Moda"], fieldName: "Nama_Vessel", pibPageDefault: 1, supPageDefault: 1 },
      { id: "ak-5", number: "5", label: "Nama pelabuhan bongkar", pibKeys: ["Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar"], supportingKeys: ["Nama_Pelabuhan_Bongkar", "Port_of_Discharge", "Destination"], fieldName: "Nama_Pelabuhan_Bongkar", pibPageDefault: 1, supPageDefault: 1 },
      { id: "ak-6", number: "6", label: "Jumlah coil", pibKeys: ["Jumlah_Coil", "Jumlah", "Jumlah_Kemasan"], supportingKeys: ["Jumlah_Coil", "Total_Packages", "Jumlah_Dan_Jenis_Kemasan", "Number_and_Type_of_Packages", "Jumlah_Kemasan"], fieldName: "Jumlah_Coil", pibPageDefault: 1, supPageDefault: 1 },
      { id: "ak-7", number: "7", label: "Deskripsi barang", pibKeys: ["Uraian_Barang", "Deskripsi_Barang", "Description"], supportingKeys: ["Deskripsi_Barang", "Description_of_Goods", "Description", "Commodity"], fieldName: "Deskripsi_Barang", pibPageDefault: 2, supPageDefault: 1 },
      { id: "ak-8", number: "8", label: "Tanggal keberangkatan", pibKeys: ["Tanggal_BL", "Tanggal BL", "House_BL_Date", "Date_of_Issue"], supportingKeys: ["Tanggal_Keberangkatan", "Departure_Date", "Date_of_Departure", "Tanggal_BL"], fieldName: "Tanggal_Keberangkatan", pibPageDefault: 1, supPageDefault: 1 },
      { id: "ak-9", number: "9", label: "Total gross weight", pibKeys: ["Berat_Kotor", "Gross_Weight", "Total_Gross_Weight"], supportingKeys: ["Total_Gross_Weight", "Gross_Weight", "Berat_Kuantitas", "Total_Weight"], fieldName: "Total_Gross_Weight", pibPageDefault: 1, supPageDefault: 1 },
    ];
  } else if (code === "WL") {
    defs = [
      { id: "wl-1", number: "1", label: "Deskripsi barang", pibKeys: ["Uraian_Barang", "Deskripsi_Barang", "Description", "Description_of_Goods"], supportingKeys: ["Deskripsi_Barang", "Description", "Description_of_Goods", "Item_Description"], fieldName: "Deskripsi_Barang", pibPageDefault: 2, supPageDefault: 1 },
      { id: "wl-2", number: "2", label: "Jumlah coil", pibKeys: ["Jumlah_Satuan_Coil", "Jumlah_Coil_Item"], supportingKeys: ["Jumlah_Coil", "Total_Coils", "Coils", "Qty_Coil", "Jumlah"], fieldName: "Jumlah_Coil", pibPageDefault: 2, supPageDefault: 1 },
      { id: "wl-3", number: "3", label: "Net weight", pibKeys: ["Berat_Bersih_Item", "Jumlah_Satuan_Barang"], supportingKeys: ["Net_Weight", "Total_Net_Weight", "Berat_Bersih", "N.W.", "NW"], fieldName: "Net_Weight", pibPageDefault: 2, supPageDefault: 1 },
      { id: "wl-4", number: "4", label: "Spesifikasi grade", pibKeys: ["Spesifikasi_Grade", "Spek_Material", "Spesifikasi", "Grade"], supportingKeys: ["Spesifikasi", "Spesifikasi_Grade", "Spek_Material", "Grade", "Specification"], fieldName: "Spesifikasi_Grade", pibPageDefault: 2, supPageDefault: 1 },
    ];
  } else if (code === "MS") {
    defs = [
      { id: "ms-1", number: "1", label: "Deskripsi barang", pibKeys: ["Uraian_Barang", "Deskripsi_Barang", "Description", "Description_of_Goods"], supportingKeys: ["Deskripsi_Barang", "Description", "Description_of_Goods", "Item_Description"], fieldName: "Deskripsi_Barang", pibPageDefault: 2, supPageDefault: 1 },
      { id: "ms-2", number: "2", label: "Jumlah berat material", pibKeys: ["Jumlah_Satuan_Barang", "Berat_Bersih_Item"], supportingKeys: ["Jumlah_Berat_Material", "Berat_Material", "Total_Weight", "Weight", "Net_Weight"], fieldName: "Jumlah_Berat_Material", pibPageDefault: 2, supPageDefault: 1 },
      { id: "ms-3", number: "3", label: "Nama supplier", pibKeys: ["Identitas_Pengirim", "Nama_Pengirim", "Pengirim", "Identitas_Penjual", "Supplier"], supportingKeys: ["Nama_Supplier", "Nama_Produsen", "Producer", "Supplier", "Manufacturer"], fieldName: "Nama_Supplier", pibPageDefault: 1, supPageDefault: 1 },
      { id: "ms-4", number: "4", label: "Spek material", pibKeys: ["Spesifikasi_Grade", "Spek_Material", "Spesifikasi", "Grade"], supportingKeys: ["Spek_Material", "Spesifikasi_Grade", "Spesifikasi", "Grade", "Specification"], fieldName: "Spek_Material", pibPageDefault: 2, supPageDefault: 1 },
    ];
  } else {
    // Dynamic fallback for any other supporting document type
    const fieldKeys = Object.keys(supIsi.fields).filter((k) => !k.endsWith("_action"));
    defs = fieldKeys.map((k, idx) => {
      const cleanLabel = k.replace(/_/g, " ").toLowerCase();
      const sentenceLabel = cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1);
      return {
        id: `${code.toLowerCase()}-${idx + 1}`,
        number: String(idx + 1),
        label: sentenceLabel,
        pibKeys: [k],
        supportingKeys: [k],
        fieldName: k,
        pibPageDefault: 1,
        supPageDefault: 1,
      };
    });
  }

  return defs.map((d) => {
    const pibKeys = [d.fieldName, ...d.pibKeys];
    const supKeys = [d.fieldName, ...d.supportingKeys];
    const pibRes = extractFieldValue(pibIsi, pibKeys, d.pibPageDefault, "PIB");
    const supRes = extractFieldValue(supIsi, supKeys, d.supPageDefault, supportingDoc.code);

    // If supporting document has no value, mark as fallback
    let supportingVal = supRes.value;
    if (!supportingVal || supportingVal === "-") {
      supportingVal = "Tidak ada di dokumen ini";
    }

    const match = checkFieldMatch(pibRes.value, supportingVal, d.fieldName, equivalencyGroups);

    const pibNotes = (pibIsi?.manualNotes || []).filter(
      (n) => n.targetType === "field" && (n.targetKey === d.fieldName || n.targetKey === d.id || d.pibKeys.includes(n.targetKey))
    );
    const supNotes = (supIsi?.manualNotes || []).filter(
      (n) => n.targetType === "field" && (n.targetKey === d.fieldName || n.targetKey === d.id || d.supportingKeys.includes(n.targetKey))
    );
    const allFieldNotes = [...pibNotes, ...supNotes];

    return {
      id: d.id,
      number: d.number,
      label: d.label,
      fieldName: d.fieldName,
      docCode: supportingDoc.code,
      status: match.status,
      pibValue: pibRes.value,
      pibPage: pibRes.page,
      pibBbox: pibRes.bbox,
      pibIsManual: pibRes.isManual,
      pibIsDataAction: pibRes.isDataAction,
      pibOriginalValue: pibRes.originalValue,
      pibDataActionNote: pibRes.dataActionNote,
      pibManualNotes: pibNotes,
      pibDetailId: pibDoc.id,
      supportingValue: supportingVal,
      supportingPage: supRes.page,
      supportingBbox: supRes.bbox,
      supportingIsManual: supRes.isManual,
      supportingIsDataAction: supRes.isDataAction,
      supportingOriginalValue: supRes.originalValue,
      supportingDataActionNote: supRes.dataActionNote,
      supportingManualNotes: supNotes,
      supportingDetailId: supportingDoc.id,
      matchReason: match.reason,
      manualNotes: allFieldNotes,
    };
  });
}

// Build all comparison groups for PIB vs each supporting document
export function buildAllComparisonGroups(
  pibDoc: BatchDocumentModel,
  supportingDocs: BatchDocumentModel[],
  equivalencyGroups: DbEquivalencyGroup[] = []
): DocumentComparisonGroup[] {
  // Matching now operates strictly on header fields (table line items are not pulled)
  return supportingDocs.map((supDoc) => {
    const fields = buildComparisonFields(pibDoc, supDoc, equivalencyGroups);
    const matchedCount = fields.filter((f) => f.status === "MATCH").length;
    const mismatchedCount = fields.filter((f) => f.status === "MISMATCH").length;

    return {
      docCode: supDoc.code,
      docName: supDoc.name,
      supportingDoc: supDoc,
      fields,
      matchedCount,
      mismatchedCount,
      lineItems: [],
      lineItemsMatchedCount: 0,
      lineItemsMismatchedCount: 0,
    };
  });
}

export interface BatchComparisonEvaluationResult {
  status: "Matching" | "Mismatching" | "Proses";
  docStatuses: Record<string, { status: "Match" | "Mismatch" | "Proses" | "-" }>;
  totalFields: number;
  matchedFields: number;
  mismatchedFields: number;
  docs: Record<
    string,
    {
      matchedCount: number;
      mismatchedCount: number;
      totalCount: number;
      status: "Match" | "Mismatch" | "Proses" | "-";
    }
  >;
  allFields: Array<{
    documentType: string;
    fieldName: string;
    pibValue: string;
    targetValue: string;
    status: "MATCH" | "MISMATCH";
    notes?: string;
  }>;
}

export function evaluateBatchComparison(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawBatch: any,
  equivalencyGroups: DbEquivalencyGroup[] = []
): BatchComparisonEvaluationResult {
  const docStatuses: Record<string, { status: "Match" | "Mismatch" | "Proses" | "-" }> = {
    Invoice: { status: "-" },
    Bill_of_Lading: { status: "-" },
  };

  const docsSummary: Record<
    string,
    {
      matchedCount: number;
      mismatchedCount: number;
      totalCount: number;
      status: "Match" | "Mismatch" | "Proses" | "-";
    }
  > = {};

  const allFields: Array<{
    documentType: string;
    fieldName: string;
    pibValue: string;
    targetValue: string;
    status: "MATCH" | "MISMATCH";
    notes?: string;
  }> = [];

  const details = Array.isArray(rawBatch?.details) ? rawBatch.details : [];
  if (details.length === 0) {
    return {
      status: "Proses",
      docStatuses,
      totalFields: 0,
      matchedFields: 0,
      mismatchedFields: 0,
      docs: docsSummary,
      allFields,
    };
  }

  const model = adaptBatchToModel(rawBatch);

  const docCodeToKey = (code: string): string | null => {
    const c = (code || "").toUpperCase();
    if (c === "INVOICE" || c === "CI") return "Invoice";
    if (c === "BL" || c.includes("LADING")) return "Bill_of_Lading";
    return null;
  };

  let totalFields = 0;
  let matchedFields = 0;
  let mismatchedFields = 0;
  let hasAnySupporting = false;
  let hasAnyMismatch = false;
  let hasAnyProses = false;

  for (const sup of model.supporting) {
    const colKey = docCodeToKey(sup.code);
    if (!colKey) continue;
    hasAnySupporting = true;

    // Check if doc is still processing (empty isi)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawDet = details.find((d: any) => d.id === sup.id);
    if (!rawDet?.isi || (typeof rawDet.isi === "string" && !rawDet.isi.trim())) {
      docStatuses[colKey] = { status: "Proses" };
      hasAnyProses = true;
      continue;
    }

    const fields = buildComparisonFields(model.pib, sup, equivalencyGroups);
    const m = fields.filter((f) => f.status === "MATCH").length;
    const mis = fields.filter((f) => f.status === "MISMATCH").length;

    totalFields += fields.length;
    matchedFields += m;
    mismatchedFields += mis;

    for (const f of fields) {
      allFields.push({
        documentType: sup.code,
        fieldName: f.label,
        pibValue: f.pibValue,
        targetValue: f.supportingValue,
        status: f.status === "MATCH" ? "MATCH" : "MISMATCH",
        notes: f.matchReason || (f.status === "MATCH" ? "Data sesuai" : "Nilai berbeda dengan acuan PIB"),
      });
    }

    let docStatus: "Match" | "Mismatch" | "Proses" | "-" = "-";
    if (fields.length === 0) {
      docStatus = "Proses";
      hasAnyProses = true;
    } else if (mis > 0) {
      docStatus = "Mismatch";
      hasAnyMismatch = true;
    } else {
      docStatus = "Match";
    }

    docStatuses[colKey] = { status: docStatus };
    docsSummary[colKey] = {
      matchedCount: m,
      mismatchedCount: mis,
      totalCount: fields.length,
      status: docStatus,
    };
  }

  let overallStatus: "Matching" | "Mismatching" | "Proses" = "Matching";
  if (!hasAnySupporting || hasAnyProses) {
    overallStatus = "Proses";
  } else if (hasAnyMismatch) {
    overallStatus = "Mismatching";
  } else {
    overallStatus = "Matching";
  }

  return {
    status: overallStatus,
    docStatuses,
    totalFields,
    matchedFields,
    mismatchedFields,
    docs: docsSummary,
    allFields,
  };
}