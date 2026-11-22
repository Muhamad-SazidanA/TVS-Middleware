import { filterCategoryData } from "~/server/nanonets";
import { applyDataActionsToFields } from "~/utils/workflowRunner";
import { WorkflowStep } from "~/types/workflow";
import { loadFixture } from "./testHelpers";

export interface DetailBatchItem {
  id?: number;
  batchId?: number;
  fileType: string;
  fileId: string;
  isi: string;
}

export interface UscBatchFixtureOptions {
  pibOverrides?: { fields?: Record<string, string>; table?: Record<string, string>[] };
  ciOverrides?: { fields?: Record<string, string>; table?: Record<string, string>[] };
  plOverrides?: { fields?: Record<string, string>; table?: Record<string, string>[] };
  blOverrides?: { fields?: Record<string, string>; table?: Record<string, string>[] };
  akOverrides?: { fields?: Record<string, string>; table?: Record<string, string>[] };
  wlOverrides?: { fields?: Record<string, string>; table?: Record<string, string>[] };
  msOverrides?: { fields?: Record<string, string>; table?: Record<string, string>[] };
  activeDataActions?: WorkflowStep[];
  includeDocTypes?: Array<"PIB" | "Invoice" | "Packing List" | "Bill of Lading" | "AK" | "WL" | "MS">;
}

const KEY_MAP: Record<string, string[]> = {
  "no invoice": ["No_Invoice", "No Invoice", "Invoice_Number", "Invoice Number"],
  "tanggal invoice": ["Tanggal_Invoice", "Tanggal Invoice", "Invoice_Date", "Invoice Date"],
  "no bl": ["No_BL", "No BL", "Sea_Waybill_Number", "Sea Waybill Number", "BL_Number", "No_House_BL", "No House BL"],
  "date": ["Tanggal_BL", "Tanggal BL", "BL_Date"],
  "berat bersih": ["Berat_Bersih", "Berat Bersih", "Net_Weight", "Net Weight"],
  "berat kotor": ["Berat_Kotor", "Berat Kotor", "Gross_Weight", "Gross Weight"],
  "gross weight": ["Gross_Weight", "Gross Weight", "Berat_Kotor", "Berat Kotor"],
  "net weight": ["Net_Weight", "Net Weight", "Berat_Bersih", "Berat Bersih", "Total_Net_Weight", "Total Net Weight"],
  "nilai pabean": ["Nilai_Pabean", "Nilai Pabean", "Nilai", "Nilai Total"],
  "nilai total invoice": ["Nilai_Total_Invoice", "Total", "Nilai Total"],
  "incoterms": ["Incoterms", "Incoterm", "Ket_FOB", "Ket FOB", "Terms_of_Delivery", "Cara_Penyerahan"],
  "incoterms lokasi": ["Incoterms_Lokasi", "Incoterms", "Incoterm", "Terms_of_Delivery"],
  "pelabuhan muat": ["Pelabuhan_Muat", "Pelabuhan Muat", "Pelabuhan_Asal", "Pelabuhan Asal", "Port_of_Loading"],
  "pelabuhan asal": ["Pelabuhan_Asal", "Pelabuhan Asal", "Pelabuhan_Muat", "Port_of_Loading"],
  "pelabuhan tujuan": ["Pelabuhan_Tujuan", "Pelabuhan Tujuan", "Destination", "destination"],
  "no referensi": ["No_Referensi", "Reference_No"],
  "nama importir": ["Nama_Importir", "Nama Importir", "Consignee", "Importir"],
  "identitas pembeli": ["Identitas_Pembeli", "Nama_Importir", "Consignee"],
};

/**
 * Synchronizes field values across common naming variants
 */
function standardizeFieldKeys(fields: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = { ...fields };
  for (const [rawKey, val] of Object.entries(fields)) {
    const kNorm = rawKey.toLowerCase().replace(/_/g, " ").trim();
    const aliases = KEY_MAP[kNorm];
    if (aliases) {
      for (const alias of aliases) {
        result[alias] = val;
      }
    }
  }
  return result;
}

/**
 * Creates a complete mock batch representing all 7 USC documents
 */
export function createUscBatchFixture(options: UscBatchFixtureOptions = {}): DetailBatchItem[] {
  const {
    pibOverrides,
    ciOverrides,
    plOverrides,
    blOverrides,
    akOverrides,
    wlOverrides,
    msOverrides,
    activeDataActions = [],
    includeDocTypes = ["PIB", "Invoice", "Packing List", "Bill of Lading", "AK", "WL", "MS"],
  } = options;

  const docs: Array<{ type: string; fixture: string; category: string; overrides?: any }> = [
    { type: "PIB", fixture: "usc_sample_pib.json", category: "PIB", overrides: pibOverrides },
    { type: "Invoice", fixture: "usc_sample_ci.json", category: "Invoice", overrides: ciOverrides },
    { type: "Packing List", fixture: "usc_sample_pl.json", category: "Packing List", overrides: plOverrides },
    { type: "Bill of Lading", fixture: "usc_sample_bl.json", category: "Bill of Lading", overrides: blOverrides },
    { type: "AK", fixture: "usc_sample_ak.json", category: "AK", overrides: akOverrides },
    { type: "WL", fixture: "usc_sample_wl.json", category: "WL", overrides: wlOverrides },
    { type: "MS", fixture: "usc_sample_ms.json", category: "MS", overrides: msOverrides },
  ];

  const results: DetailBatchItem[] = [];

  for (const doc of docs) {
    if (!includeDocTypes.includes(doc.type as any)) continue;

    const rawPayload = loadFixture(doc.fixture);
    const filtered = filterCategoryData(rawPayload, doc.category);

    if (doc.overrides?.fields) {
      filtered.fields = { ...filtered.fields, ...doc.overrides.fields };
    }
    if (doc.overrides?.table) {
      filtered.table = doc.overrides.table;
    }

    filtered.fields = standardizeFieldKeys(filtered.fields);

    // Apply Data Actions if configured
    if (activeDataActions.length > 0) {
      filtered.fields = applyDataActionsToFields(filtered.fields, doc.type.toLowerCase(), activeDataActions);
      if (Array.isArray(filtered.table)) {
        filtered.table = filtered.table.map((row) =>
          applyDataActionsToFields(row, doc.type.toLowerCase(), activeDataActions)
        );
      }
    }

    results.push({
      fileType: doc.type,
      fileId: `file_${doc.type.toLowerCase().replace(/\s+/g, "_")}`,
      isi: JSON.stringify(filtered),
    });
  }

  return results;
}
