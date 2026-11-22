"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import type { BoundingBox, ComparisonField, FieldMatchStatus } from "~/types/documentComparison";
import { valueMatchesGroup } from "~/utils/valueEquivalency";
import FieldRow from "./FieldRow";

// Dynamically import PdfViewer with ssr: false for Next.js App Router client rendering
const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full bg-slate-100 rounded-xl border border-slate-200 p-6 text-slate-500">
      <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mb-2" />
      <span className="text-xs font-medium">Menyiapkan viewer PDF...</span>
    </div>
  ),
});

interface DetailBatchItem {
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
  details?: DetailBatchItem[];
}

interface SplitViewDetailModalProps {
  batch: BatchItem;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  equivalencyGroups?: any[];
  onClose: () => void;
  onOpenAuditLog: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onOpenFieldEdit?: (params: {
    detailId: number;
    docTitle: string;
    fieldName: string;
    fieldLabel: string;
    currentValue: string;
    oppositeValue: string;
    tableIndex?: number;
  }) => void;
}

// Coordinate normalizer for Nanonets OCR boxes
function normalizeBbox(
  rawCoord?: { xmin?: number; ymin?: number; xmax?: number; ymax?: number; page?: number },
  pageFallback?: number
): BoundingBox | undefined {
  if (!rawCoord || rawCoord.xmin === undefined || rawCoord.ymin === undefined) return undefined;
  // Prefer rawCoord.page from Nanonets (0-indexed -> 1-indexed); fallback to pageFallback only if rawCoord.page is undefined
  const pageNum = rawCoord.page !== undefined ? Number(rawCoord.page) + 1 : (pageFallback ?? 1);
  const isPixel = (rawCoord.xmax ?? 0) > 100 || (rawCoord.ymax ?? 0) > 100;
  // Detect landscape vs portrait (A4 300 DPI: portrait 2480x3508, landscape 3508x2480)
  const isLandscape = isPixel && (rawCoord.xmax ?? 0) > 2480;
  const baseW = isPixel ? (isLandscape ? 3508 : 2480) : 100;
  const baseH = isPixel ? (isLandscape ? 2480 : 3508) : 100;

  const x = Math.max(0, Math.min(100, (rawCoord.xmin / baseW) * 100));
  const y = Math.max(0, Math.min(100, (rawCoord.ymin / baseH) * 100));
  const width = Math.max(1, Math.min(100, (((rawCoord.xmax ?? rawCoord.xmin) - rawCoord.xmin) / baseW) * 100));
  const height = Math.max(0.5, Math.min(100, (((rawCoord.ymax ?? rawCoord.ymin) - rawCoord.ymin) / baseH) * 100));

  return {
    page: pageNum,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
  };
}

export default function SplitViewDetailModal({
  batch,
  equivalencyGroups = [],
  onClose,
  onOpenAuditLog,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onOpenFieldEdit,
}: SplitViewDetailModalProps) {
  // Available Comparison Document Types
  const [selectedDocType, setSelectedDocType] = useState<string>("Invoice");
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // PDF Viewer Viewport States
  const [pibPage, setPibPage] = useState<number>(1);
  const [pibZoom, setPibZoom] = useState<number>(100);
  const [pembandingPage, setPembandingPage] = useState<number>(1);
  const [pembandingZoom, setPembandingZoom] = useState<number>(100);

  // Responsive Mobile Tab Switcher (< 1024px)
  const [mobileTab, setMobileTab] = useState<"left" | "center" | "right">("center");

  // Center Row Element References for Auto-Scroll
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 1. Identify PIB Detail
  const pibDetail = useMemo(() => {
    return (
      batch.details?.find((d) => {
        const ft = (d.fileType || "").trim().toLowerCase();
        return ft === "pib" || ft.includes("file acuan") || ft.startsWith("pib");
      }) || null
    );
  }, [batch.details]);

  // 2. Identify Selected Pembanding Detail
  const pembandingDetail = useMemo(() => {
    return (
      batch.details?.find((d) => {
        const ft = (d.fileType || "").trim().toLowerCase();
        const target = selectedDocType.toLowerCase();
        if (target === "invoice") return ft.includes("invoice");
        if (target === "packing list") return (ft.includes("packing") || ft.includes("paking")) && !ft.includes("wl");
        if (target === "bl") return ft.includes("bl") || ft.includes("lading");
        if (target === "ak") return ft.includes("ak") || ft.includes("coo");
        if (target === "wl") return ft === "wl" || ft.includes("weight") || ft.includes("wl");
        if (target === "ms") return ft === "ms" || ft.includes("mill") || ft.includes("test");
        return ft.includes(target);
      }) || null
    );
  }, [batch.details, selectedDocType]);

  // Parse parsed isi
  const pibIsi = useMemo(() => {
    if (!pibDetail?.isi) return { fields: {}, table: [], coordinates: {}, tableCoordinates: [], manualEdits: {} };
    try {
      const p = typeof pibDetail.isi === "string" ? JSON.parse(pibDetail.isi) : pibDetail.isi;
      return {
        fields: p.fields || {},
        table: p.table || [],
        coordinates: p.coordinates || {},
        tableCoordinates: p.tableCoordinates || [],
        manualEdits: p.manualEdits || {},
      };
    } catch {
      return { fields: {}, table: [], coordinates: {}, tableCoordinates: [], manualEdits: {} };
    }
  }, [pibDetail?.isi]);

  const pembandingIsi = useMemo(() => {
    if (!pembandingDetail?.isi) return { fields: {}, table: [], coordinates: {}, tableCoordinates: [], manualEdits: {} };
    try {
      const p = typeof pembandingDetail.isi === "string" ? JSON.parse(pembandingDetail.isi) : pembandingDetail.isi;
      return {
        fields: p.fields || {},
        table: p.table || [],
        coordinates: p.coordinates || {},
        tableCoordinates: p.tableCoordinates || [],
        manualEdits: p.manualEdits || {},
      };
    } catch {
      return { fields: {}, table: [], coordinates: {}, tableCoordinates: [], manualEdits: {} };
    }
  }, [pembandingDetail?.isi]);

  // Helper to extract value considering manualEdits and _action
  const extractFieldValue = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    docIsi: any,
    keys: string[]
  ): { value: string; isManual: boolean; coord?: any } => {
    // 1. Manual edits
    if (docIsi.manualEdits) {
      for (const k of keys) {
        if (docIsi.manualEdits[k]?.newValue !== undefined) {
          return { value: String(docIsi.manualEdits[k].newValue), isManual: true };
        }
        const nk = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const [mk, mv] of Object.entries(docIsi.manualEdits as Record<string, any>)) {
          if (mk.toLowerCase().replace(/[^a-z0-9]/g, "") === nk && mv?.newValue !== undefined) {
            return { value: String(mv.newValue), isManual: true };
          }
        }
      }
    }

    // 2. Action fields
    if (docIsi.fields) {
      for (const k of keys) {
        const actionKey = `${k}_action`;
        if (docIsi.fields[actionKey] !== undefined && docIsi.fields[actionKey] !== "") {
          const coord = docIsi.coordinates?.[k] || docIsi.coordinates?.[actionKey];
          return { value: String(docIsi.fields[actionKey]), isManual: false, coord };
        }
      }
    }

    // 3. Original fields
    if (docIsi.fields) {
      for (const k of keys) {
        if (docIsi.fields[k] !== undefined && docIsi.fields[k] !== "") {
          const coord = docIsi.coordinates?.[k];
          return { value: String(docIsi.fields[k]), isManual: false, coord };
        }
      }
      // Normalized field lookup
      const normMap: Record<string, { val: string; key: string }> = {};
      for (const [fk, fv] of Object.entries(docIsi.fields)) {
        normMap[fk.toLowerCase().replace(/[^a-z0-9]/g, "")] = { val: String(fv), key: fk };
      }
      for (const k of keys) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normMap[cleanK]) {
          const origKey = normMap[cleanK]!.key;
          const coord = docIsi.coordinates?.[origKey];
          return { value: normMap[cleanK]!.val, isManual: false, coord };
        }
      }
    }

    // 4. Table row 0
    if (docIsi.table && docIsi.table.length > 0) {
      const row = docIsi.table[0];
      const rowCoord = docIsi.tableCoordinates?.[0];
      for (const k of keys) {
        const actionKey = `${k}_action`;
        if (row[actionKey] !== undefined && row[actionKey] !== "") {
          const coord = rowCoord?.[k] || rowCoord?.[actionKey];
          return { value: String(row[actionKey]), isManual: false, coord };
        }
      }
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== "") {
          const coord = rowCoord?.[k];
          return { value: String(row[k]), isManual: false, coord };
        }
      }
      for (const [rk, rv] of Object.entries(row)) {
        const cleanRk = rk.toLowerCase().replace(/[^a-z0-9]/g, "");
        for (const k of keys) {
          if (cleanRk === k.toLowerCase().replace(/[^a-z0-9]/g, "")) {
            const coord = rowCoord?.[rk];
            return { value: String(rv), isManual: false, coord };
          }
        }
      }
    }

    return { value: "-", isManual: false };
  };

  // Helper matching engine with equivalence dictionary support
  const checkFieldMatch = useCallback((v1: string, v2: string, fieldName: string) => {
    if (!v1 || !v2 || v1 === "-" || v2 === "-") {
      return { status: "NEUTRAL" as FieldMatchStatus, reason: undefined };
    }
    const s1 = v1.trim().toLowerCase();
    const s2 = v2.trim().toLowerCase();
    if (!s1 || !s2) return { status: "NEUTRAL" as FieldMatchStatus, reason: undefined };
    if (s1 === s2) return { status: "MATCH" as FieldMatchStatus, reason: undefined };

    // Equivalence Dictionary Check
    if (equivalencyGroups && equivalencyGroups.length > 0) {
      const fieldNorm = fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");
      for (const group of equivalencyGroups) {
        if (!group || !group.canonical) continue;
        const groupNameNorm = (group.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const groupCatNorm = (group.category || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const isGeneral =
          !groupCatNorm ||
          groupCatNorm === "general" ||
          groupCatNorm === "umum" ||
          groupNameNorm === "general" ||
          groupNameNorm === "umum";

        if (
          !isGeneral &&
          groupNameNorm &&
          groupNameNorm !== fieldNorm &&
          !groupNameNorm.includes(fieldNorm) &&
          !fieldNorm.includes(groupNameNorm)
        ) {
          continue;
        }

        if (valueMatchesGroup(v1, group) && valueMatchesGroup(v2, group)) {
          return {
            status: "MATCH" as FieldMatchStatus,
            reason: `(Ekuivalen: ${group.canonical})`,
          };
        }
      }
    }

    return { status: "MISMATCH" as FieldMatchStatus, reason: undefined };
  }, [equivalencyGroups]);

  // Build Fields List for Selected Pembanding
  const fields: ComparisonField[] = useMemo(() => {
    interface FieldDef {
      id: string;
      number: string;
      label: string;
      pibKeys: string[];
      pembandingKeys: string[];
      fieldName: string;
      pagePibDefault?: number;
      pagePembandingDefault?: number;
    }

    let defs: FieldDef[] = [];

    if (selectedDocType === "Invoice") {
      defs = [
        { id: "inv-1", number: "1", label: "Deskripsi barang", pibKeys: ["Uraian_Barang", "Deskripsi_Barang", "Description"], pembandingKeys: ["Deskripsi_Barang", "Description", "Description_of_Goods", "Item_Description", "Commodity"], fieldName: "Deskripsi_Barang", pagePibDefault: 2, pagePembandingDefault: 1 },
        { id: "inv-2", number: "2", label: "Gross weight", pibKeys: ["Berat_Kotor", "Gross_Weight", "Total_Gross_Weight"], pembandingKeys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor", "Gross Weight", "G.W."], fieldName: "Gross_Weight", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-3", number: "3", label: "Identitas pembeli", pibKeys: ["Pemilik_Barang", "Nama_Importir", "Importir", "Identitas_Pembeli"], pembandingKeys: ["Identitas_Pembeli", "Buyer", "Consignee", "Sold To", "Customer"], fieldName: "Identitas_Pembeli", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-4", number: "4", label: "Identitas penjual", pibKeys: ["Identitas_Penjual", "Nama_Penjual", "Nama_Pengirim", "Pengirim", "Supplier"], pembandingKeys: ["Identitas_Penjual", "Exporter", "Seller", "Shipper", "Supplier", "Nama_Penjual"], fieldName: "Identitas_Penjual", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-5", number: "5", label: "Incoterms lokasi", pibKeys: ["Incoterms", "Ket_FOB", "Cara_Penyerahan", "Terms_of_Delivery", "Incoterms_Lokasi"], pembandingKeys: ["Incoterms_Lokasi", "Incoterms", "Terms_of_Delivery", "Delivery_Terms"], fieldName: "Incoterms_Lokasi", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-6", number: "6", label: "Jumlah coil", pibKeys: ["Jumlah_Coil", "Jumlah", "Jumlah_Kemasan", "Total_Packages"], pembandingKeys: ["Jumlah_Coil", "Total_Coils", "Jumlah", "QTY", "Total_Packages"], fieldName: "Jumlah_Coil", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-7", number: "7", label: "Mata uang", pibKeys: ["Valuta", "Mata_Uang", "Currency", "Jenis_Valuta"], pembandingKeys: ["Mata_Uang", "Valuta", "Currency", "Curr"], fieldName: "Mata_Uang", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-8", number: "8", label: "Moda", pibKeys: ["Moda", "Nama_Sarana_Pengangkutan", "Nama_Sarana_Pengangkut", "Nama_Kapal"], pembandingKeys: ["Moda", "Shipped_Per", "Vessel", "Vessel_Name", "Nama_Kapal"], fieldName: "Moda", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-9", number: "9", label: "Negara asal", pibKeys: ["Pelabuhan_Asal", "Negara_Asal", "Country_of_Origin", "Origin_Country"], pembandingKeys: ["Negara_Asal", "Country_of_Origin", "Origin"], fieldName: "Negara_Asal", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-10", number: "10", label: "Negara tujuan", pibKeys: ["Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar", "Negara_Tujuan"], pembandingKeys: ["Negara_Tujuan", "Destination_Country", "Destination"], fieldName: "Negara_Tujuan", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-11", number: "11", label: "Net weight", pibKeys: ["Berat_Bersih", "Net_Weight", "Total_Net_Weight"], pembandingKeys: ["Net_Weight", "Total_Net_Weight", "Berat_Bersih", "Net Weight", "N.W."], fieldName: "Net_Weight", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-12", number: "12", label: "Nilai total invoice", pibKeys: ["Nilai_Pabean", "Nilai_Total_Invoice", "Nilai Pabean", "Nilai Total"], pembandingKeys: ["Nilai_Total_Invoice", "Total", "Nilai Total", "Total_Amount", "Invoice_Total"], fieldName: "Nilai_Total_Invoice", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-13", number: "13", label: "No invoice", pibKeys: ["No_Invoice", "Invoice_Number", "Nomor_Invoice"], pembandingKeys: ["No_Invoice", "Invoice_Number", "Invoice Number", "Nomor_Invoice"], fieldName: "No_Invoice", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-14", number: "14", label: "Pelabuhan asal", pibKeys: ["Pelabuhan_Muat", "Pelabuhan_Asal", "Port_of_Loading"], pembandingKeys: ["Pelabuhan_Asal", "Port_of_Loading", "Pelabuhan_Muat"], fieldName: "Pelabuhan_Asal", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-15", number: "15", label: "Pelabuhan tujuan", pibKeys: ["Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar"], pembandingKeys: ["Pelabuhan_Tujuan", "Destination", "Port_of_Discharge", "Pelabuhan_Bongkar"], fieldName: "Pelabuhan_Tujuan", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "inv-16", number: "16", label: "Tanggal invoice", pibKeys: ["Tanggal_Invoice", "Invoice_Date", "Tanggal Invoice"], pembandingKeys: ["Tanggal_Invoice", "Invoice_Date", "Invoice Date"], fieldName: "Tanggal_Invoice", pagePibDefault: 1, pagePembandingDefault: 1 },
      ];
    } else if (selectedDocType === "Packing List") {
      defs = [
        { id: "pl-1", number: "1", label: "Deskripsi barang", pibKeys: ["Uraian_Barang", "Deskripsi_Barang", "Description"], pembandingKeys: ["Deskripsi_Barang", "Description", "Description_of_Goods"], fieldName: "Deskripsi_Barang", pagePibDefault: 2, pagePembandingDefault: 1 },
        { id: "pl-2", number: "2", label: "Gross weight", pibKeys: ["Berat_Kotor", "Gross_Weight", "Total_Gross_Weight"], pembandingKeys: ["Gross_Weight", "Total_Gross_Weight", "G.W.", "Gross Weight"], fieldName: "Gross_Weight", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "pl-3", number: "3", label: "Identitas buyer", pibKeys: ["Pemilik_Barang", "Nama_Importir", "Importir", "Identitas_Pembeli"], pembandingKeys: ["Identitas_Buyer", "Buyer", "Consignee", "Identitas_Pembeli"], fieldName: "Identitas_Buyer", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "pl-4", number: "4", label: "Identitas supplier", pibKeys: ["Identitas_Penjual", "Nama_Penjual", "Nama_Pengirim", "Pengirim", "Supplier"], pembandingKeys: ["Identitas_Supplier", "Supplier", "Exporter", "Shipper", "Seller", "Identitas_Penjual"], fieldName: "Identitas_Supplier", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "pl-5", number: "5", label: "Jumlah coil", pibKeys: ["Jumlah_Coil", "Jumlah", "Jumlah_Kemasan"], pembandingKeys: ["Jumlah_Coil", "Total_Coils", "Coils", "Qty_Coil", "Jumlah"], fieldName: "Jumlah_Coil", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "pl-6", number: "6", label: "Moda", pibKeys: ["Moda", "Nama_Sarana_Pengangkutan", "Nama_Sarana_Pengangkut", "Nama_Kapal"], pembandingKeys: ["Moda", "Shipped_Per", "Vessel", "Vessel_Name"], fieldName: "Moda", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "pl-7", number: "7", label: "Negara asal", pibKeys: ["Negara_Asal", "Country_of_Origin", "Origin_Country", "Negara_Asal_Country_Of_Origin"], pembandingKeys: ["Negara_asal", "Negara_Asal", "Country_of_Origin", "Origin"], fieldName: "Negara_Asal", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "pl-8", number: "8", label: "Net weight", pibKeys: ["Berat_Bersih", "Net_Weight", "Total_Net_Weight"], pembandingKeys: ["Net_Weight", "Total_Net_Weight", "N.W.", "Net Weight"], fieldName: "Net_Weight", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "pl-9", number: "9", label: "No invoice", pibKeys: ["No_Invoice", "Invoice_Number", "Nomor_Invoice"], pembandingKeys: ["No_Invoice", "Invoice_Number", "Invoice Number"], fieldName: "No_Invoice", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "pl-10", number: "10", label: "Pelabuhan asal", pibKeys: ["Pelabuhan_Muat", "Pelabuhan_Asal", "Port_of_Loading"], pembandingKeys: ["Pelabuhan_Asal", "Port_of_Loading", "Pelabuhan_Muat"], fieldName: "Pelabuhan_Asal", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "pl-11", number: "11", label: "Pelabuhan tujuan", pibKeys: ["Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar"], pembandingKeys: ["Pelabuhan_Tujuan", "Destination", "Port_of_Discharge"], fieldName: "Pelabuhan_Tujuan", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "pl-12", number: "12", label: "Tanggal invoice", pibKeys: ["Tanggal_Invoice", "Invoice_Date", "Tanggal Invoice"], pembandingKeys: ["Tanggal_Invoice", "Invoice_Date", "Invoice Date"], fieldName: "Tanggal_Invoice", pagePibDefault: 1, pagePembandingDefault: 1 },
      ];
    } else if (selectedDocType === "BL") {
      defs = [
        { id: "bl-1", number: "1", label: "Consignee", pibKeys: ["Pemilik_Barang", "Nama_Importir", "Importir", "Identitas_Pembeli"], pembandingKeys: ["Consignee", "Nama_Consignee"], fieldName: "Consignee", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "bl-2", number: "2", label: "Deskripsi barang", pibKeys: ["Uraian_Barang", "Deskripsi_Barang", "Description"], pembandingKeys: ["Deskripsi_Barang", "Description", "Description_of_Goods"], fieldName: "Deskripsi_Barang", pagePibDefault: 2, pagePembandingDefault: 1 },
        { id: "bl-3", number: "3", label: "Gross weight", pibKeys: ["Berat_Kotor", "Gross_Weight", "Total_Gross_Weight"], pembandingKeys: ["Gross_Weight", "Total_Gross_Weight", "G.W.", "Gross Weight"], fieldName: "Gross_Weight", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "bl-4", number: "4", label: "Jumlah package", pibKeys: ["Jumlah_Coil", "Jumlah", "Jumlah_Kemasan"], pembandingKeys: ["Jumlah_Package", "Total_Packages", "Jumlah_Coil", "Packages"], fieldName: "Jumlah_Package", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "bl-5", number: "5", label: "Net weight", pibKeys: ["Berat_Bersih", "Net_Weight", "Total_Net_Weight"], pembandingKeys: ["Net_Weight", "Total_Net_Weight", "N.W.", "Net Weight"], fieldName: "Net_Weight", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "bl-6", number: "6", label: "Notify party", pibKeys: ["Pemilik_Barang", "Nama_Importir", "Importir"], pembandingKeys: ["Notify_Party", "NotifyParty", "Notify_Party_action"], fieldName: "Notify_Party", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "bl-7", number: "7", label: "Port of discharge", pibKeys: ["Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar"], pembandingKeys: ["Port_of_Discharge", "Destination", "Pelabuhan_Tujuan"], fieldName: "Port_of_Discharge", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "bl-8", number: "8", label: "Port of loading", pibKeys: ["Pelabuhan_Muat", "Pelabuhan_Asal", "Port_of_Loading"], pembandingKeys: ["Port_of_Loading", "Pelabuhan_Muat", "Loading_Port"], fieldName: "Port_of_Loading", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "bl-9", number: "9", label: "Shipper", pibKeys: ["Identitas_Pengirim", "Nama_Pengirim", "Pengirim", "Identitas_Penjual"], pembandingKeys: ["Shipper", "Shipping_Marks", "Identitas_Pengirim", "Exporter", "Nama_Pengirim"], fieldName: "Shipper", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "bl-10", number: "10", label: "Tanggal BL", pibKeys: ["Tanggal_BL", "Tanggal BL", "House_BL_Date", "Date_of_Issue"], pembandingKeys: ["Tanggal_BL", "Date_of_Issue", "BL_Date", "Shipped_on_Board_Date", "Date"], fieldName: "Tanggal_BL", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "bl-11", number: "11", label: "Vessel name", pibKeys: ["Moda", "Nama_Sarana_Pengangkut", "Nama_Sarana_Pengangkutan", "Nama_Kapal"], pembandingKeys: ["Vessel_Name", "Vessel", "Nama_Kapal", "Moda"], fieldName: "Vessel_Name", pagePibDefault: 1, pagePembandingDefault: 1 },
      ];
    } else if (selectedDocType === "AK") {
      defs = [
        { id: "ak-1", number: "1", label: "No referensi (ECO)", pibKeys: ["Electronic_Certificate_Of_Origin_ECO", "Pengecualian_Perijinan2", "No_Referensi", "ECO"], pembandingKeys: ["No_Referensi", "Reference_No", "Certificate_No"], fieldName: "No_Referensi", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "ak-2", number: "2", label: "Nama exporter / shipper", pibKeys: ["Identitas_Pengirim", "Nama_Pengirim", "Pengirim", "Identitas_Penjual"], pembandingKeys: ["Nama_Exporter_Shipper", "Exporter", "Producer", "Shipper"], fieldName: "Nama_Exporter_Shipper", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "ak-3", number: "3", label: "Nama consignee", pibKeys: ["Pemilik_Barang", "Nama_Importir", "Importir", "Identitas_Pembeli"], pembandingKeys: ["Nama_Consignee", "Consignee", "Buyer", "Nama_Importir"], fieldName: "Nama_Consignee", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "ak-4", number: "4", label: "Nama vessel", pibKeys: ["Moda", "Nama_Sarana_Pengangkut", "Nama_Sarana_Pengangkutan"], pembandingKeys: ["Nama_Vessel", "Vessel_Name", "Vessel", "Moda"], fieldName: "Nama_Vessel", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "ak-5", number: "5", label: "Nama pelabuhan bongkar", pibKeys: ["Pelabuhan_Tujuan", "Destination", "Pelabuhan_Bongkar"], pembandingKeys: ["Nama_Pelabuhan_Bongkar", "Port_of_Discharge", "Destination"], fieldName: "Nama_Pelabuhan_Bongkar", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "ak-6", number: "6", label: "Jumlah coil", pibKeys: ["Jumlah_Coil", "Jumlah", "Jumlah_Kemasan"], pembandingKeys: ["Jumlah_Coil", "Total_Packages", "Jumlah_Dan_Jenis_Kemasan", "Number_and_Type_of_Packages", "Jumlah_Kemasan"], fieldName: "Jumlah_Coil", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "ak-7", number: "7", label: "Deskripsi barang", pibKeys: ["Uraian_Barang", "Deskripsi_Barang", "Description"], pembandingKeys: ["Deskripsi_Barang", "Description_of_Goods", "Description", "Commodity"], fieldName: "Deskripsi_Barang", pagePibDefault: 2, pagePembandingDefault: 1 },
        { id: "ak-8", number: "8", label: "Tanggal keberangkatan", pibKeys: ["Tanggal_BL", "Tanggal BL", "House_BL_Date", "Date_of_Issue"], pembandingKeys: ["Tanggal_Keberangkatan", "Departure_Date", "Date_of_Departure", "Tanggal_BL"], fieldName: "Tanggal_Keberangkatan", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "ak-9", number: "9", label: "Total gross weight", pibKeys: ["Berat_Kotor", "Gross_Weight", "Total_Gross_Weight"], pembandingKeys: ["Total_Gross_Weight", "Gross_Weight", "Berat_Kuantitas", "Total_Weight"], fieldName: "Total_Gross_Weight", pagePibDefault: 1, pagePembandingDefault: 1 },
      ];
    } else if (selectedDocType === "WL") {
      defs = [
        { id: "wl-1", number: "1", label: "Deskripsi Barang", pibKeys: ["Deskripsi_Barang", "Uraian_Barang", "Description"], pembandingKeys: ["Deskripsi_Barang", "Description", "Description_of_Goods", "Item_Description"], fieldName: "Deskripsi_Barang", pagePibDefault: 2, pagePembandingDefault: 1 },
        { id: "wl-2", number: "2", label: "Jumlah Coil", pibKeys: ["Jumlah_Coil", "Jumlah", "Jumlah_Kemasan"], pembandingKeys: ["Total_Coils", "Jumlah_Coil", "Coils", "Qty_Coil", "Jumlah"], fieldName: "Jumlah_Coil", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "wl-3", number: "3", label: "Net Weight", pibKeys: ["Berat_Bersih", "Total_Net_Weight", "Net_Weight"], pembandingKeys: ["Total_Net_Weight", "Net_Weight", "Berat_Bersih", "N.W."], fieldName: "Net_Weight", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "wl-4", number: "4", label: "Spesifikasi Grade", pibKeys: ["Spesifikasi_Grade", "Spek_Material", "Spesifikasi", "Grade"], pembandingKeys: ["Spesifikasi_Grade", "Spesifikasi", "Grade", "Specification"], fieldName: "Spesifikasi_Grade", pagePibDefault: 2, pagePembandingDefault: 1 },
      ];
    } else if (selectedDocType === "MS") {
      defs = [
        { id: "ms-1", number: "1", label: "Deskripsi Barang", pibKeys: ["Deskripsi_Barang", "Uraian_Barang", "Description"], pembandingKeys: ["Deskripsi_Barang", "Description", "Description_of_Goods", "Item_Description"], fieldName: "Deskripsi_Barang", pagePibDefault: 2, pagePembandingDefault: 1 },
        { id: "ms-2", number: "2", label: "Jumlah Berat Material", pibKeys: ["Berat_Bersih", "Total_Net_Weight", "Net_Weight"], pembandingKeys: ["Jumlah_Berat_Material", "Total_Weight", "Weight", "Net_Weight"], fieldName: "Jumlah_Berat_Material", pagePibDefault: 2, pagePembandingDefault: 1 },
        { id: "ms-3", number: "3", label: "Nama Supplier", pibKeys: ["Identitas_Pengirim", "Nama_Pengirim", "Pengirim", "Identitas_Penjual", "Supplier"], pembandingKeys: ["Nama_Supplier", "Nama_Produsen", "Producer", "Supplier", "Manufacturer"], fieldName: "Nama_Supplier", pagePibDefault: 1, pagePembandingDefault: 1 },
        { id: "ms-4", number: "4", label: "Spek Material", pibKeys: ["Spesifikasi_Grade", "Spek_Material", "Spesifikasi", "Grade"], pembandingKeys: ["Spek_Material", "Specification", "Steel_Grade", "Grade", "Spesifikasi"], fieldName: "Spek_Material", pagePibDefault: 2, pagePembandingDefault: 1 },
      ];
    }

    return defs.map((d) => {
      const pibRes = extractFieldValue(pibIsi, d.pibKeys);
      const pembandingRes = extractFieldValue(pembandingIsi, d.pembandingKeys);
      const match = checkFieldMatch(pibRes.value, pembandingRes.value, d.fieldName);

      const pibBbox = normalizeBbox(pibRes.coord, d.pagePibDefault);
      const pembandingBbox = normalizeBbox(pembandingRes.coord, d.pagePembandingDefault);

      return {
        id: d.id,
        number: d.number,
        label: d.label,
        status: match.status,
        pibValue: pibRes.value,
        pembandingValue: pembandingRes.value,
        matchReason: match.reason,
        isManualLeft: pibRes.isManual,
        isManualRight: pembandingRes.isManual,
        pibBbox,
        pembandingBbox,
        fieldName: d.fieldName,
        category: selectedDocType,
        detailIdLeft: pibDetail?.id,
        detailIdRight: pembandingDetail?.id,
      };
    });
  }, [selectedDocType, pibIsi, pembandingIsi, pibDetail?.id, pembandingDetail?.id, checkFieldMatch]);

  // Filter fields based on search query
  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return fields;
    const q = searchQuery.toLowerCase().trim();
    return fields.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.pibValue.toLowerCase().includes(q) ||
        f.pembandingValue.toLowerCase().includes(q) ||
        f.number.toLowerCase().includes(q)
    );
  }, [fields, searchQuery]);

  // Handle clicking a field row
  const handleSelectField = (fieldId: string) => {
    setActiveFieldId(fieldId);
    const target = fields.find((f) => f.id === fieldId);
    if (target) {
      if (target.pibBbox?.page) {
        setPibPage(target.pibBbox.page);
      }
      if (target.pembandingBbox?.page) {
        setPembandingPage(target.pembandingBbox.page);
      }
    }
  };

  // Default to first field with status 'Tidak cocok' (MISMATCH) when modal opens or doc changes
  useEffect(() => {
    if (fields.length > 0) {
      const firstMismatch = fields.find((f) => f.status === "MISMATCH");
      if (firstMismatch) {
        handleSelectField(firstMismatch.id);
      } else if (fields[0]) {
        handleSelectField(fields[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocType]);

  // Auto-scroll center list to active field
  useEffect(() => {
    if (activeFieldId && rowRefs.current[activeFieldId]) {
      rowRefs.current[activeFieldId]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeFieldId]);

  // Highlights for PDF Viewers
  const pibHighlights = useMemo(() => {
    return fields
      .filter((f) => f.pibBbox)
      .map((f) => ({
        fieldId: f.id,
        label: `${f.number}. ${f.label}`,
        bbox: f.pibBbox!,
        status: f.status,
      }));
  }, [fields]);

  const pembandingHighlights = useMemo(() => {
    return fields
      .filter((f) => f.pembandingBbox)
      .map((f) => ({
        fieldId: f.id,
        label: `${f.number}. ${f.label}`,
        bbox: f.pembandingBbox!,
        status: f.status,
      }));
  }, [fields]);

  // URLs for PDF Viewers (Using fallback PDF stream API)
  const rawPib = batch.details?.find((d) => {
    const ft = (d.fileType || "").trim().toLowerCase();
    return ft === "pib" || ft.includes("file acuan") || ft.startsWith("pib");
  });
  const rawPembanding = batch.details?.find((d) => {
    const ft = (d.fileType || "").trim().toLowerCase();
    const sel = selectedDocType.toLowerCase();
    return ft === sel || ft.includes(sel);
  });
  const pibUrl = rawPib?.id
    ? `/api/batches/${batch.id}/pdf?type=pib&detailId=${rawPib.id}`
    : `/api/batches/${batch.id}/pdf?type=pib`;
  const pembandingUrl = rawPembanding?.id
    ? `/api/batches/${batch.id}/pdf?type=${encodeURIComponent(selectedDocType)}&detailId=${rawPembanding.id}`
    : `/api/batches/${batch.id}/pdf?type=${encodeURIComponent(selectedDocType)}`;

  // Document types available in batch details
  const availableDocTabs = ["Invoice", "Packing List", "BL", "AK", "WL", "MS"];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150 overflow-hidden">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[98vw] xl:max-w-[1600px] h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-blue-950">
                Detail Batch #{batch.id}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  batch.status === "Matching"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : batch.status === "Mismatching"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {batch.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {batch.nama} • {batch.totalFile} File Dokumen
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenAuditLog}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
              title="Buka Log Pipeline & Audit Modal"
            >
              <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Log audit pipeline</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 focus:outline-none transition-colors cursor-pointer"
              title="Tutup modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile View Switcher (< 1024px) */}
        <div className="lg:hidden px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab("left")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              mobileTab === "left"
                ? "bg-blue-950 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            PDF PIB (Acuan)
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("center")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              mobileTab === "center"
                ? "bg-blue-950 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            Perbandingan Field
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("right")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              mobileTab === "right"
                ? "bg-blue-950 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            PDF {selectedDocType}
          </button>
        </div>

        {/* Body 3-Column Split View */}
        <div className="flex-1 overflow-hidden p-2 sm:p-3 bg-slate-100/60">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 h-full">
            {/* Left Column: Reference Document (PIB) Viewer */}
            <div
              className={`lg:col-span-3 xl:col-span-3 h-full ${
                mobileTab === "left" ? "block h-full" : "hidden lg:block"
              }`}
            >
              <PdfViewer
                url={pibUrl}
                fileName="PIB (File Acuan).pdf"
                documentRole="Acuan Utama"
                documentTypeLabel="PIB"
                currentPage={pibPage}
                onPageChange={setPibPage}
                zoom={pibZoom}
                onZoomChange={setPibZoom}
                activeFieldId={activeFieldId}
                onFieldSelect={handleSelectField}
                highlights={pibHighlights}
              />
            </div>

            {/* Center Column: Wider Comparison List */}
            <div
              className={`lg:col-span-6 xl:col-span-6 h-full flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden ${
                mobileTab === "center" ? "flex h-full" : "hidden lg:flex"
              }`}
            >
              {/* Center Column Toolbar */}
              <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-2 shrink-0">
                {/* Document Pembanding Switcher Tabs */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    <span className="text-[11px] font-semibold text-slate-500 tracking-tight mr-1">
                      Dokumen pembanding:
                    </span>
                    {availableDocTabs.map((docType) => {
                      const isSelected = selectedDocType === docType;
                      return (
                        <button
                          key={docType}
                          type="button"
                          onClick={() => setSelectedDocType(docType)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-blue-950 text-white border-blue-950 shadow-2xs"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800"
                          }`}
                        >
                          {docType}
                        </button>
                      );
                    })}
                  </div>

                  {/* Summary counts */}
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {fields.filter((f) => f.status === "MATCH").length} Cocok
                    </span>
                    <span className="px-2 py-0.5 rounded font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      {fields.filter((f) => f.status === "MISMATCH").length} Tidak Cocok
                    </span>
                  </div>
                </div>

                {/* Search Bar within Fields */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama field atau nilai (contoh: Posco, USD, Kwangyang)..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-900"
                  />
                  <svg
                    className="w-4 h-4 text-slate-400 absolute left-2.5 top-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Comparison Field Rows List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/40">
                {filteredFields.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 italic text-xs">
                    Tidak ada field perbandingan yang sesuai dengan pencarian.
                  </div>
                ) : (
                  filteredFields.map((field) => (
                    <div
                      key={field.id}
                      ref={(el) => {
                        rowRefs.current[field.id] = el;
                      }}
                    >
                      <FieldRow
                        field={field}
                        isActive={activeFieldId === field.id}
                        onSelect={handleSelectField}
                        onOpenEdit={onOpenFieldEdit}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Comparison Document Viewer */}
            <div
              className={`lg:col-span-3 xl:col-span-3 h-full ${
                mobileTab === "right" ? "block h-full" : "hidden lg:block"
              }`}
            >
              <PdfViewer
                url={pembandingUrl}
                fileName={`${selectedDocType}.pdf`}
                documentRole="Pembanding"
                documentTypeLabel={selectedDocType}
                currentPage={pembandingPage}
                onPageChange={setPembandingPage}
                zoom={pembandingZoom}
                onZoomChange={setPembandingZoom}
                activeFieldId={activeFieldId}
                onFieldSelect={handleSelectField}
                highlights={pembandingHighlights}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          {/* Export Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 mr-1 hidden sm:inline">
              Ekspor:
            </span>
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
              title="Unduh laporan Excel (.xlsx)"
            >
              <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 transition-colors cursor-pointer"
              title="Unduh laporan CSV (.csv)"
            >
              <svg className="w-3.5 h-3.5 text-sky-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>CSV (.csv)</span>
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors cursor-pointer"
              title="Unduh laporan ringkasan PDF (.pdf)"
            >
              <svg className="w-3.5 h-3.5 text-rose-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>PDF (.pdf)</span>
            </button>
          </div>

          {/* Close Primary Button */}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

