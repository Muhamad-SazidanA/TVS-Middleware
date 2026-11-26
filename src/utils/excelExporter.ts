import ExcelJS from "exceljs";
import {
  buildBatchChangeLogs,
  extractManualNotesFromBatch,
  formatDocDisplayName,
} from "./changeLogBuilder";

export interface ExportDetailBatch {
  id?: number | string;
  batchId?: string;
  fileType: string;
  fileId?: string;
  nomorAju?: string | null;
  nomorInvoice?: string | null;
  isi?: string | null;
  createdAt?: string;
}

export interface ExportBatchItem {
  id: string;
  no?: number;
  nama: string;
  subtext?: string;
  totalFile: number;
  status: "Matching" | "Mismatching" | "Proses" | string;
  details?: ExportDetailBatch[];
}

export interface ExportFieldReport {
  documentType: string;
  fieldName: string;
  pibValue: string;
  pembandingValue: string;
  status: "MATCH" | "MISMATCH" | "INFO";
  isMatch: boolean;
  notes: string;
}

/**
 * Sanitizes and truncates a sheet name to meet Microsoft Excel specifications:
 * - Max 31 characters
 * - No invalid characters: \ / ? * : [ ]
 * - Uniquely registered in usedNames
 */
export function getSafeSheetName(rawName: string, usedNames?: Set<string>): string {
  let clean = rawName.replace(/[\\/?*:[\]]/g, "_").trim();
  if (clean.length > 31) {
    clean = clean.slice(0, 31).trim();
  }

  if (usedNames) {
    let finalName = clean;
    let counter = 1;
    while (usedNames.has(finalName.toLowerCase())) {
      const suffix = `_${counter}`;
      finalName = clean.slice(0, 31 - suffix.length) + suffix;
      counter++;
    }
    usedNames.add(finalName.toLowerCase());
    return finalName;
  }

  return clean;
}

/**
 * Determines the detail sheet name for a specific batch.
 * Format: Detail Matching & Mismatch (Nomor Batch)
 */
export function getBatchDetailSheetName(batchId: string, usedNames?: Set<string>): string {
  const trimmed = String(batchId || "").trim();
  const compactId = /^\d+$/.test(trimmed) ? String(parseInt(trimmed, 10)) : trimmed;

  // 1. Try "Detail Matching & Mismatch (compactId)" - e.g. "Detail Matching & Mismatch (4)" is exactly 30 chars
  const candidate1 = `Detail Matching & Mismatch (${compactId})`;
  if (candidate1.length <= 31) {
    return getSafeSheetName(candidate1, usedNames);
  }

  // 2. Try "Detail Match & Mismatch (trimmed)" - e.g. "Detail Match & Mismatch (0004)" is 30 chars
  const candidate2 = `Detail Match & Mismatch (${trimmed})`;
  if (candidate2.length <= 31) {
    return getSafeSheetName(candidate2, usedNames);
  }

  // 3. Try "Detail Match (trimmed)" - e.g. "Detail Match (0004)" is 19 chars
  const candidate3 = `Detail Match (${trimmed})`;
  if (candidate3.length <= 31) {
    return getSafeSheetName(candidate3, usedNames);
  }

  // 4. Compact fallback
  return getSafeSheetName(`Detail (${compactId})`, usedNames);
}

interface GenerateExcelOptions {
  batches: ExportBatchItem[];
  getComparisonReport: (batch: ExportBatchItem) => {
    allFields: ExportFieldReport[];
    mismatches: ExportFieldReport[];
  };
  getEffectiveStatus?: (batch: ExportBatchItem) => "Matching" | "Mismatching" | "Proses";
  customFilename?: string;
}

/**
 * Generates and downloads clean, emoji-free multi-sheet Excel file (.xlsx)
 * strictly adhering to previous clean style (Image 2 and Image 3):
 * 1. Default visible sheet: "Recap Matching & Mismatch"
 * 2. Detail sheet for each batch: "Detail Matching & Mismatch (Nomor Batch)"
 * 3. Text hyperlink from Recap to Detail sheet ("Lihat Detail") and back ("Kembali ke Rekap")
 */
export async function generateMatchingExcel({
  batches,
  getComparisonReport,
  getEffectiveStatus,
  customFilename,
}: GenerateExcelOptions): Promise<void> {
  if (!batches || batches.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "USC-Middleware";
  workbook.lastModifiedBy = "USC-Middleware";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Excel workbook view: ensure Recap is the active tab when opened
  workbook.views = [
    {
      x: 0,
      y: 0,
      width: 10000,
      height: 20000,
      firstSheet: 0,
      activeTab: 0,
      visibility: "visible",
    },
  ];

  const RECAP_SHEET_NAME = "Recap Matching & Mismatch";
  const usedSheetNames = new Set<string>([RECAP_SHEET_NAME.toLowerCase()]);

  // Map each batch to detail sheet name and report data
  const batchSheetInfo = batches.map((batch) => {
    const detailSheetName = getBatchDetailSheetName(batch.id, usedSheetNames);
    const { allFields, mismatches } = getComparisonReport(batch);
    const matchCount = allFields.filter((f) => f.status === "MATCH").length;
    const mismatchCount = mismatches.length;
    const evaluatedStatus = getEffectiveStatus
      ? getEffectiveStatus(batch)
      : (batch.status as "Matching" | "Mismatching" | "Proses");

    return {
      batch,
      detailSheetName,
      allFields,
      mismatches,
      matchCount,
      mismatchCount,
      evaluatedStatus,
    };
  });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  // ==========================================
  // SHEET 1: RECAP MATCHING & MISMATCH (DEFAULT)
  // Matches Image 3 exactly (Clean, No Emoji)
  // ==========================================
  const recapSheet = workbook.addWorksheet(RECAP_SHEET_NAME, {
    views: [{ state: "normal", activeCell: "A1", showGridLines: true }],
  });

  recapSheet.columns = [
    { key: "id", width: 12 },
    { key: "nama", width: 36 },
    { key: "status", width: 18 },
    { key: "totalFile", width: 14 },
    { key: "fieldMatch", width: 16 },
    { key: "fieldMismatch", width: 16 },
    { key: "link", width: 16 },
  ];

  // Row 1: Header Banner (Image 3: RINGKASAN BATCH (X Batch))
  const recapTitleRow = recapSheet.addRow([`RINGKASAN BATCH (${batches.length} Batch)`]);
  recapSheet.mergeCells("A1:G1");
  recapTitleRow.height = 24;
  const recapTitleCell = recapSheet.getCell("A1");
  recapTitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // Clean navy #1e293b
  };
  recapTitleCell.font = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  recapTitleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // Row 2: Table Column Headers (Image 3)
  const recapHeaderRow = recapSheet.addRow([
    "ID Batch",
    "Nama Batch",
    "Status Batch",
    "Total File",
    "Field Match",
    "Field Mismatch",
    "Detail",
  ]);
  recapHeaderRow.height = 24;

  recapHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" }, // #f1f5f9
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FF1E293B" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = thinBorder;
  });
  recapSheet.getCell("B2").alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // Data Rows (Clean White Background, exactly like Image 3)
  batchSheetInfo.forEach((item) => {
    const row = recapSheet.addRow([
      item.batch.id,
      item.batch.nama,
      item.evaluatedStatus,
      `${item.batch.totalFile || 0} File`,
      item.matchCount,
      item.mismatchCount,
      "Lihat Detail",
    ]);
    row.height = 22;

    const isMatching = item.evaluatedStatus === "Matching";
    const isMismatching = item.evaluatedStatus === "Mismatching";

    // Col 1: ID Batch (Clickable link to detail sheet)
    const cId = row.getCell(1);
    const safeBatchId = String(item.batch.id).replace(/"/g, '""');
    cId.value = {
      formula: `HYPERLINK("#'${item.detailSheetName}'!A1", "${safeBatchId}")`,
      result: String(item.batch.id),
    };
    cId.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1E40AF" }, underline: true };
    cId.alignment = { vertical: "middle", horizontal: "center" };

    // Col 2: Nama Batch
    const cNama = row.getCell(2);
    cNama.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FF1E293B" } };
    cNama.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    // Col 3: Status Batch (Image 3: Matching in green, Mismatching in dark red)
    const cStatus = row.getCell(3);
    cStatus.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: isMatching ? "FF166534" : isMismatching ? "FF991B1B" : "FFB45309" },
    };
    cStatus.alignment = { vertical: "middle", horizontal: "center" };

    // Col 4: Total File
    const cTotal = row.getCell(4);
    cTotal.font = { name: "Calibri", size: 10.5, color: { argb: "FF334155" } };
    cTotal.alignment = { vertical: "middle", horizontal: "center" };

    // Col 5: Field Match (Image 3: green font)
    const cMatch = row.getCell(5);
    cMatch.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF166534" } };
    cMatch.alignment = { vertical: "middle", horizontal: "center" };

    // Col 6: Field Mismatch (Image 3: red if > 0, else blue/slate)
    const cMismatch = row.getCell(6);
    cMismatch.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: item.mismatchCount > 0 ? "FF991B1B" : "FF1E40AF" },
    };
    cMismatch.alignment = { vertical: "middle", horizontal: "center" };

    // Col 7: Link Detail (Clean text hyperlink, NO emoji)
    const cLink = row.getCell(7);
    cLink.value = {
      formula: `HYPERLINK("#'${item.detailSheetName}'!A1", "Lihat Detail")`,
      result: "Lihat Detail",
    };
    cLink.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FF1E40AF" }, underline: true };
    cLink.alignment = { vertical: "middle", horizontal: "center" };

    // Clean white fill & borders for all cells
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };
      cell.border = thinBorder;
    });
  });

  // Summary Footer Row (If more than 1 batch)
  if (batches.length > 1) {
    const totalFilesAll = batches.reduce((acc, b) => acc + (b.totalFile || 0), 0);
    const totalMatchAll = batchSheetInfo.reduce((acc, i) => acc + i.matchCount, 0);
    const totalMismatchAll = batchSheetInfo.reduce((acc, i) => acc + i.mismatchCount, 0);

    const totalRow = recapSheet.addRow([
      "Total",
      `${batches.length} Batch`,
      "",
      `${totalFilesAll} File`,
      totalMatchAll,
      totalMismatchAll,
      "",
    ]);
    totalRow.height = 24;
    totalRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      cell.font = {
        name: "Calibri",
        size: 10.5,
        bold: true,
        color:
          colNumber === 5
            ? { argb: "FF166534" }
            : colNumber === 6
              ? { argb: totalMismatchAll > 0 ? "FF991B1B" : "FF1E40AF" }
              : { argb: "FF1E293B" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 2 ? "left" : "center",
        indent: colNumber === 2 ? 1 : 0,
      };
      cell.border = thinBorder;
    });
  }

  // ==========================================
  // SHEET 2+: DETAIL MATCHING & MISMATCH (EACH BATCH)
  // Matches Image 2 exactly (Clean, No Emoji)
  // ==========================================
  batchSheetInfo.forEach((item) => {
    const detailSheet = workbook.addWorksheet(item.detailSheetName, {
      views: [{ state: "normal", activeCell: "A1", showGridLines: true }],
    });

    detailSheet.columns = [
      { key: "no", width: 8 },
      { key: "docType", width: 22 },
      { key: "param", width: 30 },
      { key: "pibVal", width: 32 },
      { key: "compVal", width: 32 },
      { key: "status", width: 14 },
      { key: "notes", width: 50 },
    ];

    // Row 1: Back Navigation to Recap Sheet (Clean text, NO emoji)
    const backRow = detailSheet.addRow(["Kembali ke Recap Matching & Mismatch"]);
    detailSheet.mergeCells("A1:G1");
    backRow.height = 22;
    const backCell = detailSheet.getCell("A1");
    backCell.value = {
      formula: `HYPERLINK("#'${RECAP_SHEET_NAME}'!A1", "Kembali ke Recap Matching & Mismatch")`,
      result: "Kembali ke Recap Matching & Mismatch",
    };
    backCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FAFC" },
    };
    backCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E40AF" }, underline: true };
    backCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    backCell.border = thinBorder;

    // Row 2: Detail Header Title (Clean Navy bar)
    const titleRow = detailSheet.addRow([
      `DETAIL EVALUASI MATCHING & DATA ACTION - BATCH ${item.batch.id}`,
    ]);
    detailSheet.mergeCells("A2:G2");
    titleRow.height = 24;
    const titleCell = detailSheet.getCell("A2");
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    titleCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    // Section 1 Header: Data Bersih
    const sec1Banner = detailSheet.addRow([
      "BAGIAN 1: PERBANDINGAN FIELD BERSIH (NILAI ASLI DOKUMEN / RAW OCR)",
    ]);
    detailSheet.mergeCells(`A${sec1Banner.number}:G${sec1Banner.number}`);
    sec1Banner.height = 22;
    const sec1Cell = detailSheet.getCell(`A${sec1Banner.number}`);
    sec1Cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    sec1Cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    sec1Cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    // Row 4: Table Column Headers (Image 2)
    const headerRow = detailSheet.addRow([
      "No",
      "Dokumen",
      "Field Parameter",
      "Nilai PIB (Acuan Utama)",
      "Nilai Dokumen Pembanding",
      "Status",
      "Keterangan / Verifikasi",
    ]);
    headerRow.height = 24;

    headerRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      cell.font = {
        name: "Calibri",
        size: 10.5,
        bold: true,
        color: { argb: "FF1E293B" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 1 || colNumber === 6 ? "center" : "left",
        indent: colNumber === 1 || colNumber === 6 ? 0 : 1,
      };
      cell.border = thinBorder;
    });

    // Row 4+: Data Rows (Image 2 clean style)
    if (item.allFields.length === 0) {
      const emptyRow = detailSheet.addRow([
        1,
        "-",
        "-",
        "-",
        "-",
        "INFO",
        "Belum ada data perbandingan pada batch ini atau data masih dalam status Proses.",
      ]);
      emptyRow.height = 24;
      detailSheet.mergeCells("B4:G4");
      emptyRow.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
      emptyRow.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        c.border = thinBorder;
      });
    } else {
      item.allFields.forEach((field, fIdx) => {
        const row = detailSheet.addRow([
          fIdx + 1,
          field.documentType,
          field.fieldName,
          field.pibValue || "-",
          field.pembandingValue || "-",
          field.status === "MATCH" ? "Match" : field.status === "MISMATCH" ? "Mismatch" : "Info",
          field.notes || "-",
        ]);
        row.height = 22;

        const isMatch = field.status === "MATCH";
        const isMismatch = field.status === "MISMATCH";

        // Col 1: No
        const cNo = row.getCell(1);
        cNo.font = { name: "Calibri", size: 10, color: { argb: "FF334155" } };
        cNo.alignment = { vertical: "middle", horizontal: "center" };

        // Col 2: Dokumen
        const cDoc = row.getCell(2);
        cDoc.font = { name: "Calibri", size: 10, color: { argb: "FF334155" } };
        cDoc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

        // Col 3: Field Parameter
        const cParam = row.getCell(3);
        cParam.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E293B" } };
        cParam.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

        // Col 4: Nilai PIB (Acuan Utama)
        const cPib = row.getCell(4);
        cPib.font = { name: "Consolas", size: 9.5, color: { argb: "FF0F172A" } };
        cPib.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

        // Col 5: Nilai Dokumen Pembanding
        const cComp = row.getCell(5);
        cComp.font = {
          name: "Consolas",
          size: 9.5,
          bold: isMismatch,
          color: { argb: isMismatch ? "FFB91C1C" : "FF0F172A" },
        };
        cComp.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

        // Col 6: Status Badge (Image 2 style: clean green Match, red Mismatch)
        const cStatus = row.getCell(6);
        cStatus.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: isMatch ? "FF166534" : isMismatch ? "FF991B1B" : "FF64748B" },
        };
        cStatus.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isMatch ? "FFF0FDF4" : isMismatch ? "FFFEF2F2" : "FFF8FAFC" },
        };
        cStatus.alignment = { vertical: "middle", horizontal: "center" };

        // Col 7: Keterangan
        const cNotes = row.getCell(7);
        cNotes.font = { name: "Calibri", size: 9.5, color: { argb: "FF475569" } };
        cNotes.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };

        // Borders & background: pure white for clean look
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber !== 6) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFFFFF" },
            };
          }
          cell.border = thinBorder;
        });
      });
    }

    // ==========================================
    // SECTION 2: LOG LENGKAP PERUBAHAN (DATA ACTION, KAMUS, EDIT & SETUJUI)
    // ==========================================
    detailSheet.addRow([]); // Blank line
    const sec2Banner = detailSheet.addRow([
      "BAGIAN 2: LOG LENGKAP PERUBAHAN (DATA ACTION, KAMUS, EDIT & SETUJUI)",
    ]);
    detailSheet.mergeCells(`A${sec2Banner.number}:G${sec2Banner.number}`);
    sec2Banner.height = 22;
    const sec2Cell = detailSheet.getCell(`A${sec2Banner.number}`);
    sec2Cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    sec2Cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    sec2Cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    const actHdrRow = detailSheet.addRow([
      "No",
      "Dokumen",
      "Field Terkait",
      "Kategori Aksi",
      "Nilai Sebelum / Asli",
      "Nilai Sesudah / Hasil",
      "Detail Perubahan, Pelaku & Waktu",
    ]);
    actHdrRow.height = 22;
    actHdrRow.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFBF1" } };
      c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF115E59" } };
      c.alignment = { vertical: "middle", horizontal: "center" };
      c.border = thinBorder;
    });

    const batchActions = buildBatchChangeLogs(item.batch as any).map((ev) => ({
      docType: formatDocDisplayName(ev.docType),
      fieldName: ev.fieldLabel || ev.fieldName,
      actionType: ev.categoryLabel,
      oldVal: ev.oldValue || "-",
      newVal: ev.newValue || "-",
      notes: `${ev.notes}${ev.actor ? ` (${ev.actor})` : ""}${ev.timestamp ? ` • ${ev.timestamp}` : ""}`,
    }));

    if (batchActions.length === 0) {
      const emptyActRow = detailSheet.addRow([
        1,
        "-",
        "-",
        "Semua Nilai Bersih",
        "-",
        "-",
        "Belum ada Data Action, Kamus Ekuivalensi, Edit Manual, atau Setujui pada batch ini.",
      ]);
      emptyActRow.height = 22;
      detailSheet.mergeCells(`D${emptyActRow.number}:F${emptyActRow.number}`);
      emptyActRow.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        c.border = thinBorder;
      });
    } else {
      batchActions.forEach((act, actIdx) => {
        const aRow = detailSheet.addRow([
          actIdx + 1,
          act.docType,
          act.fieldName,
          act.actionType,
          act.oldVal,
          act.newVal,
          act.notes,
        ]);
        aRow.height = 24;
        aRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
        aRow.getCell(2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        aRow.getCell(3).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F766E" } };
        aRow.getCell(3).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        aRow.getCell(4).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        aRow.getCell(5).font = { name: "Consolas", size: 9.5, color: { argb: "FF64748B" } };
        aRow.getCell(5).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        aRow.getCell(6).font = { name: "Consolas", size: 9.5, bold: true, color: { argb: "FF0F766E" } };
        aRow.getCell(6).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        aRow.getCell(7).font = { name: "Calibri", size: 9.5, color: { argb: "FF334155" } };
        aRow.getCell(7).alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };

        aRow.eachCell({ includeEmpty: true }, (c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: actIdx % 2 === 1 ? "FFF0FDFA" : "FFFFFFFF" } };
          c.border = thinBorder;
        });
      });
    }

    // ==========================================
    // SECTION 3: CATATAN MANUAL OPERATOR
    // ==========================================
    const manualNotes = extractManualNotesFromBatch(item.batch as any);
    detailSheet.addRow([]);
    const sec3Banner = detailSheet.addRow([
      "BAGIAN 3: CATATAN MANUAL OPERATOR",
    ]);
    detailSheet.mergeCells(`A${sec3Banner.number}:G${sec3Banner.number}`);
    sec3Banner.height = 22;
    const sec3Cell = detailSheet.getCell(`A${sec3Banner.number}`);
    sec3Cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    sec3Cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    sec3Cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    const noteHdrRow = detailSheet.addRow([
      "No",
      "Dokumen",
      "Field / Target Terkait",
      "Isi Catatan",
      "Diinput Oleh",
      "Waktu Catatan",
      "Status",
    ]);
    noteHdrRow.height = 22;
    noteHdrRow.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E293B" } };
      c.alignment = { vertical: "middle", horizontal: "center" };
      c.border = thinBorder;
    });

    if (manualNotes.length === 0) {
      const emptyNoteRow = detailSheet.addRow([
        1,
        "-",
        "-",
        "Tidak ada catatan manual tambahan pada batch ini.",
        "-",
        "-",
        "Sesuai",
      ]);
      emptyNoteRow.height = 22;
      detailSheet.mergeCells(`D${emptyNoteRow.number}:F${emptyNoteRow.number}`);
      emptyNoteRow.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        c.border = thinBorder;
      });
    } else {
      manualNotes.forEach((n, nIdx) => {
        const nRow = detailSheet.addRow([
          nIdx + 1,
          n.docType,
          n.targetKey,
          n.note,
          n.author,
          n.timestampRaw || "-",
          "Tercatat",
        ]);
        nRow.height = 22;
        nRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
        nRow.getCell(2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        nRow.getCell(3).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        nRow.getCell(4).alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
        nRow.getCell(5).alignment = { vertical: "middle", horizontal: "center" };
        nRow.getCell(6).alignment = { vertical: "middle", horizontal: "center" };
        nRow.getCell(7).alignment = { vertical: "middle", horizontal: "center" };
        nRow.eachCell({ includeEmpty: true }, (c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
          c.border = thinBorder;
        });
      });
    }

  });

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileName =
    customFilename ||
    (batches.length === 1
      ? `Laporan_Matching_Batch_${batches[0]?.id || "export"}`
      : `Laporan_Matching_${batches.length}_Batch`);

  link.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
