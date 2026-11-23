import { isEquivalentMatch, type DbEquivalencyGroup } from "./valueEquivalency";
import { cleanVal, cleanNum } from "./itemMatcher";
import type { ManualNote } from "~/app/matching/_components/detailTypes";

export interface FieldComparisonResult {
  documentType: string;
  fieldName: string;
  pibValue: string;
  targetValue: string;
  status: "MATCH" | "MISMATCH" | "INFO";
  isMatch: boolean;
  usedActionValue: boolean;
  notes: string;
  acuanDocument?: string;
}

export interface StandardLineItem {
  itemIndex: number;
  hsCode: string;
  partNo: string;
  spec: string;
  size: string;
  desc: string;
  qty: string;
  unit: string;
  netWeight: string;
  grossWeight: string;
  price: string;
  coilNo?: string;
  heatNo?: string;
  originCriterion?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: Record<string, any>;
  usedAction: boolean;
  actionNotes?: Record<string, { original: string; transformed: string; note: string }>;
  manualNotes?: ManualNote[];
}

export interface MatchedItemResult {
  pibItemIndex: number;
  pibItem: StandardLineItem;
  targetDocType: string;
  targetItemIndex?: number;
  targetItem?: StandardLineItem;
  isMatch: boolean;
  hsCodeMatch: boolean;
  partMatch: boolean;
  qtyMatch: boolean;
  weightMatch: boolean;
  priceMatch?: boolean;
  discrepancies: string[];
}

export interface CanonicalBatchReport {
  batchId: string;
  status: "MATCHING" | "MISMATCHING" | "PROSES";
  uiStatus: "Matching" | "Mismatching" | "Proses";
  headerComparison: Record<string, FieldComparisonResult[]>;
  itemComparison: Record<string, MatchedItemResult[]>;
  allFields: FieldComparisonResult[];
  mismatches: FieldComparisonResult[];
  itemMismatches: MatchedItemResult[];
  summary: {
    totalDocuments: number;
    matchedDocuments: number;
    totalPibItems: number;
    matchedPibItems: number;
    discrepancyCount: number;
  };
}

/**
 * Normalizes field names for flexible key matching.
 * Handles spaces, underscores, casing.
 */
function normKey(k: string): string {
  return k.toLowerCase().replace(/[\s_-]+/g, "");
}

/**
 * Extracts a value from a fields object with case-insensitive and alias lookup.
 * Prioritizes [key]_action over original [key].
 */
export function getFieldVal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: Record<string, any> | undefined | null,
  ...keys: string[]
): { value: string; usedAction: boolean; originalValue?: string } {
  if (!fields || typeof fields !== "object") {
    return { value: "-", usedAction: false };
  }

  // Helper to find raw value for keys
  const findRawVal = (): string | undefined => {
    for (const k of keys) {
      if (fields[k] !== undefined && fields[k] !== null && String(fields[k]).trim() !== "") {
        const rawVal = fields[k];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const strVal = typeof rawVal === "object" && rawVal !== null ? (rawVal as any).value : rawVal;
        if (strVal !== undefined && strVal !== null && String(strVal).trim() !== "") {
          return String(strVal).trim();
        }
      }
    }
    for (const k of keys) {
      const cleanK = normKey(k);
      for (const [fk, fv] of Object.entries(fields)) {
        if (fv === undefined || fv === null || String(fv).trim() === "") continue;
        const lower = fk.toLowerCase().trim();
        if (!lower.endsWith("_action") && !lower.endsWith(" action")) {
          if (normKey(fk) === cleanK) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const strVal = typeof fv === "object" && fv !== null ? (fv as any).value : fv;
            if (strVal !== undefined && strVal !== null && String(strVal).trim() !== "") {
              return String(strVal).trim();
            }
          }
        }
      }
    }
    return undefined;
  };

  // 1. First priority: Check exact _action keys in requested order
  for (const k of keys) {
    const actionKey = `${k}_action`;
    if (fields[actionKey] !== undefined && fields[actionKey] !== null && String(fields[actionKey]).trim() !== "") {
      const rawVal = fields[actionKey];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const strVal = typeof rawVal === "object" && rawVal !== null ? (rawVal as any).value : rawVal;
      if (strVal !== undefined && strVal !== null && String(strVal).trim() !== "") {
        const transVal = String(strVal).trim();
        const origVal = findRawVal();
        return { value: transVal, usedAction: true, originalValue: origVal };
      }
    }
    const spaceActionKey = `${k} action`;
    if (fields[spaceActionKey] !== undefined && fields[spaceActionKey] !== null && String(fields[spaceActionKey]).trim() !== "") {
      const rawVal = fields[spaceActionKey];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const strVal = typeof rawVal === "object" && rawVal !== null ? (rawVal as any).value : rawVal;
      if (strVal !== undefined && strVal !== null && String(strVal).trim() !== "") {
        const transVal = String(strVal).trim();
        const origVal = findRawVal();
        return { value: transVal, usedAction: true, originalValue: origVal };
      }
    }
  }

  // 2. Normalized _action keys
  for (const k of keys) {
    const cleanK = normKey(k);
    for (const [fk, fv] of Object.entries(fields)) {
      if (fv === undefined || fv === null || String(fv).trim() === "") continue;
      const lower = fk.toLowerCase().trim();
      if (lower.endsWith("_action") || lower.endsWith(" action")) {
        const baseKey = normKey(lower.replace(/(_action|\s+action)$/i, ""));
        if (baseKey === cleanK) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const strVal = typeof fv === "object" && fv !== null ? (fv as any).value : fv;
          if (strVal !== undefined && strVal !== null && String(strVal).trim() !== "") {
            const transVal = String(strVal).trim();
            const origVal = findRawVal();
            return { value: transVal, usedAction: true, originalValue: origVal };
          }
        }
      }
    }
  }

  // 3. Exact raw key lookup
  for (const k of keys) {
    if (fields[k] !== undefined && fields[k] !== null && String(fields[k]).trim() !== "") {
      const rawVal = fields[k];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const strVal = typeof rawVal === "object" && rawVal !== null ? (rawVal as any).value : rawVal;
      if (strVal !== undefined && strVal !== null && String(strVal).trim() !== "") {
        return { value: String(strVal).trim(), usedAction: false };
      }
    }
  }

  // 4. Normalized raw key lookup
  for (const k of keys) {
    const cleanK = normKey(k);
    for (const [fk, fv] of Object.entries(fields)) {
      if (fv === undefined || fv === null || String(fv).trim() === "") continue;
      const lower = fk.toLowerCase().trim();
      if (!lower.endsWith("_action") && !lower.endsWith(" action")) {
        if (normKey(fk) === cleanK) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const strVal = typeof fv === "object" && fv !== null ? (fv as any).value : fv;
          if (strVal !== undefined && strVal !== null && String(strVal).trim() !== "") {
            return { value: String(strVal).trim(), usedAction: false };
          }
        }
      }
    }
  }

  return { value: "-", usedAction: false };
}

/**
 * Shorthand helper returning just the string value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getVal(fields: Record<string, any> | undefined | null, ...keys: string[]): string {
  return getFieldVal(fields, ...keys).value;
}

/**
 * Extracts a line item field, prioritizing [key]_action over raw [key].
 */
export function getItemField(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: Record<string, any> | undefined | null,
  ...keys: string[]
): { value: string; usedAction: boolean; originalValue?: string } {
  return getFieldVal(row, ...keys);
}

/**
 * Extracts a standardized line item from a table row of any document type.
 */
export function extractStandardLineItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: Record<string, any> | undefined | null,
  index = 0,
  _docType = "pib"
): StandardLineItem {
  if (!row || typeof row !== "object") {
    return {
      itemIndex: index,
      hsCode: "",
      partNo: "",
      spec: "",
      size: "",
      desc: "",
      qty: "",
      unit: "",
      netWeight: "",
      grossWeight: "",
      price: "",
      raw: {},
      usedAction: false,
    };
  }

  let usedAction = false;
  const actionNotes: Record<string, { original: string; transformed: string; note: string }> = {};

  // getF: resolve field value, prioritizing _action keys over raw, and record unique transformations.
  // The pre-scan loop has been removed to avoid duplicate actionNotes entries — getF already covers
  // all named fields with dedup checking by (original, transformed) pair value.
  const getF = (label: string, ...keys: string[]) => {
    const res = getItemField(row, ...keys);
    if (res.usedAction) {
      usedAction = true;
      if (res.originalValue && res.originalValue !== res.value) {
        const alreadyExists = Object.values(actionNotes).some(
          (an) =>
            an.original.trim() === res.originalValue!.trim() &&
            an.transformed.trim() === res.value.trim()
        );
        if (!alreadyExists) {
          actionNotes[label] = {
            original: res.originalValue,
            transformed: res.value,
            note: `Data Action: "${res.originalValue}" -> "${res.value}"`,
          };
        }
      }
    }
    return res.value === "-" ? "" : res.value;
  };

  const hsCode = getF("hsCode", "Pos_Tarif", "HS_Code", "HS", "Pos Tarif", "hs code", "pos_tarif");
  const partNo = getF("partNo", "Kode_Barang", "Part_No", "No_Part", "Kode Barang", "part no", "part_no", "no part");
  const spec = getF("spec", "Spesifikasi_Grade", "Spek_Material", "Specification", "Spec", "Spesifikasi", "grade");
  const size = getF("size", "Ukuran_Barang", "Size", "Dimensi", "Ukuran", "dimension");
  const desc = getF("desc", "Uraian_Barang", "Description", "Desc", "Part_Desc", "Uraian", "deskripsi barang");
  const qty = getF("qty", "Jumlah_Satuan_Barang", "Jumlah_Satuan_Coil", "Satuan_Coil", "Jumlah_Barang", "QTY", "Jumlah", "qty", "jumlah coil");
  const unit = getF("unit", "Jenis_Satuan", "Unit", "Satuan", "sat");
  const netWeight = getF("netWeight", "Berat_Bersih_Item", "Jumlah_Satuan_Barang", "Net_Weight", "Total_Net_Weight", "Berat_Bersih", "weight", "net weight", "berat kuantitas", "berat_kuantitas");
  const grossWeight = getF("grossWeight", "Gross_Weight", "Total_Gross_Weight", "Berat_Kotor", "Berat_Bersih_Item", "gross weight");
  const price = getF("price", "Harga_Satuan", "Nilai_Pabean", "Price", "Unit_Price", "unit price", "nilai barang");
  const coilNo = getF("coilNo", "No_Coil", "Coil_No", "Coil_Number", "Marks", "marks", "coil no");
  const heatNo = getF("heatNo", "No_Heat", "Heat_No", "Heat_Number", "heat no");
  const originCriterion = getF("originCriterion", "Kriteria_Asal_Barang", "Origin_Criterion", "kriteria asal barang");

  // Fallback dimension and grade extraction from description text (e.g. Form AK)
  let finalSize = size;
  let finalSpec = spec;
  if (!finalSize && desc) {
    const dimMatch = desc.match(/(\d+(?:\.\s*[0-9oO]+)?\s*(?:mm)?\s*[xX*×]\s*\d+(?:\.\s*[0-9oO]+)?\s*(?:mm)?\s*[xX*×]\s*[a-zA-Z0-9]+)/i);
    if (dimMatch && dimMatch[1]) {
      finalSize = dimMatch[1];
    }
  }
  if (!finalSpec && desc) {
    const gradeMatch = desc.match(/\b(J[A-Z0-9]{4,10}|SP[A-Z0-9]{3,8})\b/i);
    if (gradeMatch && gradeMatch[1]) {
      finalSpec = gradeMatch[1];
    }
  }

  return {
    itemIndex: index,
    hsCode,
    partNo: partNo || finalSpec || coilNo || heatNo,
    spec: finalSpec,
    size: finalSize,
    desc,
    qty,
    unit,
    netWeight,
    grossWeight,
    price,
    coilNo: coilNo || undefined,
    heatNo: heatNo || undefined,
    originCriterion: originCriterion || undefined,
    raw: row,
    usedAction,
    actionNotes: Object.keys(actionNotes).length > 0 ? actionNotes : undefined,
  };
}

/**
 * Strict Item-Level Matcher: compares supporting document items against PIB reference items.
 * ELIMINATES false auto-matches:
 * - NO row-index fallback (Pass 4 removed).
 * - NO match on HS code alone when quantity/weight is empty or differing.
 */
/**
 * Strict Item-Level Matcher: compares supporting document items against PIB reference items.
 * ELIMINATES false auto-matches:
 * - NO row-index fallback (Pass 4 removed).
 * - NO match on HS code alone when quantity/weight is empty or differing.
 * - Prioritizes size/dimensions, part number/grade, and HS code + quantity.
 */
// Helper to normalize dimensions / sizes for robust cross-document comparison
export function cleanDimension(s?: string | null): string {
  if (!s) return "";
  let str = String(s).toLowerCase();
  // OCR fix: "1. O" or "1. o" -> "1.0"
  str = str.replace(/\.\s*[oO]/gi, ".0");
  // Remove unit "mm" (with or without spaces/boundary)
  str = str.replace(/mm/gi, "");
  // Remove other units if tokenized
  str = str.replace(/\b(?:cm|mtr|m|inch)\b/gi, "");
  // Normalize 'x' or '*' separators
  str = str.replace(/[*×]/g, "x");
  // Remove all whitespace
  str = str.replace(/\s+/g, "");
  // Keep only alphanumeric and dots
  str = str.replace(/[^a-z0-9.]/g, "");
  return str;
}

export function matchDocumentItemsStrict(
  pibItems: StandardLineItem[],
  targetItems: StandardLineItem[],
  targetDocType: string,
  customRules?: DbEquivalencyGroup[]
): MatchedItemResult[] {
  const matchedPibIndices = new Set<number>();
  const matchedTargetIndices = new Set<number>();
  const results: MatchedItemResult[] = [];

  const isWl = targetDocType.toLowerCase() === "wl" || targetDocType.toLowerCase().includes("weight");
  const isBl = targetDocType.toLowerCase() === "bl" || targetDocType.toLowerCase().includes("lading");

  // For Weight List (WL), items represent individual coils.
  // Verify each coil row has valid coil identifier (and net weight if present in line items).
  if (isWl) {
    for (let t = 0; t < targetItems.length; t++) {
      const tItem = targetItems[t]!;
      const hasCoil = Boolean(tItem.coilNo || tItem.partNo);
      const rowHasWeight = Boolean(cleanNum(tItem.netWeight) || cleanNum(tItem.grossWeight));
      const isMatch = hasCoil;
      results.push({
        pibItemIndex: Math.min(t, Math.max(0, pibItems.length - 1)),
        pibItem: pibItems[Math.min(t, Math.max(0, pibItems.length - 1))] || pibItems[0]!,
        targetDocType,
        targetItemIndex: t,
        targetItem: tItem,
        isMatch,
        hsCodeMatch: true,
        partMatch: hasCoil,
        qtyMatch: true,
        weightMatch: !tItem.netWeight || rowHasWeight,
        discrepancies: hasCoil ? [] : [`Nomor coil baris #${t + 1} tidak terdeteksi`],
      });
    }
    return results;
  }

  // For Bill of Lading (BL), items represent the aggregate shipment container/package cargo.
  if (isBl) {
    for (let t = 0; t < targetItems.length; t++) {
      const tItem = targetItems[t]!;
      const hasMarks = Boolean(tItem.coilNo || tItem.partNo || tItem.desc);
      results.push({
        pibItemIndex: 0,
        pibItem: pibItems[0] || {
          itemIndex: 0,
          hsCode: "-",
          partNo: "-",
          spec: "-",
          size: "-",
          desc: "-",
          qty: "-",
          unit: "-",
          netWeight: "-",
          grossWeight: "-",
          price: "-",
          raw: {},
          usedAction: false,
        },
        targetDocType,
        targetItemIndex: t,
        targetItem: tItem,
        isMatch: hasMarks,
        hsCodeMatch: true,
        partMatch: true,
        qtyMatch: true,
        weightMatch: true,
        discrepancies: hasMarks ? [] : [`Cargo BL baris #${t + 1} tidak memiliki marks`],
      });
    }
    return results;
  }

  // Helper to determine if an item key matches between PIB and target document
  const isKeyMatch = (p: StandardLineItem, t: StandardLineItem) => {
    // 1. Size / Dimensions match (e.g. 1.0 MM X 821 MM X C vs 1.0x821xC)
    const pDim = cleanDimension(p.size);
    const tDim = cleanDimension(t.size);
    if (pDim && tDim) {
      if (pDim !== tDim) {
        return false;
      }
      // Sizes match! If both have grade/spec, verify compatibility (allow substring e.g. "JSC270C" in "JSC270C \nBK089112 001")
      const pSpec = cleanVal(p.spec);
      const tSpec = cleanVal(t.spec);
      if (
        pSpec &&
        tSpec &&
        pSpec !== tSpec &&
        !tSpec.includes(pSpec) &&
        !pSpec.includes(tSpec) &&
        !isEquivalentMatch(p.spec, t.spec, "GRADE", customRules).isMatch
      ) {
        return false;
      }
      return true;
    }

    // 2. Part Number / Kode Barang match (exact match)
    const pPart = cleanVal(p.partNo);
    const tPart = cleanVal(t.partNo);
    if (pPart && tPart && pPart === tPart) {
      return true;
    }

    return false;
  };

  // Target-Driven Line Item Matching:
  // Dokumen pembanding (targetItems) adalah patokan / acuan daftar baris yang harus divalidasi.
  // PIB bertindak sebagai validator yang mencocokkan tiap baris dokumen pembanding.
  for (let t = 0; t < targetItems.length; t++) {
    const tItem = targetItems[t]!;
    let bestPibIdx = -1;

    // 1. Strict Key (Size / Part / Desc) Match
    for (let p = 0; p < pibItems.length; p++) {
      if (matchedPibIndices.has(p)) continue;
      if (isKeyMatch(pibItems[p]!, tItem)) {
        bestPibIdx = p;
        break;
      }
    }

    // 2. Material Specification / Grade Match
    if (bestPibIdx === -1 && tItem.spec) {
      for (let p = 0; p < pibItems.length; p++) {
        if (matchedPibIndices.has(p)) continue;
        if (pibItems[p]!.spec && isEquivalentMatch(pibItems[p]!.spec, tItem.spec, "GRADE", customRules).isMatch) {
          bestPibIdx = p;
          break;
        }
      }
    }

    // 3. HS Code + Quantity Match
    if (bestPibIdx === -1) {
      const tHsClean = cleanVal(tItem.hsCode);
      const tQtyClean = cleanNum(tItem.qty);
      if (tHsClean && tQtyClean) {
        for (let p = 0; p < pibItems.length; p++) {
          if (matchedPibIndices.has(p)) continue;
          const pItem = pibItems[p]!;
          const pHsClean = cleanVal(pItem.hsCode);
          const pQtyClean = cleanNum(pItem.qty);
          if (pHsClean === tHsClean && pQtyClean === tQtyClean) {
            const pSizeClean = cleanVal(pItem.size);
            const tSizeClean = cleanVal(tItem.size);
            if (pSizeClean && tSizeClean && pSizeClean !== tSizeClean) continue;
            const pPartClean = cleanVal(pItem.partNo);
            const tPartClean = cleanVal(tItem.partNo);
            if (pPartClean && tPartClean && pPartClean !== tPartClean) continue;
            bestPibIdx = p;
            break;
          }
        }
      }
    }

    if (bestPibIdx !== -1) {
      matchedPibIndices.add(bestPibIdx);
      matchedTargetIndices.add(t);
      const pItem = pibItems[bestPibIdx]!;

      const pQty = cleanNum(pItem.qty);
      const tQty = cleanNum(tItem.qty);
      const qtyMatched = !pQty || !tQty || pQty === tQty;

      const pWeight = cleanNum(pItem.netWeight);
      const tWeight = cleanNum(tItem.netWeight);
      const pWNum = parseFloat(pWeight);
      const tWNum = parseFloat(tWeight);
      const isWeightConv = !isNaN(pWNum) && !isNaN(tWNum) && pWNum > 0 && tWNum > 0 && (Math.abs(pWNum * 1000 - tWNum) < 1 || Math.abs(tWNum * 1000 - pWNum) < 1);
      const weightMatched = !pWeight || !tWeight || pWeight === tWeight || isWeightConv;

      const pHsClean = cleanVal(pItem.hsCode);
      const tHsClean = cleanVal(tItem.hsCode);
      // HS code match: exact match OR 6-digit sub-heading prefix match (e.g. Form AK 7210.49 vs PIB 72104911)
      const hsMatched =
        !pHsClean ||
        !tHsClean ||
        pHsClean === tHsClean ||
        (pHsClean.length >= 6 && tHsClean.length >= 6 && (pHsClean.startsWith(tHsClean.slice(0, 6)) || tHsClean.startsWith(pHsClean.slice(0, 6))));

      const pPart = cleanVal(pItem.partNo);
      const tPart = cleanVal(tItem.partNo);
      const isMsDoc = targetDocType.toLowerCase() === "ms" || targetDocType.toLowerCase().includes("mill");
      const isPartEquivalent =
        !pPart ||
        !tPart ||
        pPart === tPart ||
        pPart.includes(tPart) ||
        tPart.includes(pPart) ||
        (isMsDoc && Boolean(tItem.heatNo)) || // in MS, heatNo is furnace number, not partNo
        isEquivalentMatch(pItem.partNo, tItem.partNo, "GRADE", customRules).isMatch;
      const partMatched = isPartEquivalent;

      const pPriceNum = parseFloat(cleanNum(pItem.price) || "0");
      const tPriceNum = parseFloat(cleanNum(tItem.price) || "0");
      const pQtyNum = parseFloat(cleanNum(pItem.qty) || "0");
      // Direct price match OR unit price * qty equals total price (e.g. Invoice $885.61 * 18.36 MT = PIB $16,259.80)
      const priceDirectMatch = !pPriceNum || !tPriceNum || pPriceNum === tPriceNum;
      const priceCalcMatch =
        pQtyNum > 0 &&
        pPriceNum > 0 &&
        tPriceNum > 0 &&
        Math.abs(tPriceNum * pQtyNum - pPriceNum) / pPriceNum < 0.02;
      const priceMatched = priceDirectMatch || priceCalcMatch;

      const discrepancies: string[] = [];
      if (pHsClean && tHsClean && !hsMatched) {
        discrepancies.push(`HS Code berbeda: PIB "${pItem.hsCode}" ≠ ${targetDocType} "${tItem.hsCode}"`);
      }
      if (pPart && tPart && !isPartEquivalent) {
        discrepancies.push(`Part No berbeda: PIB "${pItem.partNo}" ≠ ${targetDocType} "${tItem.partNo}"`);
      }
      if (pQty && tQty && pQty !== tQty) {
        discrepancies.push(`Jumlah Qty berbeda: PIB "${pItem.qty}" ≠ ${targetDocType} "${tItem.qty}"`);
      }
      if (pWeight && tWeight && pWeight !== tWeight) {
        discrepancies.push(`Berat berbeda: PIB "${pItem.netWeight}" ≠ ${targetDocType} "${tItem.netWeight}"`);
      }
      if (!priceMatched) {
        discrepancies.push(`Harga satuan berbeda: PIB "${pItem.price}" ≠ ${targetDocType} "${tItem.price}"`);
      }

      results.push({
        pibItemIndex: bestPibIdx,
        pibItem: pItem,
        targetDocType,
        targetItemIndex: t,
        targetItem: tItem,
        isMatch: discrepancies.length === 0,
        hsCodeMatch: hsMatched,
        partMatch: partMatched,
        qtyMatch: qtyMatched,
        weightMatch: weightMatched,
        priceMatch: priceMatched,
        discrepancies,
      });
    } else {
      results.push({
        pibItemIndex: -1,
        pibItem: {
          itemIndex: -1,
          hsCode: "-",
          partNo: "-",
          spec: "-",
          size: "-",
          desc: "-",
          qty: "-",
          unit: "-",
          netWeight: "-",
          grossWeight: "-",
          price: "-",
          raw: {},
          usedAction: false,
        },
        targetDocType,
        targetItemIndex: t,
        targetItem: tItem,
        isMatch: false,
        hsCodeMatch: false,
        partMatch: false,
        qtyMatch: false,
        weightMatch: false,
        discrepancies: [`Item pembanding baris #${t + 1} tidak ditemukan di PIB`],
      });
    }
  }

  return results;
}

/**
 * Parses JSON isi safely into fields and table.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDocIsi(isi?: string | null): { fields: Record<string, any>; table: Array<Record<string, any>> } {
  if (!isi || typeof isi !== "string" || !isi.trim()) {
    return { fields: {}, table: [] };
  }
  try {
    const parsed = JSON.parse(isi);
    return {
      fields: (parsed?.fields && typeof parsed.fields === "object" ? parsed.fields : {}) as Record<string, any>,
      table: (Array.isArray(parsed?.table) ? parsed.table : []) as Array<Record<string, any>>,
    };
  } catch {
    return { fields: {}, table: [] };
  }
}

/**
 * Compares a single field between PIB and a supporting document.
 * Adheres strictly to the rule: missing values ("-", "", undefined) NEVER evaluate to true.
 */
export function compareFieldStrict(
  docType: string,
  fieldName: string,
  pibVal: string,
  compVal: string,
  usedAction = false,
  customRules?: DbEquivalencyGroup[],
  isCritical = false
): FieldComparisonResult {
  const sPib = (pibVal || "-").trim();
  const sComp = (compVal || "-").trim();

  // Missing values never evaluate to true against real values
  if (sPib === "-" || sComp === "-") {
    const status = isCritical ? "MISMATCH" : "INFO";
    const note = sPib === "-"
      ? `Field ${fieldName} tidak tercantum pada dokumen PIB`
      : `Field ${fieldName} tidak ditemukan pada ${docType}`;

    return {
      documentType: docType,
      fieldName,
      pibValue: sPib,
      targetValue: sComp,
      status,
      isMatch: false,
      usedActionValue: usedAction,
      notes: note,
    };
  }

  const eq = isEquivalentMatch(sPib, sComp, fieldName, customRules);
  if (eq.isMatch) {
    return {
      documentType: docType,
      fieldName,
      pibValue: sPib,
      targetValue: sComp,
      status: "MATCH",
      isMatch: true,
      usedActionValue: usedAction,
      notes: eq.reason ? `Cocok (${eq.reason})` : "Cocok (Matching)",
    };
  }

  return {
    documentType: docType,
    fieldName,
    pibValue: sPib,
    targetValue: sComp,
    status: "MISMATCH",
    isMatch: false,
    usedActionValue: usedAction,
    notes: `Perbedaan Nilai: PIB ("${sPib}") ≠ ${docType} ("${sComp}")`,
  };
}

/**
 * Evaluates the full canonical matching report across all 7 USC documents.
 * This is the SINGLE CANONICAL TRUTH used by Webhook, REST API, and UI.
 */
export function evaluateCanonicalBatchMatching(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Array<{ fileType: string; isi?: string | null; [key: string]: any }>,
  totalFile?: number,
  batchId = "0",
  customRules?: DbEquivalencyGroup[]
): CanonicalBatchReport {
  if (!details || !Array.isArray(details) || details.length === 0) {
    return createEmptyReport(batchId, "PROSES");
  }

  // 1. Check completeness
  const expectedTotal = totalFile && totalFile > 0 ? totalFile : details.length;
  const filledDetails = details.filter((d) => {
    if (!d.isi || typeof d.isi !== "string" || !d.isi.trim()) return false;
    try {
      const p = JSON.parse(d.isi);
      const hasFields = p?.fields && Object.keys(p.fields).length > 0 && Object.values(p.fields).some((v) => v && String(v).trim() !== "" && String(v).trim() !== "-");
      const hasTable = Array.isArray(p?.table) && p.table.length > 0;
      return hasFields || hasTable;
    } catch {
      return false;
    }
  });

  // If not all expected files are parsed, batch is still in PROSES
  if (details.length < expectedTotal || filledDetails.length < details.length) {
    return createEmptyReport(batchId, "PROSES");
  }

  // 2. Identify PIB reference document
  const pibDet = details.find((d) => {
    const ft = (d.fileType || "").trim().toLowerCase();
    return ft === "pib" || ft.includes("file acuan") || ft.startsWith("pib");
  });

  const supportingDetails = details.filter((d) => {
    const ft = (d.fileType || "").trim().toLowerCase();
    return ft !== "pib" && !ft.includes("file acuan") && !ft.startsWith("pib");
  });

  if (!pibDet || supportingDetails.length === 0) {
    return createEmptyReport(batchId, "PROSES");
  }

  const pibData = parseDocIsi(pibDet.isi);

  // Enrich PIB fields with row 0 item values so single-item matching fields (WL, MS) can compare accurately
  if (Array.isArray(pibData.table) && pibData.table.length > 0) {
    const row0 = pibData.table[0];
    if (!pibData.fields.Jumlah_Satuan_Coil && (row0.Jumlah_Satuan_Coil || row0.Jumlah_Satuan_Coil_action)) {
      pibData.fields.Jumlah_Satuan_Coil = row0.Jumlah_Satuan_Coil_action || row0.Jumlah_Satuan_Coil;
    }
    if (!pibData.fields.Berat_Bersih_Item && (row0.Jumlah_Satuan_Barang || row0.Jumlah_Satuan_Barang_action)) {
      pibData.fields.Berat_Bersih_Item = row0.Jumlah_Satuan_Barang_action || row0.Jumlah_Satuan_Barang;
    }
    if (!pibData.fields.Spesifikasi_Grade && (row0.Spesifikasi_Grade || row0.Spesifikasi_Grade_action)) {
      pibData.fields.Spesifikasi_Grade = row0.Spesifikasi_Grade_action || row0.Spesifikasi_Grade;
    }
    if (!pibData.fields.Ukuran_Barang && (row0.Ukuran_Barang || row0.Ukuran_Barang_action)) {
      pibData.fields.Ukuran_Barang = row0.Ukuran_Barang_action || row0.Ukuran_Barang;
    }
  }

  const pibItems: StandardLineItem[] = [];

  const headerComparison: Record<string, FieldComparisonResult[]> = {};
  const itemComparison: Record<string, MatchedItemResult[]> = {};
  const allFields: FieldComparisonResult[] = [];
  const mismatches: FieldComparisonResult[] = [];
  const allItemDiscrepancies: MatchedItemResult[] = [];

  let matchedDocsCount = 0;

  // Pre-parse supporting documents for cross-document SOP checks
  let invDocData: { fields: Record<string, any>; table: any[] } | null = null;
  let plDocData: { fields: Record<string, any>; table: any[] } | null = null;
  let blDocData: { fields: Record<string, any>; table: any[] } | null = null;
  let wlDocData: { fields: Record<string, any>; table: any[] } | null = null;
  let msDocData: { fields: Record<string, any>; table: any[] } | null = null;

  for (const det of supportingDetails) {
    const sFt = (det.fileType || "").toLowerCase();
    if (sFt.includes("invoice") || sFt === "ci") invDocData = parseDocIsi(det.isi);
    else if ((sFt.includes("packing") || sFt.includes("paking") || sFt === "pl") && !sFt.includes("wl")) plDocData = parseDocIsi(det.isi);
    else if (sFt === "bl" || sFt.includes("lading") || sFt.includes("ladding") || (sFt.includes("bl") && !sFt.includes("wl"))) blDocData = parseDocIsi(det.isi);
    else if (sFt === "wl" || sFt.includes("weight") || sFt.includes("wl")) wlDocData = parseDocIsi(det.isi);
    else if (sFt === "ms" || sFt === "mtc" || sFt.includes("mill") || sFt.includes("test") || sFt.includes("sheet")) msDocData = parseDocIsi(det.isi);
  }

  // 3. Compare each supporting document against PIB
  for (const det of supportingDetails) {
    const ftRaw = (det.fileType || "").trim();
    const ft = ftRaw.toLowerCase();
    const data = parseDocIsi(det.isi);
    const docFields: FieldComparisonResult[] = [];

    // Helper to evaluate and record a header field check
    const checkH = (fieldName: string, pibKeys: string[], targetKeys: string[], isCritical = false) => {
      let targetRes = getFieldVal(data.fields, ...targetKeys);
      if ((!targetRes.value || targetRes.value === "-") && Array.isArray(data.table) && data.table.length > 0) {
        targetRes = getFieldVal(data.table[0], ...targetKeys);
      }

      // If target field is missing from this supporting doc
      if (!targetRes.value || targetRes.value === "-") {
        let pibRes = getFieldVal(pibData.fields, ...pibKeys);
        if ((!pibRes.value || pibRes.value === "-") && Array.isArray(pibData.table) && pibData.table.length > 0) {
          pibRes = getFieldVal(pibData.table[0], ...pibKeys);
        }
        const res = compareFieldStrict(ftRaw, fieldName, pibRes.value, "-", false, customRules, isCritical);
        docFields.push(res);
        allFields.push(res);
        if (res.status === "MISMATCH") mismatches.push(res);
        return;
      }

      // Check candidate pibKeys: pick the first one that MATCHES, or fallback to the first candidate that has a value
      let bestRes: FieldComparisonResult | null = null;
      for (const pk of pibKeys) {
        let candPib = getFieldVal(pibData.fields, pk);
        if ((!candPib.value || candPib.value === "-") && Array.isArray(pibData.table) && pibData.table.length > 0) {
          candPib = getFieldVal(pibData.table[0], pk);
        }
        if (candPib.value && candPib.value !== "-") {
          const candComparison = compareFieldStrict(
            ftRaw,
            fieldName,
            candPib.value,
            targetRes.value,
            candPib.usedAction || targetRes.usedAction,
            customRules,
            isCritical
          );
          if (candComparison.status === "MATCH") {
            bestRes = candComparison;
            break;
          }
          if (!bestRes) {
            bestRes = candComparison;
          }
        }
      }

      if (!bestRes) {
        bestRes = compareFieldStrict(ftRaw, fieldName, "-", targetRes.value, false, customRules, isCritical);
      }

      docFields.push(bestRes);
      allFields.push(bestRes);
      if (bestRes.status === "MISMATCH") {
        mismatches.push(bestRes);
      }
    };

    // Helper to evaluate and record cross-document SOP field check (when Acuan is another supporting document)
    const checkSOP = (
      fieldName: string,
      acuanDocName: string,
      acuanFields: Record<string, any> | undefined | null,
      acuanKeys: string[],
      targetKeys: string[],
      isCritical = false
    ) => {
      if (!acuanFields) return;
      const acuanRes = getFieldVal(acuanFields, ...acuanKeys);
      const targetRes = getFieldVal(data.fields, ...targetKeys);

      if ((!acuanRes.value || acuanRes.value === "-") && (!targetRes.value || targetRes.value === "-")) {
        return;
      }

      const sAcuan = acuanRes.value || "-";
      const sTarget = targetRes.value || "-";

      if (sAcuan === "-" || sTarget === "-") {
        const res: FieldComparisonResult = {
          documentType: ftRaw,
          fieldName,
          pibValue: sAcuan,
          targetValue: sTarget,
          status: isCritical ? "MISMATCH" : "INFO",
          isMatch: false,
          usedActionValue: acuanRes.usedAction || targetRes.usedAction,
          notes: `Acuan SOP (${acuanDocName}): ${sAcuan === "-" ? `Field tidak tercantum pada ${acuanDocName}` : `Field tidak ditemukan pada ${ftRaw}`}`,
          acuanDocument: acuanDocName,
        };
        docFields.push(res);
        allFields.push(res);
        if (res.status === "MISMATCH") mismatches.push(res);
        return;
      }

      const eq = isEquivalentMatch(sAcuan, sTarget, fieldName, customRules);
      const res: FieldComparisonResult = {
        documentType: ftRaw,
        fieldName,
        pibValue: sAcuan,
        targetValue: sTarget,
        status: eq.isMatch ? "MATCH" : "MISMATCH",
        isMatch: eq.isMatch,
        usedActionValue: acuanRes.usedAction || targetRes.usedAction,
        notes: eq.isMatch
          ? (eq.reason ? `Cocok Acuan ${acuanDocName} (${eq.reason})` : `Cocok Acuan ${acuanDocName}`)
          : `Perbedaan Nilai: Acuan ${acuanDocName} ("${sAcuan}") ≠ ${ftRaw} ("${sTarget}")`,
        acuanDocument: acuanDocName,
      };
      docFields.push(res);
      allFields.push(res);
      if (res.status === "MISMATCH") mismatches.push(res);
    };

    // ─── Commercial Invoice (CI) ──────────────────────────────────────────────
    if (ft.includes("invoice") || ft === "ci") {
      // 1. Identitas penjual / supplier (Page 1 No. 1)
      checkH("Identitas_Penjual", ["Identitas_Penjual", "Nama_Penjual", "Nama_Pengirim", "Pengirim", "Supplier"], ["Identitas_Penjual", "Exporter", "Seller", "Shipper", "Supplier", "Nama_Penjual", "Identitas_Supplier"], false);
      // 2. Nomor invoice (Page 1 No. 2)
      checkH("No_Invoice", ["No_Invoice", "Invoice_Number", "Nomor_Invoice", "No Invoice"], ["No_Invoice", "Invoice_Number", "Invoice Number", "Nomor_Invoice"], false);
      // 3. Tanggal invoice (Page 1 No. 3)
      checkH("Tanggal_Invoice", ["Tanggal_Invoice", "Invoice_Date", "Tanggal Invoice"], ["Tanggal_Invoice", "Invoice_Date", "Invoice Date", "Tanggal"], false);
      // 4. Valuta (Page 3 No. 22)
      checkH("Valuta", ["Valuta", "Mata_Uang", "Currency", "Jenis_Valuta"], ["Valuta", "Mata_Uang", "Currency", "Curr"], false);
      // 5. Incoterms dan lokasi (Page 3 No. 23)
      checkH("Incoterms_Lokasi", ["Incoterms_Lokasi", "Incoterms", "Ket_FOB", "Cara_Penyerahan", "Terms_of_Delivery"], ["Incoterms_Lokasi", "Incoterms", "Terms_of_Delivery", "Delivery_Terms", "Cara_Penyerahan"], false);
      // 6. Nilai pabean (Page 3 No. 21)
      checkH("Nilai_Pabean", ["Nilai_Pabean", "Nilai_Total_Invoice", "Nilai Pabean", "Nilai Total"], ["Nilai_Total_Invoice", "Total", "Nilai Total", "Total_Amount", "Invoice_Total", "Nilai_Pabean", "Amount"], true);
      // 7. Jumlah coil (Page 3 No. 17)
      checkH("Jumlah_Coil", ["Jumlah_Coil", "Jumlah", "Jumlah_Kemasan", "Total_Packages"], ["Jumlah_Coil", "Total_Coils", "Jumlah", "QTY", "Total_Packages", "Coils"], true);
      // 8. Berat Bersih (Page 3 No. 19)
      checkH("Berat_Bersih", ["Berat_Bersih", "Net_Weight", "Total_Net_Weight"], ["Berat_Bersih", "Net_Weight", "Total_Net_Weight", "Net Weight", "N.W.", "Total_Jumlah_Berat"], true);
      // 9. Berat Kotor (Page 3 No. 18)
      checkH("Berat_Kotor", ["Berat_Kotor", "Gross_Weight", "Total_Gross_Weight"], ["Berat_Kotor", "Gross_Weight", "Total_Gross_Weight", "Gross Weight", "G.W."], true);
      // 10. Uraian barang (Page 1 No. 14)
      checkH("Uraian_Barang", ["Uraian_Barang", "Deskripsi_Barang", "Description", "Description_of_Goods"], ["Uraian_Barang", "Deskripsi_Barang", "Description", "Commodity", "Item_Description", "Description_of_Goods"], false);
      // 11. Ukuran barang (Page 2 No. 16)
      checkH("Ukuran_Barang", ["Ukuran_Barang", "Ukuran", "Size", "Dimension", "Dimensions", "Ukuran_Dimensi"], ["Ukuran_Barang", "Size", "Dimension", "Dimensions", "Ukuran", "Thickness", "Ukuran_Dimensi"], false);
      // 12. Spesifikasi / grade (Page 2 No. 15)
      checkH("Spesifikasi_Grade", ["Spesifikasi_Grade", "Spek_Material", "Spesifikasi", "Grade", "Specification"], ["Spesifikasi_Grade", "Spek_Material", "Spesifikasi", "Grade", "Specification", "Steel_Grade"], false);
      // 13. Jumlah Satuan Barang (Page 2 No. 25)
      checkH("Jumlah_Satuan_Barang", ["Jumlah_Satuan_Barang", "Berat_Bersih_Item", "Jumlah_Satuan_Barang_action", "Berat_Bersih"], ["Jumlah_Satuan_Barang", "Berat_Bersih_Item", "Net_Weight", "Total_Weight", "Weight", "Berat_Bersih", "Total_Net_Weight", "Berat_Coil"], false);
      // 14. Jumlah Satuan Coil (Page 2 No. 24)
      checkH("Jumlah_Satuan_Coil", ["Jumlah_Satuan_Coil", "Jumlah_Coil_Item", "Jumlah_Coil", "Total_Coils", "Coils", "Qty_Coil"], ["Jumlah_Satuan_Coil", "Jumlah_Coil_Item", "Jumlah_Coil", "Total_Coils", "Coils", "QTY", "Qty_Coil", "QTY_Coil"], false);
      // 15. Harga satuan (Page 2 No. 20)
      checkH("Harga_Satuan", ["Harga_Satuan", "Nilai_Pabean_Item", "Nilai_Barang", "Unit_Price", "Harga_Nilai_Pabean", "Nilai_Pabean"], ["Harga_Satuan", "Unit_Price", "Price", "Rate", "Amount", "Total_Price", "Nilai_Barang"], false);
    }
    // ─── Packing List (PL) ───────────────────────────────────────────────────
    else if ((ft.includes("packing") || ft.includes("paking") || ft === "pl") && !ft.includes("wl") && ft !== "wl") {
      // 1. Deskripsi barang (PIB Page 2-5 No.18 Uraian barang *)
      checkH("Deskripsi_Barang", ["Uraian_Barang", "Deskripsi_Barang", "Description"], ["Deskripsi_Barang", "Description", "Description_of_Goods"], false);
      // 2. Gross weight (PIB Page 1 No.16 Berat Kotor *)
      checkH("Gross_Weight", ["Berat_Kotor", "Total_Gross_Weight", "Gross_Weight"], ["Gross_Weight", "Total_Gross_Weight", "G.W.", "Gross Weight"], false);
      // 3. Identitas buyer (PIB Page 1 No.3 Pemilik Barang *)
      checkH("Identitas_Buyer", ["Pemilik_Barang", "Nama_Importir", "Consignee", "Importir", "Identitas_Pembeli", "Buyer"], ["Identitas_Buyer", "Buyer", "Consignee", "Identitas_Pembeli"], false);
      // 4. Identitas supplier (PIB Page 1 No.2 Identitas penjual / supplier *)
      checkH("Identitas_Supplier", ["Identitas_Penjual", "Nama_Pengirim", "Pengirim", "Nama_Penjual", "Supplier"], ["Identitas_Supplier", "Supplier", "Exporter", "Shipper", "Seller", "Identitas_Penjual"], false);
      // 5. Jumlah coil (PIB Page 1 No.14 Jumlah coil *)
      checkH("Jumlah_Coil", ["Jumlah_Coil", "Jumlah", "Jumlah_Kemasan"], ["Jumlah_Coil", "Total_Coils", "Coils", "Qty_Coil", "Jumlah"], false);
      // 6. Moda / nama kapal (PIB Page 1 No.4 Moda / nama kapal *)
      checkH("Moda", ["Moda", "Nama_Sarana_Pengangkut", "Nama_Sarana_Pengangkutan", "Nama_Kapal"], ["Moda", "Shipped_Per", "Vessel", "Vessel_Name"], false);
      // 7. Negara asal (PIB Page 2-5 No.21 Negara asal *)
      checkH("Negara_Asal", ["Negara_Asal", "Country_of_Origin", "Origin_Country", "Negara_Asal_Country_Of_Origin"], ["Negara_asal", "Negara_Asal", "Country_of_Origin", "Origin"], false);
      // 8. Net weight (PIB Page 1 No.15 Berat Bersih *)
      checkH("Net_Weight", ["Berat_Bersih", "Total_Net_Weight", "Net_Weight"], ["Net_Weight", "Total_Net_Weight", "N.W.", "Net Weight"], false);
      // 9. Nomor invoice (PIB Page 1 No.7 Nomor invoice *)
      checkH("No_Invoice", ["No_Invoice", "Invoice_Number", "Nomor_Invoice"], ["No_Invoice", "Invoice_Number", "Invoice Number"], false);
      // 10. Pelabuhan asal (PIB Page 1 No.5 Pelabuhan asal *)
      checkH("Pelabuhan_Asal", ["Pelabuhan_Muat", "Pelabuhan_Asal", "Port_of_Loading"], ["Pelabuhan_Asal", "Port_of_Loading", "Pelabuhan_Muat"], false);
      // 11. Pelabuhan tujuan (PIB Page 1 No.6 Pelabuhan tujuan *)
      checkH("Pelabuhan_Tujuan", ["Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar"], ["Pelabuhan_Tujuan", "Destination", "Port_of_Discharge"], false);
      // 12. Tanggal invoice (PIB Page 1 No.8 Tanggal invoice *)
      checkH("Tanggal_Invoice", ["Tanggal_Invoice", "Invoice_Date", "Tanggal Invoice"], ["Tanggal_Invoice", "Invoice_Date", "Invoice Date"], false);
    }
    // ─── Bill of Lading (BL) ─────────────────────────────────────────────────
    else if (ft === "bl" || ft.includes("lading") || ft.includes("ladding") || (ft.includes("bl") && !ft.includes("wl"))) {
      // 1. Identitas PENGIRIM (PIB Page 1 No.1 Identitas PENGIRIM, BL Page 7 No. 3)
      checkH("Identitas_Pengirim", ["Identitas_Pengirim", "Nama_Pengirim", "Pengirim", "Identitas_Penjual", "Nama_Penjual", "Shipper"], ["Identitas_Pengirim", "Shipper", "Shipping_Marks", "Exporter", "Nama_Pengirim", "Nama_Penjual", "Pengirim"], false);
      // 2. Pemilik Barang (PIB Page 1 No.3 Pemilik Barang, BL Page 7 No. 4)
      checkH("Pemilik_Barang", ["Pemilik_Barang", "Nama_Importir", "Importir", "Identitas_Pembeli"], ["Pemilik_Barang", "Consignee", "Nama_Consignee", "Buyer", "Importir", "Customer"], false);
      // 3. Moda / nama kapal (Shipped Per) (PIB Page 1 No.4 Moda / nama kapal, BL Page 7 No. 6)
      checkH("Moda", ["Moda", "Nama_Sarana_Pengangkut", "Nama_Sarana_Pengangkutan", "Nama_Kapal", "Vessel_Name"], ["Moda", "Vessel_Name", "Vessel", "Nama_Kapal", "Shipped_Per", "Shipped Per"], false);
      // 4. Pelabuhan asal (From) (PIB Page 1 No.5 Pelabuhan asal (From), BL Page 7 No. 8)
      checkH("Pelabuhan_Asal", ["Pelabuhan_Muat", "Pelabuhan_Asal", "Port_of_Loading"], ["Pelabuhan_Asal", "Port_of_Loading", "Pelabuhan_Muat", "Loading_Port", "From"], false);
      // 5. Pelabuhan tujuan (To) (PIB Page 1 No.6 Pelabuhan tujuan (To), BL Page 7 No. 9)
      checkH("Pelabuhan_Tujuan", ["Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar"], ["Pelabuhan_Tujuan", "Port_of_Discharge", "Destination", "Pelabuhan_Bongkar", "To"], false);
      // 6. Nomor B/L (PIB Page 1 No.10 Nomor B/L, BL Page 7 No. 2)
      checkH("No_BL", ["No_BL", "Nomor_BL", "BL_Number", "Nomor_B/L", "No_B/L", "House_BL_No", "B/L_No", "No_Dokumen", "No_Dokumen_BL", "No_House_BL", "House_BL"], ["No_BL", "BL_Number", "Nomor_BL", "No_B/L", "Sea_Waybill_Number", "Waybill_Number", "House_BL", "No_House_BL", "B/L_No", "Nomor_B/L"], false);
      // 7. Tanggal B/L (PIB Page 1 No.10 Tanggal B/L, BL Page 7 No. 12)
      checkH("Tanggal_BL", ["Tanggal_BL", "Tanggal BL", "House_BL_Date", "Date_of_Issue", "Tanggal_B/L", "Master_BL_Date"], ["Tanggal_BL", "Date_of_Issue", "BL_Date", "Shipped_on_Board_Date", "Date", "Tanggal_B/L", "Tanggal", "House_BL_Date"], false);
    }
    // ─── Form AK (COO) ───────────────────────────────────────────────────────
    else if (ft === "ak" || ft.includes("ak") || ft.includes("coo") || ft.includes("origin")) {
      // 1. Nomor Referensi (PIB Page 6 No.32 ECO (nomor))
      checkH("No_Referensi", ["Electronic_Certificate_Of_Origin_ECO", "Pengecualian_Perijinan2", "No_Referensi", "ECO"], ["No_Referensi", "Reference_No", "Certificate_No"], false);
      // 2. Nama Exporter / Shipper (PIB Page 1 No.1 Identitas PENGIRIM *)
      checkH("Nama_Exporter_Shipper", ["Identitas_Pengirim", "Nama_Pengirim", "Pengirim", "Identitas_Penjual", "Nama_Penjual"], ["Nama_Exporter_Shipper", "Exporter", "Producer", "Shipper", "nama exporter shipper"], false);
      // 3. Nama Consignee (PIB Page 1 No.3 Pemilik Barang *)
      checkH("Nama_Consignee", ["Pemilik_Barang", "Nama_Importir", "Importir", "Identitas_Pembeli"], ["Nama_Consignee", "Consignee", "Buyer", "nama consignee"], false);
      // 4. Nama Vessel (PIB Page 1 No.4 Moda / nama kapal *)
      checkH("Nama_Vessel", ["Moda", "Nama_Sarana_Pengangkut", "Nama_Sarana_Pengangkutan", "Nama_Kapal", "Vessel_Name", "Vessel"], ["Nama_Vessel", "Vessel_Name", "Vessel", "Moda"], false);
      // 5. Nama pelabuhan bongkar (PIB Page 1 No.6 Pelabuhan tujuan (To) *)
      checkH("Nama_Pelabuhan_Bongkar", ["Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar"], ["Nama_Pelabuhan_Bongkar", "Port_of_Discharge", "Destination", "Pelabuhan_Tujuan", "nama pelabuhan bongkar"], false);
      // 6. Jumlah dan Jenis Kemasan / Jumlah Coil (PIB Page 1 No.14 Jumlah coil *)
      checkH("Jumlah_Kemasan", ["Jumlah_Coil", "Jumlah", "Jumlah_Kemasan", "Jumlah_Satuan_Coil", "Total_Packages", "Total_Coils"], ["Jumlah_Coil", "Total_Packages", "Jumlah_Dan_Jenis_Kemasan", "Number_and_Type_of_Packages", "Jumlah_Kemasan", "Packages"], false);
      // 7. Deskripsi Barang (PIB Page 2-5 No.18 Uraian barang *)
      checkH("Deskripsi_Barang", ["Uraian_Barang", "Deskripsi_Barang", "Description", "Description_of_Goods", "Item_Description"], ["Deskripsi_Barang", "Description_of_Goods", "Description", "Commodity", "Uraian_Barang"], false);
      // 8. Tanggal Keberangkatan (PIB Page 1 No.10 Tanggal B/L *)
      checkH("Tanggal_Keberangkatan", ["Tanggal_BL", "Tanggal BL", "House_BL_Date", "Date_of_Issue"], ["Tanggal_Keberangkatan", "Departure_Date", "Date_of_Departure", "Tanggal_BL"], false);
      // 9. Total Gross Weight / Berat Kuantitas (PIB Page 1 No.16 Berat Kotor *)
      checkH("Total_Gross_Weight", ["Berat_Kotor", "Gross_Weight", "Total_Gross_Weight", "Jumlah_Satuan_Barang"], ["Total_Gross_Weight", "Gross_Weight", "Berat_Kuantitas", "Total_Weight", "Gross_Weight_or_Other_Quantity"], false);
    }
    // ─── Weight List (WL) ────────────────────────────────────────────────────
    else if (ft === "wl" || ft.includes("weight") || ft.includes("wl")) {
      // 1. Deskripsi Barang (PIB Page 2-5 No.18 Uraian barang *)
      checkH("Deskripsi_Barang", ["Uraian_Barang", "Deskripsi_Barang", "Description", "Description_of_Goods", "Item_Description"], ["Deskripsi_Barang", "Description", "Description_of_Goods", "Item_Description", "Commodity", "nama barang"], false);
      // 2. Jumlah Coil (PIB Page 2-5 No.26 Jumlah Satuan Coil)
      checkH("Jumlah_Coil", ["Jumlah_Satuan_Coil", "Jumlah_Coil_Item"], ["Jumlah_Coil", "Total_Coils", "Coils", "Qty_Coil", "Jumlah", "Total_Packages"], false);
      // 3. Net Weight (PIB Page 2-5 No.25 Jumlah Satuan Barang)
      checkH("Net_Weight", ["Berat_Bersih_Item", "Jumlah_Satuan_Barang"], ["Net_Weight", "Total_Net_Weight", "Berat_Bersih", "N.W.", "NW", "Net Weight"], true);
      // 4. Spesifikasi / Grade (PIB Page 2-5 No.20 Spesifikasi / grade *)
      checkH("Spesifikasi_Grade", ["Spesifikasi_Grade", "Spek_Material", "Spesifikasi", "Grade", "Standard"], ["Spesifikasi", "Spesifikasi_Grade", "Grade", "Specification", "Spek_Material", "spek"], false);
    }
    // ─── Mill Test Certificate (MS / MTC) ────────────────────────────────────
    else if (ft === "ms" || ft === "mtc" || ft.includes("mill") || ft.includes("test") || ft.includes("sheet")) {
      // 1. Deskripsi Barang (PIB Page 2-5 No.18 Uraian barang *)
      checkH("Deskripsi_Barang", ["Uraian_Barang", "Deskripsi_Barang", "Description", "Description_of_Goods", "Item_Description"], ["Deskripsi_Barang", "Description", "Description_of_Goods", "Item_Description", "Commodity"], false);
      // 2. Jumlah / Berat Material (PIB Page 2-5 No.25 Jumlah Satuan Barang)
      checkH("Jumlah_Berat_Material", ["Jumlah_Satuan_Barang", "Berat_Bersih_Item"], ["Jumlah_Berat_Material", "Berat_Material", "Total_Weight", "Weight", "Net_Weight"], false);
      // 3. Nama Supplier / Produsen (PIB Page 1 No.1 Identitas Pengirim / No.2 Penjual *)
      checkH("Nama_Supplier", ["Identitas_Pengirim", "Nama_Pengirim", "Pengirim", "Identitas_Penjual", "Supplier"], ["Nama_Supplier", "Nama_Produsen", "Producer", "Supplier", "Manufacturer"], false);
      // 4. Spek Material (PIB Page 2-5 No.20 Spesifikasi / grade *)
      checkH("Spek_Material", ["Spesifikasi_Grade", "Spek_Material", "Spesifikasi", "Grade"], ["Spek_Material", "Spesifikasi_Grade", "Specification", "Steel_Grade", "Grade", "Spesifikasi"], false);
    }

    headerComparison[ftRaw] = docFields;

    // 4. In matching section, only header fields are evaluated
    itemComparison[ftRaw] = [];

    const hasDocHeaderMismatch = docFields.some((f) => f.status === "MISMATCH");
    if (!hasDocHeaderMismatch && docFields.length > 0) {
      matchedDocsCount++;
    }
  }

  // 5. Overall Status Calculation
  // Evaluated strictly based on header field mismatches
  const hasDiscrepancy = mismatches.length > 0;
  const overallStatus = hasDiscrepancy ? "MISMATCHING" : "MATCHING";
  const uiStatus = hasDiscrepancy ? "Mismatching" : "Matching";

  return {
    batchId,
    status: overallStatus,
    uiStatus,
    headerComparison,
    itemComparison: {},
    allFields,
    mismatches,
    itemMismatches: [],
    summary: {
      totalDocuments: details.length,
      matchedDocuments: matchedDocsCount + 1, // +1 for PIB
      totalPibItems: 0,
      matchedPibItems: 0,
      discrepancyCount: mismatches.length,
    },
  };
}

function createEmptyReport(
  batchId: string,
  status: "MATCHING" | "MISMATCHING" | "PROSES"
): CanonicalBatchReport {
  return {
    batchId,
    status,
    uiStatus: status === "MATCHING" ? "Matching" : status === "MISMATCHING" ? "Mismatching" : "Proses",
    headerComparison: {},
    itemComparison: {},
    allFields: [],
    mismatches: [],
    itemMismatches: [],
    summary: {
      totalDocuments: 0,
      matchedDocuments: 0,
      totalPibItems: 0,
      matchedPibItems: 0,
      discrepancyCount: 0,
    },
  };
}
