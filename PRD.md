# Desain Flow Matching PIB vs Dokumen Pendukung (TVS Project)

## 1. Konteks & Tujuan

Dari contoh dokumen `NOPEN_10617` yang diberikan, satu PIB (BC 2.0) bisa merujuk ke banyak dokumen pendukung sekaligus:

| Dokumen | Jumlah pada contoh ini | Contoh Nomor |
|---|---|---|
| PIB (header + 77 line item) | 1 | 040300-000141420240405010617 |
| Commercial Invoice | 2 | 91842687, 91842688 |
| Packing List | 2 | 91842687, 91842688 |
| Bill of Lading (Master/Sea Waybill - ONE) | 1 | ONEYBLRE02110700 |
| Bill of Lading (House/Express - TVS SCS) | 1 | S01235842 |
| Parts List gabungan (opsional, cross-check) | 1 | 77 baris |

Tujuan sistem: setelah semua dokumen di-OCR menjadi JSON, **middleware Python** harus otomatis menentukan:
1. Apakah dokumen pendukung yang di-upload memang **dokumen yang tepat** untuk PIB tersebut (document-level match, berdasarkan nomor referensi di header PIB).
2. Apakah **isi/nilai** di dokumen pendukung itu **konsisten** dengan PIB (field-level & line-item-level match).
3. Kalau tidak match, **di field mana** dan **seberapa besar selisihnya**, supaya user tinggal lihat report, tidak perlu buka semua PDF manual.

---

## 2. High-Level Flow

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────────────┐     ┌───────────────┐
│  Upload PDF  │ --> │  OCR Engine  │ --> │  Normalizer     │ --> │  Matching Engine  │ --> │  Result Report │
│ (PIB+lampiran)│     │ (per-doc JSON)│     │ (bentuk umum)   │     │ (rules per level) │     │ (JSON + UI)    │
└─────────────┘     └──────────────┘     └────────────────┘     └─────────────────┘     └───────────────┘
```

**Detail tahapan:**

1. **Klasifikasi dokumen** — sebelum/selama OCR, setiap file diberi label jenis dokumen (`PIB`, `INVOICE`, `PACKING_LIST`, `BL_MASTER`, `BL_HOUSE`, `COO`, dll). Ini bisa dari nama file, atau dari heading yang terdeteksi OCR (mis. "COMMERCIAL INVOICE", "BILL OF LADING", "PACKING LIST").
2. **OCR extraction** — tiap jenis dokumen punya template ekstraksi sendiri (field mapping berbeda), output-nya JSON mentah per dokumen.
3. **Normalisasi** — menyamakan format: tanggal (`25-04-2024` → `2024-04-25`), angka (`90,373.04` → `90373.04`), nomor kontainer/HS code (uppercase, trim spasi), nomor dokumen (trim leading zero jika perlu).
4. **Matching engine** — dijalankan berlapis (lihat bagian 4).
5. **Result report** — output JSON terstruktur berisi status match per level + detail diskrepansi (lihat bagian 5).

---

## 3. Schema Ekstraksi (per jenis dokumen)

Skema ini adalah *kontrak* antara hasil OCR dan matching engine. Field yang dipakai untuk matching harus konsisten key-nya di semua jenis dokumen.

### 3.1 PIB — Header
```json
{
  "doc_type": "PIB",
  "nomor_pendaftaran": "040300/000141420/2024/04/05010617",
  "tanggal_pendaftaran": "2024-04-25",
  "kantor_pabean": "KPU BEA DAN CUKAI TIPE A TANJUNG PRIOK",
  "importir": {
    "nama": "PT. TVS MOTOR COMPANY INDONESIA",
    "npwp": "018696831055000"
  },
  "pengirim_penjual": {
    "nama": "TVS MOTOR COMPANY LIMITED",
    "negara": "IN"
  },
  "pelabuhan_muat": "KATTUPALLI INKAT",
  "pelabuhan_tujuan": "TANJUNG PRIOK IDTPP",
  "cara_angkut": "LAUT",
  "sarana_angkut": "MOL EXPLORER",
  "valuta": "USD",
  "ndpbm": 16150,
  "nilai": {
    "fob": 90373.04,
    "freight": 150.00,
    "asuransi": 0.00,
    "nilai_pabean_usd": 90523.04,
    "nilai_pabean_rp": 1461947096.00
  },
  "berat": {
    "kotor_kg": 18206.00,
    "bersih_kg": 17006.745
  },
  "referensi_dokumen": {
    "invoice": [{"no": "91842687", "tanggal": "2024-03-23"}],
    "master_bl": {"no": "S01235842", "tanggal": "2024-04-11"},
    "house_bl": {"no": "ONEYBLRE02110700", "tanggal": "2024-04-11"}
  },
  "kontainer": [
    {"nomor": "FSCU8617852", "ukuran_tipe": "40 FCL", "jumlah_kemasan": "48 PACKAGE"}
  ],
  "total_pungutan": {
    "bm": 33779000.00,
    "ppn": 164529751.00,
    "pph": 37392175.00,
    "total": 235700926.00
  }
}
```

### 3.2 PIB — Line Item (array, 77 baris pada contoh)
```json
{
  "no": 1,
  "pos_tarif_hs": "84821000",
  "kode_barang": "0339110",
  "uraian": "BALL BEARING 12X37X12 C3 6301Z",
  "negara_asal": "IN",
  "tarif_bm": "4%",
  "jumlah_satuan": 1470.0000,
  "satuan": "NUMBER OF PIECE",
  "jumlah_kemasan": 117.6000,
  "berat_bersih_kg": null,
  "nilai_pabean_usd": 868.74,
  "fasilitas": ["KITE PENGEMBALIAN (2)", "KITE PENGEMBALIAN (3)", "PREFERENSI TARIF AIFTA (11)"]
}
```

### 3.3 Invoice — Header + Item
```json
{
  "doc_type": "INVOICE",
  "invoice_no": "91842687",
  "invoice_date": "2024-03-23",
  "exporter": "TVS MOTOR COMPANY LIMITED",
  "consignee": "PT TVS MOTOR COMPANY INDONESIA",
  "port_of_loading": "KATTUPALLI PORT",
  "container_no": "FSCU8617852",
  "seal_no": "SPPL03608731",
  "total_gross_weight_kg": 1379.000,
  "total_net_weight_kg": 1254.100,
  "total_qty": 24909,
  "total_value_usd": 11338.17,
  "items": [
    {
      "part_no": "0339110",
      "description": "BALL BEARING 12x37x12 C3 6301Z",
      "net_wt_kg": 0.080,
      "qty": 1470,
      "tot_qty_wt_kg": 117.600,
      "unit_price": 0.590,
      "tot_value": 867.30,
      "currency": "USD",
      "hs_code_dbk": "87141090"
    }
  ]
}
```

### 3.4 Packing List — Header + Item
Struktur mirip Invoice, field kunci tambahan: `pallet_dim`, `no_of_packages` (bukan value/harga).

### 3.5 Bill of Lading (Master / House)
```json
{
  "doc_type": "BL_MASTER",
  "bl_no": "S01235842",
  "bl_date": "2024-04-11",
  "vessel_voyage": "XIN YANG PU / 172E",
  "port_of_loading": "KATTUPALLI, INDIA",
  "port_of_discharge": "JAKARTA, INDONESIA",
  "container_no": "FSCU8617852",
  "seal_no": "IN1304973",
  "gross_weight_kg": 18206.000,
  "net_weight_kg": 17006.745,
  "measurement_m3": 40,
  "packages": 48,
  "referenced_invoices": ["91842687", "91842688"],
  "shipped_on_board_date": "2024-04-11"
}
```

---

## 4. Matching Engine — 3 Level

### Level 1: Document-Level Match (dokumen ini memang untuk PIB ini?)
Cocokkan nomor referensi yang tertulis di **header PIB** terhadap nomor pada dokumen pendukung itu sendiri.

| PIB field | Dicocokkan dengan | Field di dokumen lain |
|---|---|---|
| `referensi_dokumen.invoice[].no` + tanggal | Invoice | `invoice_no` + `invoice_date` |
| `referensi_dokumen.master_bl.no` + tanggal | BL Master (ONE) | `bl_no` + `bl_date` |
| `referensi_dokumen.house_bl.no` + tanggal | BL Express (TVS SCS) | `bl_no` + `bl_date` |
| `kontainer[].nomor` | Invoice, Packing List, BL | `container_no` |

→ Kalau field ini tidak cocok, dokumen pendukung yang di-upload **bukan pasangan yang benar** untuk PIB ini — ini error paling fatal, harus jadi flag prioritas tinggi.

### Level 2: Header/Aggregate-Level Match (total-total nilai konsisten?)
Bandingkan **agregat**, bukan per baris — karena satu PIB bisa gabungan 2+ invoice.

| PIB (agregat) | Dibandingkan dengan | Toleransi |
|---|---|---|
| `nilai.fob` | Σ `total_value_usd` semua invoice terkait | 0 (harus sama, atau ± pembulatan 0.01) |
| `berat.bersih_kg` | Σ `total_net_weight_kg` semua invoice/packing list, **atau** `net_weight_kg` di BL | ± 0.01 kg |
| `berat.kotor_kg` | `gross_weight_kg` di BL | ± 0.01 kg |
| jumlah kemasan (`27. jumlah kemasan`) | `packages` di BL | 0 |
| jumlah baris barang ("77 Jenis barang") | jumlah unique part number gabungan semua invoice | 0 |

Contoh dari dokumen ini: PIB `berat.bersih_kg = 17006.7450` cocok persis dengan BL `net_weight_kg = 17006.745` ✅ — dan `nilai.fob = 90373.04` = 11338.17 (invoice 1) + 79034.87 (invoice 2) = 90373.04 ✅.

### Level 3: Line-Item-Level Match (per part number)
Ini yang paling detail dan paling sering ditemukan selisih. Kunci join terbaik: **`part_no` / `kode_barang`**, karena `uraian`/`description` sering beda ejaan minor antar dokumen OCR.

Untuk tiap PIB line item, cari baris yang sama di invoice/packing list (join by `kode_barang == part_no`), lalu bandingkan:

| Field PIB | Field Invoice/Packing List | Toleransi |
|---|---|---|
| `jumlah_satuan` (qty) | `qty` | 0 (harus sama persis) |
| `nilai_pabean_usd` | `tot_value` | ± 0.01 (rounding) |
| `pos_tarif_hs` | `hs_code_dbk` | 0 — **wajib sama**, ini poin krusial buat compliance |
| `uraian` | `description` | fuzzy match (≥ 85% similarity), bukan exact |
| `negara_asal` | (dari header invoice `country of origin`) | exact |

**Contoh nyata selisih yang ketemu dari dokumen ini** (baik dipakai sebagai test case):
- PIB baris ke-58, part `R1210020` "SEAT ASSY LATCH", Pos Tarif PIB = `87141090`.
- Di Invoice 91842688 baris 29, part yang sama tertulis `RITC/HSN Code = 87141010` (beda dari PIB & dari parts list gabungan yang menyebut `87141090`).
→ Ini **mismatch HS code** antara Invoice dan PIB/parts-list — persis jenis temuan yang harus otomatis ditandai oleh engine sebagai `FIELD_MISMATCH` tingkat "high" karena menyangkut tarif bea masuk.

---

## 5. Schema Output/Result

Result harus bisa dibaca manusia (untuk UI) maupun diproses lanjut (untuk audit trail). Struktur yang disarankan:

```json
{
  "pib_no": "040300-000141420240405010617",
  "matched_documents": [
    {"doc_type": "INVOICE", "doc_no": "91842687", "status": "MATCHED"},
    {"doc_type": "INVOICE", "doc_no": "91842688", "status": "MATCHED"},
    {"doc_type": "BL_MASTER", "doc_no": "S01235842", "status": "MATCHED"},
    {"doc_type": "BL_HOUSE", "doc_no": "ONEYBLRE02110700", "status": "MATCHED"},
    {"doc_type": "PACKING_LIST", "doc_no": "91842687", "status": "MATCHED"}
  ],
  "summary": {
    "overall_status": "PARTIAL_MATCH",
    "total_checks": 312,
    "matched": 305,
    "mismatched": 5,
    "missing": 2
  },
  "level_1_document_reference": [
    {"field": "master_bl_no", "pib_value": "S01235842", "doc_value": "S01235842", "status": "MATCH"}
  ],
  "level_2_aggregate": [
    {"field": "nilai_pabean_fob", "pib_value": 90373.04, "doc_value": 90373.04, "status": "MATCH", "diff": 0.00},
    {"field": "berat_bersih_kg", "pib_value": 17006.745, "doc_value": 17006.745, "status": "MATCH", "diff": 0.000}
  ],
  "level_3_line_items": [
    {
      "part_no": "R1210020",
      "field": "hs_code",
      "pib_value": "87141090",
      "invoice_value": "87141010",
      "status": "MISMATCH",
      "severity": "HIGH",
      "source_doc": {"type": "INVOICE", "no": "91842688"}
    },
    {
      "part_no": "K6210480",
      "field": "qty",
      "pib_value": 200,
      "invoice_value": 200,
      "status": "MATCH"
    }
  ],
  "unmatched_pib_items": [],
  "unmatched_invoice_items": []
}
```

**Kategori `status` yang disarankan** (dipakai konsisten di semua level):
- `MATCH` — nilai identik (atau dalam toleransi).
- `MISMATCH` — ada di kedua dokumen tapi nilainya beda.
- `MISSING_IN_PIB` — ada di invoice/packing list tapi tidak ditemukan di PIB.
- `MISSING_IN_SOURCE` — ada di PIB tapi tidak ditemukan di dokumen pendukung.
- `NOT_APPLICABLE` — field memang tidak ada di salah satu jenis dokumen (mis. packing list tidak punya harga).

**`severity`** membantu user memprioritaskan: `HIGH` untuk field yang berdampak ke bea/pajak (HS code, nilai pabean, qty), `MEDIUM` untuk berat/kemasan, `LOW` untuk deskripsi/nama barang (karena OCR rawan typo).

---

## 6. Saran Arsitektur Modul Python (Middleware)

```
middleware/
├── classifier.py     # deteksi jenis dokumen dari hasil OCR mentah
├── extractors/
│   ├── pib.py         # mapping raw OCR -> schema PIB (3.1 & 3.2)
│   ├── invoice.py      # mapping raw OCR -> schema Invoice (3.3)
│   ├── packing_list.py
│   └── bl.py
├── normalizer.py      # utils: parse_date, parse_number, clean_hs_code, clean_container_no
├── matcher/
│   ├── level1_reference.py
│   ├── level2_aggregate.py
│   └── level3_lineitem.py   # join by part_no, fuzzy match untuk description
├── reporter.py         # build result JSON (bagian 5) + hitung summary
└── main.py             # orchestrator: terima list JSON OCR -> panggil semua tahap -> return result
```

Poin desain penting:
- **Normalizer terpisah dari matcher** — supaya toleransi angka/tanggal konsisten di semua level, tidak duplikat logic.
- **Join key untuk line item pakai `part_no`**, bukan `uraian`, karena part number lebih stabil hasil OCR-nya dibanding teks deskripsi panjang.
- **Toleransi numerik dikonfigurasi**, bukan hard-code (mis. `TOLERANCE = {"value_usd": 0.01, "weight_kg": 0.01, "qty": 0}`) — supaya gampang di-tune tanpa ubah logic.
- **Fuzzy match untuk teks** (misal pakai `rapidfuzz`) khusus field `uraian`/`description`, karena OCR sering typo tapi part number & angka biasanya lebih akurat.
- Kalau satu PIB merujuk **banyak invoice** (seperti kasus ini, 2 invoice), matcher line-item harus lakukan **union** semua item invoice dulu sebelum di-join ke PIB.

---

## 7. Ringkasan Alur Kerja End-to-End

1. Semua PDF (PIB + lampiran) di-upload → diklasifikasi jenisnya.
2. OCR jalan per dokumen → hasil JSON sesuai schema section 3.
3. Normalizer merapikan format tanggal/angka/kode.
4. Matcher jalan 3 level (reference → aggregate → line item).
5. Reporter merangkum ke satu JSON hasil akhir (section 5) dengan `overall_status` dan detail per-diskrepansi + `severity`.
6. Result ini yang ditampilkan ke user (bisa jadi tabel/dashboard): dokumen mana yang match, dan kalau ada mismatch, di baris/field mana persisnya, beserta nilai dari kedua sisi supaya user tidak perlu buka PDF asli lagi.

[PRD.md](file;file:///c%3A/My%20All%20Projek%20Start%209%20Feb%202025/Gawe/Middleware/PRD.md) coba anda baca dan analisis prd ini

set up api key ini
Authorization Basic Auth :
Username : 244bd61f-32b0-11ef-94f2-cec13431d72d
Password : 

Params :
start_day_interval  : 20658
current_batch_day : 20658

dengan get data
By Model : https://app.nanonets.com/api/v2/Inferences/Model/{model_id}/ImageLevelInferences


https://app.nanonets.com/api/v2/Inferences/Model/{model_id}/ImageLevelInferences/{id}