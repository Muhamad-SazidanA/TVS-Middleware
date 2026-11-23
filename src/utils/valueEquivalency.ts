import { cleanNum } from "./itemMatcher";

export interface DbEquivalencyGroup {
  id: number;
  name: string;
  category: string;
  canonical: string;
  values: string[];
}

/**
 * Normalizes text to lowercase alphanumeric tokens separated by single spaces.
 */
export function normEquivString(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Checks if a candidate string matches an equivalency group.
 * Matches:
 *   1. Full string (exact or normalized)
 *   2. First line of multi-line blocks (e.g. company name in an address block)
 *   3. Substantive prefix matching on word boundaries (e.g. "Marubeni-Itochu Steel Inc." or "CIF")
 *   4. Line-by-line prefix matching for multi-line document values
 */
export function valueMatchesGroup(rawVal: string, group: DbEquivalencyGroup): boolean {
  if (!rawVal || !group || !group.canonical) return false;
  const rawList = [group.canonical, ...(Array.isArray(group.values) ? group.values : [])].filter(Boolean);
  if (rawList.length === 0) return false;

  const cleanVal = String(rawVal).trim();
  const cleanLow = cleanVal.toLowerCase();
  const cleanNorm = normEquivString(cleanVal);
  if (!cleanNorm) return false;

  const allValues = rawList.map((v) => String(v).trim().toLowerCase());
  const allNorms = rawList.map((v) => normEquivString(String(v))).filter(Boolean);

  // Exact string or normalized alphanumeric match against configured group values
  if (allValues.includes(cleanLow) || allNorms.includes(cleanNorm)) {
    return true;
  }

  return false;
}

const MONTHS_MAP: Record<string, number> = {
  jan: 1, janv: 1, januari: 1, january: 1,
  feb: 2, febr: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agus: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktob: 10, oktober: 10, oct: 10, october: 10,
  nop: 11, nopember: 11, nov: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

export function parseStandardDate(str: string): string | null {
  if (!str) return null;
  const clean = str.trim().toLowerCase().replace(/[,.]+/g, " ").replace(/\s+/g, " ");

  // 1. Check if string contains a numeric date pattern (DD-MM-YYYY or YYYY-MM-DD)
  const numMatch = clean.match(/(?:^|\s)(\d{1,4})[\s\/-](\d{1,2})[\s\/-](\d{1,4})(?:$|\s)/);
  if (numMatch) {
    const [, p1, p2, p3] = numMatch;
    let y = 0, m = 0, d = 0;
    if (p1.length === 4) {
      y = parseInt(p1, 10);
      m = parseInt(p2, 10);
      d = parseInt(p3, 10);
    } else if (p3.length === 4) {
      d = parseInt(p1, 10);
      m = parseInt(p2, 10);
      y = parseInt(p3, 10);
    }
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // 2. Check if string contains a textual date pattern (DD Month YYYY or Month DD YYYY)
  const words = clean.split(/\s+/).filter(Boolean);
  for (let i = 0; i <= words.length - 3; i++) {
    const slice = words.slice(i, i + 3);
    let y = 0, m = 0, d = 0;
    let matchedParts = 0;
    for (const w of slice) {
      if (/^\d{4}$/.test(w) && y === 0) {
        y = parseInt(w, 10);
        matchedParts++;
      } else if (/^\d{1,2}$/.test(w) && d === 0) {
        d = parseInt(w, 10);
        matchedParts++;
      } else if (MONTHS_MAP[w.slice(0, 3)] && m === 0) {
        m = MONTHS_MAP[w.slice(0, 3)]!;
        matchedParts++;
      } else if (MONTHS_MAP[w] && m === 0) {
        m = MONTHS_MAP[w]!;
        matchedParts++;
      }
    }
    if (matchedParts === 3 && y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return null;
}

export function parseFlexibleNumber(s: string): number | null {
  if (!s) return null;
  let str = s
    .toLowerCase()
    .replace(/\b(?:usd|idr|rp|valuta|eur|jpy)\b/gi, "")
    .replace(/[$€¥]/g, "")
    .replace(/\((?:kg|mt|m\/t|pcs)\)/gi, "")
    .replace(/\b(?:kg|mt|m\/t|pcs|coils|coil|sheets)\b/gi, "")
    .replace(/\s+/g, "")
    .trim();

  const dotCount = (str.match(/\./g) || []).length;
  const commaCount = (str.match(/,/g) || []).length;

  if (dotCount > 1) {
    if (commaCount === 1) {
      str = str.replace(/\./g, "").replace(/,/g, ".");
    } else {
      const parts = str.split(".");
      const lastPart = parts[parts.length - 1]!;
      if (parts.length > 2 && (lastPart.length === 2 || lastPart.length === 4)) {
        const thousands = parts.slice(0, -1).join("");
        str = `${thousands}.${lastPart}`;
      } else {
        str = parts.join("");
      }
    }
  } else if (dotCount === 1 && commaCount === 1) {
    const dotIdx = str.indexOf(".");
    const commaIdx = str.indexOf(",");
    if (dotIdx < commaIdx) {
      str = str.replace(/\./g, "").replace(/,/g, ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (commaCount === 1 && dotCount === 0) {
    str = str.replace(/,/g, ".");
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Checks equivalence between two values:
 *   1. Identical values (case-insensitive, normalized, or first-line for address blocks)
 *   2. Database equivalency group match (canonical or configured variations)
 *   3. Numeric equivalence for numeric/weight/price fields
 */
export function isEquivalentMatch(
  valA?: string | null,
  valB?: string | null,
  fieldName?: string,
  dbGroups?: DbEquivalencyGroup[]
): { isMatch: boolean; reason?: string } {
  if (!valA || !valB || valA === "-" || valB === "-") {
    return { isMatch: false };
  }

  const cleanA = String(valA).trim();
  const cleanB = String(valB).trim();

  if (!cleanA || !cleanB) return { isMatch: false };

  // 1. Direct exact match (case-insensitive)
  if (cleanA.toLowerCase() === cleanB.toLowerCase()) {
    return { isMatch: true };
  }

  // Direct normalized match (ignoring punctuation differences like trailing dots or hyphens)
  const normA = normEquivString(cleanA);
  const normB = normEquivString(cleanB);
  if (normA && normB && normA === normB) {
    return { isMatch: true, reason: "Kesesuaian teks normalisasi" };
  }

  // 2. Database equivalency group lookup
  if (dbGroups && dbGroups.length > 0) {
    const targetFieldNorm = fieldName ? normalizeFieldKey(fieldName) : "";

    for (const group of dbGroups) {
      if (!group || !group.canonical) continue;

      // Group field scoping: If group specifies a specific field name, check if it matches fieldName or known synonyms
      if (targetFieldNorm && group.name) {
        const groupFieldNorm = normalizeFieldKey(group.name);
        const isGeneral =
          groupFieldNorm === "umum" ||
          groupFieldNorm === "general" ||
          group.category?.toLowerCase() === "umum" ||
          group.category?.toLowerCase() === "general";

        if (!isGeneral && groupFieldNorm !== targetFieldNorm) {
          const isSynonym =
            (groupFieldNorm.includes("penjual") &&
              (targetFieldNorm.includes("penjual") ||
                targetFieldNorm.includes("seller") ||
                targetFieldNorm.includes("pengirim") ||
                targetFieldNorm.includes("exporter") ||
                targetFieldNorm.includes("supplier") ||
                targetFieldNorm.includes("produsen"))) ||
            (groupFieldNorm.includes("importir") &&
              (targetFieldNorm.includes("importir") ||
                targetFieldNorm.includes("buyer") ||
                targetFieldNorm.includes("consignee") ||
                targetFieldNorm.includes("pemilik") ||
                targetFieldNorm.includes("pembeli"))) ||
            (groupFieldNorm.includes("delivery") &&
              (targetFieldNorm.includes("delivery") ||
                targetFieldNorm.includes("incoterm") ||
                targetFieldNorm.includes("penyerahan")));

          if (!isSynonym) {
            continue; // Skip group meant for a completely different field
          }
        }
      }

      const aInGroup = valueMatchesGroup(cleanA, group);
      const bInGroup = valueMatchesGroup(cleanB, group);

      if (aInGroup && bInGroup) {
        return {
          isMatch: true,
          reason: `Kamus Ekuivalensi: "${group.canonical}" (${group.name})`,
        };
      }
    }
  }

  const normField = (fieldName ?? "").toLowerCase().replace(/[\s_-]+/g, "");

  // HS Code comparison (ignoring punctuation dots e.g. "7209.16.00" vs "72091600")
  if ((normField.includes("hs") || normField.includes("tarif")) && normA && normB) {
    const digA = normA.replace(/[^0-9]/g, "");
    const digB = normB.replace(/[^0-9]/g, "");
    if (digA && digB && digA === digB) {
      return { isMatch: true, reason: "Kesesuaian kode HS" };
    }
  }

  // 3. Date field comparison (e.g. "18-03-2025" vs "Mar. 18, 2025")
  const isDateField =
    normField.includes("tanggal") ||
    normField.includes("date") ||
    normField.includes("tgl") ||
    normField.includes("pembuatan") ||
    normField.includes("waktu") ||
    normField.includes("eco");
  if (isDateField) {
    const dA = parseStandardDate(cleanA);
    const dB = parseStandardDate(cleanB);
    if (dA && dB && dA === dB) {
      return { isMatch: true, reason: `Kesesuaian tanggal (${dA})` };
    }
  }

  // 4. Numeric field comparison (weights, quantities, amounts)
  const isNumericField =
    normField.includes("berat") ||
    normField.includes("weight") ||
    normField.includes("gross") ||
    normField.includes("net") ||
    normField.includes("nilai") ||
    normField.includes("total") ||
    normField.includes("amount") ||
    normField.includes("harga") ||
    normField.includes("price") ||
    normField.includes("jumlah") ||
    normField.includes("qty") ||
    normField.includes("coil");

  if (isNumericField) {
    const numA = cleanNum(cleanA);
    const numB = cleanNum(cleanB);
    if (numA && numB && numA === numB) {
      return { isMatch: true, reason: "Kesesuaian nilai numerik" };
    }
    const nA = parseFlexibleNumber(cleanA) ?? Number(numA);
    const nB = parseFlexibleNumber(cleanB) ?? Number(numB);
    if (!isNaN(nA) && !isNaN(nB) && nA !== null && nB !== null) {
      if (Math.abs(nA - nB) < 0.0001) {
        return { isMatch: true, reason: "Kesesuaian nilai numerik" };
      }
      // MT to KG conversion (1 MT = 1000 KG)
      if (Math.abs(nA * 1000 - nB) < 1 || Math.abs(nB * 1000 - nA) < 1) {
        return { isMatch: true, reason: "Konversi satuan MT ↔ KG" };
      }
    }
    return { isMatch: false };
  }

  // 5. Dimension / Ukuran Barang comparison (e.g. "1.0 MM X 821 MM X C" vs "1.0x821xC")
  const isDimensionField =
    normField.includes("ukuran") ||
    normField.includes("size") ||
    normField.includes("dimensi") ||
    normField.includes("dimension");

  if (isDimensionField) {
    const cleanDim = (s: string) =>
      s
        .toLowerCase()
        .replace(/\.\s*[oO]/gi, ".0")
        .replace(/mm/gi, "")
        .replace(/\b(?:cm|mtr|m|inch)\b/gi, "")
        .replace(/[*×]/g, "x")
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9.]/g, "")
        .split("x")
        .map((p) => {
          const num = parseFloat(p);
          return !isNaN(num) && String(num) === p.replace(/0+$/, "").replace(/\.$/, "") ? String(num) : p;
        })
        .join("x");
    const dA = cleanDim(cleanA);
    const dB = cleanDim(cleanB);
    if (dA && dB && dA === dB) {
      return { isMatch: true, reason: "Kesesuaian dimensi ukuran" };
    }
  }

  // 6. Port comparison (e.g. "JAKARTA INDONESIA" vs "TANJUNG PRIOK", "KWANGYANG KOREA" vs "KWANGYANG")
  const isPortField =
    normField.includes("pelabuhan") ||
    normField.includes("port") ||
    normField.includes("destination") ||
    normField.includes("discharge") ||
    normField.includes("loading") ||
    normField.includes("bongkar") ||
    normField.includes("muat");

  if (isPortField) {
    const isTanjungPriokOrJakarta = (s: string) => {
      const low = s.toLowerCase();
      return low.includes("priok") || low.includes("jakarta");
    };
    if (isTanjungPriokOrJakarta(cleanA) && isTanjungPriokOrJakarta(cleanB)) {
      return { isMatch: true, reason: "Kesesuaian pelabuhan (TANJUNG PRIOK / JAKARTA)" };
    }
    const cleanPort = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\b(korea|indonesia|port|pelabuhan)\b/g, "")
        .trim();
    const pA = cleanPort(cleanA);
    const pB = cleanPort(cleanB);
    if (pA && pB && (pA === pB || pA.includes(pB) || pB.includes(pA))) {
      return { isMatch: true, reason: "Kesesuaian pelabuhan asal/tujuan" };
    }
  }

  // 7. Multi-line description comparison (e.g. BL Deskripsi_Barang vs PIB Uraian_Barang)
  const isDescField =
    normField.includes("deskripsi") ||
    normField.includes("uraian") ||
    normField.includes("description") ||
    normField.includes("barang");

  if (isDescField) {
    const cleanDesc = (s: string) =>
      s
        .toLowerCase()
        .replace(/[\r\n]+/g, " ")
        .replace(/\s*\(\s*/g, " (")
        .replace(/\s*\)\s*/g, ") ")
        .replace(/[^a-z0-9() ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const dA = cleanDesc(cleanA);
    const dB = cleanDesc(cleanB);
    if (dA === dB) {
      return { isMatch: true, reason: "Kesesuaian uraian barang" };
    }
    const linesA = cleanA.split(/[\r\n]+/).map((l) => cleanDesc(l)).filter(Boolean);
    const linesB = cleanB.split(/[\r\n]+/).map((l) => cleanDesc(l)).filter(Boolean);
    if (linesA.length > 0 && linesB.length > 0) {
      const allAInB = linesA.every((la) => linesB.some((lb) => lb.includes(la) || la.includes(lb)));
      const allBInA = linesB.every((lb) => linesA.some((la) => la.includes(lb) || lb.includes(la)));
      if (allAInB || allBInA) {
        return { isMatch: true, reason: "Kesesuaian uraian barang (semua item tercantum)" };
      }
    }
  }

  // 8. Company name comparison (Consignee, Notify Party, Shipper, Supplier, Buyer)
  const isCompanyField =
    normField.includes("consignee") ||
    normField.includes("notify") ||
    normField.includes("shipper") ||
    normField.includes("supplier") ||
    normField.includes("penjual") ||
    normField.includes("pembeli") ||
    normField.includes("buyer") ||
    normField.includes("importir") ||
    normField.includes("pemilik") ||
    normField.includes("pengirim");

  if (isCompanyField) {
    const cleanComp = (s: string) =>
      s
        .toLowerCase()
        .replace(/[.,\-_#/()]/g, " ")
        .replace(/\b(pt|ltd|inc|corp|co|tbk)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    const cA = cleanComp(cleanA);
    const cB = cleanComp(cleanB);
    if (cA && cB && (cA === cB || cA.startsWith(cB) || cB.startsWith(cA))) {
      return { isMatch: true, reason: "Kesesuaian nama perusahaan" };
    }
  }

  // 9. Incoterms normalization (e.g. "CIF JAKARTA , INDONESIA" vs "CIF")
  const isIncotermsField =
    normField.includes("incoterm") ||
    normField.includes("delivery") ||
    normField.includes("penyerahan");
  if (isIncotermsField) {
    const getIncoterm = (s: string) => {
      const m = s.toUpperCase().match(/\b(CIF|FOB|CFR|EXW|DDP|DAP|CIP|CPT|FCA|FAS)\b/);
      return m ? m[1] : "";
    };
    const tA = getIncoterm(cleanA);
    const tB = getIncoterm(cleanB);
    if (tA && tB && tA === tB) {
      return { isMatch: true, reason: `Kesesuaian Incoterms (${tA})` };
    }
  }

  // 10. Country & Port geographic relationship (e.g. "KOREA" vs "KWANGYANG", "INDONESIA" vs "TANJUNG PRIOK")
  const isCountryOrPortField =
    normField.includes("negara") ||
    normField.includes("country") ||
    normField.includes("origin") ||
    normField.includes("pelabuhan") ||
    normField.includes("port") ||
    normField.includes("tujuan") ||
    normField.includes("asal");
  if (isCountryOrPortField) {
    const sA = cleanA.toLowerCase();
    const sB = cleanB.toLowerCase();
    const isKoreaA = sA.includes("korea") || sA.includes("kr") || sA.includes("kwangyang");
    const isKoreaB = sB.includes("korea") || sB.includes("kr") || sB.includes("kwangyang");
    if (isKoreaA && isKoreaB) {
      return { isMatch: true, reason: "Kesesuaian asal: KOREA / KWANGYANG" };
    }
    const isIndoA = sA.includes("indonesia") || sA.includes("id") || sA.includes("jakarta") || sA.includes("priok");
    const isIndoB = sB.includes("indonesia") || sB.includes("id") || sB.includes("jakarta") || sB.includes("priok");
    if (isIndoA && isIndoB) {
      return { isMatch: true, reason: "Kesesuaian tujuan: INDONESIA / TANJUNG PRIOK" };
    }
  }

  // 11. Currency / Nilai Pabean conversion (e.g. USD 919,989.49 vs IDR 15,258,025,691.65 with exchange rate ~16,585)
  const isValueField =
    normField.includes("nilai") ||
    normField.includes("pabean") ||
    normField.includes("invoice_total") ||
    normField.includes("total_invoice") ||
    normField.includes("amount");
  if (isValueField) {
    const parseNum = (str: string) => {
      let s = str.replace(/[^0-9.,]/g, "").trim();
      if (s.includes(",") && s.includes(".")) {
        const lastDot = s.lastIndexOf(".");
        const lastComma = s.lastIndexOf(",");
        if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
        else s = s.replace(/,/g, "");
      } else if (s.includes(",")) {
        if (/\d+,\d{1,4}$/.test(s)) s = s.replace(",", ".");
        else s = s.replace(/,/g, "");
      } else if ((s.match(/\./g) || []).length > 1) {
        const lastDotIdx = s.lastIndexOf(".");
        const intPart = s.slice(0, lastDotIdx).replace(/\./g, "");
        const decPart = s.slice(lastDotIdx + 1);
        s = `${intPart}.${decPart}`;
      }
      return parseFloat(s);
    };
    const nA = parseNum(cleanA);
    const nB = parseNum(cleanB);
    if (!isNaN(nA) && !isNaN(nB) && nA > 0 && nB > 0) {
      const ratio = Math.max(nA, nB) / Math.min(nA, nB);
      if (ratio >= 14000 && ratio <= 18000) {
        return { isMatch: true, reason: `Nilai Pabean sesuai konversi Kurs NDPBM (~Rp ${Math.round(ratio).toLocaleString()}/USD)` };
      }
    }
  }

  // 12. Reference / ECO number normalization (e.g. "K001-25-0170799" vs "No. K001250170799 Tgl . 27-03-2025" or "K001250170799")
  const isRefField =
    normField.includes("referensi") ||
    normField.includes("eco") ||
    normField.includes("perijinan") ||
    normField.includes("certificate") ||
    normField.includes("nomor");
  if (isRefField) {
    const stripRef = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const rA = stripRef(cleanA);
    const rB = stripRef(cleanB);
    if (rA && rB && (rA === rB || rA.includes(rB) || rB.includes(rA))) {
      return { isMatch: true, reason: "Kesesuaian nomor referensi / ECO" };
    }
  }

  // 13. Composite Invoice Number & Date (e.g. "4JV2X125, MAR. 18, 2025" vs "4JV2X125 / 18-03-2025" or "4JV2X125")
  if (normField.includes("invoice")) {
    const extractTokens = (str: string) =>
      str
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 4);
    const tokA = extractTokens(cleanA);
    const tokB = extractTokens(cleanB);
    const common = tokA.filter((t) => tokB.includes(t));
    if (common.length > 0) {
      return { isMatch: true, reason: `No Invoice sesuai (${common.join(", ")})` };
    }
  }

  return { isMatch: false };
}

/**
 * Normalizes a field name key for consistent lookup.
 */
export function normalizeFieldKey(f: string): string {
  return f.toLowerCase().replace(/[\s_-]+/g, "");
}

// Legacy FieldAliasRule kept for type compatibility — no longer used for matching
export interface FieldAliasRule {
  id: string;
  name: string;
  description?: string;
  field: string;
  values: string[];
  canonicalValue?: string;
  enabled: boolean;
}
