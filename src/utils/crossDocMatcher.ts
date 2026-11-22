import { getVal, parseDocIsi } from "./canonicalMatcher";
import { isEquivalentMatch, type DbEquivalencyGroup } from "./valueEquivalency";

export interface CrossCheckRuleDef {
  id: string;
  category: "INVOICE_VS_PL" | "PL_VS_BL" | "PL_VS_WL" | "PL_VS_MS" | "INV_BL_VS_AK" | "INTERNAL_INTEGRITY";
  categoryLabel: string;
  fieldLabel: string;
  sourceDocType: string;
  targetDocType: string;
  sourceFieldKeys: string[];
  targetFieldKeys: string[];
  excelRef: string;
  description: string;
}

export interface CrossCheckItemResult {
  ruleId: string;
  category: "INVOICE_VS_PL" | "PL_VS_BL" | "PL_VS_WL" | "PL_VS_MS" | "INV_BL_VS_AK" | "INTERNAL_INTEGRITY";
  categoryLabel: string;
  fieldLabel: string;
  sourceDocType: string;
  targetDocType: string;
  sourceFileName?: string;
  targetFileName?: string;
  sourceValue: string;
  targetValue: string;
  status: "MATCH" | "MISMATCH" | "SKIPPED";
  isMatch: boolean;
  reason?: string;
  excelRef: string;
  notes: string;
}

export interface CrossDocBatchReport {
  totalRules: number;
  evaluatedCount: number;
  matchedCount: number;
  mismatchCount: number;
  skippedCount: number;
  isFullyConsistent: boolean;
  scorePercentage: number;
  resultsByCategory: Record<string, CrossCheckItemResult[]>;
  allResults: CrossCheckItemResult[];
  mismatches: CrossCheckItemResult[];
}

export const CROSS_CHECK_RULES: CrossCheckRuleDef[] = [
  // 1. INVOICE VS PACKING LIST (SOP Checklist Invoice & Packing List)
  {
    id: "INV_PL_01",
    category: "INVOICE_VS_PL",
    categoryLabel: "Invoice ↔ Packing List",
    fieldLabel: "Identitas Supplier / Penjual",
    sourceDocType: "Invoice",
    targetDocType: "Packing List",
    sourceFieldKeys: ["Identitas_Penjual", "Nama_Penjual", "Seller", "Supplier", "Exporter"],
    targetFieldKeys: ["Identitas_Penjual", "Nama_Penjual", "Shipper", "Supplier", "Exporter"],
    excelRef: "Checklist Invoice #1 • Checklist Packing List #1",
    description: "Pastikan nama dan alamat supplier sama persis antara Invoice dan Packing List.",
  },
  {
    id: "INV_PL_02",
    category: "INVOICE_VS_PL",
    categoryLabel: "Invoice ↔ Packing List",
    fieldLabel: "Nomor Invoice",
    sourceDocType: "Invoice",
    targetDocType: "Packing List",
    sourceFieldKeys: ["Invoice_Number", "No_Invoice", "Nomor_Invoice", "Invoice Number"],
    targetFieldKeys: ["Invoice_Number", "No_Invoice", "Nomor_Invoice", "Invoice Number"],
    excelRef: "Checklist Invoice #2 • Checklist Packing List #2",
    description: "Cocokkan nomor invoice pada Packing List dengan Commercial Invoice; nomor harus sama.",
  },
  {
    id: "INV_PL_03",
    category: "INVOICE_VS_PL",
    categoryLabel: "Invoice ↔ Packing List",
    fieldLabel: "Tanggal Invoice",
    sourceDocType: "Invoice",
    targetDocType: "Packing List",
    sourceFieldKeys: ["Tanggal_Invoice", "Invoice_Date", "Tanggal Invoice", "Invoice Date"],
    targetFieldKeys: ["Tanggal_Invoice", "Invoice_Date", "Tanggal Invoice", "Invoice Date"],
    excelRef: "Checklist Invoice #3 • Checklist Packing List #3",
    description: "Pastikan tanggal, bulan, dan tahun pada Packing List identik dengan Commercial Invoice.",
  },
  {
    id: "INV_PL_04",
    category: "INVOICE_VS_PL",
    categoryLabel: "Invoice ↔ Packing List",
    fieldLabel: "Identitas Pembeli (Buyer)",
    sourceDocType: "Invoice",
    targetDocType: "Packing List",
    sourceFieldKeys: ["Identitas_Pembeli", "Nama_Importir", "Buyer", "Consignee"],
    targetFieldKeys: ["Identitas_Pembeli", "Nama_Importir", "Buyer", "Consignee"],
    excelRef: "Checklist Invoice #4 • Checklist Packing List #4",
    description: "Cek nama badan usaha pembeli (PT. United Steel Center Indonesia) dan alamat NPWP.",
  },
  {
    id: "INV_PL_05",
    category: "INVOICE_VS_PL",
    categoryLabel: "Invoice ↔ Packing List",
    fieldLabel: "Section Code / Client Code",
    sourceDocType: "Invoice",
    targetDocType: "Packing List",
    sourceFieldKeys: ["Section_Code", "Client_Code", "Section Code", "Client Code"],
    targetFieldKeys: ["Section_Code", "Client_Code", "Section Code", "Client Code"],
    excelRef: "Checklist Invoice #5 • Checklist Packing List #5",
    description: "Cocokkan Section Code antara Invoice dan Packing List (misal BJV2).",
  },
  {
    id: "INV_PL_06",
    category: "INVOICE_VS_PL",
    categoryLabel: "Invoice ↔ Packing List",
    fieldLabel: "Nomor S/C & Order No.",
    sourceDocType: "Invoice",
    targetDocType: "Packing List",
    sourceFieldKeys: ["Nomor_SC", "SC_No", "Order_No", "Nomor_Order", "S/C No", "Order No"],
    targetFieldKeys: ["Nomor_SC", "SC_No", "Order_No", "Nomor_Order", "S/C No", "Order No"],
    excelRef: "Checklist Invoice #8 • Checklist Packing List #7",
    description: "Cocokkan nomor Sales Contract dan nomor Order antara Invoice dan Packing List.",
  },
  {
    id: "INV_PL_07",
    category: "INVOICE_VS_PL",
    categoryLabel: "Invoice ↔ Packing List",
    fieldLabel: "Marks and Numbers",
    sourceDocType: "Invoice",
    targetDocType: "Packing List",
    sourceFieldKeys: ["Marks_and_Numbers", "Shipping_Marks", "Marks & Numbers", "Marks and Numbers"],
    targetFieldKeys: ["Marks_and_Numbers", "Shipping_Marks", "Marks & Numbers", "Marks and Numbers"],
    excelRef: "Checklist Invoice #13 • Checklist Packing List #9",
    description: "Cocokkan tanda pengiriman dan identitas penerima antara Invoice dan Packing List.",
  },
  {
    id: "INV_PL_08",
    category: "INVOICE_VS_PL",
    categoryLabel: "Invoice ↔ Packing List",
    fieldLabel: "Deskripsi Barang",
    sourceDocType: "Invoice",
    targetDocType: "Packing List",
    sourceFieldKeys: ["Deskripsi_Barang", "Description_of_Goods", "Uraian_Barang", "Description"],
    targetFieldKeys: ["Deskripsi_Barang", "Description_of_Goods", "Uraian_Barang", "Description"],
    excelRef: "Checklist Invoice #14 • Checklist Packing List #10",
    description: "Pastikan deskripsi barang sesuai antara Invoice dan Packing List.",
  },
  {
    id: "INV_PL_09",
    category: "INVOICE_VS_PL",
    categoryLabel: "Invoice ↔ Packing List",
    fieldLabel: "Jumlah Coil / Package",
    sourceDocType: "Invoice",
    targetDocType: "Packing List",
    sourceFieldKeys: ["Jumlah_Coil", "Total_Coil", "Coil_Count", "Packages", "Jumlah Kemasan"],
    targetFieldKeys: ["Jumlah_Coil", "Total_Coil", "Coil_Count", "Packages", "Jumlah Kemasan"],
    excelRef: "Checklist Invoice #17 • Checklist Packing List #13",
    description: "Cocokkan jumlah total coil antara Invoice dan Packing List.",
  },
  {
    id: "INV_PL_10",
    category: "INVOICE_VS_PL",
    categoryLabel: "Invoice ↔ Packing List",
    fieldLabel: "Gross Weight",
    sourceDocType: "Invoice",
    targetDocType: "Packing List",
    sourceFieldKeys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor", "Gross Weight"],
    targetFieldKeys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor", "Gross Weight"],
    excelRef: "Checklist Invoice #18 • Checklist Packing List #14",
    description: "Cocokkan total berat kotor antara Invoice dan Packing List.",
  },
  {
    id: "INV_PL_11",
    category: "INVOICE_VS_PL",
    categoryLabel: "Invoice ↔ Packing List",
    fieldLabel: "Net Weight",
    sourceDocType: "Invoice",
    targetDocType: "Packing List",
    sourceFieldKeys: ["Net_Weight", "Total_Net_Weight", "Berat_Bersih", "Net Weight"],
    targetFieldKeys: ["Net_Weight", "Total_Net_Weight", "Berat_Bersih", "Net Weight"],
    excelRef: "Checklist Invoice #19 • Checklist Packing List #15",
    description: "Cocokkan total berat bersih antara Invoice dan Packing List.",
  },

  // 2. PACKING LIST VS BILL OF LADING (SOP Checklist Packing List & BL)
  {
    id: "PL_BL_01",
    category: "PL_VS_BL",
    categoryLabel: "Packing List ↔ Bill of Lading",
    fieldLabel: "Nama Kapal (Vessel Name)",
    sourceDocType: "Packing List",
    targetDocType: "BL",
    sourceFieldKeys: ["Nama_Kapal", "Vessel_Name", "Shipped_Per", "Moda"],
    targetFieldKeys: ["Nama_Kapal", "Vessel_Name", "Vessel", "Shipped_Per"],
    excelRef: "Checklist Packing List #8 • Checklist BL #6",
    description: "Cocokkan nama kapal pada Packing List dengan Bill of Lading (B/L).",
  },
  {
    id: "PL_BL_02",
    category: "PL_VS_BL",
    categoryLabel: "Packing List ↔ Bill of Lading",
    fieldLabel: "Pelabuhan Muat (Port of Loading)",
    sourceDocType: "Packing List",
    targetDocType: "BL",
    sourceFieldKeys: ["Pelabuhan_Asal", "Port_of_Loading", "From", "Pelabuhan Muat"],
    targetFieldKeys: ["Pelabuhan_Asal", "Port_of_Loading", "POL", "Pelabuhan Muat"],
    excelRef: "Checklist Packing List #8 • Checklist BL #8",
    description: "Cocokkan pelabuhan muat pengapalan antara Packing List dan B/L.",
  },
  {
    id: "PL_BL_03",
    category: "PL_VS_BL",
    categoryLabel: "Packing List ↔ Bill of Lading",
    fieldLabel: "Pelabuhan Bongkar (Port of Discharge)",
    sourceDocType: "Packing List",
    targetDocType: "BL",
    sourceFieldKeys: ["Pelabuhan_Tujuan", "Port_of_Discharge", "To", "Pelabuhan Bongkar"],
    targetFieldKeys: ["Pelabuhan_Tujuan", "Port_of_Discharge", "POD", "Pelabuhan Bongkar"],
    excelRef: "Checklist Packing List #8 • Checklist BL #9",
    description: "Cocokkan pelabuhan bongkar tujuan antara Packing List dan B/L.",
  },
  {
    id: "PL_BL_04",
    category: "PL_VS_BL",
    categoryLabel: "Packing List ↔ Bill of Lading",
    fieldLabel: "Gross Weight",
    sourceDocType: "Packing List",
    targetDocType: "BL",
    sourceFieldKeys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor"],
    targetFieldKeys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor"],
    excelRef: "Checklist Packing List #14 • Checklist BL #16",
    description: "Cocokkan berat kotor barang pada B/L dengan Packing List.",
  },
  {
    id: "PL_BL_05",
    category: "PL_VS_BL",
    categoryLabel: "Packing List ↔ Bill of Lading",
    fieldLabel: "Jumlah Package / Coil",
    sourceDocType: "Packing List",
    targetDocType: "BL",
    sourceFieldKeys: ["Jumlah_Coil", "Total_Coil", "Jumlah_Package", "Packages"],
    targetFieldKeys: ["Jumlah_Package", "Number_of_Packages", "Jumlah_Coil", "Packages"],
    excelRef: "Checklist Packing List #13 • Checklist BL #14",
    description: "Pastikan jumlah kemasan / package pada B/L sesuai dengan Packing List.",
  },
  {
    id: "PL_BL_06",
    category: "PL_VS_BL",
    categoryLabel: "Packing List ↔ Bill of Lading",
    fieldLabel: "Shipping Marks",
    sourceDocType: "Packing List",
    targetDocType: "BL",
    sourceFieldKeys: ["Marks_and_Numbers", "Shipping_Marks"],
    targetFieldKeys: ["Marks_and_Numbers", "Shipping_Marks"],
    excelRef: "Checklist Packing List #9 • Checklist BL #15",
    description: "Cocokkan tanda pengiriman pada B/L dengan Packing List.",
  },

  // 3. PACKING LIST VS WEIGHT LIST (SOP Checklist WL)
  {
    id: "PL_WL_01",
    category: "PL_VS_WL",
    categoryLabel: "Packing List ↔ Weight List",
    fieldLabel: "Nama Supplier / Shipper",
    sourceDocType: "Packing List",
    targetDocType: "WL",
    sourceFieldKeys: ["Identitas_Penjual", "Nama_Penjual", "Shipper", "Supplier"],
    targetFieldKeys: ["Nama_Supplier", "Supplier", "Shipper", "Identitas_Penjual"],
    excelRef: "Checklist WL #2",
    description: "Cocokkan nama perusahaan supplier/shipper pada Weight List dengan Packing List.",
  },
  {
    id: "PL_WL_02",
    category: "PL_VS_WL",
    categoryLabel: "Packing List ↔ Weight List",
    fieldLabel: "Jumlah Coil Total",
    sourceDocType: "Packing List",
    targetDocType: "WL",
    sourceFieldKeys: ["Jumlah_Coil", "Total_Coil"],
    targetFieldKeys: ["Jumlah_Coil", "Total_Coil", "Item_Count"],
    excelRef: "Checklist WL #7",
    description: "Pastikan jumlah total coil pada Weight List sesuai dengan Packing List.",
  },
  {
    id: "PL_WL_03",
    category: "PL_VS_WL",
    categoryLabel: "Packing List ↔ Weight List",
    fieldLabel: "Net Weight Total",
    sourceDocType: "Packing List",
    targetDocType: "WL",
    sourceFieldKeys: ["Net_Weight", "Total_Net_Weight", "Berat_Bersih"],
    targetFieldKeys: ["Net_Weight", "Total_Net_Weight", "Total_Berat"],
    excelRef: "Checklist WL #8",
    description: "Cocokkan total berat bersih barang pada Weight List dengan Packing List.",
  },
  {
    id: "PL_WL_04",
    category: "PL_VS_WL",
    categoryLabel: "Packing List ↔ Weight List",
    fieldLabel: "Gross Weight Total",
    sourceDocType: "Packing List",
    targetDocType: "WL",
    sourceFieldKeys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor"],
    targetFieldKeys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor"],
    excelRef: "Checklist WL #9",
    description: "Pastikan total berat kotor pada Weight List sesuai dengan Packing List.",
  },

  // 4. PACKING LIST VS MILL SHEET (SOP Checklist MS)
  {
    id: "PL_MS_01",
    category: "PL_VS_MS",
    categoryLabel: "Packing List ↔ Mill Sheet",
    fieldLabel: "Deskripsi Barang",
    sourceDocType: "Packing List",
    targetDocType: "MS",
    sourceFieldKeys: ["Deskripsi_Barang", "Description_of_Goods"],
    targetFieldKeys: ["Deskripsi_Barang", "Product_Name", "Material_Description"],
    excelRef: "Checklist MS #5",
    description: "Pastikan deskripsi produk baja pada Mill Sheet sesuai dengan Packing List.",
  },
  {
    id: "PL_MS_02",
    category: "PL_VS_MS",
    categoryLabel: "Packing List ↔ Mill Sheet",
    fieldLabel: "Spesifikasi / Grade Material",
    sourceDocType: "Packing List",
    targetDocType: "MS",
    sourceFieldKeys: ["Spesifikasi", "Spek_Material", "Grade"],
    targetFieldKeys: ["Spek_Material", "Grade", "Specification"],
    excelRef: "Checklist MS #6",
    description: "Cocokkan spesifikasi material grade pada Mill Sheet dengan Packing List.",
  },

  // 5. INVOICE & BL VS FORM AK (COO) (SOP AK Page 1, 2-5, 6)
  {
    id: "AK_INV_01",
    category: "INV_BL_VS_AK",
    categoryLabel: "Invoice & BL ↔ Form AK (COO)",
    fieldLabel: "Nomor Invoice",
    sourceDocType: "Invoice",
    targetDocType: "AK",
    sourceFieldKeys: ["Invoice_Number", "No_Invoice", "Nomor_Invoice"],
    targetFieldKeys: ["Nomor_Invoice", "Invoice_Number", "No_Invoice", "Number_and_Date_of_Invoices"],
    excelRef: "AK Page 1 #17 • AK Page 6 #13",
    description: "Cocokkan nomor invoice komersial yang dicantumkan pada Form AK.",
  },
  {
    id: "AK_INV_02",
    category: "INV_BL_VS_AK",
    categoryLabel: "Invoice & BL ↔ Form AK (COO)",
    fieldLabel: "Tanggal Invoice",
    sourceDocType: "Invoice",
    targetDocType: "AK",
    sourceFieldKeys: ["Tanggal_Invoice", "Invoice_Date"],
    targetFieldKeys: ["Tanggal_Invoice", "Invoice_Date", "Number_and_Date_of_Invoices"],
    excelRef: "AK Page 1 #17 • AK Page 6 #13",
    description: "Pastikan tanggal invoice pada Form AK sesuai dengan Commercial Invoice.",
  },
  {
    id: "AK_INV_03",
    category: "INV_BL_VS_AK",
    categoryLabel: "Invoice & BL ↔ Form AK (COO)",
    fieldLabel: "Nama Consignee (Buyer)",
    sourceDocType: "Invoice",
    targetDocType: "AK",
    sourceFieldKeys: ["Identitas_Pembeli", "Buyer", "Consignee"],
    targetFieldKeys: ["Nama_Consignee", "Consignee", "Identitas_Pembeli"],
    excelRef: "AK Page 1 #3",
    description: "Pastikan nama dan alamat Consignee pada Form AK sesuai dengan Invoice.",
  },
  {
    id: "AK_BL_01",
    category: "INV_BL_VS_AK",
    categoryLabel: "Invoice & BL ↔ Form AK (COO)",
    fieldLabel: "Nama Vessel",
    sourceDocType: "BL",
    targetDocType: "AK",
    sourceFieldKeys: ["Nama_Kapal", "Vessel_Name"],
    targetFieldKeys: ["Nama_Vessel", "Vessel_Name", "Nama_Kapal"],
    excelRef: "AK Page 1 #5",
    description: "Pastikan nama kapal pengangkut pada Form AK sesuai dengan Bill of Lading (B/L).",
  },
  {
    id: "AK_BL_02",
    category: "INV_BL_VS_AK",
    categoryLabel: "Invoice & BL ↔ Form AK (COO)",
    fieldLabel: "Pelabuhan Bongkar (Port of Discharge)",
    sourceDocType: "BL",
    targetDocType: "AK",
    sourceFieldKeys: ["Pelabuhan_Tujuan", "Port_of_Discharge"],
    targetFieldKeys: ["Pelabuhan_Bongkar", "Port_of_Discharge", "Pelabuhan_Tujuan"],
    excelRef: "AK Page 1 #6",
    description: "Cocokkan pelabuhan bongkar pada Form AK dengan B/L.",
  },
  {
    id: "AK_PL_01",
    category: "INV_BL_VS_AK",
    categoryLabel: "Invoice & BL ↔ Form AK (COO)",
    fieldLabel: "Gross Weight / Kuantitas",
    sourceDocType: "Packing List",
    targetDocType: "AK",
    sourceFieldKeys: ["Gross_Weight", "Total_Gross_Weight"],
    targetFieldKeys: ["Gross_Weight", "Quantity", "Berat_Kuantitas"],
    excelRef: "AK Page 1 #13 • AK Page 2-5 #8",
    description: "Cocokkan total berat atau kuantitas pada Form AK dengan Packing List.",
  },
];

/**
 * Normalizes document type key for reliable matching in batch details.
 */
function isDocTypeMatch(fileType: string, targetType: string): boolean {
  const ft = (fileType || "").trim().toLowerCase();
  const tt = targetType.trim().toLowerCase();

  if (tt === "invoice") return ft.includes("invoice") && !ft.includes("pib");
  if (tt === "packing list" || tt === "pl") return ft.includes("packing") || ft === "pl";
  if (tt === "bl") return ft.includes("bl") || ft.includes("lading") || ft === "b/l";
  if (tt === "ms") return ft.includes("mill") || ft === "ms" || ft.includes("mtc");
  if (tt === "wl") return ft.includes("weight") || ft === "wl";
  if (tt === "ak") return ft.includes("ak") || ft.includes("coo") || ft.includes("origin");
  if (tt === "pib") return ft === "pib" || ft.includes("file acuan") || ft.startsWith("pib");

  return ft === tt || ft.includes(tt);
}

/**
 * Finds parsed document by its target type.
 */
function findDocByType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Array<{ fileType: string; isi?: string | null; fileName?: string; [key: string]: any }>,
  targetType: string
) {
  const found = details.find((d) => isDocTypeMatch(d.fileType, targetType));
  if (!found) return null;
  const parsed = parseDocIsi(found.isi);
  return {
    fileType: found.fileType,
    fileName: found.fileName || found.fileType,
    fields: parsed.fields,
    table: parsed.table,
  };
}

/**
 * Evaluates all cross-document validation rules based on Docmatch USC field.xlsx.
 * Works alongside the primary PIB-anchor engine without changing its behavior.
 */
export function evaluateCrossDocumentMatching(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Array<{ fileType: string; isi?: string | null; fileName?: string; [key: string]: any }>,
  equivalencyGroups: DbEquivalencyGroup[] = []
): CrossDocBatchReport {
  const allResults: CrossCheckItemResult[] = [];
  const resultsByCategory: Record<string, CrossCheckItemResult[]> = {
    INVOICE_VS_PL: [],
    PL_VS_BL: [],
    PL_VS_WL: [],
    PL_VS_MS: [],
    INV_BL_VS_AK: [],
    INTERNAL_INTEGRITY: [],
  };

  for (const rule of CROSS_CHECK_RULES) {
    const srcDoc = findDocByType(details, rule.sourceDocType);
    const tgtDoc = findDocByType(details, rule.targetDocType);

    // If either document is missing in the uploaded batch, mark as SKIPPED
    if (!srcDoc || !tgtDoc) {
      const skippedNote = !srcDoc && !tgtDoc
        ? `Dokumen ${rule.sourceDocType} dan ${rule.targetDocType} belum diunggah`
        : !srcDoc
        ? `Dokumen ${rule.sourceDocType} belum diunggah`
        : `Dokumen ${rule.targetDocType} belum diunggah`;

      const item: CrossCheckItemResult = {
        ruleId: rule.id,
        category: rule.category,
        categoryLabel: rule.categoryLabel,
        fieldLabel: rule.fieldLabel,
        sourceDocType: rule.sourceDocType,
        targetDocType: rule.targetDocType,
        sourceFileName: srcDoc?.fileName,
        targetFileName: tgtDoc?.fileName,
        sourceValue: "-",
        targetValue: "-",
        status: "SKIPPED",
        isMatch: false,
        excelRef: rule.excelRef,
        notes: skippedNote,
      };

      allResults.push(item);
      resultsByCategory[rule.category].push(item);
      continue;
    }

    const valSrc = getVal(srcDoc.fields, ...rule.sourceFieldKeys);
    const valTgt = getVal(tgtDoc.fields, ...rule.targetFieldKeys);

    // If either value is missing ("-"), neutral check
    if (!valSrc || !valTgt || valSrc === "-" || valTgt === "-") {
      const missingSide = valSrc === "-" && valTgt === "-"
        ? "Field tidak terdeteksi pada kedua dokumen"
        : valSrc === "-"
        ? `Field tidak terdeteksi pada ${rule.sourceDocType}`
        : `Field tidak terdeteksi pada ${rule.targetDocType}`;

      const item: CrossCheckItemResult = {
        ruleId: rule.id,
        category: rule.category,
        categoryLabel: rule.categoryLabel,
        fieldLabel: rule.fieldLabel,
        sourceDocType: rule.sourceDocType,
        targetDocType: rule.targetDocType,
        sourceFileName: srcDoc.fileName,
        targetFileName: tgtDoc.fileName,
        sourceValue: valSrc || "-",
        targetValue: valTgt || "-",
        status: "SKIPPED",
        isMatch: false,
        excelRef: rule.excelRef,
        notes: missingSide,
      };

      allResults.push(item);
      resultsByCategory[rule.category].push(item);
      continue;
    }

    // Perform equivalent matching using shared engine
    const eq = isEquivalentMatch(valSrc, valTgt, rule.fieldLabel, equivalencyGroups);
    const isMatch = eq.isMatch;
    const status: "MATCH" | "MISMATCH" = isMatch ? "MATCH" : "MISMATCH";
    const notes = isMatch
      ? (eq.reason ? `Selaras (${eq.reason})` : "Selaras (Konsisten)")
      : `Selisih Antar Dokumen: ${rule.sourceDocType} ("${valSrc}") ≠ ${rule.targetDocType} ("${valTgt}")`;

    const item: CrossCheckItemResult = {
      ruleId: rule.id,
      category: rule.category,
      categoryLabel: rule.categoryLabel,
      fieldLabel: rule.fieldLabel,
      sourceDocType: rule.sourceDocType,
      targetDocType: rule.targetDocType,
      sourceFileName: srcDoc.fileName,
      targetFileName: tgtDoc.fileName,
      sourceValue: valSrc,
      targetValue: valTgt,
      status,
      isMatch,
      reason: eq.reason,
      excelRef: rule.excelRef,
      notes,
    };

    allResults.push(item);
    resultsByCategory[rule.category].push(item);
  }

  // Calculate statistics
  const totalRules = allResults.length;
  const skippedCount = allResults.filter((r) => r.status === "SKIPPED").length;
  const matchedCount = allResults.filter((r) => r.status === "MATCH").length;
  const mismatchCount = allResults.filter((r) => r.status === "MISMATCH").length;
  const evaluatedCount = matchedCount + mismatchCount;
  const isFullyConsistent = mismatchCount === 0;
  const scorePercentage = evaluatedCount > 0 ? Math.round((matchedCount / evaluatedCount) * 100) : 100;

  const mismatches = allResults.filter((r) => r.status === "MISMATCH");

  return {
    totalRules,
    evaluatedCount,
    matchedCount,
    mismatchCount,
    skippedCount,
    isFullyConsistent,
    scorePercentage,
    resultsByCategory,
    allResults,
    mismatches,
  };
}

