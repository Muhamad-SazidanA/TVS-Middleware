export type UscDocumentType =
  | "pib"
  | "ci"
  | "pl"
  | "bl"
  | "ak"
  | "wl"
  | "ms";

export interface DocumentFieldItem {
  name: string;
  label: string;
  type: "header" | "table";
  description?: string;
}

export interface UscDocumentDefinition {
  type: UscDocumentType;
  title: string;
  shortName: string;
  category: string;
  modelEnvKey: string;
  fallbackModelId: string;
  expectedFields: string[];
  itemFields: string[];
  fields: DocumentFieldItem[];
}

export const DOCUMENT_FIELD_REGISTRY: Record<UscDocumentType, UscDocumentDefinition> = {
  pib: {
    type: "pib",
    title: "PIB (Pemberitahuan Impor Barang)",
    shortName: "PIB",
    category: "PIB",
    modelEnvKey: "MODEL_PIB",
    fallbackModelId: "233e650f-2b0e-4c56-8d98-35f40e032a60",
    expectedFields: [
      "Nomor_Pengajuan",
      "No_Invoice",
      "Tanggal_Invoice",
      "No_BL",
      "Tanggal_BL",
      "Nama_Importir",
      "Pemilik_Barang",
      "Identitas_Penjual",
      "Nama_Penjual",
      "Nama_Pengirim",
      "Identitas_Pengirim",
      "Nilai_Pabean",
      "Valuta",
      "NDPBM",
      "Berat_Bersih",
      "Berat_Kotor",
      "Jumlah_Coil",
      "No_Peti",
      "Pelabuhan_Muat",
      "Pelabuhan_Tujuan",
      "Cara_Penyerahan",
      "Terms_of_Delivery",
      "Incoterms",
      "Moda",
      "Electronic_Certificate_Of_Origin_ECO",
      "Surat_Keputusan",
      "Pengecualian_Perijinan",
    ],
    itemFields: [
      "Pos_Tarif",
      "Kode_Barang",
      "Uraian_Barang",
      "Ukuran_Barang",
      "Spesifikasi_Grade",
      "Negara_Asal_Country_Of_Origin",
      "Tarif",
      "PPN",
      "PPH",
      "Jumlah_Barang",
      "Jenis_Satuan_Barang",
      "Harga_Satuan",
    ],
    fields: [
      // Headers
      { name: "Nomor_Pengajuan", label: "Nomor Pengajuan", type: "header", description: "Nomor Aju PIB 26 digit" },
      { name: "No_Invoice", label: "Nomor Invoice", type: "header", description: "Nomor Commercial Invoice pada PIB" },
      { name: "Tanggal_Invoice", label: "Tanggal Invoice", type: "header", description: "Tanggal Invoice pada PIB" },
      { name: "No_BL", label: "Nomor B/L", type: "header", description: "Nomor B/L atau Sea Waybill pada PIB" },
      { name: "Tanggal_BL", label: "Tanggal B/L", type: "header", description: "Tanggal penerbitan B/L pada PIB" },
      { name: "Nama_Importir", label: "Nama Importir", type: "header", description: "PT. UNITED STEEL CENTER INDONESIA (Alias: Pemilik_Barang)" },
      { name: "Pemilik_Barang", label: "Pemilik Barang", type: "header", description: "Identitas Importir / Pemilik Barang pada PIB" },
      { name: "Identitas_Penjual", label: "Identitas Penjual", type: "header", description: "Supplier / Shipper pihak penjual" },
      { name: "Nama_Penjual", label: "Nama Penjual", type: "header", description: "Pihak penjual pada PIB" },
      { name: "Nama_Pengirim", label: "Nama Pengirim", type: "header", description: "Shipper pihak pengekspor" },
      { name: "Identitas_Pengirim", label: "Identitas Pengirim", type: "header", description: "Identitas Pengirim / Shipper pada PIB" },
      { name: "Nilai_Pabean", label: "Nilai Pabean", type: "header", description: "Nilai CIF Pabean dalam valuta" },
      { name: "Valuta", label: "Valuta / Mata Uang", type: "header", description: "Mata uang invoice (e.g. USD)" },
      { name: "NDPBM", label: "NDPBM", type: "header", description: "Nilai Dasar Penghitungan Bea Masuk" },
      { name: "Berat_Bersih", label: "Berat Bersih (Net)", type: "header", description: "Berat bersih total dalam KG" },
      { name: "Berat_Kotor", label: "Berat Kotor (Gross)", type: "header", description: "Berat kotor total dalam KG" },
      { name: "Jumlah_Coil", label: "Jumlah Coil / Package", type: "header", description: "Total satuan kemasan / coil" },
      { name: "No_Peti", label: "Nomor Peti Kemas (Container)", type: "header", description: "Nomor container 11 karakter" },
      { name: "Pelabuhan_Muat", label: "Pelabuhan Muat", type: "header", description: "Port of Loading (POL)" },
      { name: "Pelabuhan_Tujuan", label: "Pelabuhan Tujuan", type: "header", description: "Port of Discharge (POD)" },
      { name: "Cara_Penyerahan", label: "Cara Penyerahan (Incoterms)", type: "header", description: "Syarat penyerahan (CIF, FOB)" },
      { name: "Terms_of_Delivery", label: "Terms of Delivery (Cara Penyerahan)", type: "header", description: "Syarat penyerahan (CIF, FOB)" },
      { name: "Incoterms", label: "Incoterms", type: "header", description: "Syarat penyerahan Incoterms" },
      { name: "Moda", label: "Moda / Sarana Pengangkut", type: "header", description: "Nama kapal & nomor pelayaran" },
      { name: "Electronic_Certificate_Of_Origin_ECO", label: "ECO Form AK", type: "header", description: "Referensi nomor SKA / Form AK" },
      { name: "Surat_Keputusan", label: "Surat Keputusan Fasilitas", type: "header", description: "Keputusan fasilitas impor" },
      { name: "Pengecualian_Perijinan", label: "Pengecualian Perijinan", type: "header", description: "Ketentuan pengecualian lartas" },
      // Table Line Items
      { name: "Pos_Tarif", label: "Pos Tarif (HS Code)", type: "table", description: "Klasifikasi HS Code 8 digit" },
      { name: "Kode_Barang", label: "Kode Barang / Part No", type: "table", description: "Identitas part atau produk steel" },
      { name: "Uraian_Barang", label: "Uraian Barang", type: "table", description: "Deskripsi material barang" },
      { name: "Ukuran_Barang", label: "Ukuran Barang (Dimensi)", type: "table", description: "Ketebalan x Lebar x Panjang/Coil" },
      { name: "Spesifikasi_Grade", label: "Spesifikasi Grade", type: "table", description: "Standar mutu baja (SPHC, dll)" },
      { name: "Negara_Asal_Country_Of_Origin", label: "Negara Asal (COO)", type: "table", description: "Negara manufaktur baja" },
      { name: "Tarif", label: "Tarif Bea Masuk", type: "table", description: "Persentase tarif BM (e.g. 0% AK)" },
      { name: "PPN", label: "Tarif PPN", type: "table", description: "Persentase PPN impor" },
      { name: "PPH", label: "Tarif PPH", type: "table", description: "Persentase PPH Pasal 22" },
      { name: "Jumlah_Barang", label: "Jumlah Satuan Barang", type: "table", description: "Kuantitas unit barang / coil" },
      { name: "Jenis_Satuan_Barang", label: "Jenis Satuan Barang", type: "table", description: "KGM / TNE / Unit" },
      { name: "Harga_Satuan", label: "Harga Satuan", type: "table", description: "Unit price CIF per satuan" },
    ],
  },

  ci: {
    type: "ci",
    title: "Commercial Invoice (CI)",
    shortName: "CI",
    category: "Invoice",
    modelEnvKey: "MODEL_INVOICE",
    fallbackModelId: "dab11666-7657-46e7-8efb-3fed630ee96e",
    expectedFields: [
      "No_Invoice",
      "Tanggal_Invoice",
      "Identitas_Penjual",
      "Identitas_Pembeli",
      "Nilai_Total_Invoice",
      "Mata_Uang",
      "Incoterms_Lokasi",
      "Terms_of_Delivery",
      "Cara_Penyerahan",
      "Incoterms",
      "Net_Weight",
      "Gross_Weight",
      "Jumlah_Coil",
      "Pelabuhan_Asal",
      "Pelabuhan_Tujuan",
      "Negara_Asal",
      "Negara_Tujuan",
      "Moda",
      "Syarat_Pembayaran",
      "Section_Code",
      "Marks_Number",
      "No_SC_Order_No",
    ],
    itemFields: [
      "Spesifikasi",
      "Ukuran_Barang",
      "Harga_Satuan",
      "Total_Harga",
    ],
    fields: [
      // Headers
      { name: "No_Invoice", label: "Nomor Invoice", type: "header", description: "Nomor Commercial Invoice" },
      { name: "Tanggal_Invoice", label: "Tanggal Invoice", type: "header", description: "Tanggal penerbitan invoice" },
      { name: "Identitas_Penjual", label: "Identitas Penjual", type: "header", description: "Shipper / Exporter / Seller" },
      { name: "Identitas_Pembeli", label: "Identitas Pembeli", type: "header", description: "Buyer / Consignee" },
      { name: "Nilai_Total_Invoice", label: "Nilai Total Invoice", type: "header", description: "Total nilai tagihan faktur" },
      { name: "Mata_Uang", label: "Mata Uang", type: "header", description: "USD, JPY, EUR, dll" },
      { name: "Incoterms_Lokasi", label: "Incoterms & Lokasi", type: "header", description: "CIF Tanjung Priok, FOB Busan" },
      { name: "Terms_of_Delivery", label: "Terms of Delivery (Incoterms)", type: "header", description: "Syarat penyerahan (CIF, FOB)" },
      { name: "Cara_Penyerahan", label: "Cara Penyerahan", type: "header", description: "Syarat penyerahan Incoterms" },
      { name: "Incoterms", label: "Incoterms", type: "header", description: "Incoterms" },
      { name: "Net_Weight", label: "Net Weight", type: "header", description: "Total berat bersih invoice" },
      { name: "Gross_Weight", label: "Gross Weight", type: "header", description: "Total berat kotor invoice" },
      { name: "Jumlah_Coil", label: "Jumlah Coil / Package", type: "header", description: "Total unit muatan" },
      { name: "Pelabuhan_Asal", label: "Pelabuhan Asal", type: "header", description: "Port of Loading" },
      { name: "Pelabuhan_Tujuan", label: "Pelabuhan Tujuan", type: "header", description: "Port of Discharge" },
      { name: "Negara_Asal", label: "Negara Asal", type: "header", description: "Country of Origin" },
      { name: "Negara_Tujuan", label: "Negara Tujuan", type: "header", description: "Country of Destination" },
      { name: "Moda", label: "Moda Transportasi", type: "header", description: "Vessel name & voyage" },
      { name: "Syarat_Pembayaran", label: "Syarat Pembayaran", type: "header", description: "L/C, T/T, dll" },
      { name: "Section_Code", label: "Section Code", type: "header", description: "Kode divisi / kontrak" },
      { name: "Marks_Number", label: "Shipping Marks", type: "header", description: "Tanda pengenal muatan / peti" },
      { name: "No_SC_Order_No", label: "Sales Contract / Order No", type: "header", description: "Nomor Sales Contract" },
      // Table Line Items
      { name: "Spesifikasi", label: "Spesifikasi Material", type: "table", description: "Grade baja (SPHC, SPCC)" },
      { name: "Ukuran_Barang", label: "Ukuran / Size", type: "table", description: "Dimensi ketebalan & lebar" },
      { name: "Harga_Satuan", label: "Harga Satuan (Unit Price)", type: "table", description: "Harga per metric ton atau kg" },
      { name: "Total_Harga", label: "Total Harga Item", type: "table", description: "Subtotal nilai item baris" },
    ],
  },

  pl: {
    type: "pl",
    title: "Packing List (PL)",
    shortName: "PL",
    category: "Packing List",
    modelEnvKey: "MODEL_PACKING_LIST",
    fallbackModelId: "133a8cb8-762f-4002-9878-bbb333706775",
    expectedFields: [
      "No_Invoice",
      "Tanggal_Invoice",
      "Identitas_Supplier",
      "Identitas_Buyer",
      "Net_Weight",
      "Gross_Weight",
      "Total_Jumlah_Berat",
      "Jumlah_Coil",
      "Pelabuhan_Asal",
      "Pelabuhan_Tujuan",
      "Negara_Asal",
      "Negara_Tujuan",
      "Moda",
      "Marks_Number",
      "No_SC_Order_No",
      "Section_Code",
      "Deskripsi_Barang",
    ],
    itemFields: [
      "Spesifikasi",
      "Ukuran_Barang",
      "Weight",
      "Qty",
    ],
    fields: [
      // Headers
      { name: "No_Invoice", label: "Nomor Invoice Ref", type: "header", description: "Nomor invoice terkait" },
      { name: "Tanggal_Invoice", label: "Tanggal Invoice", type: "header", description: "Tanggal referensi invoice" },
      { name: "Identitas_Supplier", label: "Identitas Supplier", type: "header", description: "Pihak pengirim / supplier" },
      { name: "Identitas_Buyer", label: "Identitas Buyer", type: "header", description: "Pihak penerima / pembeli" },
      { name: "Net_Weight", label: "Total Net Weight", type: "header", description: "Total berat bersih barang" },
      { name: "Gross_Weight", label: "Total Gross Weight", type: "header", description: "Total berat kotor barang" },
      { name: "Total_Jumlah_Berat", label: "Total Jumlah Berat", type: "header", description: "Akumulasi berat agregat" },
      { name: "Jumlah_Coil", label: "Jumlah Coil / Package", type: "header", description: "Total kemasan fisik" },
      { name: "Pelabuhan_Asal", label: "Pelabuhan Asal", type: "header", description: "Port of Loading" },
      { name: "Pelabuhan_Tujuan", label: "Pelabuhan Tujuan", type: "header", description: "Port of Discharge" },
      { name: "Negara_Asal", label: "Negara Asal", type: "header", description: "Country of Origin" },
      { name: "Negara_Tujuan", label: "Negara Tujuan", type: "header", description: "Country of Destination" },
      { name: "Moda", label: "Moda Transportasi", type: "header", description: "Vessel name" },
      { name: "Marks_Number", label: "Shipping Marks & Number", type: "header", description: "Tanda kemasan" },
      { name: "No_SC_Order_No", label: "Sales Contract No", type: "header", description: "Nomor Sales Contract" },
      { name: "Section_Code", label: "Section Code", type: "header", description: "Kode bagian / order" },
      { name: "Deskripsi_Barang", label: "Deskripsi Barang", type: "header", description: "Uraian umum cargo" },
      // Table Line Items
      { name: "Spesifikasi", label: "Spesifikasi Material", type: "table", description: "Grade baja per item" },
      { name: "Ukuran_Barang", label: "Ukuran Barang / Size", type: "table", description: "Dimensi fisik coil" },
      { name: "Weight", label: "Berat Bersih Item (Weight)", type: "table", description: "Net weight per baris/kelompok" },
      { name: "Qty", label: "Kuantitas (Qty)", type: "table", description: "Jumlah coil per baris" },
    ],
  },

  bl: {
    type: "bl",
    title: "Bill of Lading (BL)",
    shortName: "BL",
    category: "Bill of Lading",
    modelEnvKey: "MODEL_BL",
    fallbackModelId: "53b28ee1-0693-4d6a-8e16-844e405874c9",
    expectedFields: [
      "No_BL",
      "Tanggal_BL",
      "Shipper",
      "Consignee",
      "Notify_Party",
      "Vessel_Name",
      "Voyage_Number",
      "Port_Of_Loading",
      "Port_Of_Discharge",
      "Gross_Weight",
      "Jumlah_Package",
      "Total_Package",
      "Freight_Term",
      "Shipping_Marks",
      "Deskripsi_Barang",
    ],
    itemFields: [
      "Marks",
      "Gross_Weight",
      "Qty",
      "Desc",
    ],
    fields: [
      // Headers
      { name: "No_BL", label: "Nomor B/L (Sea Waybill)", type: "header", description: "Nomor Bill of Lading" },
      { name: "Tanggal_BL", label: "Tanggal B/L", type: "header", description: "Tanggal penerbitan B/L (On Board Date)" },
      { name: "Shipper", label: "Shipper (Pengirim)", type: "header", description: "Pihak pengirim muatan (Shipper)" },
      { name: "Consignee", label: "Consignee", type: "header", description: "Pihak penerima muatan" },
      { name: "Notify_Party", label: "Notify Party", type: "header", description: "Pihak yang diberitahu" },
      { name: "Vessel_Name", label: "Nama Kapal (Vessel)", type: "header", description: "Kapal pengangkut utama" },
      { name: "Voyage_Number", label: "Nomor Voyage", type: "header", description: "Nomor pelayaran / trip" },
      { name: "Port_Of_Loading", label: "Pelabuhan Muat (POL)", type: "header", description: "Port of Loading" },
      { name: "Port_Of_Discharge", label: "Pelabuhan Bongkar (POD)", type: "header", description: "Port of Discharge" },
      { name: "Gross_Weight", label: "Total Gross Weight", type: "header", description: "Total berat kotor muatan B/L" },
      { name: "Jumlah_Package", label: "Jumlah Package / Coil", type: "header", description: "Jumlah unit koli muatan" },
      { name: "Total_Package", label: "Total Package (Satuan Kemasan)", type: "header", description: "Total satuan kemasan cargo" },
      { name: "Freight_Term", label: "Freight Term", type: "header", description: "Freight Prepaid / Collect" },
      { name: "Shipping_Marks", label: "Shipping Marks", type: "header", description: "Tanda muatan peti kemas" },
      { name: "Deskripsi_Barang", label: "Deskripsi Muatan", type: "header", description: "Description of Goods" },
      // Table Line Items
      { name: "Marks", label: "Container / Marks", type: "table", description: "Nomor Container / Peti Kemas" },
      { name: "Gross_Weight", label: "Gross Weight Item", type: "table", description: "Berat kotor per koli/container" },
      { name: "Qty", label: "Kuantitas / Package", type: "table", description: "Jumlah kemasan per baris" },
      { name: "Desc", label: "Deskripsi Barang Item", type: "table", description: "Uraian per koli/item" },
    ],
  },

  ak: {
    type: "ak",
    title: "Form AK (Certificate of Origin)",
    shortName: "Form AK",
    category: "AK",
    modelEnvKey: "MODEL_AK",
    fallbackModelId: "12a16d1c-9b37-4a19-809f-84e594f541ea",
    expectedFields: [
      "No_Referensi",
      "Tanggal_Keberangkatan",
      "Nama_Exporter_Shipper",
      "Nama_Consignee",
      "Nama_Pelabuhan_Bongkar",
      "Nama_Vessel",
      "Nama_Manufacturer",
      "No_Dan_Tanggal_Invoice",
      "Third_Country_Invoicing",
      "Tempat_Dan_Waktu_Pembuatan_AKForm",
      "Issued_Retroactively",
    ],
    itemFields: [
      "No_Item",
      "HS_Code",
      "Deskripsi_Barang",
      "Kriteria_Asal_Barang",
      "Berat_Kuantitas",
      "No_Part",
    ],
    fields: [
      // Headers
      { name: "No_Referensi", label: "Nomor Referensi Form AK", type: "header", description: "Nomor sertifikat SKA Form AK" },
      { name: "Tanggal_Keberangkatan", label: "Tanggal Keberangkatan", type: "header", description: "Departure date kapal" },
      { name: "Nama_Exporter_Shipper", label: "Nama Exporter / Shipper", type: "header", description: "Eksportir berbadan hukum" },
      { name: "Nama_Consignee", label: "Nama Consignee", type: "header", description: "Importir / Penerima Indonesia" },
      { name: "Nama_Pelabuhan_Bongkar", label: "Pelabuhan Bongkar", type: "header", description: "Port of discharge" },
      { name: "Nama_Vessel", label: "Nama Kapal / Sarana Angkut", type: "header", description: "Vessel name & voyage" },
      { name: "Nama_Manufacturer", label: "Nama Manufacturer", type: "header", description: "Pabrik pembuat baja" },
      { name: "No_Dan_Tanggal_Invoice", label: "Nomor & Tanggal Invoice Ref", type: "header", description: "Referensi invoice pada Form AK" },
      { name: "Third_Country_Invoicing", label: "Third Country Invoicing", type: "header", description: "Klausul invoice pihak ketiga" },
      { name: "Tempat_Dan_Waktu_Pembuatan_AKForm", label: "Tempat & Waktu Pembuatan", type: "header", description: "Kota & tanggal penerbitan SKA" },
      { name: "Issued_Retroactively", label: "Issued Retroactively", type: "header", description: "Klausul penerbitan retroaktif" },
      // Table Line Items
      { name: "No_Item", label: "Nomor Item (Item No)", type: "table", description: "Urutan baris barang Form AK" },
      { name: "HS_Code", label: "Pos Tarif (HS Code)", type: "table", description: "HS Code 6 atau 8 digit" },
      { name: "Deskripsi_Barang", label: "Deskripsi Barang", type: "table", description: "Uraian barang Form AK" },
      { name: "Kriteria_Asal_Barang", label: "Kriteria Asal (Origin Criterion)", type: "table", description: "RVC 40%, CTH, WO, dll" },
      { name: "Berat_Kuantitas", label: "Berat / Kuantitas", type: "table", description: "Gross weight atau kuantitas" },
      { name: "No_Part", label: "Nomor Part / Part No", type: "table", description: "Kode part jika tertera" },
    ],
  },

  wl: {
    type: "wl",
    title: "Weight List (WL)",
    shortName: "WL",
    category: "WL",
    modelEnvKey: "MODEL_WL",
    fallbackModelId: "a43ce59b-e997-4fd5-8c7e-cd8eacc033ac",
    expectedFields: [
      "No_Referensi",
      "Nama_Supplier",
      "Net_Weight",
      "Gross_Weight",
      "Total_Berat",
      "Jumlah_Coil",
      "Satuan_Berat",
      "Deskripsi_Barang",
      "Spesifikasi",
      "Identitas_Dokumen",
    ],
    itemFields: [
      "Coil_No",
      "Net_Weight",
      "Gross_Weight",
    ],
    fields: [
      // Headers
      { name: "No_Referensi", label: "Nomor Referensi Weight List", type: "header", description: "Nomor dokumen Weight List" },
      { name: "Nama_Supplier", label: "Nama Supplier", type: "header", description: "Pihak produsen / supplier penimbang" },
      { name: "Net_Weight", label: "Total Net Weight", type: "header", description: "Total berat bersih agregat" },
      { name: "Gross_Weight", label: "Total Gross Weight", type: "header", description: "Total berat kotor agregat" },
      { name: "Total_Berat", label: "Total Berat Dokumen", type: "header", description: "Akumulasi berat timbangan" },
      { name: "Jumlah_Coil", label: "Jumlah Coil Total", type: "header", description: "Total coil terdaftar" },
      { name: "Satuan_Berat", label: "Satuan Berat", type: "header", description: "KG / LBS / MT" },
      { name: "Deskripsi_Barang", label: "Deskripsi Barang", type: "header", description: "Uraian material" },
      { name: "Spesifikasi", label: "Spesifikasi / Grade", type: "header", description: "Grade baja terdaftar" },
      { name: "Identitas_Dokumen", label: "Identitas Dokumen", type: "header", description: "Judul / kode form timbangan" },
      // Table Line Items
      { name: "Coil_No", label: "Nomor Coil (Coil No)", type: "table", description: "Nomor identitas unik setiap coil" },
      { name: "Net_Weight", label: "Net Weight Coil", type: "table", description: "Berat bersih tiap coil" },
      { name: "Gross_Weight", label: "Gross Weight Coil", type: "table", description: "Berat kotor tiap coil" },
    ],
  },

  ms: {
    type: "ms",
    title: "Mill Test Certificate (MTC)",
    shortName: "MTC",
    category: "MS",
    modelEnvKey: "MODEL_MS",
    fallbackModelId: "09bd8ce7-8037-4ade-a5ed-7f49a9bfd6c8",
    expectedFields: [
      "No_Sertifikat",
      "Tanggal_Sertifikat",
      "Nama_Produsen",
      "Spek_Material",
      "Jumlah_Berat_Material",
      "Deskripsi_Barang",
      "Identitas_Dokumen",
    ],
    itemFields: [
      "Ukuran",
      "No_Heat",
      "Komposisi_Kimia",
      "Weight",
    ],
    fields: [
      // Headers
      { name: "No_Sertifikat", label: "Nomor Sertifikat MTC", type: "header", description: "Nomor sertifikat pengujian pabrik" },
      { name: "Tanggal_Sertifikat", label: "Tanggal Sertifikat", type: "header", description: "Tanggal penerbitan sertifikat" },
      { name: "Nama_Produsen", label: "Nama Produsen / Pabrik", type: "header", description: "Pabrik baja pembuat (e.g. POSCO)" },
      { name: "Spek_Material", label: "Spesifikasi / Grade Material", type: "header", description: "Grade baja standar (JIS G3131 SPHC)" },
      { name: "Jumlah_Berat_Material", label: "Jumlah Berat Material", type: "header", description: "Total berat tersertifikasi" },
      { name: "Deskripsi_Barang", label: "Deskripsi Barang", type: "header", description: "Uraian produk baja" },
      { name: "Identitas_Dokumen", label: "Identitas Dokumen", type: "header", description: "Inspection / Test Certificate" },
      // Table Line Items
      { name: "Ukuran", label: "Ukuran / Dimensi", type: "table", description: "Tebal x Lebar x Panjang/Coil" },
      { name: "No_Heat", label: "Nomor Heat (Heat No)", type: "table", description: "Nomor peleburan baja" },
      { name: "Komposisi_Kimia", label: "Komposisi Kimia", type: "table", description: "Kandungan C, Mn, P, S, Si" },
      { name: "Weight", label: "Berat Coil MTC", type: "table", description: "Berat per heat / coil" },
    ],
  },
};

/**
 * Normalizes a document scope or category string to one of the 7 USC document types or "all".
 */
export function normalizeDocumentType(docScope?: string): UscDocumentType | "all" {
  if (!docScope) return "all";
  const s = docScope.toLowerCase().replace(/[\s_-]+/g, "").trim();

  if (s === "all" || s === "*" || s === "global") return "all";
  if (s === "pib" || s.includes("acuan")) return "pib";
  if (s === "ci" || s.includes("invoice") || s.includes("commercial")) return "ci";
  if (s === "pl" || s.includes("packing") || s.includes("paking")) return "pl";
  if (s === "bl" || s.includes("lading") || s.includes("ladding") || s.includes("bill")) return "bl";
  if (s === "ak" || s.includes("coo") || s.includes("origin") || s.includes("formak")) return "ak";
  if (s === "wl" || s.includes("weight")) return "wl";
  if (s === "ms" || s === "mtc" || s.includes("mill") || s.includes("sheet") || s.includes("test")) return "ms";

  return "all";
}

/**
 * Gets the document definition for a given doc scope.
 */
export function getDocumentDefinition(docScope?: string): UscDocumentDefinition | undefined {
  const normType = normalizeDocumentType(docScope);
  if (normType === "all") return undefined;
  return DOCUMENT_FIELD_REGISTRY[normType];
}

/**
 * Returns selectable option list for CustomMultiSelect based on the chosen target document.
 */
export function getFieldOptionsForDocument(
  docScope?: string
): Array<{ label: string; value: string; description?: string; badge?: string }> {
  const normType = normalizeDocumentType(docScope);

  if (normType === "all") {
    // Global: Union of representative fields from all documents
    const seen = new Set<string>();
    const options: Array<{ label: string; value: string; description?: string; badge?: string }> = [];

    // Collect all fields across all 7 USC documents
    for (const docDef of Object.values(DOCUMENT_FIELD_REGISTRY)) {
      for (const field of docDef.fields) {
        if (!seen.has(field.name)) {
          seen.add(field.name);
          options.push({
            label: field.name,
            value: field.name,
            description: field.label,
          });
        }
      }
    }
    return options;
  }

  const def = DOCUMENT_FIELD_REGISTRY[normType];
  if (!def) return [];

  const seen = new Set<string>();
  const options: Array<{ label: string; value: string; description?: string; badge?: string }> = [];
  for (const field of def.fields) {
    if (!seen.has(field.name)) {
      seen.add(field.name);
      options.push({
        label: field.name,
        value: field.name,
        description: field.label,
      });
    }
  }
  return options;
}

/**
 * List of 7 USC document types with metadata for document selection dropdowns.
 */
export const USC_DOCUMENTS_LIST: Array<{
  type: UscDocumentType;
  shortName: string;
  title: string;
  category: string;
}> = [
  { type: "pib", shortName: "PIB", title: "PIB (Pemberitahuan Impor Barang)", category: "PIB" },
  { type: "ci", shortName: "CI", title: "Commercial Invoice (CI)", category: "Invoice" },
  { type: "pl", shortName: "PL", title: "Packing List (PL)", category: "Packing List" },
  { type: "bl", shortName: "BL", title: "Bill of Lading (BL)", category: "Bill of Lading" },
  { type: "ak", shortName: "Form AK", title: "Form AK (Certificate of Origin)", category: "AK" },
  { type: "wl", shortName: "WL", title: "Weight List (WL)", category: "WL" },
  { type: "ms", shortName: "MTC", title: "Mill Test Certificate (MTC)", category: "MS" },
];

/**
 * Common field aliases and synonyms across all OCR extraction documents.
 */
export const FIELD_SYNONYMS: Record<string, string[]> = {
  Nama_Importir: ["Pemilik_Barang", "Nama_Importir", "Nama Importir", "Importir", "Consignee", "Buyer", "Identitas_Buyer", "Identitas_Pembeli", "Nama_Pemilik_Barang"],
  Pemilik_Barang: ["Nama_Importir", "Pemilik_Barang", "Nama_Pemilik_Barang", "Importir", "Consignee", "Buyer"],
  Identitas_Penjual: ["Nama_Penjual", "Identitas_Penjual", "Seller", "Supplier", "Identitas_Supplier"],
  Nama_Penjual: ["Identitas_Penjual", "Nama_Penjual", "Seller", "Supplier", "Identitas_Supplier"],
  Nama_Pengirim: ["Identitas_Pengirim", "Nama_Pengirim", "Shipper", "Exporter", "Nama_Exporter_Shipper"],
  Identitas_Pengirim: ["Nama_Pengirim", "Identitas_Pengirim", "Shipper", "Exporter"],
  Identitas_Supplier: ["Nama_Penjual", "Identitas_Penjual", "Seller", "Supplier", "Identitas_Supplier"],
  Identitas_Buyer: ["Pemilik_Barang", "Nama_Importir", "Buyer", "Consignee", "Identitas_Buyer"],
  Cara_Penyerahan: ["Incoterms", "Terms_of_Delivery", "Cara_Penyerahan", "Ket_FOB", "FOB", "Delivery_Terms"],
  Terms_of_Delivery: ["Incoterms", "Cara_Penyerahan", "Terms_of_Delivery", "Delivery_Terms", "Ket_FOB"],
  Incoterms: ["Terms_of_Delivery", "Cara_Penyerahan", "Incoterms", "Delivery_Terms"],
  Nilai_Pabean: ["Nilai_Total_Invoice", "Nilai_Pabean", "Total", "Nilai Total", "Nilai", "Total_Amount"],
  Nilai_Total_Invoice: ["Nilai_Pabean", "Nilai_Total_Invoice", "Total", "Total_Amount", "Nilai Total"],
  Berat_Bersih: ["Total_Net_Weight", "Net_Weight", "Berat_Bersih", "Total_Jumlah_Berat"],
  Net_Weight: ["Berat_Bersih", "Total_Net_Weight", "Net_Weight", "Total_Jumlah_Berat"],
  Berat_Kotor: ["Total_Gross_Weight", "Gross_Weight", "Berat_Kotor"],
  Gross_Weight: ["Berat_Kotor", "Total_Gross_Weight", "Gross_Weight"],
  No_Invoice: ["Invoice_Number", "Nomor_Invoice", "No_Invoice", "No Invoice", "Invoice Number"],
  Invoice_Number: ["No_Invoice", "Nomor_Invoice", "Invoice_Number", "No Invoice"],
  Tanggal_Invoice: ["Invoice_Date", "Tanggal_Invoice", "Tanggal Invoice", "Invoice Date"],
  Invoice_Date: ["Tanggal_Invoice", "Invoice_Date", "Tanggal Invoice"],
  No_BL: ["BL_Number", "No_BL", "No_House_BL", "Sea_Waybill_Number", "No BL"],
  Tanggal_BL: ["BL_Date", "Tanggal_BL", "Date_of_Issue", "House_BL_Date"],
  Pelabuhan_Muat: ["Pelabuhan_Asal", "Port_of_Loading", "Pelabuhan_Muat", "Pelabuhan Asal"],
  Pelabuhan_Asal: ["Pelabuhan_Muat", "Port_of_Loading", "Pelabuhan_Asal"],
  Pelabuhan_Tujuan: ["Destination", "Port_of_Discharge", "Pelabuhan_Tujuan", "Pelabuhan Tujuan"],
  Jumlah_Coil: ["Total_Coils", "Jumlah_Coil", "Jumlah", "QTY", "Total_Packages"],
};

/**
 * Resolves a field value from document fieldValues using direct match, synonyms, and normalization.
 */
export function resolveFieldValue(
  fieldValues: Record<string, unknown> | undefined,
  fieldName: string
): { found: boolean; value: string; resolvedKey: string } {
  if (!fieldValues || typeof fieldValues !== "object") {
    return { found: false, value: "", resolvedKey: "" };
  }

  // 1. Direct candidate checks
  const synonyms = FIELD_SYNONYMS[fieldName] || [fieldName];
  const candidates: string[] = [];

  for (const s of synonyms) {
    candidates.push(`${s}_action`);
    candidates.push(s);
    candidates.push(s.replace(/_/g, " "));
  }
  candidates.unshift(`${fieldName}_action`, fieldName, fieldName.replace(/_/g, " "));

  for (const cand of candidates) {
    if (fieldValues[cand] !== undefined && fieldValues[cand] !== null) {
      const val = String(fieldValues[cand]).trim();
      if (val !== "" && val !== "-") {
        return { found: true, value: val, resolvedKey: cand };
      }
    }
  }

  // 2. Normalized alphanumeric check
  const normCandidates = candidates.map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const [k, v] of Object.entries(fieldValues)) {
    if (v === undefined || v === null) continue;
    const normK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normCandidates.includes(normK)) {
      const val = String(v).trim();
      if (val !== "" && val !== "-") {
        return { found: true, value: val, resolvedKey: k };
      }
    }
  }

  return { found: false, value: "", resolvedKey: "" };
}
