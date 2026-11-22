"use client";

import React, { useState, useMemo } from "react";
import { getVal, parseDocIsi } from "~/utils/canonicalMatcher";
import { isEquivalentMatch, type DbEquivalencyGroup } from "~/utils/valueEquivalency";

interface SopChecklistViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Array<{ fileType: string; isi?: string | null; fileName?: string; [key: string]: any }>;
  equivalencyGroups?: DbEquivalencyGroup[];
}

interface SopRowDef {
  no: number;
  label: string;
  keys: string[];
  instruction: string;
  pibPadanan?: string;
  pibKeys?: string[];
  docType: "Invoice" | "Packing List" | "BL" | "MS" | "WL" | "AK";
}

interface SopSheetDef {
  id: string;
  name: string;
  docType: "Invoice" | "Packing List" | "BL" | "MS" | "WL" | "AK";
  rows: SopRowDef[];
}

const SOP_SHEETS: SopSheetDef[] = [
  {
    id: "invoice",
    name: "Checklist Invoice",
    docType: "Invoice",
    rows: [
      { no: 1, label: "Identitas penjual / supplier", keys: ["Identitas_Penjual", "Nama_Penjual", "Seller", "Supplier"], instruction: "Pastikan nama dan alamat supplier sama dengan dokumen packing list", pibPadanan: "PIB Page 1 No.2 Identitas penjual / supplier", pibKeys: ["Identitas_Penjual", "Nama_Penjual", "Nama_Pengirim"], docType: "Invoice" },
      { no: 2, label: "Nomor invoice", keys: ["Invoice_Number", "No_Invoice", "Nomor_Invoice"], instruction: "Cocokkan nomor invoice dengan packing list", pibPadanan: "PIB Page 1 No.7 Nomor invoice", pibKeys: ["Nomor_Invoice", "Invoice_Number", "No_Invoice"], docType: "Invoice" },
      { no: 3, label: "Tanggal invoice", keys: ["Tanggal_Invoice", "Invoice_Date"], instruction: "Pastikan tanggal bulan dan tahun sama dengan packing list", pibPadanan: "PIB Page 1 No.8 Tanggal invoice", pibKeys: ["Tanggal_Invoice", "Invoice_Date"], docType: "Invoice" },
      { no: 4, label: "Identitas pembeli (Buyer)", keys: ["Identitas_Pembeli", "Nama_Importir", "Buyer"], instruction: "Cek nama badan usaha dan alamat sesuai NPWP", pibPadanan: "PIB Page 1 No.3 Pemilik Barang", pibKeys: ["Nama_Importir", "Pemilik_Barang"], docType: "Invoice" },
      { no: 5, label: "Section Code / Client Code", keys: ["Section_Code", "Client_Code"], instruction: "Cocokkan Section Code dengan packing list", docType: "Invoice" },
      { no: 6, label: "Negara asal (Country of Origin)", keys: ["Negara_Asal", "Country_of_Origin"], instruction: "Pastikan sesuai negara asal barang dan dokumen COO/Form AK", pibPadanan: "PIB Page 2-5 No.21 Negara asal", pibKeys: ["Negara_Asal", "Country_of_Origin"], docType: "Invoice" },
      { no: 7, label: "Negara tujuan (Country of Destination)", keys: ["Negara_Tujuan", "Country_of_Destination"], instruction: "Pastikan sesuai negara tujuan impor (Indonesia)", docType: "Invoice" },
      { no: 8, label: "Nomor S/C dan Order No.", keys: ["Nomor_SC", "SC_No", "Order_No"], instruction: "Cocokkan dengan sales contract, purchase order (PO), atau sistem internal", docType: "Invoice" },
      { no: 9, label: "Moda / nama kapal (Shipped Per)", keys: ["Nama_Kapal", "Vessel_Name", "Shipped_Per"], instruction: "Cocokkan nama kapal dengan Bill of Lading (B/L)", pibPadanan: "PIB Page 1 No.4 Moda / nama kapal", pibKeys: ["Nama_Sarana_Pengangkutan", "Nama_Kapal", "Cara_Pengangkutan"], docType: "Invoice" },
      { no: 10, label: "Pelabuhan asal (From)", keys: ["Pelabuhan_Asal", "Port_of_Loading"], instruction: "Pastikan sesuai B/L dan dokumen pengapalan", pibPadanan: "PIB Page 1 No.5 Pelabuhan asal (From)", pibKeys: ["Pelabuhan_Muat", "Pelabuhan_Asal"], docType: "Invoice" },
      { no: 11, label: "Pelabuhan tujuan (To)", keys: ["Pelabuhan_Tujuan", "Port_of_Discharge"], instruction: "Pastikan sesuai B/L, PIB, dan rencana kedatangan barang", pibPadanan: "PIB Page 1 No.6 Pelabuhan tujuan (To)", pibKeys: ["Pelabuhan_Tujuan", "Pelabuhan_Bongkar"], docType: "Invoice" },
      { no: 12, label: "Syarat pembayaran (Terms of Payment)", keys: ["Terms_of_Payment", "Syarat_Pembayaran"], instruction: "Pastikan sesuai kontrak/PO dan ketentuan pembayaran yang disepakati", docType: "Invoice" },
      { no: 13, label: "Marks and Numbers / penerima", keys: ["Marks_and_Numbers", "Shipping_Marks"], instruction: "Cocokkan Marks and Numbers dengan packing list dan BL", docType: "Invoice" },
      { no: 14, label: "Deskripsi barang", keys: ["Deskripsi_Barang", "Description_of_Goods"], instruction: "Pastikan deskripsi barang sesuai PO, packing list, B/L, Mill sheet dan Perijinan SPI", pibPadanan: "PIB Page 2-5 No.18 Uraian barang", pibKeys: ["Uraian_Barang", "Deskripsi_Barang"], docType: "Invoice" },
      { no: 15, label: "Spesifikasi / grade", keys: ["Spesifikasi", "Spek_Material", "Grade"], instruction: "Cocokkan Spek dengan PO, Mill sheet dan Perijinan SPI", pibPadanan: "PIB Page 2-5 No.20 Spesifikasi / grade", pibKeys: ["Spesifikasi", "Spek_Material"], docType: "Invoice" },
      { no: 16, label: "Ukuran barang", keys: ["Ukuran", "Dimensi", "Size"], instruction: "Verifikasi ukuran dengan PO, packing list & Mill sheet", pibPadanan: "PIB Page 2-5 No.19 Ukuran barang", pibKeys: ["Ukuran", "Dimensi"], docType: "Invoice" },
      { no: 17, label: "Jumlah coil", keys: ["Jumlah_Coil", "Total_Coil"], instruction: "Cocokkan jumlah coil dengan packing list dan dokumen pengiriman lainnya", pibPadanan: "PIB Page 1 No.14 Jumlah coil", pibKeys: ["Jumlah_Coil", "Total_Coil"], docType: "Invoice" },
      { no: 18, label: "Gross weight", keys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor"], instruction: "Cocokkan berat kotor dengan packing list, B/L dan Weight list", pibPadanan: "PIB Page 1 No.16 Berat Kotor", pibKeys: ["Berat_Kotor", "Gross_Weight"], docType: "Invoice" },
      { no: 19, label: "Net weight", keys: ["Net_Weight", "Total_Net_Weight", "Berat_Bersih"], instruction: "Cocokkan berat bersih dengan packing list, B/L dan Mill sheet", pibPadanan: "PIB Page 1 No.15 Berat Bersih", pibKeys: ["Berat_Bersih", "Net_Weight"], docType: "Invoice" },
      { no: 20, label: "Harga satuan", keys: ["Harga_Satuan", "Unit_Price"], instruction: "Pastikan harga dan satuan sesuai PO/kontrak", pibPadanan: "PIB Page 2-5 No.27 Harga satuan", pibKeys: ["Harga_Satuan", "Unit_Price"], docType: "Invoice" },
      { no: 21, label: "Nilai total invoice", keys: ["Nilai_Total_Invoice", "Total_Amount", "Total"], instruction: "Periksa perhitungan total amount", pibPadanan: "PIB Page 1 No.13 Nilai pabean", pibKeys: ["Nilai_Pabean", "Nilai_Total"], docType: "Invoice" },
      { no: 22, label: "Mata uang", keys: ["Mata_Uang", "Valuta", "Currency"], instruction: "Pastikan mata uang sama dengan PO/kontrak dan instruksi pembayaran", pibPadanan: "PIB Page 1 No.11 Valuta", pibKeys: ["Valuta", "Mata_Uang"], docType: "Invoice" },
      { no: 23, label: "Incoterms dan lokasi", keys: ["Terms_of_Delivery", "Incoterms", "Cara_Penyerahan"], instruction: "Pastikan Incoterms dan pelabuhan tujuan sesuai kontrak/PO", pibPadanan: "PIB Page 1 No.12 Incoterms dan lokasi", pibKeys: ["Cara_Penyerahan", "Incoterms"], docType: "Invoice" },
    ],
  },
  {
    id: "packing_list",
    name: "Checklist Packing List",
    docType: "Packing List",
    rows: [
      { no: 1, label: "Identitas supplier / shipper", keys: ["Identitas_Penjual", "Nama_Penjual", "Shipper"], instruction: "Pastikan nama dan alamat supplier sama dengan dokumen invoice", pibPadanan: "PIB Page 1 No.2 Identitas penjual", pibKeys: ["Identitas_Penjual", "Nama_Penjual"], docType: "Packing List" },
      { no: 2, label: "Nomor invoice", keys: ["Invoice_Number", "No_Invoice", "Nomor_Invoice"], instruction: "Cocokkan dengan Invoice; nomor harus sama", pibPadanan: "PIB Page 1 No.7 Nomor invoice", pibKeys: ["Nomor_Invoice", "Invoice_Number"], docType: "Packing List" },
      { no: 3, label: "Tanggal invoice", keys: ["Tanggal_Invoice", "Invoice_Date"], instruction: "Cocokkan dengan invoice dan referensi transaksi", pibPadanan: "PIB Page 1 No.8 Tanggal invoice", pibKeys: ["Tanggal_Invoice", "Invoice_Date"], docType: "Packing List" },
      { no: 4, label: "Identitas buyer", keys: ["Identitas_Pembeli", "Nama_Importir", "Buyer"], instruction: "Cek nama badan usaha dan alamat sesuai NPWP", pibPadanan: "PIB Page 1 No.3 Pemilik Barang", pibKeys: ["Nama_Importir", "Pemilik_Barang"], docType: "Packing List" },
      { no: 5, label: "Section Code / Client Code", keys: ["Section_Code", "Client_Code"], instruction: "Cocokkan Section Code dengan invoice", docType: "Packing List" },
      { no: 6, label: "Negara asal dan tujuan", keys: ["Negara_Asal", "Country_of_Origin"], instruction: "Pastikan sama dengan Invoice dan sesuai COO/dokumen asal barang", pibPadanan: "PIB Page 2-5 No.21 Negara asal", pibKeys: ["Negara_Asal"], docType: "Packing List" },
      { no: 7, label: "Nomor S/C dan Order No.", keys: ["Nomor_SC", "SC_No", "Order_No"], instruction: "Cocokkan dengan Invoice, PO, dan sistem internal", docType: "Packing List" },
      { no: 8, label: "Nama kapal & pelabuhan", keys: ["Nama_Kapal", "Vessel_Name", "Pelabuhan_Asal", "Pelabuhan_Tujuan"], instruction: "Cocokkan nama kapal dan pelabuhan dengan B/L", pibPadanan: "PIB Page 1 No.4, 5, 6", pibKeys: ["Nama_Sarana_Pengangkutan", "Pelabuhan_Muat", "Pelabuhan_Tujuan"], docType: "Packing List" },
      { no: 9, label: "Marks and Numbers", keys: ["Marks_and_Numbers", "Shipping_Marks"], instruction: "Cocokkan Marks and Numbers dengan Invoice dan BL", docType: "Packing List" },
      { no: 10, label: "Deskripsi barang", keys: ["Deskripsi_Barang", "Description_of_Goods"], instruction: "Pastikan deskripsi barang sesuai PO, invoice, B/L, Mill sheet", pibPadanan: "PIB Page 2-5 No.18 Uraian barang", pibKeys: ["Uraian_Barang", "Deskripsi_Barang"], docType: "Packing List" },
      { no: 11, label: "Jumlah kemasan / coil", keys: ["Jumlah_Coil", "Total_Coil"], instruction: "Cocokkan jumlah coil dengan invoice dan dokumen pengiriman lainnya", pibPadanan: "PIB Page 1 No.14 Jumlah coil", pibKeys: ["Jumlah_Coil"], docType: "Packing List" },
      { no: 12, label: "Gross weight", keys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor"], instruction: "Cocokkan berat kotor dengan invoice, B/L dan Weight list", pibPadanan: "PIB Page 1 No.16 Berat Kotor", pibKeys: ["Berat_Kotor"], docType: "Packing List" },
      { no: 13, label: "Net weight", keys: ["Net_Weight", "Total_Net_Weight", "Berat_Bersih"], instruction: "Cocokkan berat kotor dengan invoice, B/L dan Mill sheet", pibPadanan: "PIB Page 1 No.15 Berat Bersih", pibKeys: ["Berat_Bersih"], docType: "Packing List" },
    ],
  },
  {
    id: "bl",
    name: "Checklist Bill of Lading",
    docType: "BL",
    rows: [
      { no: 1, label: "Nomor BL", keys: ["Nomor_BL", "BL_Number", "B/L No"], instruction: "Pastikan nomor BL terbaca jelas dan sesuai dengan dokumen pengiriman", pibPadanan: "PIB Page 1 No.9 Nomor B/L", pibKeys: ["Nomor_BL", "BL_Number", "House_BL_No"], docType: "BL" },
      { no: 2, label: "Shipper", keys: ["Identitas_Penjual", "Shipper", "Supplier"], instruction: "Cocokkan dengan data supplier dan Invoice", pibPadanan: "PIB Page 1 No.1 Identitas PENGIRIM", pibKeys: ["Identitas_Pengirim", "Nama_Pengirim", "Identitas_Penjual"], docType: "BL" },
      { no: 3, label: "Consignee", keys: ["Identitas_Pembeli", "Consignee", "Buyer"], instruction: "Pastikan sesuai dengan pihak penerima yang tercantum pada dokumen impor", pibPadanan: "PIB Page 1 No.3 Pemilik Barang", pibKeys: ["Nama_Importir", "Pemilik_Barang"], docType: "BL" },
      { no: 4, label: "Vessel Name", keys: ["Nama_Kapal", "Vessel_Name", "Vessel"], instruction: "Cocokkan dengan informasi pengiriman dan dokumen terkait", pibPadanan: "PIB Page 1 No.4 Moda / nama kapal", pibKeys: ["Nama_Sarana_Pengangkutan", "Nama_Kapal"], docType: "BL" },
      { no: 5, label: "Port of Loading", keys: ["Pelabuhan_Asal", "Port_of_Loading", "POL"], instruction: "Pastikan sesuai dengan rute pengiriman yang disepakati", pibPadanan: "PIB Page 1 No.5 Pelabuhan asal", pibKeys: ["Pelabuhan_Muat", "Pelabuhan_Asal"], docType: "BL" },
      { no: 6, label: "Port of Discharge", keys: ["Pelabuhan_Tujuan", "Port_of_Discharge", "POD"], instruction: "Pastikan sesuai dengan tujuan pengiriman", pibPadanan: "PIB Page 1 No.6 Pelabuhan tujuan", pibKeys: ["Pelabuhan_Tujuan", "Pelabuhan_Bongkar"], docType: "BL" },
      { no: 7, label: "Tanggal BL", keys: ["Tanggal_BL", "Date_of_Issue", "BL_Date"], instruction: "Periksa tanggal penerbitan dan tanggal on-board", pibPadanan: "PIB Page 1 No.10 Tanggal B/L", pibKeys: ["Tanggal_BL", "House_BL_Date"], docType: "BL" },
      { no: 8, label: "Deskripsi Barang", keys: ["Deskripsi_Barang", "Description_of_Goods"], instruction: "Cocokkan deskripsi barang dengan Commercial Invoice dan Packing List", pibPadanan: "PIB Page 2-5 No.18 Uraian barang", pibKeys: ["Uraian_Barang"], docType: "BL" },
      { no: 9, label: "Jumlah Package", keys: ["Jumlah_Package", "Number_of_Packages", "Jumlah_Coil"], instruction: "Pastikan jumlah kemasan sesuai dengan Packing List", pibPadanan: "PIB Page 1 No.14 Jumlah coil", pibKeys: ["Jumlah_Coil"], docType: "BL" },
      { no: 10, label: "Gross Weight", keys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor"], instruction: "Cocokkan dengan Packing List dan Weight List", pibPadanan: "PIB Page 1 No.16 Berat Kotor", pibKeys: ["Berat_Kotor"], docType: "BL" },
    ],
  },
  {
    id: "ms",
    name: "Checklist Mill Sheet (MTC)",
    docType: "MS",
    rows: [
      { no: 1, label: "Nama Produsen / Mill", keys: ["Nama_Produsen", "Producer_Name", "Manufacturer"], instruction: "Cocokkan dengan informasi supplier dan dokumen material lainnya", docType: "MS" },
      { no: 2, label: "Nomor Sertifikat", keys: ["Nomor_Sertifikat", "Certificate_Number"], instruction: "Pastikan nomor sertifikat jelas dan dapat ditelusuri", docType: "MS" },
      { no: 3, label: "Deskripsi Barang", keys: ["Deskripsi_Barang", "Material_Description", "Product_Name"], instruction: "Pastikan sesuai dengan deskripsi barang pada Invoice dan Packing List", pibPadanan: "PIB Page 2-5 No.18 Uraian barang", pibKeys: ["Uraian_Barang"], docType: "MS" },
      { no: 4, label: "Spek Material", keys: ["Spek_Material", "Grade", "Specification"], instruction: "Cocokkan dengan spesifikasi pada PO dan Packing List", pibPadanan: "PIB Page 2-5 No.20 Spesifikasi / grade", pibKeys: ["Spesifikasi", "Spek_Material"], docType: "MS" },
      { no: 5, label: "Ukuran / Dimensi", keys: ["Ukuran", "Dimensi", "Size", "Thickness"], instruction: "Pastikan sesuai dengan spesifikasi barang yang dipesan", pibPadanan: "PIB Page 2-5 No.19 Ukuran barang", pibKeys: ["Ukuran", "Dimensi"], docType: "MS" },
      { no: 6, label: "Jumlah / Berat Material", keys: ["Jumlah_Berat_Material", "Weight", "Net_Weight"], instruction: "Cocokkan dengan Packing List dan Weight List", pibPadanan: "PIB Page 1 No.15 Berat Bersih", pibKeys: ["Berat_Bersih"], docType: "MS" },
      { no: 7, label: "Tanggal Sertifikat", keys: ["Tanggal_Sertifikat", "Certificate_Date"], instruction: "Pastikan tanggal terbaca dan berkaitan dengan material yang dikirim", docType: "MS" },
    ],
  },
  {
    id: "wl",
    name: "Checklist Weight List (WL)",
    docType: "WL",
    rows: [
      { no: 1, label: "Nama Supplier / Shipper", keys: ["Nama_Supplier", "Supplier", "Shipper"], instruction: "Cocokkan dengan Invoice dan Packing List", pibPadanan: "PIB Page 1 No.2 Identitas penjual", pibKeys: ["Identitas_Penjual", "Nama_Penjual"], docType: "WL" },
      { no: 2, label: "Nomor Referensi", keys: ["Nomor_Referensi", "Reference_Number"], instruction: "Pastikan sesuai dengan PO, Invoice, dan dokumen pengiriman lainnya", docType: "WL" },
      { no: 3, label: "Deskripsi Barang", keys: ["Deskripsi_Barang", "Description_of_Goods"], instruction: "Cocokkan dengan deskripsi barang pada Invoice dan Packing List", pibPadanan: "PIB Page 2-5 No.18 Uraian barang", pibKeys: ["Uraian_Barang"], docType: "WL" },
      { no: 4, label: "Jumlah Coil", keys: ["Jumlah_Coil", "Total_Coil"], instruction: "Pastikan jumlah setiap item dan total sesuai dengan Packing List", pibPadanan: "PIB Page 1 No.14 Jumlah coil", pibKeys: ["Jumlah_Coil"], docType: "WL" },
      { no: 5, label: "Net Weight", keys: ["Net_Weight", "Total_Net_Weight", "Berat_Bersih"], instruction: "Cocokkan dengan Packing List dan dokumen pengiriman lainnya", pibPadanan: "PIB Page 1 No.15 Berat Bersih", pibKeys: ["Berat_Bersih"], docType: "WL" },
      { no: 6, label: "Gross Weight", keys: ["Gross_Weight", "Total_Gross_Weight", "Berat_Kotor"], instruction: "Pastikan sesuai dengan Packing List dan Bill of Lading (B/L)", pibPadanan: "PIB Page 1 No.16 Berat Kotor", pibKeys: ["Berat_Kotor"], docType: "WL" },
    ],
  },
  {
    id: "ak",
    name: "Checklist Form AK (COO)",
    docType: "AK",
    rows: [
      { no: 1, label: "Nomor Referensi", keys: ["Nomor_Referensi", "Reference_No"], instruction: "Pastikan nomor referensi sama dengan Form AK utama dan halaman lainnya", pibPadanan: "PIB Page 6 No.32 ECO (nomor)", pibKeys: ["No_Referensi", "Nomor_Referensi", "No_Pendaftaran"], docType: "AK" },
      { no: 2, label: "Nama Exporter / Shipper", keys: ["Nama_Exporter_Shipper", "Exporter", "Shipper"], instruction: "Cocokkan nama dan alamat shipper dengan dokumen pendukung", pibPadanan: "PIB Page 1 No.1 Identitas PENGIRIM", pibKeys: ["Identitas_Pengirim", "Nama_Pengirim", "Identitas_Penjual"], docType: "AK" },
      { no: 3, label: "Nama Consignee", keys: ["Nama_Consignee", "Consignee"], instruction: "Pastikan nama dan alamat Consignee sesuai dengan invoice", pibPadanan: "PIB Page 1 No.3 Pemilik Barang", pibKeys: ["Nama_Importir", "Pemilik_Barang"], docType: "AK" },
      { no: 4, label: "Nama Vessel", keys: ["Nama_Vessel", "Vessel_Name"], instruction: "Pastikan nama kapal sesuai dengan Bill of Lading (BL)", pibPadanan: "PIB Page 1 No.4 Moda / nama kapal", pibKeys: ["Nama_Sarana_Pengangkutan", "Nama_Kapal"], docType: "AK" },
      { no: 5, label: "Pelabuhan Bongkar", keys: ["Pelabuhan_Bongkar", "Port_of_Discharge"], instruction: "Cocokkan nama pelabuhan bongkar dengan Bill of Lading (BL)", pibPadanan: "PIB Page 1 No.6 Pelabuhan tujuan", pibKeys: ["Pelabuhan_Tujuan", "Pelabuhan_Bongkar"], docType: "AK" },
      { no: 6, label: "Nomor dan Tanggal Invoice", keys: ["Nomor_Invoice", "Number_and_Date_of_Invoices"], instruction: "Cocokkan dengan Commercial Invoice", pibPadanan: "PIB Page 1 No.7 Nomor invoice; No.8 Tanggal", pibKeys: ["Nomor_Invoice", "Tanggal_Invoice"], docType: "AK" },
      { no: 7, label: "Jumlah dan Jenis Kemasan", keys: ["Jumlah_Package", "Number_and_Type_of_Packages"], instruction: "Cocokkan jumlah dan jenis kemasan dengan Packing List", pibPadanan: "PIB Page 1 No.14 Jumlah coil", pibKeys: ["Jumlah_Coil"], docType: "AK" },
      { no: 8, label: "Deskripsi Barang", keys: ["Deskripsi_Barang", "Description_of_Goods"], instruction: "Cocokkan jenis barang dan spek nya dengan Invoice dan Packing List", pibPadanan: "PIB Page 2-5 No.18 Uraian barang", pibKeys: ["Uraian_Barang"], docType: "AK" },
      { no: 9, label: "Pos Tarif / HS Code", keys: ["Pos_Tarif", "HS_Code", "HS_Number"], instruction: "Periksa kode HS yang dicantumkan pada item terkait", pibPadanan: "PIB Page 2-5 No.17 Pos Tarif", pibKeys: ["Pos_Tarif", "HS_Code"], docType: "AK" },
      { no: 10, label: "Berat / Kuantitas", keys: ["Gross_Weight", "Quantity", "Berat_Kuantitas"], instruction: "Cocokkan berat atau kuantitas dengan Packing List dan Weight List", pibPadanan: "PIB Page 1 No.16 Berat Kotor", pibKeys: ["Berat_Kotor"], docType: "AK" },
    ],
  },
];

export default function SopChecklistView({ details, equivalencyGroups = [] }: SopChecklistViewProps) {
  const [activeSheetId, setActiveSheetId] = useState<string>("invoice");

  // Parse all documents in batch
  const parsedDocs = useMemo(() => {
    const map: Record<string, { fileName: string; fields: Record<string, any> }> = {};
    for (const d of details) {
      const ft = (d.fileType || "").trim().toLowerCase();
      let key = ft;
      if (ft === "pib" || ft.includes("file acuan")) key = "pib";
      else if (ft.includes("invoice")) key = "Invoice";
      else if (ft.includes("packing") || ft === "pl") key = "Packing List";
      else if (ft.includes("bl") || ft.includes("lading")) key = "BL";
      else if (ft.includes("mill") || ft === "ms") key = "MS";
      else if (ft.includes("weight") || ft === "wl") key = "WL";
      else if (ft.includes("ak") || ft.includes("coo")) key = "AK";

      const p = parseDocIsi(d.isi);
      map[key] = {
        fileName: d.fileName || d.fileType,
        fields: p.fields,
      };
    }
    return map;
  }, [details]);

  const pibDoc = parsedDocs["pib"];
  const currentSheet = SOP_SHEETS.find((s) => s.id === activeSheetId) || SOP_SHEETS[0];
  const activeDoc = parsedDocs[currentSheet.docType];

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Header Sheet Nav */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-sm text-blue-950 flex items-center gap-2">
              <span>Checklist SOP klien (8 sheet matriks pemeriksaan)</span>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                Docmatch USC field.xlsx
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pilih sheet dokumen untuk memverifikasi seluruh butir pemeriksaan standar klien.
            </p>
          </div>

          <div className="text-right text-[11px]">
            <span className="text-slate-500">Status dokumen: </span>
            {activeDoc ? (
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Terunggah ({activeDoc.fileName})
              </span>
            ) : (
              <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Belum diunggah
              </span>
            )}
          </div>
        </div>

        {/* Sheet Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SOP_SHEETS.map((sheet) => {
            const hasDoc = !!parsedDocs[sheet.docType];
            const isActive = activeSheetId === sheet.id;
            return (
              <button
                key={sheet.id}
                onClick={() => setActiveSheetId(sheet.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border flex items-center gap-2 ${
                  isActive
                    ? "bg-blue-950 text-white border-blue-950 shadow-2xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>{sheet.name}</span>
                <span className={`w-2 h-2 rounded-full ${hasDoc ? "bg-emerald-500" : "bg-slate-300"}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Checklist Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-blue-950 text-[11px] font-bold border-b border-slate-200">
                <th className="py-3 px-3 w-12 text-center">No.</th>
                <th className="py-3 px-4 w-52">Bagian yang dicek</th>
                <th className="py-3 px-4">Nilai pada dokumen batch</th>
                <th className="py-3 px-4">Apa yang harus dicek? (SOP klien)</th>
                <th className="py-3 px-4 w-36 text-center">Status</th>
                <th className="py-3 px-4 w-56">Padanan di draft PIB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {currentSheet.rows.map((row) => {
                const docVal = activeDoc ? getVal(activeDoc.fields, ...row.keys) : "-";
                const pibVal = pibDoc && row.pibKeys ? getVal(pibDoc.fields, ...row.pibKeys) : "-";

                let statusText = "INFO";
                let statusBadge = "bg-slate-100 text-slate-600 border-slate-200";

                if (docVal && docVal !== "-" && pibVal && pibVal !== "-") {
                  const eq = isEquivalentMatch(pibVal, docVal, row.label, equivalencyGroups);
                  if (eq.isMatch) {
                    statusText = "MATCH";
                    statusBadge = "bg-emerald-100 text-emerald-800 border-emerald-200";
                  } else {
                    statusText = "MISMATCH";
                    statusBadge = "bg-rose-100 text-rose-800 border-rose-200";
                  }
                } else if (docVal && docVal !== "-") {
                  statusText = "TERSEDIA";
                  statusBadge = "bg-blue-50 text-blue-800 border-blue-200";
                }

                return (
                  <tr key={row.no} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 text-center font-bold text-slate-500">
                      {row.no}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {row.label}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700 max-w-xs break-words">
                      {docVal !== "-" ? (
                        <span className="font-semibold text-slate-900">{docVal}</span>
                      ) : (
                        <span className="text-slate-400 italic">Tidak ditemukan</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px] leading-relaxed">
                      {row.instruction}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadge}`}>
                        {statusText}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-600">
                      {row.pibPadanan ? (
                        <div className="space-y-0.5">
                          <span className="font-medium text-slate-700 block">{row.pibPadanan}</span>
                          {pibVal !== "-" && (
                            <span className="font-mono text-[10px] text-blue-950 font-semibold block truncate max-w-[200px]" title={pibVal}>
                              Nilai: {pibVal}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">Khusus cross-check dokumen</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

