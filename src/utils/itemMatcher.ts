export interface ExtractedItem {
  hs: string;
  partNo: string;
  qty: string;
  desc: string;
  originalIndex: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: Record<string, any>;
}

export interface MatchedItemPair {
  pibItem: ExtractedItem | null;
  rekapItem: ExtractedItem | null;
  isHsMatch: boolean;
  isPartMatch: boolean;
  isQtyMatch: boolean;
  isRowMatch: boolean;
  hasBoth: boolean;
  status: "match" | "mismatch" | "missing_rekap" | "missing_pib";
}

// Clean string for alphanumeric comparison (case-insensitive, removes punctuation/spaces)
export const cleanVal = (s?: string | null): string => {
  if (!s) return "";
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, "").trim();
};

// Clean numeric string (e.g. "3,000" -> "3000", "3000.00" -> "3000", "18,360 (kg)" -> "18360", "USD 919 , 989. 49" -> "919989.49")
export const cleanNum = (s?: string | null): string => {
  if (!s) return "";
  let str = String(s)
    .toLowerCase()
    .replace(/\b(?:usd|idr|rp|valuta|eur|jpy)\b/gi, "")
    .replace(/[$€¥]/g, "")
    .replace(/\((?:kg|mt|m\/t|pcs)\)/gi, "")
    .replace(/\b(?:kg|mt|m\/t|pcs|coils|coil|sheets)\b/gi, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .trim();
  str = str.replace(/\.0+$/, "");
  // Only match if the ENTIRE stripped string is a single valid number
  const match = str.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (match && match[1]) {
    return match[1].replace(/\.0+$/, "");
  }
  return str;
};

// Helper to extract line item field, prioritizing [fieldName]_action over raw field
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRowField(row: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    const actionKey = `${k}_action`;
    if (row[actionKey] !== undefined && row[actionKey] !== null && String(row[actionKey]).trim() !== "") {
      return String(row[actionKey]).trim();
    }
  }
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
  }
  return "";
}

// Extract standard fields from a PIB table row
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractPibItem(row: Record<string, any> | undefined | null, index = 0): ExtractedItem {
  if (!row) {
    return { hs: "", partNo: "", qty: "", desc: "", originalIndex: index, raw: {} };
  }
  const hs = getRowField(
    row,
    "Pos_Tarif",
    "pos tarif",
    "pos_tarif",
    "HS_Code",
    "hs code"
  );

  const partNo = getRowField(
    row,
    "Spesifikasi_Grade",
    "spesifikasi grade",
    "Ukuran_Barang",
    "ukuran barang",
    "Kode_Barang",
    "kode barang",
    "kode_barang",
    "Part_No",
    "part_no"
  );

  const qty = getRowField(
    row,
    "Jumlah_Satuan_Barang",
    "jumlah satuan barang",
    "Jumlah_Satuan_Coil",
    "jumlah satuan coil",
    "Jumlah_Barang",
    "jumlah barang",
    "jumlah_barang",
    "QTY",
    "qty",
    "jumlah"
  );

  const desc = getRowField(
    row,
    "Uraian_Barang",
    "uraian barang",
    "Uraian",
    "uraian",
    "Desc",
    "desc"
  );

  return { hs, partNo, qty, desc, originalIndex: index, raw: row };
}

// Extract standard fields from a Rekap table row
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractRekapItem(row: Record<string, any> | undefined | null, index = 0): ExtractedItem {
  if (!row) {
    return { hs: "", partNo: "", qty: "", desc: "", originalIndex: index, raw: {} };
  }
  const hs = getRowField(
    row,
    "HS_Code",
    "hs code",
    "pos tarif",
    "pos_tarif",
    "Pos_Tarif"
  );

  const partNo = getRowField(
    row,
    "Part_No",
    "part_no",
    "no part",
    "part no",
    "Kode_Barang",
    "kode_barang",
    "kode barang"
  );

  const qty = getRowField(
    row,
    "QTY",
    "qty",
    "jumlah",
    "jumlah_barang",
    "jumlah barang"
  );

  const desc = getRowField(
    row,
    "Part_Desc",
    "part desc",
    "desc",
    "uraian"
  );

  return { hs, partNo, qty, desc, originalIndex: index, raw: row };
}

/**
 * Builds a pair comparison between a PIB item and a Rekap item.
 */
function createItemPair(pibItem: ExtractedItem | null, rekapItem: ExtractedItem | null): MatchedItemPair {
  const hasBoth = Boolean(
    pibItem &&
    rekapItem &&
    (pibItem.hs || pibItem.partNo || pibItem.qty) &&
    (rekapItem.hs || rekapItem.partNo || rekapItem.qty)
  );

  if (!hasBoth || !pibItem || !rekapItem) {
    return {
      pibItem,
      rekapItem,
      isHsMatch: false,
      isPartMatch: false,
      isQtyMatch: false,
      isRowMatch: false,
      hasBoth,
      status: pibItem ? "missing_rekap" : "missing_pib",
    };
  }

  const isHsMatch =
    pibItem.hs !== "" &&
    rekapItem.hs !== "" &&
    cleanVal(pibItem.hs) === cleanVal(rekapItem.hs);

  const isPartMatch =
    pibItem.partNo !== "" &&
    rekapItem.partNo !== "" &&
    cleanVal(pibItem.partNo) === cleanVal(rekapItem.partNo);

  const isQtyMatch =
    pibItem.qty !== "" &&
    rekapItem.qty !== "" &&
    cleanNum(pibItem.qty) === cleanNum(rekapItem.qty);

  // Strict row match: requires matching quantity, and either matching part number
  // or (if both lack part number) matching HS code. Never matches on HS code alone with empty quantity!
  const isRowMatch = Boolean(
    isQtyMatch &&
    pibItem.qty !== "" &&
    rekapItem.qty !== "" &&
    (isPartMatch || (!pibItem.partNo && !rekapItem.partNo && isHsMatch))
  );

  return {
    pibItem,
    rekapItem,
    isHsMatch,
    isPartMatch,
    isQtyMatch,
    isRowMatch,
    hasBoth: true,
    status: isRowMatch ? "match" : "mismatch",
  };
}

/**
 * Matches items between PIB table and Rekap table in an order-independent manner.
 * Prioritizes matching by Part Number + Quantity, then Part Number alone, then HS Code + Quantity,
 * ensuring items in scrambled order are correctly aligned side-by-side.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function matchPibAndRekapItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pibTable: Array<Record<string, any>> = [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rekapTable: Array<Record<string, any>> = []
): MatchedItemPair[] {
  const pibItems: ExtractedItem[] = pibTable.map((r, i) => extractPibItem(r, i));
  const rekapItems: ExtractedItem[] = rekapTable.map((r, i) => extractRekapItem(r, i));

  const matchedPibIndices = new Set<number>();
  const matchedRekapIndices = new Set<number>();
  const pibToRekapMap = new Map<number, number>();

  // Pass 1: Exact Part Number + Exact Quantity
  for (let p = 0; p < pibItems.length; p++) {
    if (matchedPibIndices.has(p)) continue;
    const pItem = pibItems[p]!;
    if (!pItem.partNo) continue;

    for (let r = 0; r < rekapItems.length; r++) {
      if (matchedRekapIndices.has(r)) continue;
      const rItem = rekapItems[r]!;
      if (
        rItem.partNo &&
        cleanVal(pItem.partNo) === cleanVal(rItem.partNo) &&
        pItem.qty &&
        rItem.qty &&
        cleanNum(pItem.qty) === cleanNum(rItem.qty)
      ) {
        matchedPibIndices.add(p);
        matchedRekapIndices.add(r);
        pibToRekapMap.set(p, r);
        break;
      }
    }
  }

  // Pass 2: Exact Part Number (even if Quantity or HS differs, to detect quantity mismatches accurately)
  for (let p = 0; p < pibItems.length; p++) {
    if (matchedPibIndices.has(p)) continue;
    const pItem = pibItems[p]!;
    if (!pItem.partNo) continue;

    for (let r = 0; r < rekapItems.length; r++) {
      if (matchedRekapIndices.has(r)) continue;
      const rItem = rekapItems[r]!;
      if (rItem.partNo && cleanVal(pItem.partNo) === cleanVal(rItem.partNo)) {
        matchedPibIndices.add(p);
        matchedRekapIndices.add(r);
        pibToRekapMap.set(p, r);
        break;
      }
    }
  }

  // Pass 3: Exact HS Code + Exact Quantity (for rows where Part Number might be missing/unparsed)
  for (let p = 0; p < pibItems.length; p++) {
    if (matchedPibIndices.has(p)) continue;
    const pItem = pibItems[p]!;
    if (!pItem.hs) continue;

    for (let r = 0; r < rekapItems.length; r++) {
      if (matchedRekapIndices.has(r)) continue;
      const rItem = rekapItems[r]!;
      if (
        rItem.hs &&
        cleanVal(pItem.hs) === cleanVal(rItem.hs) &&
        pItem.qty &&
        rItem.qty &&
        cleanNum(pItem.qty) === cleanNum(rItem.qty)
      ) {
        matchedPibIndices.add(p);
        matchedRekapIndices.add(r);
        pibToRekapMap.set(p, r);
        break;
      }
    }
  }

  // NOTE: Pass 4 (arbitrary index fallback) is permanently removed to eliminate false auto-matches.

  const results: MatchedItemPair[] = [];

  // Add paired items in order of PIB items
  for (let p = 0; p < pibItems.length; p++) {
    const pItem = pibItems[p]!;
    const rIdx = pibToRekapMap.get(p);
    if (rIdx !== undefined) {
      results.push(createItemPair(pItem, rekapItems[rIdx]!));
    } else {
      // Unmatched PIB item (missing in Rekap)
      results.push(createItemPair(pItem, null));
    }
  }

  // Add remaining Rekap items that had no match in PIB
  for (let r = 0; r < rekapItems.length; r++) {
    if (!matchedRekapIndices.has(r)) {
      results.push(createItemPair(null, rekapItems[r]!));
    }
  }

  return results;
}
