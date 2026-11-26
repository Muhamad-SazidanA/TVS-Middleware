import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { evaluateBatchComparison } from "~/app/matching/_components/detailAdapter";
import { loadServerEquivalencyGroups } from "~/server/equivalencyLoader";
import {
  buildBatchChangeLogs,
  extractManualNotesFromBatch,
  formatDocDisplayName,
} from "~/utils/changeLogBuilder";
import { logSystemAudit } from "~/server/auditLogger";

export const dynamic = "force-dynamic";

function formatDate(d?: Date | string | null): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

function getSafeSheetName(rawName: string, usedNames: Set<string>): string {
  let clean = rawName.replace(/[\\/?*:[\]]/g, "_").trim();
  if (clean.length > 31) {
    clean = clean.slice(0, 31).trim();
  }
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

// Formatter to map raw field keys into clean, human-readable parameters
function formatFieldLabel(key: string): string {
  const map: Record<string, string> = {
    No_Invoice: "Invoice Number",
    Tanggal_Invoice: "Invoice Date",
    Pelabuhan_Asal: "Port of Loading",
    Pelabuhan_Tujuan: "Destination",
    Identitas_Penjual: "Exporter / Supplier",
    Identitas_Pembeli: "Consignee",
    Identitas_Supplier: "Supplier",
    Identitas_Buyer: "Buyer",
    Nilai_Total_Invoice: "Total Nilai Invoice",
    Gross_Weight: "Gross Weight",
    Net_Weight: "Net Weight",
    Jumlah_Coil: "Jumlah Coil",
    Mata_Uang: "Currency (Mata Uang)",
    Deskripsi_Barang: "Item Description",
    Incoterms_Lokasi: "Terms of Delivery (Incoterms)",
    Moda: "Vessel / Moda",
    Negara_Asal: "Country of Origin",
    Negara_Tujuan: "Destination Country",
    Port_of_Loading: "Port of Loading",
    Port_of_Discharge: "Destination (Port of Discharge)",
    Tanggal_BL: "Date (Tanggal BL)",
    Vessel_Name: "Vessel Name",
    Nama_Vessel: "Vessel Name",
    Jumlah_Package: "QTY (Jumlah Package)",
    Notify_Party: "Notify Party",
    Consignee: "Consignee",
    Shipper: "Shipper / Exporter",
    No_Referensi: "No Referensi (Certificate No)",
    Nama_Exporter_Shipper: "Nama Exporter / Shipper",
    Nama_Consignee: "Nama Consignee",
    Nama_Pelabuhan_Bongkar: "Port of Discharge",
    Tanggal_Keberangkatan: "Departure Date",
    Total_Gross_Weight: "Total Gross Weight",
    No_Dan_Tanggal_Invoice: "Number and Date of Invoices",
    HS_Code: "HS Code",
    Waktu_Pembuatan_AK: "Place and Date of Issue",
    Spesifikasi_Grade: "Spesifikasi / Grade",
    Spek_Material: "Spek Material",
    Jumlah_Berat_Material: "Jumlah / Berat Material",
    Ukuran_Barang: "Ukuran Barang",
    Nama_Supplier: "Nama Supplier",
    Total_Berat: "Total Berat",
    Jumlah_Kemasan: "Jumlah dan Jenis Kemasan",
  };
  return map[key] || key.replace(/_/g, " ");
}

function formatDocName(type: string): string {
  const t = (type || "").toLowerCase().trim();
  if (t === "invoice" || t === "ci") return "Invoice";
  if (t === "pl" || t.includes("packing")) return "Packing List";
  if (t === "bl" || t.includes("lading")) return "Bill of Lading";
  if (t === "ak" || t.includes("coo") || t.includes("origin")) return "Form AK";
  if (t === "wl" || t.includes("weight")) return "Weight List";
  if (t === "ms" || t.includes("mill") || t.includes("sheet") || t === "mtc") return "Mill Sheet";
  return type;
}

interface ExportQueryOptions {
  mode: string;
  scope: string;
  archiveStatus?: string;
  startDate?: string | null;
  endDate?: string | null;
  search: string;
  batchIdsFilter: string[];
  markExported: boolean;
}

async function handleExcelExport(opts: ExportQueryOptions) {
  try {
    const session = await auth();
    const userRole = (session?.user as { role?: string })?.role || "STAFF";
    const currentUserId = session?.user?.id;

    const {
      mode,
      scope,
      archiveStatus = "APPROVED",
      startDate,
      endDate,
      search,
      batchIdsFilter,
      markExported,
    } = opts;

    // 1. RBAC & Scope constraints
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    if (batchIdsFilter.length > 0) {
      whereClause.id = { in: batchIdsFilter };
    }

    if (scope === "all_data") {
      const st = archiveStatus.toUpperCase();
      if (st === "EXPORTED" || st === "ARCHIVED") {
        whereClause.status = { in: ["EXPORTED", "ARCHIVED"] };
      } else {
        whereClause.status = "APPROVED";
      }
    } else {
      if (userRole === "STAFF" && currentUserId) {
        whereClause.createdById = currentUserId;
      }
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        whereClause.createdAt.gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = e;
      }
    }

    // 2. Query Batches with authentic relations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batches = await (db as any).batch.findMany({
      where: whereClause,
      include: {
        details: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        actionLogs: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { id: "asc" },
    });

    const serverGroups = await loadServerEquivalencyGroups();

    // 3. Filter by search query if passed (matching ID, no pengajuan, creator, approver, status)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchingBatches = batches.filter((batch: any) => {
      if (!search) return true;
      const idMatch = (batch.id || "").toLowerCase().includes(search);
      const creatorMatch =
        (batch.createdBy?.name || "").toLowerCase().includes(search) ||
        (batch.createdBy?.email || "").toLowerCase().includes(search);
      const approverMatch =
        (batch.approvedBy?.name || "").toLowerCase().includes(search) ||
        (batch.approvedBy?.email || "").toLowerCase().includes(search);
      const statusMatch = (batch.status || "").toLowerCase().includes(search);
      const detailMatch = Array.isArray(batch.details)
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          batch.details.some((d: any) =>
            String(d?.nomorAju || "").toLowerCase().includes(search)
          )
        : false;
      return idMatch || creatorMatch || approverMatch || statusMatch || detailMatch;
    });

    if (scope === "all_data" && matchingBatches.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada dokumen Approved yang sesuai untuk diexport." },
        { status: 400 }
      );
    }

    // 4. Initialize ExcelJS Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Docmatch USC Middleware";
    workbook.created = new Date();
    workbook.modified = new Date();

    const usedSheetNames = new Set<string>();
    const RECAP_SHEET_NAME = "Recap Matching & Mismatch";
    usedSheetNames.add(RECAP_SHEET_NAME.toLowerCase());

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

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };

    // Precompute report, sheet names, and metadata for each batch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchDataList = matchingBatches.map((batch: any) => {
      const detailSheetName = getSafeSheetName(`Detail (${batch.id})`, usedSheetNames);
      const evalResult = evaluateBatchComparison(batch, serverGroups);

      // Complete chronological logs: Data Action, Kamus Ekuivalensi, Edit Manual, Setujui (Satuan/Massal/Berkas), File Updates
      const rawEvents = buildBatchChangeLogs(batch, evalResult.evaluatedFieldModels || []);
      const activeActions = rawEvents.map((ev, idx) => ({
        no: idx + 1,
        docType: formatDocDisplayName(ev.docType),
        fieldName: formatFieldLabel(ev.fieldLabel || ev.fieldName),
        actionType: ev.categoryLabel,
        oldValue: ev.oldValue || "-",
        newValue: ev.newValue || "-",
        evalStatus: "Tercatat",
        notes: ev.notes || "-",
        actionBy: ev.actor || batch.createdBy?.name || "Operator",
        timestamp: ev.timestamp ? formatDate(ev.timestamp) : "Otomatis",
      }));

      // Extract ALL manual notes cleanly (supports both `.text` and legacy `.note`)
      const manualNotesList = extractManualNotesFromBatch(batch).map((n, idx) => ({
        no: idx + 1,
        docType: n.docType,
        targetKey: formatFieldLabel(n.targetKey),
        note: n.note,
        author: n.author,
        timestamp: formatDate(n.timestampRaw),
      }));

      return {
        batch,
        detailSheetName,
        evalResult,
        activeActions,
        manualNotesList,
        matchCount: evalResult.matchedFields,
        mismatchCount: evalResult.mismatchedFields,
      };
    });

    // =========================================================================
    // SHEET 1: RECAP MATCHING & MISMATCH (Tepat Sesuai Template Pengguna)
    // RINGKASAN BATCH (X Batch)
    // ID Batch, Nama Batch, Status Batch, Total File, Field Match, Field Mismatch, Detail
    // =========================================================================
    const sheet1 = workbook.addWorksheet(RECAP_SHEET_NAME, {
      views: [{ state: "normal", activeCell: "A1", showGridLines: true }],
    });

    sheet1.columns = [
      { key: "id", width: 14 },
      { key: "nama", width: 38 },
      { key: "status", width: 18 },
      { key: "totalFile", width: 14 },
      { key: "fieldMatch", width: 16 },
      { key: "fieldMismatch", width: 16 },
      { key: "detail", width: 16 },
    ];

    // Row 1: Header Title Banner (Merged A1:G1)
    const titleRow1 = sheet1.addRow([`RINGKASAN BATCH (${batchDataList.length} Batch)`]);
    sheet1.mergeCells("A1:G1");
    titleRow1.height = 24;
    const titleCell1 = sheet1.getCell("A1");
    titleCell1.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // Clean corporate slate #1E293B
    };
    titleCell1.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    titleCell1.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    // Row 2: Table Column Headers (Image 3 / User Spec)
    const headerRow1 = sheet1.addRow([
      "ID Batch",
      "Nama Batch",
      "Status Batch",
      "Total File",
      "Field Match",
      "Field Mismatch",
      "Detail",
    ]);
    headerRow1.height = 24;

    headerRow1.eachCell((cell, colNumber) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" }, // #F1F5F9
      };
      cell.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FF1E293B" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 2 ? "left" : "center",
        indent: colNumber === 2 ? 1 : 0,
      };
      cell.border = thinBorder;
    });

    // Populate Sheet 1 Data Rows
    batchDataList.forEach((item) => {
      const rawBatchSt = String(item.batch.status || "").toUpperCase();
      const willBecomeExported =
        (markExported && scope === "all_data" && rawBatchSt === "APPROVED") ||
        rawBatchSt === "EXPORTED" ||
        rawBatchSt === "ARCHIVED";
      const sheetStatusLabel = willBecomeExported
        ? "Exported"
        : rawBatchSt === "APPROVED"
        ? "Approved"
        : item.evalResult.status;

      const row = sheet1.addRow([
        item.batch.id,
        item.batch.nama || "PT. UNITED STEEL CENTER INDONESIA",
        sheetStatusLabel,
        `${item.batch.totalFile || 6} File`,
        item.matchCount,
        item.mismatchCount,
        "Lihat Detail",
      ]);
      row.height = 22;

      const safeDetailSheetName = item.detailSheetName.replace(/'/g, "''");

      // Col 1: ID Batch (Clickable link to detail sheet)
      const cId = row.getCell(1);
      cId.value = {
        formula: `HYPERLINK("#'${safeDetailSheetName}'!A1", "${item.batch.id}")`,
        result: item.batch.id,
      };
      cId.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E40AF" }, underline: true };
      cId.alignment = { vertical: "middle", horizontal: "center" };

      // Col 2: Nama Batch
      const cNama = row.getCell(2);
      cNama.font = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
      cNama.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

      // Col 3: Status Batch
      const isMatching = item.evalResult.status === "Matching";
      const isMismatching = item.evalResult.status === "Mismatching";
      const cStatus = row.getCell(3);
      cStatus.font = {
        name: "Calibri",
        size: 10,
        bold: true,
        color: { argb: isMatching ? "FF166534" : isMismatching ? "FF991B1B" : "FF64748B" },
      };
      cStatus.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isMatching ? "FFF0FDF4" : isMismatching ? "FFFEF2F2" : "FFF8FAFC" },
      };
      cStatus.alignment = { vertical: "middle", horizontal: "center" };

      // Col 4: Total File
      const cTotal = row.getCell(4);
      cTotal.font = { name: "Calibri", size: 10, color: { argb: "FF475569" } };
      cTotal.alignment = { vertical: "middle", horizontal: "center" };

      // Col 5: Field Match
      const cMatch = row.getCell(5);
      cMatch.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF166534" } };
      cMatch.alignment = { vertical: "middle", horizontal: "center" };

      // Col 6: Field Mismatch
      const cMismatch = row.getCell(6);
      cMismatch.font = {
        name: "Calibri",
        size: 10,
        bold: true,
        color: { argb: item.mismatchCount > 0 ? "FF991B1B" : "FF1E40AF" },
      };
      cMismatch.alignment = { vertical: "middle", horizontal: "center" };

      // Col 7: Detail Link ("Lihat Detail")
      const cLink = row.getCell(7);
      cLink.value = {
        formula: `HYPERLINK("#'${safeDetailSheetName}'!A1", "Lihat Detail")`,
        result: "Lihat Detail",
      };
      cLink.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E40AF" }, underline: true };
      cLink.alignment = { vertical: "middle", horizontal: "center" };

      // Cell borders
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber !== 3) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        }
        cell.border = thinBorder;
      });
    });

    // Summary Footer Row for Sheet 1
    if (batchDataList.length > 0) {
      const totalDocs = batchDataList.reduce((acc, i) => acc + (i.batch.totalFile || 6), 0);
      const totalFieldMatch = batchDataList.reduce((acc, i) => acc + i.matchCount, 0);
      const totalFieldMismatch = batchDataList.reduce((acc, i) => acc + i.mismatchCount, 0);

      const summaryRow = sheet1.addRow([
        "TOTAL",
        `${batchDataList.length} Batch`,
        "",
        `${totalDocs} File`,
        totalFieldMatch,
        totalFieldMismatch,
        "",
      ]);
      summaryRow.height = 24;
      summaryRow.eachCell((cell, colNumber) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color:
            colNumber === 5
              ? { argb: "FF166534" }
              : colNumber === 6
                ? { argb: "FF991B1B" }
                : { argb: "FF0F172A" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 2 ? "left" : "center",
          indent: colNumber === 2 ? 1 : 0,
        };
        cell.border = thinBorder;
      });
    }

    // =========================================================================
    // SHEET 2+: DETAIL MATCHING & MISMATCH - BATCH (1 SHEET PER BATCH)
    // Kembali ke Recap Matching & Mismatch
    // DETAIL MATCHING & MISMATCH - BATCH [ID]
    // No, Dokumen, Field Parameter, Nilai PIB (Acuan Utama), Nilai Dokumen Pembanding, Status, Keterangan / Verifikasi
    // =========================================================================
    batchDataList.forEach((item) => {
      const detailSheet = workbook.addWorksheet(item.detailSheetName, {
        views: [{ state: "normal", activeCell: "A1", showGridLines: true }],
      });

      detailSheet.columns = [
        { key: "no", width: 8 },
        { key: "doc", width: 22 },
        { key: "param", width: 32 },
        { key: "pibVal", width: 34 },
        { key: "compVal", width: 34 },
        { key: "status", width: 14 },
        { key: "notes", width: 52 },
      ];

      // Row 1: Back Navigation Hyperlink to Sheet 1
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

      // Row 2: Detail Header Title
      const titleRow = detailSheet.addRow([
        `DETAIL MATCHING & MISMATCH - BATCH ${item.batch.id}`,
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

      // Row 3: Table Column Headers (User Spec: No, Dokumen, Field Parameter, Nilai PIB, Nilai Pembanding, Status, Keterangan)
      const hdrRow = detailSheet.addRow([
        "No",
        "Dokumen",
        "Field Parameter",
        "Nilai PIB (Acuan Utama)",
        "Nilai Dokumen Pembanding",
        "Status",
        "Keterangan / Verifikasi",
      ]);
      hdrRow.height = 24;
      hdrRow.eachCell((c, colNum) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        c.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FF1E293B" } };
        c.alignment = {
          vertical: "middle",
          horizontal: colNum === 1 || colNum === 6 ? "center" : "left",
          indent: colNum === 1 || colNum === 6 ? 0 : 1,
        };
        c.border = thinBorder;
      });

      // Row 4+: Populate All Fields
      if (item.evalResult.allFields.length === 0) {
        const emptyRow = detailSheet.addRow([
          1,
          "-",
          "-",
          "-",
          "-",
          "INFO",
          "Belum ada data perbandingan pada batch ini.",
        ]);
        emptyRow.height = 24;
        detailSheet.mergeCells("B4:G4");
        emptyRow.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
        emptyRow.eachCell({ includeEmpty: true }, (c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
          c.border = thinBorder;
        });
      } else {
        item.evalResult.allFields.forEach((field, fIdx) => {
          const isMatch = field.status === "MATCH";
          const isMismatch = field.status === "MISMATCH";

          const r = detailSheet.addRow([
            fIdx + 1,
            formatDocName(field.documentType),
            formatFieldLabel(field.fieldName),
            field.pibValue || "-",
            field.targetValue || "-",
            isMatch ? "Match" : isMismatch ? "Mismatch" : "Info",
            field.notes || "-",
          ]);
          r.height = 22;

          // Col 1: No
          r.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
          r.getCell(1).font = { name: "Calibri", size: 10, color: { argb: "FF334155" } };

          // Col 2: Dokumen
          r.getCell(2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
          r.getCell(2).font = { name: "Calibri", size: 10, color: { argb: "FF334155" } };

          // Col 3: Field Parameter
          const cF = r.getCell(3);
          cF.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E293B" } };
          cF.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

          // Col 4: Nilai PIB
          const cPibV = r.getCell(4);
          cPibV.font = { name: "Consolas", size: 9.5, color: { argb: "FF0F172A" } };
          cPibV.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

          // Col 5: Nilai Pembanding
          const cCompV = r.getCell(5);
          cCompV.font = {
            name: "Consolas",
            size: 9.5,
            bold: isMismatch,
            color: { argb: isMismatch ? "FFB91C1C" : "FF0F172A" },
          };
          cCompV.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

          // Col 6: Status Badge
          const cStat = r.getCell(6);
          cStat.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: isMatch ? "FF166534" : isMismatch ? "FF991B1B" : "FF64748B" },
          };
          cStat.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isMatch ? "FFF0FDF4" : isMismatch ? "FFFEF2F2" : "FFF8FAFC" },
          };
          cStat.alignment = { vertical: "middle", horizontal: "center" };

          // Col 7: Keterangan / Verifikasi
          const cNotes = r.getCell(7);
          cNotes.font = { name: "Calibri", size: 9.5, color: { argb: "FF475569" } };
          cNotes.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };

          r.eachCell({ includeEmpty: true }, (c, colNum) => {
            if (colNum !== 6) {
              c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            }
            c.border = thinBorder;
          });
        });
      }

      // =========================================================================
      // BAGIAN 2 & 3: KHUSUS MODE WITH_ACTION_LOG (+ Log + Catatan)
      // "ada yang bersih ada yang + log + Catatan yang mau saya bangun tuh yang seperti ini"
      // =========================================================================
      if (mode === "with_action_log") {
        // --- BAGIAN 2: LOG LENGKAP PERUBAHAN (DATA ACTION, KAMUS, EDIT, SETUJUI SATUAN/ALL) ---
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

        if (item.activeActions.length === 0) {
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
          item.activeActions.forEach((act, aIdx) => {
            const detailSummary = `${act.notes} (${act.actionBy} • ${act.timestamp})`;
            const aRow = detailSheet.addRow([
              aIdx + 1,
              act.docType,
              act.fieldName,
              act.actionType,
              act.oldValue,
              act.newValue,
              detailSummary,
            ]);
            aRow.height = 24;
            aRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
            aRow.getCell(2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
            aRow.getCell(3).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
            aRow.getCell(4).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
            aRow.getCell(5).font = { name: "Consolas", size: 9 };
            aRow.getCell(6).font = { name: "Consolas", size: 9, bold: true, color: { argb: "FF0F766E" } };
            aRow.getCell(7).alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
            aRow.eachCell({ includeEmpty: true }, (c) => {
              c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
              c.border = thinBorder;
            });
          });
        }

        // --- BAGIAN 3: CATATAN MANUAL OPERATOR & LOG REVISI ---
        detailSheet.addRow([]); // Blank line
        const sec3Banner = detailSheet.addRow([
          "BAGIAN 3: LOG REVISI & CATATAN MANUAL OPERATOR",
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
          "Catatan Revisi / User Note",
          "Diinput Oleh",
          "Waktu Catatan",
          "Status Verifikasi",
        ]);
        noteHdrRow.height = 22;
        noteHdrRow.eachCell((c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
          c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E293B" } };
          c.alignment = { vertical: "middle", horizontal: "center" };
          c.border = thinBorder;
        });

        if (item.manualNotesList.length === 0) {
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
          item.manualNotesList.forEach((n, nIdx) => {
            const nRow = detailSheet.addRow([
              nIdx + 1,
              n.docType,
              n.targetKey,
              n.note,
              n.author,
              n.timestamp,
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
      }
    });

    // =========================================================================
    // OPTIONAL GLOBAL SHEET: LOG ACTION & CATATAN REVISI (Mode with_action_log only)
    // =========================================================================
    if (mode === "with_action_log") {
      const sheetAuditName = getSafeSheetName("Log Action & Catatan Revisi", usedSheetNames);
      const auditSheet = workbook.addWorksheet(sheetAuditName, {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      auditSheet.columns = [
        { header: "No", key: "no", width: 8 },
        { header: "ID Batch", key: "batchId", width: 14 },
        { header: "Jenis Dokumen", key: "docType", width: 20 },
        { header: "Field yang Diubah", key: "fieldName", width: 26 },
        { header: "Tipe Aksi / Perubahan", key: "actionType", width: 24 },
        { header: "Nilai Asli (Original)", key: "oldValue", width: 28 },
        { header: "Nilai Baru (Transformasi)", key: "newValue", width: 28 },
        { header: "Catatan User / Alasan Revisi", key: "notes", width: 38 },
        { header: "Diubah Oleh", key: "actionBy", width: 20 },
        { header: "Waktu Perubahan", key: "timestamp", width: 22 },
      ];

      const auditHdrRow = auditSheet.getRow(1);
      auditHdrRow.height = 24;
      auditHdrRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F766E" },
        };
        cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = thinBorder;
      });

      let auditIdx = 1;
      batchDataList.forEach((item) => {
        item.activeActions.forEach((act) => {
          const r = auditSheet.addRow({
            no: auditIdx++,
            batchId: item.batch.id,
            docType: act.docType,
            fieldName: act.fieldName,
            actionType: act.actionType,
            oldValue: act.oldValue,
            newValue: act.newValue,
            notes: act.notes,
            actionBy: act.actionBy,
            timestamp: act.timestamp,
          });
          r.height = 22;
          r.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
          r.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
          r.getCell(6).font = { name: "Consolas", size: 9 };
          r.getCell(7).font = { name: "Consolas", size: 9, bold: true, color: { argb: "FF0F766E" } };
          r.eachCell({ includeEmpty: true }, (c) => {
            c.border = thinBorder;
          });
        });

        item.manualNotesList.forEach((noteItem) => {
          const r = auditSheet.addRow({
            no: auditIdx++,
            batchId: item.batch.id,
            docType: noteItem.docType,
            fieldName: noteItem.targetKey,
            actionType: "Catatan Manual",
            oldValue: "-",
            newValue: noteItem.note,
            notes: noteItem.note,
            actionBy: noteItem.author,
            timestamp: noteItem.timestamp,
          });
          r.height = 22;
          r.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
          r.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
          r.getCell(6).font = { name: "Consolas", size: 9 };
          r.getCell(7).font = { name: "Consolas", size: 9, bold: true, color: { argb: "FF334155" } };
          r.eachCell({ includeEmpty: true }, (c) => {
            c.border = thinBorder;
          });
        });
      });
    }

    // 5. Generate Excel Buffer BEFORE mutating status
    const buffer = await workbook.xlsx.writeBuffer();

    // 6. When exported from All Data, transition Approved batches -> Exported cleanly
    let exportedCount = 0;
    if (markExported && scope === "all_data" && matchingBatches.length > 0) {
      const idsToExport: string[] = matchingBatches
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => String(b.status || "").toUpperCase() === "APPROVED")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => String(b.id));

      if (idsToExport.length > 0) {
        const actorName = session?.user?.name || session?.user?.email || "Operator";
        const exportedAt = new Date();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).batch.updateMany({
          where: { id: { in: idsToExport }, status: "APPROVED" },
          data: { status: "EXPORTED", exportedAt },
        });
        exportedCount = idsToExport.length;

        await Promise.allSettled(
          idsToExport.map((bId: string) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (db as any).actionLog.create({
              data: {
                batchId: bId,
                docType: "Batch",
                docNumber: bId,
                fieldName: "Status Batch",
                oldValue: "APPROVED",
                newValue: "EXPORTED",
                notes: `[Export to Excel] Dokumen berhasil diexport ke Excel & diarsipkan oleh ${actorName}`,
                actionBy: actorName,
              },
            })
          )
        );

        await logSystemAudit({
          userId: session?.user?.id,
          userName: session?.user?.name,
          userEmail: session?.user?.email,
          action: "UPDATE",
          category: "BATCH_DATA",
          title: `Export to Excel (${idsToExport.length} batch) -> Exported`,
          details: `Batch IDs: ${idsToExport.join(", ")}`,
          metadata: { batchIds: idsToExport, exportedAt: exportedAt.toISOString(), mode },
        });
      }
    }

    const timestampStr = new Date().toISOString().slice(0, 10);
    const scopeLabel =
      scope === "all_data"
        ? markExported
          ? "AllData_Exported"
          : "AllData_Approved"
        : "Personal";
    const modeLabel = mode === "with_action_log" ? "With_ActionLogs" : "Clean";
    const batchSuffix =
      batchIdsFilter.length === 1
        ? `_Batch_${batchIdsFilter[0]}`
        : batchIdsFilter.length > 1
        ? `_${batchIdsFilter.length}Batch`
        : "";
    const filename = `DocMatch_${scopeLabel}_${modeLabel}${batchSuffix}_${timestampStr}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Exported-Count": String(exportedCount),
      },
    });
  } catch (error) {
    console.error("Excel Export Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengexport file Excel." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") || "clean").toLowerCase();
  const scope = (searchParams.get("scope") || "personal").toLowerCase();
  const archiveStatus = searchParams.get("status") || "APPROVED";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const search = searchParams.get("search")?.toLowerCase().trim() || "";
  const batchIdsParam = searchParams.get("batchIds")?.trim() || "";
  const batchIdsFilter = batchIdsParam
    ? batchIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const markExported =
    searchParams.get("markExported") === "true" && scope === "all_data";

  return handleExcelExport({
    mode,
    scope,
    archiveStatus,
    startDate,
    endDate,
    search,
    batchIdsFilter,
    markExported,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mode = String(body.mode || "clean").toLowerCase();
  const scope = String(body.scope || "all_data").toLowerCase();
  const archiveStatus = String(body.status || "APPROVED");
  const startDate = body.startDate ? String(body.startDate) : null;
  const endDate = body.endDate ? String(body.endDate) : null;
  const search = body.search ? String(body.search).toLowerCase().trim() : "";
  const batchIdsFilter = Array.isArray(body.batchIds)
    ? body.batchIds.map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];
  const markExported = body.markExported !== false && scope === "all_data";

  return handleExcelExport({
    mode,
    scope,
    archiveStatus,
    startDate,
    endDate,
    search,
    batchIdsFilter,
    markExported,
  });
}
