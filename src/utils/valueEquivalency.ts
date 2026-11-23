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

  // 2. Database equivalency group lookup (Kamus Bahasa / Kamus Ekuivalensi)
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
