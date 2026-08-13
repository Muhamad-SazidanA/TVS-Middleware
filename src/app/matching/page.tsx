"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// SVG Icons

const SearchIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const PlusIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const RefreshCwIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const ChevronLeftIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const FileTextIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const EyeIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const PencilIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const XIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const DownloadIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

const FileDocIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

interface DetailBatch {
  id: number;
  batchId: string;
  fileType: string;
  fileId: string;
  isi?: string | null;
  createdAt?: string;
}

interface BatchItem {
  id: string;
  no: number;
  nama: string;
  subtext: string;
  totalFile: number;
  status: "Matching" | "Mismatching" | "Proses";
  details?: DetailBatch[];
}

// Top-level helpers
const parseIsi = (isi?: string | null) => {
  if (!isi) return { fields: {}, table: [] };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any = typeof isi === "string" ? JSON.parse(isi) : isi;
    return {
      fields: (parsed.fields || {}) as Record<string, string>,
      table: (Array.isArray(parsed.table) ? parsed.table : []) as Array<Record<string, string>>,
    };
  } catch {
    return { fields: {}, table: [] };
  }
};

const getVal = (fields?: Record<string, string>, ...keys: string[]) => {
  if (!fields) return "-";
  for (const k of keys) {
    if (fields[k]) return fields[k];
  }
  const normMap: Record<string, string> = {};
  for (const [rk, rv] of Object.entries(fields)) {
    normMap[rk.toLowerCase().replace(/[^a-z0-9]/g, "")] = rv;
  }
  for (const k of keys) {
    const nk = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normMap[nk]) return normMap[nk];
  }
  return "-";
};

function parseNumericValue(val: any): number {
  if (val === undefined || val === null || val === "" || val === "-") return 0;
  const s = String(val).trim();
  const cleaned = s.replace(/[^0-9.,]/g, "");
  if (!cleaned) return 0;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    } else {
      return parseFloat(cleaned.replace(/,/g, "")) || 0;
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts.length > 2 || (parts[1] && parts[1].length === 3)) {
      return parseFloat(cleaned.replace(/,/g, "")) || 0;
    } else {
      return parseFloat(cleaned.replace(",", ".")) || 0;
    }
  } else {
    return parseFloat(cleaned) || 0;
  }
}

function formatNumericValue(num: number): string {
  if (isNaN(num) || num === 0) return "0";
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkDetailFileMatch(pibData: any, pibLanjutanData: any, detail: any, allDetails?: any[]): boolean {
  if (!detail || !detail.isi) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any = typeof detail.isi === "string" ? JSON.parse(detail.isi) : detail.isi;
    const fields: Record<string, string> = parsed?.fields || {};
    const table: Array<Record<string, string>> = Array.isArray(parsed?.table) ? parsed.table : [];
    const ft = (detail.fileType || "").trim().toLowerCase();

    const getF = (...keys: string[]) => getVal(fields, ...keys);
    const getPib = (...keys: string[]) => getVal(pibData?.fields, ...keys);

    const isMatch = (v1?: string, v2?: string) => {
      if (!v1 || !v2 || v1 === "-" || v2 === "-") return true;
      return v1.trim().toLowerCase() === v2.trim().toLowerCase();
    };

    if (ft.includes("invoice")) {
      const invNum = getF("Invoice_Number", "Invoice Number");
      const pibInvNum = getPib("Invoice_Number", "Invoice Number");
      let invNoMatch = isMatch(pibInvNum, invNum);

      if (!invNoMatch && invNum && pibLanjutanData?.table) {
        const cleanInv = invNum.trim().toLowerCase();
        for (const row of pibLanjutanData.table) {
          const docName = (row["Nama_Document"] || row["nama document"] || "").toLowerCase();
          const docNo = (row["No_Document"] || row["no document"] || "").trim().toLowerCase();
          if (docName.includes("invoice") && docNo === cleanInv) {
            invNoMatch = true;
            break;
          }
        }
      }
      if (!invNoMatch) return false;

      if (!isMatch(getPib("Invoice_Date", "Invoice Date"), getF("Invoice_Date", "Invoice Date"))) return false;
      if (!isMatch(getPib("Pelabuhan_Muat", "Pelabuhan Muat"), getF("Port_of_Loading", "Port of Loading"))) return false;
      
      const pibDest = getPib("Pelabuhan_Tujuan", "Pelabuhan Tujuan");
      const invDest = getF("Destination", "destination");
      if (pibDest && invDest && pibDest !== "-" && invDest !== "-") {
        const cd = invDest.trim().toLowerCase();
        const cpd = pibDest.trim().toLowerCase();
        if (cd !== cpd && !cd.includes(cpd) && !cpd.includes(cd)) return false;
      }
      if (!isMatch(getPib("Nama_Penjual", "Nama Penjual"), getF("Exporter"))) return false;
      if (!isMatch(getPib("Nama_Importir", "Nama Importir"), getF("Consignee"))) return false;
      if (!isMatch(getPib("Ket_FOB", "Ket FOB", "Incoterm", "Terms_of_Delivery", "Cara_Penyerahan"), getF("Terms_of_Delivery", "Terms of Delivery", "Incoterm", "Delivery_Terms"))) return false;

      // Invoice Total Check (Single vs Multiple Invoices)
      const allInvDetails = (allDetails || []).filter((d: any) =>
        (d.fileType || "").trim().toLowerCase().includes("invoice")
      );
      const pibTotalVal = getPib("Nilai", "Nilai Total");
      const pibTotalNum = parseNumericValue(pibTotalVal);

      if (allInvDetails.length > 1 && pibTotalNum > 0) {
        const sumAllInvoices = allInvDetails.reduce((sum: number, d: any) => {
          const p = typeof d.isi === "string" ? JSON.parse(d.isi) : d.isi;
          const f = p?.fields || {};
          return sum + parseNumericValue(getVal(f, "Total", "Nilai Total"));
        }, 0);
        if (sumAllInvoices > 0 && Math.abs(pibTotalNum - sumAllInvoices) > 0.01) {
          return false;
        }
      } else if (pibTotalNum > 0) {
        const invTotalNum = parseNumericValue(getF("Total", "Nilai Total"));
        if (invTotalNum > 0 && Math.abs(pibTotalNum - invTotalNum) > 0.01) {
          return false;
        }
      }

      return true;
    }

    if (ft.includes("packing") || ft.includes("paking")) {
      const pkgInv = getF("Invoice_Number", "Invoice Number");
      const pibInvNum = getPib("Invoice_Number", "Invoice Number");
      let invNoMatch = isMatch(pibInvNum, pkgInv);

      if (!invNoMatch && pkgInv && pibLanjutanData?.table) {
        const cleanInv = pkgInv.trim().toLowerCase();
        for (const row of pibLanjutanData.table) {
          const docName = (row["Nama_Document"] || row["nama document"] || "").toLowerCase();
          const docNo = (row["No_Document"] || row["no document"] || "").trim().toLowerCase();
          if (docName.includes("invoice") && docNo === cleanInv) {
            invNoMatch = true;
            break;
          }
        }
      }
      if (!invNoMatch) return false;

      if (!isMatch(getPib("Invoice_Date", "Invoice Date"), getF("Invoice_Date", "Invoice Date"))) return false;

      // Packing List Net Weight Check (Single vs Multiple Packing Lists)
      const allPkgDetails = (allDetails || []).filter((d: any) => {
        const f = (d.fileType || "").trim().toLowerCase();
        return f.includes("packing") || f.includes("paking");
      });
      const pibNetWtVal = getPib("Berat_Bersih", "Berat Bersih");
      const pibNetWtNum = parseNumericValue(pibNetWtVal);

      if (allPkgDetails.length > 1 && pibNetWtNum > 0) {
        const sumAllPkgWts = allPkgDetails.reduce((sum: number, d: any) => {
          const p = typeof d.isi === "string" ? JSON.parse(d.isi) : d.isi;
          const f = p?.fields || {};
          return sum + parseNumericValue(getVal(f, "Total_Net_Weight", "Total Net Weight", "Net_Weight", "Net Weight", "Berat_Bersih", "Berat Bersih"));
        }, 0);
        if (sumAllPkgWts > 0 && Math.abs(pibNetWtNum - sumAllPkgWts) > 0.01) {
          return false;
        }
      } else if (pibNetWtNum > 0) {
        const pkgNetWtNum = parseNumericValue(getF("Total_Net_Weight", "Total Net Weight", "Net_Weight", "Net Weight", "Berat_Bersih", "Berat Bersih"));
        if (pkgNetWtNum > 0 && Math.abs(pibNetWtNum - pkgNetWtNum) > 0.01) {
          return false;
        }
      }

      return true;
    }

    if (ft === "bl" || (ft.includes("bl") && !ft.includes("master"))) {
      if (!isMatch(getPib("No_House_BL", "No House BL"), getF("Sea_Waybill_Number", "Sea Waybill Number"))) return false;
      if (!isMatch(getPib("House_BL_Date", "House BL Date"), getF("Date"))) return false;
      if (!isMatch(getPib("Berat_Kotor", "Berat Kotor"), table[0]?.["Gross_Weight"] || table[0]?.["gross weight"])) return false;
      if (!isMatch(getPib("Jumlah", "Jumlah Package"), table[0]?.["QTY"] || table[0]?.["qty"])) return false;
      return true;
    }

    if (ft.includes("master")) {
      if (!isMatch(getPib("No_Master_BL", "No Master BL"), getF("BL_Number", "BL Number"))) return false;
      if (!isMatch(getPib("Master_BL_Date", "Master BL Date"), getF("Date_of_Issue", "Date of Issue"))) return false;
      if (!isMatch(getPib("No_Peti", "No Peti"), getF("Container"))) return false;
      if (!isMatch(getPib("Tipe_Peti", "Tipe Peti"), getF("Type"))) return false;
      if (!isMatch(getPib("Berat_Kotor", "Berat Kotor"), table[0]?.["Goods_Gross"])) return false;
      return true;
    }

    if (ft.includes("rekap")) {
      const pibTable = pibData?.table || [];
      const maxRows = Math.max(pibTable.length, table.length);
      if (maxRows === 0) return true;
      for (let i = 0; i < maxRows; i++) {
        const pibRow = pibTable[i] || {};
        const rekapRow = table[i] || {};
        const pibHs = (pibRow["Pos_Tarif"] || pibRow["pos tarif"] || pibRow["pos_tarif"] || pibRow["HS_Code"] || pibRow["hs code"] || "").trim();
        const rekapHs = (rekapRow["HS_Code"] || rekapRow["hs code"] || rekapRow["pos tarif"] || rekapRow["pos_tarif"] || rekapRow["Pos_Tarif"] || "").trim();
        const pibPart = (pibRow["Kode_Barang"] || pibRow["kode barang"] || pibRow["kode_barang"] || pibRow["Part_No"] || pibRow["part_no"] || "").trim();
        const rekapPart = (rekapRow["Part_No"] || rekapRow["part_no"] || rekapRow["no part"] || rekapRow["part no"] || rekapRow["Kode_Barang"] || rekapRow["kode_barang"] || rekapRow["kode barang"] || "").trim();
        const pibQty = (pibRow["Jumlah_Barang"] || pibRow["jumlah barang"] || pibRow["jumlah_barang"] || pibRow["QTY"] || pibRow["qty"] || pibRow["jumlah"] || "").trim();
        const rekapQty = (rekapRow["QTY"] || rekapRow["qty"] || rekapRow["jumlah"] || rekapRow["jumlah_barang"] || rekapRow["jumlah barang"] || "").trim();

        const cleanVal = (s: string) => s.toLowerCase().trim();
        const cleanNum = (s: string) => s.toLowerCase().replace(/,/g, "").replace(/\.00$/, "").replace(/\s+/g, "").trim();

        const hasBoth = Boolean((pibHs || pibPart || pibQty) && (rekapHs || rekapPart || rekapQty));
        const isHsMatch = pibHs !== "" && rekapHs !== "" && cleanVal(pibHs) === cleanVal(rekapHs);
        const isPartMatch = pibPart !== "" && rekapPart !== "" && cleanVal(pibPart) === cleanVal(rekapPart);
        const isQtyMatch = pibQty !== "" && rekapQty !== "" && cleanNum(pibQty) === cleanNum(rekapQty);

        const isRowMatch = hasBoth && (isHsMatch || isPartMatch) && (isQtyMatch || !pibQty || !rekapQty);
        if (hasBoth && !isRowMatch) return false;
      }
      return true;
    }

    return true;
  } catch {
    return false;
  }
}

interface FieldDiffReport {
  documentType: string;
  fieldName: string;
  pibValue: string;
  pembandingValue: string;
  isMatch: boolean;
  notes: string;
}

const getBatchComparisonReport = (batch: BatchItem) => {
  const pibDet = batch.details?.find((d) => (d.fileType || "").trim().toLowerCase() === "pib");
  const pibLanjutanDet = batch.details?.find((d) => (d.fileType || "").trim().toLowerCase().includes("lanjutan"));
  const pibData = parseIsi(pibDet?.isi);
  const pibLanjutanData = parseIsi(pibLanjutanDet?.isi);

  const allFields: FieldDiffReport[] = [];
  const mismatches: FieldDiffReport[] = [];

  const checkField = (docType: string, fieldName: string, pibVal: string, compVal: string, customStatus?: boolean) => {
    const sPib = (pibVal || "-").trim();
    const sComp = (compVal || "-").trim();

    let match = customStatus !== undefined ? customStatus : false;
    if (customStatus === undefined) {
      if (sPib === "-" || sComp === "-") {
        match = false;
      } else {
        match = sPib.toLowerCase() === sComp.toLowerCase();
      }
    }

    const report: FieldDiffReport = {
      documentType: docType,
      fieldName,
      pibValue: sPib,
      pembandingValue: sComp,
      isMatch: match,
      notes: match
        ? "Cocok (Matching)"
        : sComp === "-"
        ? `Field ${fieldName} tidak ditemukan pada ${docType}`
        : `Perbedaan Nilai: PIB ("${sPib}") ≠ ${docType} ("${sComp}")`,
    };

    allFields.push(report);
    if (!match) {
      mismatches.push(report);
    }
  };

  if (batch.details) {
    const typeCounts: Record<string, number> = {};
    const typeTotals: Record<string, number> = {};
    batch.details.forEach((d) => {
      const ft = (d.fileType || "").trim();
      typeTotals[ft] = (typeTotals[ft] || 0) + 1;
    });

    for (const det of batch.details) {
      const ftRaw = (det.fileType || "").trim();
      const ftLower = ftRaw.toLowerCase();
      if (ftLower === "pib" || ftLower.includes("lanjutan")) continue;

      typeCounts[ftRaw] = (typeCounts[ftRaw] || 0) + 1;
      const docLabel = typeTotals[ftRaw] > 1 ? `${ftRaw} #${typeCounts[ftRaw]}` : ftRaw;
      const data = parseIsi(det.isi);

      if (ftLower.includes("invoice")) {
        const invNum = getVal(data.fields, "Invoice_Number", "Invoice Number");
        const pibInvNum = getVal(pibData.fields, "Invoice_Number", "Invoice Number");

        let invMatch = pibInvNum !== "-" && invNum !== "-" && pibInvNum.toLowerCase() === invNum.toLowerCase();
        if (!invMatch && invNum !== "-" && pibLanjutanData?.table) {
          const cleanInv = invNum.trim().toLowerCase();
          for (const row of pibLanjutanData.table) {
            const docName = (row["Nama_Document"] || row["nama document"] || "").toLowerCase();
            const docNo = (row["No_Document"] || row["no document"] || "").trim().toLowerCase();
            if (docName.includes("invoice") && docNo === cleanInv) {
              invMatch = true;
              break;
            }
          }
        }
        checkField(docLabel, "Invoice Number", pibInvNum, invNum, invMatch);
        checkField(docLabel, "Invoice Date", getVal(pibData.fields, "Invoice_Date", "Invoice Date"), getVal(data.fields, "Invoice_Date", "Invoice Date"));
        checkField(docLabel, "Port of Loading", getVal(pibData.fields, "Pelabuhan_Muat", "Pelabuhan Muat"), getVal(data.fields, "Port_of_Loading", "Port of Loading"));
        checkField(docLabel, "Destination", getVal(pibData.fields, "Pelabuhan_Tujuan", "Pelabuhan Tujuan"), getVal(data.fields, "Destination", "destination"));
        checkField(docLabel, "Exporter", getVal(pibData.fields, "Nama_Penjual", "Nama Penjual"), getVal(data.fields, "Exporter"));
        checkField(docLabel, "Consignee", getVal(pibData.fields, "Nama_Importir", "Nama Importir"), getVal(data.fields, "Consignee"));
        checkField(docLabel, "Terms of Delivery", getVal(pibData.fields, "Ket_FOB", "Ket FOB", "Incoterm", "Terms_of_Delivery", "Cara_Penyerahan"), getVal(data.fields, "Terms_of_Delivery", "Terms of Delivery", "Incoterm", "Delivery_Terms"));
        checkField(docLabel, "Total", getVal(pibData.fields, "Nilai", "Nilai Total"), getVal(data.fields, "Total"));
      } else if (ftLower.includes("packing") || ftLower.includes("paking")) {
        const pkgInv = getVal(data.fields, "Invoice_Number", "Invoice Number");
        const pibInvNum = getVal(pibData.fields, "Invoice_Number", "Invoice Number");
        let invMatch = pibInvNum !== "-" && pkgInv !== "-" && pibInvNum.toLowerCase() === pkgInv.toLowerCase();
        if (!invMatch && pkgInv !== "-" && pibLanjutanData?.table) {
          const cleanInv = pkgInv.trim().toLowerCase();
          for (const row of pibLanjutanData.table) {
            const docName = (row["Nama_Document"] || row["nama document"] || "").toLowerCase();
            const docNo = (row["No_Document"] || row["no document"] || "").trim().toLowerCase();
            if (docName.includes("invoice") && docNo === cleanInv) {
              invMatch = true;
              break;
            }
          }
        }
        checkField(docLabel, "Invoice Number", pibInvNum, pkgInv, invMatch);
        checkField(docLabel, "Invoice Date", getVal(pibData.fields, "Invoice_Date", "Invoice Date"), getVal(data.fields, "Invoice_Date", "Invoice Date"));

        // Net weight check (single vs multi packing list)
        const pibNetWtVal = getVal(pibData.fields, "Berat_Bersih", "Berat Bersih");
        const pkgNetWtVal = getVal(data.fields, "Total_Net_Weight", "Total Net Weight", "Net_Weight", "Net Weight", "Berat_Bersih", "Berat Bersih");
        const allPkgDets = (batch.details || []).filter((d) => {
          const f = (d.fileType || "").trim().toLowerCase();
          return f.includes("packing") || f.includes("paking");
        });

        if (allPkgDets.length > 1) {
          const sumPkgWts = allPkgDets.reduce((acc, d) => {
            const p = parseIsi(d.isi);
            return acc + parseNumericValue(getVal(p.fields, "Total_Net_Weight", "Total Net Weight", "Net_Weight", "Net Weight", "Berat_Bersih", "Berat Bersih"));
          }, 0);
          const pibWtNum = parseNumericValue(pibNetWtVal);
          const isWtMatch = pibWtNum > 0 && sumPkgWts > 0 && Math.abs(pibWtNum - sumPkgWts) < 0.01;
          checkField(docLabel, `Total Net Weight (${docLabel})`, pibNetWtVal, pkgNetWtVal, isWtMatch);
        } else {
          checkField(docLabel, "Total Net Weight", pibNetWtVal, pkgNetWtVal);
        }
      } else if (ftLower === "bl" || (ftLower.includes("bl") && !ftLower.includes("master"))) {
        checkField(docLabel, "Sea Waybill Number", getVal(pibData.fields, "No_House_BL", "No House BL"), getVal(data.fields, "Sea_Waybill_Number", "Sea Waybill Number"));
        checkField(docLabel, "Date", getVal(pibData.fields, "House_BL_Date", "House BL Date"), getVal(data.fields, "Date"));
        checkField(docLabel, "Gross Weight", getVal(pibData.fields, "Berat_Kotor", "Berat Kotor"), data.table[0]?.["Gross_Weight"] || data.table[0]?.["gross weight"] || "-");
        checkField(docLabel, "QTY", getVal(pibData.fields, "Jumlah", "Jumlah Package"), data.table[0]?.["QTY"] || data.table[0]?.["qty"] || "-");
      } else if (ftLower.includes("master")) {
        checkField(docLabel, "BL Number", getVal(pibData.fields, "No_Master_BL", "No Master BL"), getVal(data.fields, "BL_Number", "BL Number"));
        checkField(docLabel, "Date of Issue", getVal(pibData.fields, "Master_BL_Date", "Master BL Date"), getVal(data.fields, "Date_of_Issue", "Date of Issue"));
        checkField(docLabel, "Container", getVal(pibData.fields, "No_Peti", "No Peti"), getVal(data.fields, "Container"));
        checkField(docLabel, "Type", getVal(pibData.fields, "Tipe_Peti", "Tipe Peti"), getVal(data.fields, "Type"));
        checkField(docLabel, "Goods Gross", getVal(pibData.fields, "Berat_Kotor", "Berat Kotor"), data.table[0]?.["Goods_Gross"] || "-");
      } else if (ftLower.includes("rekap")) {
        const maxRows = Math.max(pibData.table.length, data.table.length);
        for (let i = 0; i < maxRows; i++) {
          const pibRow = pibData.table[i] || {};
          const rekapRow = data.table[i] || {};
          const pibHs = (pibRow["Pos_Tarif"] || pibRow["pos tarif"] || pibRow["pos_tarif"] || pibRow["HS_Code"] || pibRow["hs code"] || "").trim();
          const rekapHs = (rekapRow["HS_Code"] || rekapRow["hs code"] || rekapRow["pos tarif"] || rekapRow["pos_tarif"] || rekapRow["Pos_Tarif"] || "").trim();
          const pibPart = (pibRow["Kode_Barang"] || pibRow["kode barang"] || pibRow["kode_barang"] || pibRow["Part_No"] || pibRow["part_no"] || "").trim();
          const rekapPart = (rekapRow["Part_No"] || rekapRow["part_no"] || rekapRow["no part"] || rekapRow["part no"] || rekapRow["Kode_Barang"] || rekapRow["kode_barang"] || rekapRow["kode barang"] || "").trim();
          const pibQty = (pibRow["Jumlah_Barang"] || pibRow["jumlah barang"] || pibRow["jumlah_barang"] || pibRow["QTY"] || pibRow["qty"] || pibRow["jumlah"] || "").trim();
          const rekapQty = (rekapRow["QTY"] || rekapRow["qty"] || rekapRow["jumlah"] || rekapRow["jumlah_barang"] || rekapRow["jumlah barang"] || "").trim();

          const cleanVal = (s: string) => s.toLowerCase().trim();
          const cleanNum = (s: string) => s.toLowerCase().replace(/,/g, "").replace(/\.00$/, "").replace(/\s+/g, "").trim();

          const isHsMatch = pibHs !== "" && rekapHs !== "" && cleanVal(pibHs) === cleanVal(rekapHs);
          const isPartMatch = pibPart !== "" && rekapPart !== "" && cleanVal(pibPart) === cleanVal(rekapPart);
          const isQtyMatch = pibQty !== "" && rekapQty !== "" && cleanNum(pibQty) === cleanNum(rekapQty);

          checkField(docLabel, `Item #${i + 1} HS Code`, pibHs, rekapHs, isHsMatch);
          checkField(docLabel, `Item #${i + 1} Part No`, pibPart, rekapPart, isPartMatch);
          checkField(docLabel, `Item #${i + 1} Qty`, pibQty, rekapQty, isQtyMatch);
        }
      }
    }
  }

  return { allFields, mismatches };
};const exportBatchExcel = (batch: BatchItem) => {
  const { allFields, mismatches } = getBatchComparisonReport(batch);

  let mismatchRowsHtml = "";
  if (mismatches.length > 0) {
    for (const m of mismatches) {
      mismatchRowsHtml += `
        <tr>
          <td style="border: 1px solid #fecdd3; background-color: #fff1f2; padding: 6px 10px; font-weight: bold; color: #9f1239; text-align: left; vertical-align: top; word-break: break-word; white-space: normal; mso-wrap-text: true;">${m.documentType}</td>
          <td style="border: 1px solid #fecdd3; background-color: #fff1f2; padding: 6px 10px; font-weight: bold; text-align: left; vertical-align: top; word-break: break-word; white-space: normal; mso-wrap-text: true;">${m.fieldName}</td>
          <td style="border: 1px solid #fecdd3; background-color: #fff1f2; padding: 6px 10px; font-family: Consolas, monospace; color: #1e3a8a; text-align: left; vertical-align: top; word-break: break-word; white-space: normal; mso-wrap-text: true;">${m.pibValue}</td>
          <td style="border: 1px solid #fecdd3; background-color: #fff1f2; padding: 6px 10px; font-family: Consolas, monospace; color: #b91c1c; font-weight: bold; text-align: left; vertical-align: top; word-break: break-word; white-space: normal; mso-wrap-text: true;">${m.pembandingValue}</td>
          <td style="border: 1px solid #fecdd3; background-color: #fff1f2; padding: 6px 10px; font-size: 10pt; color: #9f1239; text-align: left; vertical-align: top; word-break: break-word; white-space: normal; mso-wrap-text: true;">${m.notes}</td>
        </tr>
      `;
    }
  } else {
    mismatchRowsHtml = `
      <tr>
        <td colspan="5" style="border: 1px solid #a7f3d0; background-color: #ecfdf5; padding: 10px; color: #047857; font-weight: bold; text-align: left; vertical-align: top; word-break: break-word; white-space: normal; mso-wrap-text: true;">
          ✅ SELURUH DATA MATCHING: tidak ditemukan ketidakcocokan data di seluruh dokumen pendukung.
        </td>
      </tr>
    `;
  }

  let allRowsHtml = "";
  for (const f of allFields) {
    const bgColor = f.isMatch ? "#ffffff" : "#fff1f2";
    const statusBg = f.isMatch ? "#ecfdf5" : "#ffe4e6";
    const statusColor = f.isMatch ? "#047857" : "#b91c1c";
    allRowsHtml += `
      <tr>
        <td style="border: 1px solid #e2e8f0; background-color: ${bgColor}; padding: 6px 10px; font-weight: bold; text-align: left; vertical-align: top; word-break: break-word; white-space: normal; mso-wrap-text: true;">${f.documentType}</td>
        <td style="border: 1px solid #e2e8f0; background-color: ${bgColor}; padding: 6px 10px; text-align: left; vertical-align: top; word-break: break-word; white-space: normal; mso-wrap-text: true;">${f.fieldName}</td>
        <td style="border: 1px solid #e2e8f0; background-color: ${bgColor}; padding: 6px 10px; font-family: Consolas, monospace; color: #1e3a8a; text-align: left; vertical-align: top; word-break: break-word; white-space: normal; mso-wrap-text: true;">${f.pibValue}</td>
        <td style="border: 1px solid #e2e8f0; background-color: ${bgColor}; padding: 6px 10px; font-family: Consolas, monospace; ${!f.isMatch ? "color: #b91c1c; font-weight: bold;" : ""} text-align: left; vertical-align: top; word-break: break-word; white-space: normal; mso-wrap-text: true;">${f.pembandingValue}</td>
        <td style="border: 1px solid #e2e8f0; background-color: ${statusBg}; padding: 6px 10px; text-align: center; vertical-align: top; font-weight: bold; color: ${statusColor}; white-space: nowrap;">
          ${f.isMatch ? "MATCH" : "MISMATCH"}
        </td>
      </tr>
    `;
  }

  const excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Laporan Matching</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; }
    table { border-collapse: collapse; table-layout: fixed; width: 100%; }
    td, th { text-align: left; vertical-align: top; word-break: break-word; white-space: normal; mso-wrap-text: true; }
  </style>
</head>
<body>
  <table>
    <colgroup>
      <col style="width: 120px;" />
      <col style="width: 160px;" />
      <col style="width: 280px;" />
      <col style="width: 300px;" />
      <col style="width: 380px;" />
    </colgroup>
    <tr>
      <td colspan="5" style="font-size: 16pt; font-weight: bold; color: #091e42; padding-bottom: 4px; text-align: left;">TVS MIDDLEWARE - LAPORAN DETAIL MATCHING BATCH</td>
    </tr>
    <tr>
      <td colspan="5" style="font-size: 10pt; color: #64748b; font-style: italic; padding-bottom: 12px; text-align: left;">Analisis Evaluasi Ketidakcocokan Dokumen Import</td>
    </tr>
    <tr><td colspan="5"></td></tr>
    <tr>
      <td colspan="5" style="font-size: 11pt; font-weight: bold; background-color: #091e42; color: #ffffff; padding: 6px 10px; text-align: left;">RINGKASAN BATCH</td>
    </tr>
    <tr>
      <td style="font-weight: bold; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left;">Nama Batch</td>
      <td colspan="4" style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; text-align: left;">${batch.nama}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left;">Status Batch</td>
      <td colspan="4" style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; color: ${batch.status === "Matching" ? "#047857" : "#b91c1c"}; text-align: left;">${batch.status}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left;">Total File</td>
      <td colspan="4" style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left;">${batch.totalFile} File</td>
    </tr>
    <tr>
      <td style="font-weight: bold; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left;">Jumlah Mismatch</td>
      <td colspan="4" style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; color: ${mismatches.length > 0 ? "#b91c1c" : "#047857"}; text-align: left;">${mismatches.length} Field Berbeda</td>
    </tr>
    <tr><td colspan="5"></td></tr>
    <tr>
      <td colspan="5" style="font-size: 11pt; font-weight: bold; background-color: #9f1239; color: #ffffff; padding: 6px 10px; text-align: left;">⚠️ DAFTAR FIELD MISMATCHING (${mismatches.length} Field Berbeda)</td>
    </tr>
    <tr>
      <td style="border: 1px solid #fecdd3; background-color: #ffe4e6; color: #9f1239; font-weight: bold; padding: 6px 10px; text-align: left;">Dokumen</td>
      <td style="border: 1px solid #fecdd3; background-color: #ffe4e6; color: #9f1239; font-weight: bold; padding: 6px 10px; text-align: left;">Field</td>
      <td style="border: 1px solid #fecdd3; background-color: #ffe4e6; color: #9f1239; font-weight: bold; padding: 6px 10px; text-align: left;">PIB (Acuan Utama)</td>
      <td style="border: 1px solid #fecdd3; background-color: #ffe4e6; color: #9f1239; font-weight: bold; padding: 6px 10px; text-align: left;">Pembanding</td>
      <td style="border: 1px solid #fecdd3; background-color: #ffe4e6; color: #9f1239; font-weight: bold; padding: 6px 10px; text-align: left;">Penjelasan Ketidakcocokan</td>
    </tr>
    ${mismatchRowsHtml}
    <tr><td colspan="5"></td></tr>
    <tr>
      <td colspan="5" style="font-size: 11pt; font-weight: bold; background-color: #334155; color: #ffffff; padding: 6px 10px; text-align: left;">RINCIAN EVALUASI SELURUH FIELD</td>
    </tr>
    <tr>
      <td style="border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155; font-weight: bold; padding: 6px 10px; text-align: left;">Dokumen</td>
      <td style="border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155; font-weight: bold; padding: 6px 10px; text-align: left;">Field</td>
      <td style="border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155; font-weight: bold; padding: 6px 10px; text-align: left;">PIB (Acuan Utama)</td>
      <td style="border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155; font-weight: bold; padding: 6px 10px; text-align: left;">Pembanding</td>
      <td style="border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155; font-weight: bold; padding: 6px 10px; text-align: center;">Status</td>
    </tr>
    ${allRowsHtml}
  </table>
</body>
</html>`;

  const blob = new Blob(["\uFEFF" + excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Laporan_Matching_Batch_${batch.id}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const exportBatchPdf = async (batch: BatchItem) => {
  const { allFields, mismatches } = getBatchComparisonReport(batch);

  let mismatchSectionHtml = "";
  if (mismatches.length > 0) {
    let rowsHtml = "";
    for (const m of mismatches) {
      rowsHtml += `
        <tr style="background: #fff1f2;">
          <td style="border: 1px solid #fecdd3; padding: 6px 8px; font-weight: bold; color: #9f1239; word-break: break-word;">${m.documentType}</td>
          <td style="border: 1px solid #fecdd3; padding: 6px 8px; font-weight: bold; word-break: break-word;">${m.fieldName}</td>
          <td style="border: 1px solid #fecdd3; padding: 6px 8px; font-family: monospace; color: #1e3a8a; word-break: break-word;">${m.pibValue}</td>
          <td style="border: 1px solid #fecdd3; padding: 6px 8px; font-family: monospace; color: #b91c1c; font-weight: bold; word-break: break-word;">${m.pembandingValue}</td>
          <td style="border: 1px solid #fecdd3; padding: 6px 8px; font-size: 10px; color: #9f1239; word-break: break-word;">${m.notes}</td>
        </tr>
      `;
    }

    mismatchSectionHtml = `
      <div style="margin-top: 18px; padding: 14px; background: #fff5f5; border: 1.5px solid #f87171; border-radius: 8px;">
        <h3 style="margin: 0 0 8px 0; font-size: 13px; color: #9f1239; text-transform: uppercase;">
          ⚠️ DAFTAR FIELD MISMATCHING (${mismatches.length} Field Berbeda)
        </h3>
        <p style="margin: 0 0 10px 0; font-size: 11px; color: #7f1d1d;">
          Berikut adalah rincian seluruh field data yang tidak cocok antara dokumen PIB (Acuan) dan Dokumen Pembanding:
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #ffe4e6; color: #9f1239;">
              <th style="border: 1px solid #fecdd3; padding: 6px 8px; text-align: left;">Dokumen</th>
              <th style="border: 1px solid #fecdd3; padding: 6px 8px; text-align: left;">Field</th>
              <th style="border: 1px solid #fecdd3; padding: 6px 8px; text-align: left;">PIB (Acuan Utama)</th>
              <th style="border: 1px solid #fecdd3; padding: 6px 8px; text-align: left;">Pembanding</th>
              <th style="border: 1px solid #fecdd3; padding: 6px 8px; text-align: left;">Penjelasan Ketidakcocokan</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  } else {
    mismatchSectionHtml = `
      <div style="margin-top: 18px; padding: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; color: #047857; font-size: 12px; font-weight: bold;">
        ✅ SELURUH DATA MATCHING: tidak ditemukan ketidakcocokan data di seluruh dokumen pendukung.
      </div>
    `;
  }

  let allTableRowsHtml = "";
  for (const f of allFields) {
    allTableRowsHtml += `
      <tr style="background: ${f.isMatch ? "#ffffff" : "#fff1f2"};">
        <td style="border: 1px solid #e2e8f0; padding: 6px 8px; font-weight: 600; word-break: break-word;">${f.documentType}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px 8px; word-break: break-word;">${f.fieldName}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px 8px; font-family: monospace; color: #1e3a8a; word-break: break-word;">${f.pibValue}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px 8px; font-family: monospace; ${!f.isMatch ? "color: #b91c1c; font-weight: bold;" : ""} word-break: break-word;">${f.pembandingValue}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center; font-weight: bold; color: ${f.isMatch ? "#047857" : "#b91c1c"}; background: ${f.isMatch ? "#ecfdf5" : "#ffe4e6"};">
          ${f.isMatch ? "MATCH" : "MISMATCH"}
        </td>
      </tr>
    `;
  }

  const tempDiv = document.createElement("div");
  tempDiv.style.position = "fixed";
  tempDiv.style.left = "0";
  tempDiv.style.top = "0";
  tempDiv.style.width = "794px";
  tempDiv.style.padding = "24px";
  tempDiv.style.background = "#ffffff";
  tempDiv.style.color = "#0f172a";
  tempDiv.style.zIndex = "-99999";
  tempDiv.style.opacity = "0.01";
  tempDiv.style.pointerEvents = "none";
  tempDiv.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  tempDiv.innerHTML = `
    <div style="border-bottom: 2px solid #091e42; padding-bottom: 12px; margin-bottom: 16px;">
      <h1 style="margin: 0; font-size: 18px; color: #091e42;">TVS Middleware - Laporan Detail Matching Batch</h1>
      <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">Analisis Evaluasi Ketidakcocokan Dokumen Import</p>
    </div>
    <div style="font-size: 12px; line-height: 1.6; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <p style="margin: 2px 0;"><strong>Nama Batch:</strong> ${batch.nama}</p>
      <p style="margin: 2px 0;"><strong>Status Batch:</strong> <span style="padding: 2px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px; ${batch.status === "Matching" ? "background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;" : "background: #fff1f2; color: #b91c1c; border: 1px solid #fecdd3;"}">${batch.status}</span></p>
      <p style="margin: 2px 0;"><strong>Total File:</strong> ${batch.totalFile} File</p>
      <p style="margin: 2px 0;"><strong>Jumlah Mismatch:</strong> <strong style="color: ${mismatches.length > 0 ? "#b91c1c" : "#047857"};">${mismatches.length} Field Berbeda</strong></p>
    </div>

    ${mismatchSectionHtml}

    <div style="margin-top: 24px;">
      <h3 style="font-size: 13px; margin-bottom: 8px; color: #091e42; text-transform: uppercase;">RINCIAN EVALUASI SELURUH FIELD</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background: #f1f5f9; color: #475569;">
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">Dokumen</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">Field</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">PIB (Acuan Utama)</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">Pembanding</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${allTableRowsHtml}
        </tbody>
      </table>
    </div>
  `;

  document.body.appendChild(tempDiv);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).html2pdf) {
      await new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector('script[src*="html2pdf"]');
        if (existingScript) {
          let count = 0;
          const checkInterval = setInterval(() => {
            count++;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((window as any).html2pdf) {
              clearInterval(checkInterval);
              resolve();
            } else if (count > 30) {
              clearInterval(checkInterval);
              reject(new Error("Timeout loading PDF library"));
            }
          }, 100);
          return;
        }

        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load PDF library"));
        document.body.appendChild(script);
      });
    }

    const opt = {
      margin: [8, 8, 8, 8],
      filename: `Laporan_Matching_Batch_${batch.id}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 800 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (window as any).html2pdf().set(opt).from(tempDiv).save();
  } catch (err) {
    console.warn("Direct html2pdf render failed, falling back to print window:", err);
    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8"/>
            <title>Laporan_Matching_Batch_${batch.id}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #0f172a; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
              th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
              @media print {
                body { padding: 0; }
                @page { margin: 10mm; size: A4; }
              }
            </style>
          </head>
          <body>
            ${tempDiv.innerHTML}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    } else {
      alert("Gagal mengunduh PDF. Silakan izinkan pop-up browser Anda.");
    }
  } finally {
    if (document.body.contains(tempDiv)) {
      document.body.removeChild(tempDiv);
    }
  }
};

export default function MatchingPage() {
  const searchParams = useSearchParams();
  const highlightedBatchId = searchParams.get("batchId");

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | "Matching" | "Mismatching" | "Proses">("All");

  // Multi-row Selection State
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals & Drawers State
  const [viewingBatch, setViewingBatch] = useState<BatchItem | null>(null);
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);
  const [editStatus, setEditStatus] = useState<"Matching" | "Mismatching" | "Proses">("Matching");
  const [editTotalFile, setEditTotalFile] = useState<number>(1);
  const [downloadMenuBatchId, setDownloadMenuBatchId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createBatchId, setCreateBatchId] = useState("");
  const [createTotalFile, setCreateTotalFile] = useState(1);
  const [createStatus, setCreateStatus] = useState<"Matching" | "Mismatching" | "Proses">("Proses");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBatches = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch("/api/batches");
      if (res.ok) {
        const data = await res.json();
        if (data.batches && Array.isArray(data.batches)) {
          setBatches(data.batches);
        }
      }
    } catch (err) {
      console.error("Failed to fetch batches:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches(false);

    // Real-time automatic polling every 2 seconds
    const interval = setInterval(() => {
      fetchBatches(true);
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchBatches]);

  // Real-time sync for active viewingBatch modal
  useEffect(() => {
    if (viewingBatch) {
      const latest = batches.find((b) => b.id === viewingBatch.id);
      if (latest && (latest.status !== viewingBatch.status || JSON.stringify(latest.details) !== JSON.stringify(viewingBatch.details))) {
        setViewingBatch(latest);
      }
    }
  }, [batches, viewingBatch]);

  // Filter batches
  const filteredBatches = batches.filter((batch) => {
    const matchesSearch =
      batch.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.subtext.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab = activeTab === "All" || batch.status === activeTab;

    return matchesSearch && matchesTab;
  });

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / rowsPerPage));
  const paginatedBatches = filteredBatches.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Selection handlers
  const isAllPaginatedSelected =
    paginatedBatches.length > 0 &&
    paginatedBatches.every((b) => selectedBatchIds.includes(b.id));

  const toggleSelectAllPaginated = () => {
    if (isAllPaginatedSelected) {
      const paginatedIds = paginatedBatches.map((b) => b.id);
      setSelectedBatchIds((prev) => prev.filter((id) => !paginatedIds.includes(id)));
    } else {
      const paginatedIds = paginatedBatches.map((b) => b.id);
      setSelectedBatchIds((prev) => Array.from(new Set([...prev, ...paginatedIds])));
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedBatchIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // CRUD Handlers
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: createBatchId.trim() || undefined,
          totalFile: createTotalFile,
          status: createStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowCreateModal(false);
        setCreateBatchId("");
        setCreateTotalFile(1);
        fetchBatches();
      } else {
        alert(data.error || "Gagal membuat batch");
      }
    } catch (err) {
      console.error("Create batch error:", err);
      alert("Terjadi kesalahan saat menambah batch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/batches/${editingBatch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          totalFile: editTotalFile,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEditingBatch(null);
        fetchBatches();
      } else {
        alert(data.error || "Gagal mengedit batch");
      }
    } catch (err) {
      console.error("Update batch error:", err);
      alert("Terjadi kesalahan saat memperbarui batch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Apakah Anda yakin ingin menghapus Batch #${id} dari database?`)) return;

    try {
      const res = await fetch(`/api/batches/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedBatchIds((prev) => prev.filter((item) => item !== id));
        fetchBatches();
      } else {
        alert(data.error || "Gagal menghapus batch");
      }
    } catch (err) {
      console.error("Delete batch error:", err);
      alert("Terjadi kesalahan saat menghapus batch");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBatchIds.length === 0) return;
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus ${selectedBatchIds.length} batch terpilih dari database?`
      )
    )
      return;

    try {
      const res = await fetch("/api/batches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedBatchIds }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedBatchIds([]);
        fetchBatches();
      } else {
        alert(data.error || "Gagal menghapus batch terpilih");
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
      alert("Terjadi kesalahan saat menghapus batch terpilih");
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-blue-950">Matching Engine</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola dan verifikasi hasil matching batch dokumen PIB, Invoice, BL, dan Packing List.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchBatches(false)}
            className="px-3 py-2 text-slate-600 hover:text-blue-950 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-xs font-semibold flex items-center gap-1.5 shadow-2xs focus:outline-none"
            title="Refresh Data"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Search Input & Filter Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search batches..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-white text-xs text-slate-800 placeholder-slate-400 pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-2xs"
          />
        </div>

        {/* Filter Pills Tabs (All, Matching, Mismatching, Proses) */}
        <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-lg border border-slate-200/80 self-start md:self-auto overflow-x-auto max-w-full">
          {(["All", "Matching", "Mismatching", "Proses"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs transition-all whitespace-nowrap focus:outline-none ${
                  isActive
                    ? "bg-white text-blue-950 shadow-xs font-bold border border-slate-200/60"
                    : "text-slate-600 hover:text-blue-950 font-medium hover:bg-white/50"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table Container (Light Mode) */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider group/header">
                {/* No Column Header (with hover/select-all checkbox) */}
                <th className="py-3 px-4 w-16 text-center">
                  <div className="flex items-center justify-center">
                    {selectedBatchIds.length > 0 || isAllPaginatedSelected ? (
                      <input
                        type="checkbox"
                        checked={isAllPaginatedSelected}
                        onChange={toggleSelectAllPaginated}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-950 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-950"
                        title="Pilih semua di halaman ini"
                      />
                    ) : (
                      <>
                        <span className="group-hover/header:hidden">No</span>
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={toggleSelectAllPaginated}
                          className="hidden group-hover/header:inline-block w-3.5 h-3.5 rounded border-slate-300 text-blue-950 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-950"
                          title="Pilih semua di halaman ini"
                        />
                      </>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Nama</th>
                <th className="py-3 px-4 text-center w-36">Status</th>
                <th className="py-3 px-4 text-center w-28">Total File</th>
                <th className="py-3 px-4 text-center">File Pendukung</th>
                <th className="py-3 px-4 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCwIcon className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-950" />
                    <span>Memuat data batch dari database...</span>
                  </td>
                </tr>
              ) : paginatedBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <FileTextIcon className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                    <p className="font-bold text-slate-800 text-sm">Tidak ada data batch ditemukan</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {searchQuery
                        ? `Tidak ada batch yang cocok dengan kata kunci "${searchQuery}"`
                        : "Belum ada dokumen batch yang diunggah."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedBatches.map((batch, idx) => {
                  const itemIndex = (currentPage - 1) * rowsPerPage + idx + 1;
                  const isHighlighted = highlightedBatchId === batch.id;
                  const isSelected = selectedBatchIds.includes(batch.id);

                  const statusLower = (batch.status || "").toLowerCase().trim();
                  const isProsesStatus =
                    statusLower === "proses" ||
                    statusLower === "pending" ||
                    statusLower === "processing";

                  const filledCount = (batch.details || []).filter((d) => {
                    if (!d.isi || typeof d.isi !== "string" || !d.isi.trim() || d.isi.trim() === "{}" || d.isi.trim() === "[]") return false;
                    try {
                      const p = JSON.parse(d.isi);
                      const fields = p?.fields || {};
                      const table = Array.isArray(p?.table) ? p.table : [];
                      const hasFields = Object.keys(fields).length > 0 && Object.values(fields).some((v: any) => v && String(v).trim() !== "" && String(v).trim() !== "-");
                      const hasTable = table.length > 0;
                      return hasFields || hasTable;
                    } catch {
                      return false;
                    }
                  }).length;

                  const isDetailsIncomplete =
                    !batch.details ||
                    batch.details.length === 0 ||
                    (batch.totalFile && batch.totalFile > 0 && batch.details.length < batch.totalFile) ||
                    filledCount < (batch.details ? batch.details.length : 1);

                  const isProses = isProsesStatus || isDetailsIncomplete;

                  return (
                    <tr
                      key={batch.id}
                      onClick={(e) => {
                        if (isProses) {
                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }
                        setViewingBatch(batch);
                      }}
                      className={`group transition-colors ${
                        isProses
                          ? "hover:bg-amber-50/30 cursor-not-allowed"
                          : "hover:bg-slate-50/80 cursor-pointer"
                      } ${
                        isSelected
                          ? "bg-blue-50/70 hover:bg-blue-50"
                          : isHighlighted
                          ? "bg-blue-50/40"
                          : ""
                      }`}
                    >
                      {/* 1. No / Checkbox Column */}
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-xs font-medium text-center">
                        <div className="flex items-center justify-center">
                          {isSelected ? (
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={(e) => toggleSelectRow(batch.id, e)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-950 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-950"
                            />
                          ) : (
                            <>
                              <span className="group-hover:hidden">{itemIndex}</span>
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={(e) => toggleSelectRow(batch.id, e)}
                                onClick={(e) => e.stopPropagation()}
                                className="hidden group-hover:inline-block w-3.5 h-3.5 rounded border-slate-300 text-blue-950 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-950"
                              />
                            </>
                          )}
                        </div>
                      </td>

                      {/* 2. Nama Batch / Importir */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="font-bold text-slate-800 text-xs leading-snug group-hover:text-blue-950 transition-colors">
                          {batch.nama}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono font-medium tracking-wide mt-0.5">
                          {batch.subtext}
                        </div>
                      </td>

                      {/* 3. Status */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex justify-center">
                          {isProses ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                              <svg className="w-3 h-3 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Proses
                            </span>
                          ) : batch.status === "Matching" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              Matching
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                              Mismatching
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Total File */}
                      <td className="py-3.5 px-4 font-medium text-slate-700 text-center">
                        {batch.totalFile} File
                      </td>

                      {/* 5. File Pendukung */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1 max-w-xs mx-auto">
                          {isProses ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50/70 text-amber-800 border border-amber-200/60">
                              <svg className="w-3 h-3 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Memproses Data ({filledCount}/{batch.totalFile || (batch.details ? batch.details.length : 0)} File)...
                            </span>
                          ) : batch.details && batch.details.length > 0 ? (
                            (() => {
                              const pibDet = batch.details.find((d) => (d.fileType || "").trim().toLowerCase() === "pib");
                              const pibLanjutanDet = batch.details.find((d) => (d.fileType || "").trim().toLowerCase().includes("lanjutan"));
                              const pibData = parseIsi(pibDet?.isi);
                              const pibLanjutanData = parseIsi(pibLanjutanDet?.isi);

                              const supportingDetails = batch.details.filter((d) => {
                                const ftLower = (d.fileType || "").trim().toLowerCase();
                                return ftLower !== "pib" && !ftLower.includes("lanjutan");
                              });

                              if (supportingDetails.length === 0) {
                                return <span className="text-slate-400 text-[11px] italic">-</span>;
                              }

                              const typeCounts: Record<string, number> = {};
                              const typeTotals: Record<string, number> = {};

                              supportingDetails.forEach((d) => {
                                const ft = (d.fileType || "").trim();
                                typeTotals[ft] = (typeTotals[ft] || 0) + 1;
                              });

                              return supportingDetails.map((det) => {
                                const ft = (det.fileType || "").trim();

                                typeCounts[ft] = (typeCounts[ft] || 0) + 1;
                                const isMulti = typeTotals[ft] > 1;
                                const displayLabel = isMulti ? `${ft} #${typeCounts[ft]}` : ft;

                                const isFileMatch =
                                  batch.status === "Matching" ||
                                  checkDetailFileMatch(pibData, pibLanjutanData, det, batch.details);

                                return (
                                  <span
                                    key={det.id}
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                      isFileMatch
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-rose-50 text-rose-700 border-rose-200"
                                    }`}
                                    title={`ID: ${det.fileId} • ${isFileMatch ? "Matching" : "Mismatching"}`}
                                  >
                                    {displayLabel}
                                  </span>
                                );
                              });
                            })()
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">-</span>
                          )}
                        </div>
                      </td>

                      {/* 6. Aksi Column */}
                      <td className="py-3.5 px-4 text-center">
                        {isProses ? (
                          <div className="inline-flex items-center justify-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50/90 text-amber-800 border border-amber-200/80 shadow-2xs select-none">
                              <svg className="w-3.5 h-3.5 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Proses</span>
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center gap-1">
                            {/* View Detail Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingBatch(batch);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-950 hover:bg-slate-100 rounded transition-colors"
                              title="Lihat Detail"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>

                            {/* Download Button with Dropdown Menu */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDownloadMenuBatchId(downloadMenuBatchId === batch.id ? null : batch.id);
                                }}
                                className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                title="Download Laporan Batch"
                              >
                                <DownloadIcon className="w-4 h-4" />
                              </button>

                              {downloadMenuBatchId === batch.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-full mr-2 top-1/2 -translate-y-1/2 w-36 bg-white rounded-xl border border-slate-200/90 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-left"
                                >
                                  <div className="px-2.5 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                    Format File
                                  </div>
                                  <button
                                    onClick={() => {
                                      exportBatchExcel(batch);
                                      setDownloadMenuBatchId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-emerald-50/70 font-semibold hover:text-emerald-900 transition-colors whitespace-nowrap"
                                  >
                                    <div className="w-6 h-6 rounded-md bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
                                      <FileDocIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <span>Excel (.csv)</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      exportBatchPdf(batch);
                                      setDownloadMenuBatchId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-rose-50/70 font-semibold hover:text-rose-900 transition-colors whitespace-nowrap"
                                  >
                                    <div className="w-6 h-6 rounded-md bg-rose-100/80 text-rose-700 flex items-center justify-center shrink-0">
                                      <FileDocIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <span>PDF (.pdf)</span>
                                  </button>
                                </div>
                              )}
                            </div>

                             {/* Edit Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingBatch(batch);
                                setEditStatus(batch.status);
                                setEditTotalFile(batch.totalFile);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-950 hover:bg-slate-100 rounded transition-colors"
                              title="Edit Status Batch"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={(e) => handleDeleteSingle(batch.id, e)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Hapus Batch"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Card Pagination Footer */}
        <div className="p-3.5 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          {/* Left page indicator */}
          <div className="font-mono text-slate-500 text-xs">
            {currentPage} / {totalPages}
          </div>

          {/* Right pagination controls */}
          <div className="flex items-center gap-4 self-end sm:self-auto">
            {/* Rows per page dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs font-medium">Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white text-slate-800 text-xs rounded border border-slate-200 px-2 py-1 focus:outline-none shadow-2xs font-semibold"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Prev / Page / Next */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-xs focus:outline-none shadow-2xs font-semibold"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" />
                <span>Prev Page</span>
              </button>

              <span className="px-2.5 py-1 bg-blue-950 text-white rounded font-bold text-xs shadow-2xs">
                {currentPage}
              </span>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-xs focus:outline-none shadow-2xs font-semibold"
              >
                <span>Next Page</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE BATCH MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-blue-950">Tambah Batch Manual</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 focus:outline-none"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ID Batch (opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 0005 (kosongkan untuk otomatis)"
                  value={createBatchId}
                  onChange={(e) => setCreateBatchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Total File</label>
                <input
                  type="number"
                  min={1}
                  value={createTotalFile}
                  onChange={(e) => setCreateTotalFile(Number(e.target.value))}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Batch</label>
                <select
                  value={createStatus}
                  onChange={(e) =>
                    setCreateStatus(e.target.value as "Matching" | "Mismatching" | "Proses")
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="Proses">Proses</option>
                  <option value="Matching">Matching</option>
                  <option value="Mismatching">Mismatching</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 text-white font-bold shadow-xs flex items-center gap-1.5"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BATCH MODAL */}
      {editingBatch && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-blue-950">
                Edit Status Batch #{editingBatch.id}
              </h3>
              <button
                onClick={() => setEditingBatch(null)}
                className="text-slate-400 hover:text-slate-700 focus:outline-none"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateBatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Batch</label>
                <select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as "Matching" | "Mismatching" | "Proses")
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="Matching">Matching</option>
                  <option value="Mismatching">Mismatching</option>
                  <option value="Proses">Proses</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Total File</label>
                <input
                  type="number"
                  min={1}
                  value={editTotalFile}
                  onChange={(e) => setEditTotalFile(Number(e.target.value))}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBatch(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 text-white font-bold shadow-xs"
                >
                  {isSubmitting ? "Memperbarui..." : "Update Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW BATCH DETAIL COMPARISON MODAL */}
      {viewingBatch && (() => {
        const findAllDetails = (typeStr: string) => {
          return (
            viewingBatch.details?.filter((d) => {
              const ft = (d.fileType || "").trim().toLowerCase();
              const ts = typeStr.toLowerCase();
              if (ts === "pib") return ft === "pib"; // Strictly match "PIB", NOT "PIB Lanjutan"
              if (ts === "bl") return (ft === "bl" || ft.endsWith(" bl")) && !ft.includes("master");
              return ft.includes(ts);
            }) || []
          );
        };

        const parseIsi = (isi?: string | null) => {
          if (!isi) return { fields: {}, table: [] };
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsed: any = typeof isi === "string" ? JSON.parse(isi) : isi;
            return {
              fields: (parsed.fields || {}) as Record<string, string>,
              table: (Array.isArray(parsed.table) ? parsed.table : []) as Array<Record<string, string>>,
            };
          } catch {
            return { fields: {}, table: [] };
          }
        };

        const getVal = (fields: Record<string, string>, ...keys: string[]) => {
          if (!fields) return undefined;
          for (const k of keys) {
            if (fields[k]) return fields[k];
          }
          const normMap: Record<string, string> = {};
          for (const [rk, rv] of Object.entries(fields)) {
            normMap[rk.toLowerCase().replace(/[^a-z0-9]/g, "")] = rv;
          }
          for (const k of keys) {
            const nk = k.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (normMap[nk]) return normMap[nk];
          }
          return undefined;
        };

        const pibDetail = findAllDetails("PIB")[0];
        const invDetails = findAllDetails("Invoice");
        const pkgDetails = findAllDetails("Packing List");
        const blDetail = findAllDetails("BL")[0];
        const mblDetail = findAllDetails("Master BL")[0];
        const rekapDetail = findAllDetails("Rekap Document")[0];
        const pibLanjutanDetail = findAllDetails("PIB Lanjutan")[0];

        const pibData = parseIsi(pibDetail?.isi);
        const blData = parseIsi(blDetail?.isi);
        const mblData = parseIsi(mblDetail?.isi);
        const rekapData = parseIsi(rekapDetail?.isi);
        const pibLanjutanData = parseIsi(pibLanjutanDetail?.isi);

        const getInvoiceMatchInfo = (invNum?: string) => {
          const defaultPib = getVal(pibData.fields, "Invoice_Number", "Invoice Number");
          if (!invNum || invNum === "-") return { isMatch: null, valLeft: defaultPib, noteLeft: undefined };
          const cleanInv = invNum.trim().toLowerCase();
          if (!cleanInv) return { isMatch: null, valLeft: defaultPib, noteLeft: undefined };

          if (defaultPib && defaultPib.trim().toLowerCase() === cleanInv) {
            return { isMatch: true, valLeft: defaultPib, noteLeft: undefined };
          }

          if (pibLanjutanData?.table) {
            for (const row of pibLanjutanData.table) {
              const docName = (row["Nama_Document"] || row["nama document"] || "").toLowerCase();
              const docNo = (row["No_Document"] || row["no document"] || "").trim();
              if (docName.includes("invoice") && docNo.toLowerCase() === cleanInv) {
                return { isMatch: true, valLeft: docNo, noteLeft: "PIB Lanjutan" };
              }
            }
          }

          return { isMatch: false, valLeft: defaultPib && defaultPib !== "-" ? defaultPib : "-", noteLeft: undefined };
        };

        const isMatch = (v1?: string, v2?: string) => {
          if (!v1 || !v2 || v1 === "-" || v2 === "-") return null;
          const s1 = v1.trim().toLowerCase();
          const s2 = v2.trim().toLowerCase();
          if (!s1 || !s2) return null;
          return s1 === s2;
        };

        const displayValue = (val?: string) => {
          if (val === undefined || val === null || val === "" || val === "-") return "-";
          return String(val);
        };

        const CompareRow = ({
          lblLeft,
          valLeft,
          lblRight,
          valRight,
          customStatus,
          noteLeft,
        }: {
          lblLeft: string;
          valLeft?: string;
          lblRight: string;
          valRight?: string;
          customStatus?: boolean | null;
          noteLeft?: string;
        }) => {
          const rawLeft = displayValue(valLeft);
          const rawRight = displayValue(valRight);
          const status = customStatus !== undefined ? customStatus : isMatch(rawLeft, rawRight);

          const boxBgClass =
            status === true
              ? "bg-emerald-50 text-emerald-950 border-emerald-200/90"
              : status === false
              ? "bg-rose-50 text-rose-950 border-rose-200/90"
              : "bg-slate-50/70 text-slate-700 border-slate-200/60";

          const labelClass =
            status === true
              ? "text-emerald-700 font-semibold flex-shrink-0"
              : status === false
              ? "text-rose-700 font-semibold flex-shrink-0"
              : "text-slate-500 font-medium flex-shrink-0";

          const valueClass =
            status === true
              ? "text-emerald-950 font-bold"
              : status === false
              ? "text-rose-950 font-bold"
              : "text-slate-800 font-semibold";

          return (
            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Left Column Box: PIB Reference (Acuan Utama) */}
              <div
                className={`p-2.5 rounded-xl border flex flex-col justify-between transition-colors ${boxBgClass}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={labelClass}>{lblLeft}:</span>
                  <span
                    className={`font-sans text-xs text-right ml-2 line-clamp-2 break-words max-w-[65%] leading-snug ${valueClass}`}
                    title={rawLeft}
                  >
                    {rawLeft}
                  </span>
                </div>
                {noteLeft && (
                  <div className="mt-0.5 flex items-center justify-end">
                    <span className="text-[9.5px] text-slate-500 font-normal italic opacity-80">
                      ({noteLeft})
                    </span>
                  </div>
                )}
              </div>

              {/* Right Column Box: Pembanding */}
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${boxBgClass}`}
              >
                <span className={labelClass}>{lblRight}:</span>
                <span
                  className={`font-sans text-xs text-right ml-2 line-clamp-2 break-words max-w-[65%] leading-snug ${valueClass}`}
                  title={rawRight}
                >
                  {rawRight}
                </span>
              </div>
            </div>
          );
        };

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full my-6 flex flex-col max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-blue-950">
                      Detail Batch #{viewingBatch.id}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        viewingBatch.status === "Matching"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : viewingBatch.status === "Mismatching"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {viewingBatch.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {viewingBatch.nama} • {viewingBatch.totalFile} File Dokumen
                  </p>
                </div>
                <button
                  onClick={() => setViewingBatch(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 focus:outline-none transition-colors"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Body Comparison */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/40 text-xs">
                {/* 0. INFORMASI DOKUMEN PIB & PIB LANJUTAN */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-blue-950 text-xs flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-950 text-white flex items-center justify-center text-[10px]">
                        0
                      </span>
                      <span>INFORMASI DOKUMEN PIB & DOKUMEN LANJUTAN</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold border bg-blue-50 text-blue-800 border-blue-200">
                      Info PIB
                    </span>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Non-Matching PIB Fields Grid */}
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <span>Informasi Field PIB (Non-Matching)</span>
                      </h4>
                      {(() => {
                        const nonMatchingKeys = [
                          { label: "Nomor Pengajuan", alt: ["Nomor Pengajuan", "No_Aju", "No Aju", "No_Pengajuan"] },
                          { label: "Alamat Importir", alt: ["Alamat_Importir", "Alamat Importir"] },
                          { label: "Nama Pemilik Barang", alt: ["Nama_Pemilik_Barang", "Nama Pemilik Barang"] },
                          { label: "Alamat Pemilik Barang", alt: ["Alamat_Pemilik_Barang", "Alamat Pemilik Barang"] },
                          { label: "Nama Pengirim", alt: ["Nama_Pengirim", "Nama Pengirim"] },
                          { label: "Alamat Pengirim", alt: ["Alamat_Pengirim", "Alamat Pengirim"] },
                          { label: "Alamat Penjual", alt: ["Alamat_Penjual", "Alamat Penjual"] },
                          { label: "Nama Sarana Pengangkutan", alt: ["Nama_Sarana_Pengangkutan", "Nama Sarana Pengangkutan"] },
                          { label: "No Voy", alt: ["No_Voy", "No Voy"] },
                          { label: "Merk", alt: ["Merk"] },
                        ];

                        const nonMatchingFields: Array<{ label: string; value: string }> = [];

                        nonMatchingKeys.forEach(({ label, alt }) => {
                          const val = getVal(pibData.fields, label, ...alt);
                          if (val && val !== "-") {
                            nonMatchingFields.push({ label, value: val });
                          }
                        });

                        const matchedKeysNorm = new Set([
                          "invoicenumber", "invoicedate", "pelabuhanmuat", "pelabuhantujuan", "destination", "namapenjual",
                          "namaimportir", "ketfob", "carapenyerahan", "incoterm", "termsofdelivery",
                          "fob", "nilai", "nilaitotal", "beratbersih", "nohousebl", "housebldate",
                          "beratkotor", "jumlah", "nomasterbl", "masterbldate", "nopeti", "tipepeti"
                        ]);

                        if (pibData.fields) {
                          Object.entries(pibData.fields).forEach(([k, v]) => {
                            const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, "");
                            if (
                              !matchedKeysNorm.has(normKey) &&
                              !nonMatchingFields.some((f) => f.label.toLowerCase().replace(/[^a-z0-9]/g, "") === normKey) &&
                              v && String(v).trim() !== "" && String(v).trim() !== "-"
                            ) {
                              nonMatchingFields.push({ label: k.replace(/_/g, " "), value: String(v).trim() });
                            }
                          });
                        }

                        if (nonMatchingFields.length === 0) {
                          return <p className="text-slate-400 italic text-[11px] p-2 bg-slate-50 rounded-lg">Tidak ada informasi field PIB non-matching.</p>;
                        }

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {nonMatchingFields.map((f, i) => (
                              <div key={i} className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 flex flex-col justify-between">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{f.label}</span>
                                <span className="font-semibold text-slate-800 text-xs mt-1 break-words line-clamp-3" title={f.value}>{f.value}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* PIB Lanjutan Table (if available) */}
                    {pibLanjutanDetail && (
                      <div className="pt-3 border-t border-slate-100">
                        <h4 className="text-[11px] font-bold text-blue-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <span>Tabel Dokumen PIB Lanjutan</span>
                        </h4>
                        {pibLanjutanData.table && pibLanjutanData.table.length > 0 ? (
                          <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-100/90 text-slate-600 font-bold border-b border-slate-200 text-[10.5px]">
                                  <th className="py-2 px-3">No</th>
                                  <th className="py-2 px-3">Nama Document</th>
                                  <th className="py-2 px-3">No Document</th>
                                  <th className="py-2 px-3">Tanggal Document</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {pibLanjutanData.table.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                                    <td className="py-2 px-3 font-semibold text-slate-800">{row["Nama_Document"] || row["nama document"] || row["Nama Document"] || "-"}</td>
                                    <td className="py-2 px-3 font-mono text-blue-950 font-bold">{row["No_Document"] || row["no document"] || row["No Document"] || "-"}</td>
                                    <td className="py-2 px-3 text-slate-600">{row["Tanggal_Document"] || row["tanggal document"] || row["Tanggal Document"] || "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-slate-400 italic text-[11px] p-2 bg-slate-50 rounded-lg">Tabel Dokumen PIB Lanjutan Kosong.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 1. INVOICE SECTION */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-blue-950 text-xs flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-950 text-white flex items-center justify-center text-[10px]">
                        1
                      </span>
                      <span>
                        INVOICE COMPARISON{" "}
                        {invDetails.length > 1 && `(${invDetails.length} File Invoice)`}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                        invDetails.length > 0 && invDetails.every((d) => d.isi)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : invDetails.length > 0
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {invDetails.length > 0
                        ? invDetails.every((d) => d.isi)
                          ? `${invDetails.length} Uploaded`
                          : "Pending OCR"
                        : "Tidak Ada"}
                    </span>
                  </div>
                  <div className="p-3.5 space-y-4">
                    {invDetails.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px] p-2">Tidak ada file Invoice diunggah.</p>
                    ) : (
                      (() => {
                        const pibTotalVal = getVal(pibData.fields, "Nilai", "Nilai Total");
                        const pibTotalNum = parseNumericValue(pibTotalVal);
                        const sumInvoiceTotal = invDetails.reduce((acc, det) => {
                          const dData = parseIsi(det.isi);
                          return acc + parseNumericValue(getVal(dData.fields, "Total", "Nilai Total"));
                        }, 0);
                        const isCombinedMatch =
                          invDetails.length > 1 && pibTotalNum > 0 && sumInvoiceTotal > 0
                            ? Math.abs(pibTotalNum - sumInvoiceTotal) < 0.01
                            : undefined;

                        return (
                          <>
                            {invDetails.length > 1 && (
                              <div
                                className={`p-2.5 px-3.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs font-medium transition-all ${
                                  isCombinedMatch === true
                                    ? "bg-emerald-50/70 border-emerald-200/90 text-emerald-950"
                                    : isCombinedMatch === false
                                    ? "bg-rose-50/70 border-rose-200/90 text-rose-950"
                                    : "bg-blue-50/70 border-blue-200/90 text-blue-950"
                                }`}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                                    <span
                                      className={`w-5 h-5 rounded font-bold text-[10px] flex items-center justify-center text-white ${
                                        isCombinedMatch === true
                                          ? "bg-emerald-600"
                                          : isCombinedMatch === false
                                          ? "bg-rose-600"
                                          : "bg-blue-600"
                                      }`}
                                    >
                                      ∑
                                    </span>
                                    <span>Akumulasi Total Invoice ({invDetails.length} File):</span>
                                  </span>

                                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200/90 font-bold text-slate-800 shadow-2xs">
                                      PIB: {pibTotalVal || "-"}
                                    </span>
                                    <span className="text-slate-400 font-bold">=</span>
                                    {invDetails.map((det, i) => {
                                      const dData = parseIsi(det.isi);
                                      const v = parseNumericValue(getVal(dData.fields, "Total", "Nilai Total"));
                                      return (
                                        <React.Fragment key={i}>
                                          {i > 0 && <span className="text-slate-400 font-bold">+</span>}
                                          <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-200/80 text-slate-700">
                                            <span className="text-slate-400 font-sans text-[10px] mr-1">Inv #{i + 1}:</span>
                                            {formatNumericValue(v)}
                                          </span>
                                        </React.Fragment>
                                      );
                                    })}
                                    <span
                                      className={`px-2 py-0.5 rounded border font-bold ${
                                        isCombinedMatch === true
                                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                          : isCombinedMatch === false
                                          ? "bg-rose-100 text-rose-800 border-rose-300"
                                          : "bg-blue-100 text-blue-800 border-blue-300"
                                      }`}
                                    >
                                      = {formatNumericValue(sumInvoiceTotal)}
                                    </span>
                                  </div>
                                </div>

                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                                    isCombinedMatch === true
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : isCombinedMatch === false
                                      ? "bg-rose-100 text-rose-800 border-rose-300"
                                      : "bg-blue-100 text-blue-800 border-blue-300"
                                  }`}
                                >
                                  {isCombinedMatch === true
                                    ? "✓ Match"
                                    : isCombinedMatch === false
                                    ? "✕ Mismatch"
                                    : "Multiple"}
                                </span>
                              </div>
                            )}

                            {invDetails.map((invDet, idx) => {
                              const invData = parseIsi(invDet.isi);
                              const invNum = getVal(invData.fields, "Invoice_Number", "Invoice Number");
                              const matchInfo = getInvoiceMatchInfo(invNum);
                              return (
                                <div
                                  key={invDet.id || idx}
                                  className="space-y-1 bg-slate-50/60 p-3 rounded-lg border border-slate-200/80"
                                >
                                  {invDetails.length > 1 && (
                                    <div className="font-bold text-[11px] text-blue-950 pb-1.5 border-b border-slate-200/80 flex items-center justify-between">
                                      <span className="px-2 py-0.5 bg-blue-950 text-white rounded text-[10px] font-bold">
                                        Invoice #{idx + 1}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        ID: {invDet.fileId}
                                      </span>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 font-bold text-[11px] text-slate-700">
                                    <div className="text-blue-950">PIB (Acuan Utama)</div>
                                    <div className="text-slate-700 pl-2 border-l border-slate-200">
                                      Invoice {invDetails.length > 1 ? `#${idx + 1}` : ""} (Pembanding)
                                    </div>
                                  </div>
                                  <CompareRow
                                    lblLeft="Invoice Number"
                                    valLeft={matchInfo.valLeft}
                                    lblRight="Invoice Number"
                                    valRight={invNum}
                                    customStatus={matchInfo.isMatch}
                                    noteLeft={matchInfo.noteLeft}
                                  />
                                  <CompareRow
                                    lblLeft="Invoice Date"
                                    valLeft={getVal(pibData.fields, "Invoice_Date", "Invoice Date")}
                                    lblRight="Invoice Date"
                                    valRight={getVal(invData.fields, "Invoice_Date", "Invoice Date")}
                                  />
                                  <CompareRow
                                    lblLeft="Port of Loading"
                                    valLeft={getVal(pibData.fields, "Pelabuhan_Muat", "Pelabuhan Muat")}
                                    lblRight="Port of Loading"
                                    valRight={getVal(invData.fields, "Port_of_Loading", "Port of Loading")}
                                  />
                                  <CompareRow
                                    lblLeft="Destination"
                                    valLeft={getVal(pibData.fields, "Pelabuhan_Tujuan", "Pelabuhan Tujuan")}
                                    lblRight="Destination"
                                    valRight={getVal(invData.fields, "Destination", "destination")}
                                  />
                                  <CompareRow
                                    lblLeft="Exporter"
                                    valLeft={getVal(pibData.fields, "Nama_Penjual", "Nama Penjual")}
                                    lblRight="Exporter"
                                    valRight={getVal(invData.fields, "Exporter")}
                                  />
                                  <CompareRow
                                    lblLeft="Consignee"
                                    valLeft={getVal(pibData.fields, "Nama_Importir", "Nama Importir")}
                                    lblRight="Consignee"
                                    valRight={getVal(invData.fields, "Consignee")}
                                  />
                                  <CompareRow
                                    lblLeft="Terms of Delivery"
                                    valLeft={getVal(pibData.fields, "Ket_FOB", "Ket FOB", "Incoterm", "Terms_of_Delivery", "Terms of Delivery", "Cara_Penyerahan", "cara penyerahan")}
                                    lblRight="Terms of Delivery"
                                    valRight={getVal(invData.fields, "Terms_of_Delivery", "Terms of Delivery", "Incoterm", "Delivery_Terms", "Delivery Terms")}
                                  />
                                  <CompareRow
                                    lblLeft="Total"
                                    valLeft={getVal(pibData.fields, "Nilai", "Nilai Total")}
                                    lblRight="Total"
                                    valRight={getVal(invData.fields, "Total", "Nilai Total")}
                                    customStatus={invDetails.length > 1 ? isCombinedMatch : undefined}
                                    noteLeft={invDetails.length > 1 ? `Akumulasi Total (${invDetails.length} Invoice)` : undefined}
                                  />
                                </div>
                              );
                            })}
                          </>
                        );
                      })()
                    )}
                  </div>
                </div>

                {/* 2. PACKING LIST SECTION */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-blue-950 text-xs flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-950 text-white flex items-center justify-center text-[10px]">
                        2
                      </span>
                      <span>
                        PACKING LIST COMPARISON{" "}
                        {pkgDetails.length > 1 && `(${pkgDetails.length} File Packing List)`}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                        pkgDetails.length > 0 && pkgDetails.every((d) => d.isi)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : pkgDetails.length > 0
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {pkgDetails.length > 0
                        ? pkgDetails.every((d) => d.isi)
                          ? `${pkgDetails.length} Uploaded`
                          : "Pending OCR"
                        : "Tidak Ada"}
                    </span>
                  </div>
                  <div className="p-3.5 space-y-4">
                    {pkgDetails.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px] p-2">Tidak ada file Packing List diunggah.</p>
                    ) : (
                      (() => {
                        const pibNetWtVal = getVal(pibData.fields, "Berat_Bersih", "Berat Bersih");
                        const pibNetWtNum = parseNumericValue(pibNetWtVal);
                        const sumPkgNetWt = pkgDetails.reduce((acc, det) => {
                          const dData = parseIsi(det.isi);
                          return (
                            acc +
                            parseNumericValue(
                              getVal(
                                dData.fields,
                                "Total_Net_Weight",
                                "Total Net Weight",
                                "Net_Weight",
                                "Net Weight",
                                "Berat_Bersih",
                                "Berat Bersih"
                              )
                            )
                          );
                        }, 0);
                        const isCombinedWtMatch =
                          pkgDetails.length > 1 && pibNetWtNum > 0 && sumPkgNetWt > 0
                            ? Math.abs(pibNetWtNum - sumPkgNetWt) < 0.01
                            : undefined;

                        return (
                          <>
                            {pkgDetails.length > 1 && (
                              <div
                                className={`p-2.5 px-3.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs font-medium transition-all ${
                                  isCombinedWtMatch === true
                                    ? "bg-emerald-50/70 border-emerald-200/90 text-emerald-950"
                                    : isCombinedWtMatch === false
                                    ? "bg-rose-50/70 border-rose-200/90 text-rose-950"
                                    : "bg-blue-50/70 border-blue-200/90 text-blue-950"
                                }`}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                                    <span
                                      className={`w-5 h-5 rounded font-bold text-[10px] flex items-center justify-center text-white ${
                                        isCombinedWtMatch === true
                                          ? "bg-emerald-600"
                                          : isCombinedWtMatch === false
                                          ? "bg-rose-600"
                                          : "bg-blue-600"
                                      }`}
                                    >
                                      ∑
                                    </span>
                                    <span>Akumulasi Net Weight ({pkgDetails.length} File PL):</span>
                                  </span>

                                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200/90 font-bold text-slate-800 shadow-2xs">
                                      PIB: {pibNetWtVal || "-"}
                                    </span>
                                    <span className="text-slate-400 font-bold">=</span>
                                    {pkgDetails.map((det, i) => {
                                      const dData = parseIsi(det.isi);
                                      const v = parseNumericValue(
                                        getVal(
                                          dData.fields,
                                          "Total_Net_Weight",
                                          "Total Net Weight",
                                          "Net_Weight",
                                          "Net Weight",
                                          "Berat_Bersih",
                                          "Berat Bersih"
                                        )
                                      );
                                      return (
                                        <React.Fragment key={i}>
                                          {i > 0 && <span className="text-slate-400 font-bold">+</span>}
                                          <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-200/80 text-slate-700">
                                            <span className="text-slate-400 font-sans text-[10px] mr-1">PL #{i + 1}:</span>
                                            {formatNumericValue(v)}
                                          </span>
                                        </React.Fragment>
                                      );
                                    })}
                                    <span
                                      className={`px-2 py-0.5 rounded border font-bold ${
                                        isCombinedWtMatch === true
                                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                          : isCombinedWtMatch === false
                                          ? "bg-rose-100 text-rose-800 border-rose-300"
                                          : "bg-blue-100 text-blue-800 border-blue-300"
                                      }`}
                                    >
                                      = {formatNumericValue(sumPkgNetWt)}
                                    </span>
                                  </div>
                                </div>

                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                                    isCombinedWtMatch === true
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : isCombinedWtMatch === false
                                      ? "bg-rose-100 text-rose-800 border-rose-300"
                                      : "bg-blue-100 text-blue-800 border-blue-300"
                                  }`}
                                >
                                  {isCombinedWtMatch === true
                                    ? "✓ Match"
                                    : isCombinedWtMatch === false
                                    ? "✕ Mismatch"
                                    : "Multiple"}
                                </span>
                              </div>
                            )}

                            {pkgDetails.map((pkgDet, idx) => {
                              const pkgData = parseIsi(pkgDet.isi);
                              const pkgInvNum = getVal(pkgData.fields, "Invoice_Number", "Invoice Number");
                              const matchInfo = getInvoiceMatchInfo(pkgInvNum);
                              return (
                                <div
                                  key={pkgDet.id || idx}
                                  className="space-y-1 bg-slate-50/60 p-3 rounded-lg border border-slate-200/80"
                                >
                                  {pkgDetails.length > 1 && (
                                    <div className="font-bold text-[11px] text-blue-950 pb-1.5 border-b border-slate-200/80 flex items-center justify-between">
                                      <span className="px-2 py-0.5 bg-blue-950 text-white rounded text-[10px] font-bold">
                                        Packing List #{idx + 1}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        ID: {pkgDet.fileId}
                                      </span>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 font-bold text-[11px] text-slate-700">
                                    <div className="text-blue-950">PIB (Acuan Utama)</div>
                                    <div className="text-slate-700 pl-2 border-l border-slate-200">
                                      Packing List {pkgDetails.length > 1 ? `#${idx + 1}` : ""} (Pembanding)
                                    </div>
                                  </div>
                                  <CompareRow
                                    lblLeft="Invoice Number"
                                    valLeft={matchInfo.valLeft}
                                    lblRight="Invoice Number"
                                    valRight={pkgInvNum}
                                    customStatus={matchInfo.isMatch}
                                    noteLeft={matchInfo.noteLeft}
                                  />
                                  <CompareRow
                                    lblLeft="Invoice Date"
                                    valLeft={getVal(pibData.fields, "Invoice_Date", "Invoice Date")}
                                    lblRight="Invoice Date"
                                    valRight={getVal(pkgData.fields, "Invoice_Date", "Invoice Date")}
                                  />
                                  <CompareRow
                                    lblLeft="Total Net Weight"
                                    valLeft={getVal(pibData.fields, "Berat_Bersih", "Berat Bersih")}
                                    lblRight="Total Net Weight"
                                    valRight={getVal(
                                      pkgData.fields,
                                      "Total_Net_Weight",
                                      "Total Net Weight",
                                      "Net_Weight",
                                      "Net Weight",
                                      "Berat_Bersih",
                                      "Berat Bersih"
                                    )}
                                    customStatus={pkgDetails.length > 1 ? isCombinedWtMatch : undefined}
                                    noteLeft={
                                      pkgDetails.length > 1
                                        ? `Akumulasi Net Weight (${pkgDetails.length} PL)`
                                        : undefined
                                    }
                                  />
                                </div>
                              );
                            })}
                          </>
                        );
                      })()
                    )}
                  </div>
                </div>

                {/* 3. BL SECTION (ONLY IF UPLOADED) */}
                {blDetail && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                      <div className="font-bold text-blue-950 text-xs flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-950 text-white flex items-center justify-center text-[10px]">
                          3
                        </span>
                        <span>BILL OF LADING (BL) COMPARISON</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                          blDetail.isi
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {blDetail.isi ? "Uploaded" : "Pending OCR"}
                      </span>
                    </div>
                    <div className="p-3.5 space-y-2">
                      <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 font-bold text-[11px] text-slate-700">
                        <div className="text-blue-950">PIB (Acuan Utama)</div>
                        <div className="text-slate-700 pl-2 border-l border-slate-200">
                          BL (Pembanding)
                        </div>
                      </div>
                      <CompareRow
                        lblLeft="Sea Waybill Number"
                        valLeft={getVal(pibData.fields, "No_House_BL", "No House BL", "House_BL")}
                        lblRight="Sea Waybill Number"
                        valRight={getVal(blData.fields, "Sea_Waybill_Number", "Sea Waybill Number")}
                      />
                      <CompareRow
                        lblLeft="Date"
                        valLeft={getVal(pibData.fields, "House_BL_Date", "House BL Date")}
                        lblRight="Date"
                        valRight={getVal(blData.fields, "Date")}
                      />
                      <CompareRow
                        lblLeft="Gross Weight"
                        valLeft={getVal(pibData.fields, "Berat_Kotor", "Berat Kotor")}
                        lblRight="Gross Weight"
                        valRight={blData.table[0]?.["Gross_Weight"] || blData.table[0]?.["gross weight"]}
                      />
                      <CompareRow
                        lblLeft="QTY"
                        valLeft={getVal(pibData.fields, "Jumlah", "Jumlah Package")}
                        lblRight="QTY"
                        valRight={blData.table[0]?.["QTY"] || blData.table[0]?.["qty"]}
                      />
                    </div>
                  </div>
                )}

                {/* 4. MASTER BL SECTION (ONLY IF UPLOADED) */}
                {mblDetail && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                      <div className="font-bold text-blue-950 text-xs flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-950 text-white flex items-center justify-center text-[10px]">
                          4
                        </span>
                        <span>MASTER BL COMPARISON</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                          mblDetail.isi
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {mblDetail.isi ? "Uploaded" : "Pending OCR"}
                      </span>
                    </div>
                    <div className="p-3.5 space-y-2">
                      <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 font-bold text-[11px] text-slate-700">
                        <div className="text-blue-950">PIB (Acuan Utama)</div>
                        <div className="text-slate-700 pl-2 border-l border-slate-200">
                          Master BL (Pembanding)
                        </div>
                      </div>
                      <CompareRow
                        lblLeft="BL Number"
                        valLeft={getVal(pibData.fields, "No_Master_BL", "No Master BL", "Master_BL")}
                        lblRight="BL Number"
                        valRight={getVal(mblData.fields, "BL_Number", "BL Number")}
                      />
                      <CompareRow
                        lblLeft="Date of Issue"
                        valLeft={getVal(pibData.fields, "Master_BL_Date", "Master BL Date")}
                        lblRight="Date of Issue"
                        valRight={getVal(mblData.fields, "Date_of_Issue", "Date of Issue")}
                      />
                      <CompareRow
                        lblLeft="Container"
                        valLeft={getVal(pibData.fields, "No_Peti", "No Peti")}
                        lblRight="Container"
                        valRight={getVal(mblData.fields, "Container")}
                      />
                      <CompareRow
                        lblLeft="Type"
                        valLeft={getVal(pibData.fields, "Tipe_Peti", "Tipe Peti")}
                        lblRight="Type"
                        valRight={getVal(mblData.fields, "Type")}
                      />
                      <CompareRow
                        lblLeft="Goods Gross"
                        valLeft={getVal(pibData.fields, "Berat_Kotor", "Berat Kotor")}
                        lblRight="Goods Gross"
                        valRight={mblData.table[0]?.["Goods_Gross"]}
                      />
                    </div>
                  </div>
                )}

                {/* 5. REKAP DOCUMENT SECTION (ONLY IF UPLOADED) */}
                {rekapDetail && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                      <div className="font-bold text-blue-950 text-xs flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-950 text-white flex items-center justify-center text-[10px]">
                          5
                        </span>
                        <span>REKAP DOCUMENT COMPARISON (TABEL BARANG)</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                          rekapDetail.isi
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {rekapDetail.isi ? "Uploaded" : "Pending OCR"}
                      </span>
                    </div>

                    <div className="p-3.5 space-y-3">
                      <div className="grid grid-cols-2 gap-3 font-bold text-[11px] text-slate-700">
                        <div className="text-blue-950">PIB Barang (Acuan Utama)</div>
                        <div className="text-slate-700 pl-2 border-l border-slate-200">
                          Rekap Barang (Pembanding)
                        </div>
                      </div>

                      {/* Item-by-item comparison with full text & row match status */}
                      <div className="space-y-2.5">
                        {(() => {
                          const maxRows = Math.max(pibData.table.length, rekapData.table.length);
                          if (maxRows === 0) {
                            return (
                              <p className="text-slate-400 italic text-[11px] text-center py-3 bg-slate-50 rounded-lg">
                                Tabel Barang PIB dan Rekap Kosong.
                              </p>
                            );
                          }

                          const renderedRows = [];
                          for (let i = 0; i < maxRows; i++) {
                            const pibRow = pibData.table[i] || {};
                            const rekapRow = rekapData.table[i] || {};
                            const pibHs = displayValue(pibRow["Pos_Tarif"] || pibRow["pos tarif"] || pibRow["pos_tarif"] || pibRow["HS_Code"] || pibRow["hs code"]);
                            const rekapHs = displayValue(
                              rekapRow["HS_Code"] || rekapRow["hs code"] || rekapRow["pos tarif"] || rekapRow["pos_tarif"] || rekapRow["Pos_Tarif"]
                            );

                            const pibPart = displayValue(pibRow["Kode_Barang"] || pibRow["kode barang"] || pibRow["kode_barang"] || pibRow["Part_No"] || pibRow["part_no"]);
                            const rekapPart = displayValue(
                              rekapRow["Part_No"] ||
                              rekapRow["part_no"] ||
                              rekapRow["no part"] ||
                              rekapRow["part no"] ||
                              rekapRow["Kode_Barang"] ||
                              rekapRow["kode_barang"] ||
                              rekapRow["kode barang"]
                            );

                            const pibQty = displayValue(pibRow["Jumlah_Barang"] || pibRow["jumlah barang"] || pibRow["jumlah_barang"] || pibRow["QTY"] || pibRow["qty"] || pibRow["jumlah"]);
                            const rekapQty = displayValue(
                              rekapRow["QTY"] ||
                              rekapRow["qty"] ||
                              rekapRow["jumlah"] ||
                              rekapRow["jumlah_barang"] ||
                              rekapRow["jumlah barang"]
                            );

                            const pibDesc = displayValue(pibRow["Uraian"] || pibRow["uraian"] || pibRow["Desc"] || pibRow["desc"]);
                            const rekapDesc = displayValue(
                              rekapRow["Part_Desc"] ||
                              rekapRow["part desc"] ||
                              rekapRow["desc"] ||
                              rekapRow["uraian"]
                            );

                            const hasBoth = Boolean(
                              (pibHs !== "-" || pibPart !== "-" || pibQty !== "-") && (rekapHs !== "-" || rekapPart !== "-" || rekapQty !== "-")
                            );

                            const cleanVal = (s: string) => s.toLowerCase().trim();
                            const cleanNum = (s: string) => s.toLowerCase().replace(/,/g, "").replace(/\.00$/, "").replace(/\s+/g, "").trim();

                            const isHsMatch =
                              pibHs !== "-" && rekapHs !== "-" && cleanVal(pibHs) === cleanVal(rekapHs);
                            const isPartMatch =
                              pibPart !== "-" &&
                              rekapPart !== "-" &&
                              cleanVal(pibPart) === cleanVal(rekapPart);
                            const isQtyMatch =
                              pibQty !== "-" && rekapQty !== "-" && cleanNum(pibQty) === cleanNum(rekapQty);

                            const isRowMatch = hasBoth && (isHsMatch || isPartMatch) && (isQtyMatch || pibQty === "-" || rekapQty === "-");
                            const isRowMismatch = hasBoth && !isRowMatch;

                            const itemBoxClass = isRowMatch
                              ? "bg-emerald-50 text-emerald-950 border-emerald-200"
                              : isRowMismatch
                              ? "bg-rose-50 text-rose-950 border-rose-200"
                              : "bg-slate-50 text-slate-800 border-slate-200/80";

                            renderedRows.push(
                              <div key={i} className="grid grid-cols-2 gap-3 text-xs">
                                {/* PIB Item Box */}
                                <div
                                  className={`p-3 rounded-xl border space-y-1.5 transition-colors ${itemBoxClass}`}
                                >
                                  <div className="flex items-center justify-between font-bold text-xs border-b border-black/10 pb-1">
                                    <span>HS: {pibHs}</span>
                                    <span>Qty: {pibQty}</span>
                                  </div>
                                  <div className="font-semibold text-xs opacity-90">
                                    Part No: {pibPart}
                                  </div>
                                  <div className="break-words font-sans text-xs leading-normal pt-0.5">
                                    {pibDesc}
                                  </div>
                                </div>

                                {/* Rekap Item Box */}
                                <div
                                  className={`p-3 rounded-xl border space-y-1.5 transition-colors ${itemBoxClass}`}
                                >
                                  <div className="flex items-center justify-between font-bold text-xs border-b border-black/10 pb-1">
                                    <span>HS: {rekapHs}</span>
                                    <span>Qty: {rekapQty}</span>
                                  </div>
                                  <div className="font-semibold text-xs opacity-90">
                                    Part No: {rekapPart}
                                  </div>
                                  <div className="break-words font-sans text-xs leading-normal pt-0.5">
                                    {rekapDesc}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return renderedRows;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  PIB digunakan sebagai acuan pembanding utama (sebelah kiri).
                </span>
                <button
                  onClick={() => setViewingBatch(null)}
                  className="px-5 py-2 rounded-xl bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs shadow-xs"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
