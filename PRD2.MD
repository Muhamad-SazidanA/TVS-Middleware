# PRD — Sistem Matching Otomatis PIB vs Dokumen Pendukung
**Project:** TVS Import Document Matching Middleware
**Versi:** 2.0 (restrukturisasi dari draft v1)
**Status:** Draft untuk development
**Bahasa spesifikasi:** MUST = wajib diimplementasikan, SHOULD = direkomendasikan, MAY = opsional

---

## 1. Ringkasan Eksekutif

Sistem menerima hasil OCR (dalam bentuk JSON) dari satu PIB (BC 2.0) beserta dokumen pendukungnya (Invoice, Packing List, Bill of Lading), lalu **secara otomatis** menentukan apakah dokumen-dokumen tersebut adalah pasangan yang benar dan apakah isinya konsisten satu sama lain. Output akhir adalah satu JSON report yang menunjukkan status match/mismatch di setiap level, lengkap dengan lokasi dan besar selisihnya, sehingga user tidak perlu membuka PDF asli untuk audit manual.

## 2. Tujuan Terukur (Goals)

| ID | Goal | Kriteria sukses |
|---|---|---|
| G1 | Deteksi dokumen pendukung yang salah pasang | 100% dokumen dengan nomor referensi tidak cocok harus ter-flag di Level 1 |
| G2 | Deteksi selisih agregat (total nilai/berat) | Selisih di atas toleransi harus muncul di Level 2 dengan angka pasti |
| G3 | Deteksi selisih per baris barang | Setiap part number di PIB harus ada hasil banding (match/mismatch/missing) di Level 3 |
| G4 | Prioritisasi otomatis | Setiap mismatch punya `severity` agar user tahu mana yang harus dicek duluan |
| G5 | Audit trail | Report bisa dipakai ulang untuk audit, bukan cuma tampilan sekali lihat |

## 3. Ruang Lingkup

**In scope (MUST):**
- Matching untuk 1 PIB terhadap N Invoice, N Packing List, 1 BL Master, 1 BL House.
- 3 level matching: document reference, aggregate, line item.
- Output JSON terstruktur + ringkasan status.

**Out of scope (untuk versi ini):**
- OCR engine itu sendiri (dianggap sudah menghasilkan JSON mentah per dokumen — lihat catatan di §12.1 soal confidence score).
- UI/dashboard (hanya kontrak JSON yang disiapkan, bukan front-end).
- Koreksi otomatis data (sistem hanya melaporkan, tidak mengubah data PIB/invoice).
- Multi-PIB batch processing (dianggap 1 PIB per proses; batching adalah pekerjaan orchestrator di luar matching engine).

## 4. Glosarium

| Istilah | Arti |
|---|---|
| PIB | Pemberitahuan Impor Barang (BC 2.0), dokumen utama |
| HS Code / Pos Tarif | Kode klasifikasi barang untuk perhitungan bea masuk |
| Line item | Satu baris barang di dalam PIB/Invoice |
| Join key | Field yang dipakai untuk mencocokkan baris antar dokumen (`part_no`) |
| Toleransi | Selisih maksimum yang masih dianggap "match" |

---

## 5. Arsitektur & Alur Data

```
[1] Upload PDF  ->  [2] Classifier  ->  [3] OCR Extractor  ->  [4] Normalizer  ->  [5] Matcher (L1→L2→L3)  ->  [6] Reporter
```

| Step | Nama | Input | Output | Wajib urut? |
|---|---|---|---|---|
| 1 | Upload | File PDF | Raw file | - |
| 2 | Classifier | Raw file / raw OCR text | `doc_type` (enum) | Sebelum extractor |
| 3 | Extractor | Raw OCR + `doc_type` | JSON sesuai schema §6 | Sebelum normalizer |
| 4 | Normalizer | JSON mentah per dokumen | JSON ternormalisasi (format tanggal/angka/kode seragam) | Sebelum matcher |
| 5 | Matcher | Semua JSON ternormalisasi (1 PIB + N dokumen pendukung) | Hasil match per level | L1 → L2 → L3 berurutan (lihat §12.2) |
| 6 | Reporter | Hasil semua level matcher | JSON report final (§9) | Terakhir |

**MUST**: Normalizer harus dipanggil sebelum data masuk ke matcher manapun — tidak boleh ada matcher yang parsing tanggal/angka sendiri-sendiri (hindari duplikasi logic).

---

## 6. Data Contracts (Schema Ekstraksi)

> Field bertanda **(R)** = required, **(O)** = optional/boleh null.

### 6.1 PIB — Header
```json
{
  "doc_type": "PIB",                          // (R) const
  "nomor_pendaftaran": "string",               // (R)
  "tanggal_pendaftaran": "YYYY-MM-DD",         // (R)
  "importir": {"nama": "string", "npwp": "string"},   // (R)
  "valuta": "string",                          // (R)
  "ndpbm": "number",                           // (R)
  "nilai": {
    "fob": "number", "freight": "number",
    "asuransi": "number", "nilai_pabean_usd": "number",
    "nilai_pabean_rp": "number"
  },                                            // (R) semua sub-field
  "berat": {"kotor_kg": "number", "bersih_kg": "number"}, // (R)
  "referensi_dokumen": {
    "invoice": [{"no": "string", "tanggal": "YYYY-MM-DD"}],  // (R) min 1
    "master_bl": {"no": "string", "tanggal": "YYYY-MM-DD"},  // (R)
    "house_bl": {"no": "string", "tanggal": "YYYY-MM-DD"}    // (O) — tidak semua PIB punya house BL
  },
  "kontainer": [{"nomor": "string", "ukuran_tipe": "string", "jumlah_kemasan": "string"}], // (R) min 1
  "total_pungutan": {"bm": "number", "ppn": "number", "pph": "number", "total": "number"}   // (R)
}
```

### 6.2 PIB — Line Item (array)
```json
{
  "no": "int",                    // (R)
  "pos_tarif_hs": "string",       // (R)
  "kode_barang": "string",        // (R) — ini JOIN KEY utama, harus selalu ada
  "uraian": "string",             // (R)
  "negara_asal": "string",        // (R)
  "jumlah_satuan": "number",      // (R)
  "satuan": "string",             // (R)
  "jumlah_kemasan": "number",     // (O)
  "berat_bersih_kg": "number|null", // (O)
  "nilai_pabean_usd": "number",   // (R)
  "fasilitas": ["string"]          // (O)
}
```

### 6.3 Invoice — Header + Item
```json
{
  "doc_type": "INVOICE",                     // (R) const
  "invoice_no": "string",                    // (R)
  "invoice_date": "YYYY-MM-DD",              // (R)
  "container_no": "string",                  // (R)
  "total_gross_weight_kg": "number",         // (R)
  "total_net_weight_kg": "number",           // (R)
  "total_qty": "number",                     // (R)
  "total_value_usd": "number",               // (R)
  "items": [
    {
      "part_no": "string",       // (R) JOIN KEY
      "description": "string",   // (R)
      "qty": "number",           // (R)
      "tot_value": "number",     // (R)
      "currency": "string",      // (R)
      "hs_code_dbk": "string"    // (R)
    }
  ]
}
```

### 6.4 Packing List — Header + Item
Sama seperti Invoice, minus field harga (`tot_value`, `currency`, `unit_price`). Tambahan (O): `pallet_dim`, `no_of_packages`.

### 6.5 Bill of Lading (Master / House)
```json
{
  "doc_type": "BL_MASTER | BL_HOUSE",    // (R)
  "bl_no": "string",                     // (R)
  "bl_date": "YYYY-MM-DD",               // (R)
  "container_no": "string",              // (R)
  "gross_weight_kg": "number",           // (R)
  "net_weight_kg": "number",             // (R)
  "packages": "int",                     // (R)
  "referenced_invoices": ["string"]      // (R) min 1
}
```

**MUST**: Setiap extractor WAJIB menghasilkan field yang ditandai (R). Jika salah satu field (R) tidak terbaca OCR, extractor MUST mengisi `null` dan menambahkan entri di `_extraction_warnings: []` — jangan biarkan field hilang diam-diam (silent fail dilarang, lihat §12.1).

---

## 7. Functional Requirements — Matching Engine

### 7.1 Level 1 — Document Reference Match

**Tujuan:** Memastikan dokumen yang di-upload memang pasangan yang benar untuk PIB ini.

**Input:** PIB header (`referensi_dokumen`, `kontainer`) + header semua dokumen pendukung.

| ID | Requirement |
|---|---|
| REQ-L1-01 | Sistem MUST mencocokkan `referensi_dokumen.invoice[].no` PIB terhadap `invoice_no` tiap file Invoice yang di-upload. |
| REQ-L1-02 | Sistem MUST mencocokkan `referensi_dokumen.master_bl.no` terhadap `bl_no` file BL Master. |
| REQ-L1-03 | Sistem MUST mencocokkan `referensi_dokumen.house_bl.no` terhadap `bl_no` file BL House **jika field ini ada** di PIB (boleh diabaikan jika `house_bl` null). |
| REQ-L1-04 | Sistem MUST mencocokkan setiap `kontainer[].nomor` PIB terhadap `container_no` di Invoice, Packing List, dan BL. |
| REQ-L1-05 | Jika ada dokumen ter-upload yang nomor referensinya TIDAK ditemukan di PIB manapun, sistem MUST menandainya `status: "UNRECOGNIZED_DOCUMENT"` dan `severity: "HIGH"` — ini kandidat dokumen tertukar dengan PIB lain. |
| REQ-L1-06 | Jika satu referensi di PIB (mis. salah satu invoice) TIDAK ada dokumen pendukungnya yang ter-upload, sistem MUST menandai `status: "MISSING_DOCUMENT"`, `severity: "HIGH"`. |

**Output per item:** `{field, pib_value, doc_value, status: MATCH|MISMATCH|MISSING_DOCUMENT|UNRECOGNIZED_DOCUMENT}`

**Gate rule:** REQ-L1-07 — Jika ada minimal satu `MISMATCH`/`UNRECOGNIZED_DOCUMENT` di Level 1 untuk sepasang dokumen tertentu, sistem MUST tetap menjalankan Level 2 & 3 untuk dokumen lain yang lolos Level 1, TAPI dokumen yang gagal Level 1 MUST DIKECUALIKAN dari agregasi Level 2 (lihat §12.2 — jangan sampai dokumen yang salah pasang ikut menghitung total).

---

### 7.2 Level 2 — Aggregate Match

**Tujuan:** Membandingkan total-total nilai, bukan per baris (karena 1 PIB bisa gabungan beberapa invoice).

**Input:** PIB header (`nilai`, `berat`, `kontainer`) + union semua dokumen pendukung yang **lolos Level 1**.

| ID | Requirement | Formula |
|---|---|---|
| REQ-L2-01 | Bandingkan FOB PIB vs jumlah invoice | `pib.nilai.fob` vs `Σ invoice.total_value_usd` |
| REQ-L2-02 | Bandingkan berat bersih | `pib.berat.bersih_kg` vs `Σ invoice.total_net_weight_kg` ATAU `bl.net_weight_kg` (pakai BL sebagai primary jika ada, invoice sebagai fallback) |
| REQ-L2-03 | Bandingkan berat kotor | `pib.berat.kotor_kg` vs `bl.gross_weight_kg` |
| REQ-L2-04 | Bandingkan jumlah kemasan | `pib.kontainer[].jumlah_kemasan` (parse angka dari string) vs `bl.packages` |
| REQ-L2-05 | Bandingkan jumlah jenis barang | `count(distinct pib_line_items.kode_barang)` vs `count(distinct union(invoice_items).part_no)` |

**MUST**: Semua toleransi numerik diambil dari config (§8), TIDAK boleh hard-code di dalam fungsi matcher.

**Output per item:** `{field, pib_value, doc_value, diff, status: MATCH|MISMATCH, severity}` — severity `MEDIUM` untuk berat/kemasan, `HIGH` untuk nilai FOB.

---

### 7.3 Level 3 — Line Item Match

**Tujuan:** Bandingkan tiap baris barang PIB terhadap baris invoice/packing list yang sesuai.

**Input:** Array line item PIB + union seluruh item dari semua Invoice yang lolos Level 1.

| ID | Requirement |
|---|---|
| REQ-L3-01 | Join key MUST `pib_line.kode_barang == invoice_item.part_no`. Dilarang join pakai `uraian`/`description`. |
| REQ-L3-02 | **Jika 1 PIB merujuk >1 Invoice**, sistem MUST melakukan UNION semua item invoice terlebih dahulu, DAN jika `part_no` yang sama muncul di lebih dari satu invoice, sistem MUST menjumlahkan (`SUM`) `qty` dan `tot_value` dari semua kemunculan tersebut sebelum dibandingkan ke PIB. (Ini kasus yang tidak eksplisit di draft v1 — WAJIB ditangani karena bisa menyebabkan false-positive mismatch qty.) |
| REQ-L3-03 | Bandingkan `jumlah_satuan` (PIB) vs `qty` (invoice, hasil SUM jika REQ-L3-02 berlaku). Toleransi = 0. |
| REQ-L3-04 | Bandingkan `nilai_pabean_usd` (PIB) vs `tot_value` (invoice, hasil SUM). Toleransi sesuai config (default 0.01). |
| REQ-L3-05 | Bandingkan `pos_tarif_hs` (PIB) vs `hs_code_dbk` (invoice). Toleransi = 0 (exact match wajib). `severity: HIGH` jika mismatch — ini dampak langsung ke bea masuk. |
| REQ-L3-06 | Bandingkan `uraian` (PIB) vs `description` (invoice) pakai fuzzy string match. Threshold minimum diambil dari config (default 85%), BUKAN hard-code. `severity: LOW` jika di bawah threshold (karena OCR rawan typo, bukan indikasi fraud). |
| REQ-L3-07 | Bandingkan `negara_asal` (PIB) vs country of origin di header invoice. Toleransi = 0. |
| REQ-L3-08 | Part number yang ada di PIB tapi TIDAK ditemukan di union invoice MUST masuk ke `unmatched_pib_items` dengan `status: MISSING_IN_SOURCE`. |
| REQ-L3-09 | Part number yang ada di invoice tapi TIDAK ditemukan di PIB MUST masuk ke `unmatched_invoice_items` dengan `status: MISSING_IN_PIB`. |

**Test case wajib (golden test, dari data TVS nyata):**
PIB baris ke-58, `kode_barang = R1210020`, `pos_tarif_hs = 87141090`. Di Invoice 91842688 baris 29, `hs_code_dbk = 87141010`. Sistem **MUST** menghasilkan satu entri:
```json
{"part_no": "R1210020", "field": "hs_code", "pib_value": "87141090", "invoice_value": "87141010", "status": "MISMATCH", "severity": "HIGH"}
```
Jika implementasi tidak menghasilkan entri ini persis seperti itu terhadap data contoh, implementasi dianggap SALAH.

---

## 8. Configuration Schema

**MUST**: Semua angka toleransi dan threshold ada di satu file config, contoh:
```json
{
  "tolerance": {
    "value_usd": 0.01,
    "weight_kg": 0.01,
    "qty": 0,
    "packages": 0,
    "hs_code": 0
  },
  "fuzzy_match": {
    "field": "uraian_vs_description",
    "algorithm": "rapidfuzz.token_sort_ratio",
    "min_similarity_pct": 85
  },
  "weight_source_priority": ["BL", "INVOICE_SUM"]
}
```

---

## 9. Output/Result Schema

```json
{
  "pib_no": "string",
  "processed_at": "ISO-8601 timestamp",
  "matched_documents": [
    {"doc_type": "INVOICE", "doc_no": "string", "status": "MATCHED|UNRECOGNIZED_DOCUMENT|MISSING_DOCUMENT"}
  ],
  "summary": {
    "overall_status": "FULL_MATCH|PARTIAL_MATCH|FAILED",
    "total_checks": "int", "matched": "int", "mismatched": "int", "missing": "int"
  },
  "level_1_document_reference": [
    {"field": "string", "pib_value": "any", "doc_value": "any", "status": "string"}
  ],
  "level_2_aggregate": [
    {"field": "string", "pib_value": "number", "doc_value": "number", "diff": "number", "status": "string", "severity": "string"}
  ],
  "level_3_line_items": [
    {"part_no": "string", "field": "string", "pib_value": "any", "invoice_value": "any", "status": "string", "severity": "string", "source_doc": {"type": "string", "no": "string"}}
  ],
  "unmatched_pib_items": [ {"part_no": "string", "status": "MISSING_IN_SOURCE"} ],
  "unmatched_invoice_items": [ {"part_no": "string", "status": "MISSING_IN_PIB", "source_doc": {"type": "string", "no": "string"}} ],
  "_extraction_warnings": [ {"doc_type": "string", "doc_no": "string", "field": "string", "note": "string"} ]
}
```

**Enum `status`:** `MATCH`, `MISMATCH`, `MISSING_IN_PIB`, `MISSING_IN_SOURCE`, `MISSING_DOCUMENT`, `UNRECOGNIZED_DOCUMENT`, `NOT_APPLICABLE`.
**Enum `severity`:** `HIGH` (HS code, nilai pabean, qty, dokumen salah pasang), `MEDIUM` (berat, kemasan), `LOW` (deskripsi/nama barang).
**Enum `overall_status`:** `FULL_MATCH` (0 mismatch/missing), `PARTIAL_MATCH` (ada mismatch tapi tidak ada `UNRECOGNIZED_DOCUMENT`), `FAILED` (ada minimal 1 `UNRECOGNIZED_DOCUMENT` atau `MISSING_DOCUMENT` di Level 1).

---

## 10. Module & Function Interface Spec (Python)

> Bagian ini WAJIB dipakai sebagai kontrak nama fungsi — tujuannya supaya AI coding assistant tidak menebak-nebak struktur kode.

```
middleware/
├── classifier.py
│     def classify_document(raw_ocr_json: dict) -> str: ...        # return doc_type enum
│
├── extractors/
│     def extract_pib(raw_ocr_json: dict) -> dict: ...             # -> schema §6.1 + §6.2
│     def extract_invoice(raw_ocr_json: dict) -> dict: ...         # -> schema §6.3
│     def extract_packing_list(raw_ocr_json: dict) -> dict: ...    # -> schema §6.4
│     def extract_bl(raw_ocr_json: dict) -> dict: ...              # -> schema §6.5
│
├── normalizer.py
│     def parse_date(raw: str) -> str: ...          # -> "YYYY-MM-DD"
│     def parse_number(raw: str) -> float: ...       # -> "90,373.04" -> 90373.04
│     def clean_hs_code(raw: str) -> str: ...
│     def clean_container_no(raw: str) -> str: ...
│     def normalize_document(doc: dict) -> dict: ... # dispatch berdasarkan doc_type
│
├── matcher/
│     def match_level1(pib: dict, support_docs: list[dict], config: dict) -> list[dict]: ...
│     def match_level2(pib: dict, support_docs: list[dict], level1_result: list[dict], config: dict) -> list[dict]: ...
│     def match_level3(pib_items: list[dict], invoice_items: list[dict], config: dict) -> dict:
│         # return {"matched": [...], "unmatched_pib": [...], "unmatched_invoice": [...]}
│         # WAJIB implementasi union+SUM per REQ-L3-02 sebelum join
│
├── reporter.py
│     def build_report(pib_no: str, l1: list, l2: list, l3: dict, docs_status: list) -> dict: ...  # -> schema §9
│
└── main.py
      def run_matching(pib_raw: dict, support_docs_raw: list[dict], config: dict) -> dict: ...
      # orchestrator: classify -> extract -> normalize -> match L1 -> L2 -> L3 -> report
```

---

## 11. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | Sistem MUST menyimpan config toleransi terpisah dari kode (file JSON/YAML), agar bisa diubah tanpa deploy ulang. |
| NFR-02 | Setiap run matching MUST menghasilkan `processed_at` timestamp dan disimpan sebagai audit trail (tidak overwrite hasil run sebelumnya). |
| NFR-03 | Akses ke hasil report SHOULD dibatasi (data bea cukai & pajak bersifat sensitif) — minimal role-based access, TBD siapa yang boleh lihat mismatch `HIGH` severity vs summary saja. |
| NFR-04 | Sistem SHOULD logging setiap kali `_extraction_warnings` terisi (indikasi OCR gagal baca field wajib), agar bisa dipantau kualitas OCR dari waktu ke waktu. |

---

## 12. Edge Case & Business Rule Eksplisit

### 12.1 OCR confidence / field gagal terbaca
Draft v1 tidak membahas ini sama sekali. **MUST**: jika OCR engine menyediakan confidence score, extractor MUST meneruskan skor tersebut per field; jika confidence di bawah threshold (TBD, sarankan 70%), field tersebut MUST dianggap "tidak dapat diverifikasi" bukan otomatis "mismatch" — beri status terpisah `UNVERIFIED` agar tidak salah tandai sebagai kesalahan dokumen padahal cuma OCR yang kurang jelas.

### 12.2 Urutan eksekusi Level 1→2→3
**MUST** berurutan, tidak paralel murni, karena Level 2 & 3 butuh tahu dokumen mana yang LOLOS Level 1 (dokumen `UNRECOGNIZED_DOCUMENT` wajib dikecualikan dari agregasi, lihat REQ-L1-07).

### 12.3 Duplikasi part number lintas invoice
Sudah dijawab eksplisit di REQ-L3-02 — SUM qty & value sebelum join ke PIB.

### 12.4 PIB revisi/pembetulan
**Belum ditentukan di versi ini — open question**, lihat §14. Sarannya: setiap `pib_no` + `tanggal_pendaftaran` dianggap versi unik, revisi = record baru, bukan overwrite.

### 12.5 Mismatch yang ditemukan — siapa yang menindaklanjuti?
**Out of scope untuk matching engine** — sistem ini hanya MELAPORKAN, tidak MENGUBAH data. Alur review manual (siapa approve, siapa reject) adalah keputusan bisnis di luar PRD ini, perlu dijawab terpisah (§14).

---

## 13. Acceptance Criteria / Definition of Done

- [ ] AC-01: Menjalankan `run_matching()` terhadap data contoh `NOPEN_10617` MUST menghasilkan report dengan `overall_status: PARTIAL_MATCH`.
- [ ] AC-02: Report tersebut MUST mengandung entri mismatch HS code untuk part `R1210020` persis seperti golden test di §7.3.
- [ ] AC-03: `level_2_aggregate` untuk field `berat_bersih_kg` MUST `status: MATCH` (karena `17006.745` = `17006.745` di data contoh).
- [ ] AC-04: Mengubah nilai di file config toleransi MUST mengubah hasil klasifikasi match/mismatch tanpa mengubah kode matcher manapun.
- [ ] AC-05: Jika salah satu Invoice di-upload dengan `invoice_no` yang tidak terdaftar di `referensi_dokumen` PIB, report MUST `overall_status: FAILED` dan dokumen tsb `status: UNRECOGNIZED_DOCUMENT`.
- [ ] AC-06: Kasus 1 PIB dengan 2 invoice yang punya part number sama di keduanya MUST menghasilkan qty gabungan (SUM), bukan dua entri terpisah yang salah dibandingkan satu-satu.

---

## 14. Open Questions (harus dijawab sebelum/selama development)

1. Threshold confidence OCR untuk status `UNVERIFIED` — berapa persen?
2. Alur review manual untuk mismatch `HIGH` — perlu approval workflow di sistem ini, atau cukup report + notifikasi ke tim lain?
3. PIB revisi — apakah perlu versioning eksplisit di schema (`revision_no`)?
4. Role-based access ke report — siapa saja yang boleh lihat detail mismatch vs summary saja?
5. Threshold fuzzy match 85% untuk deskripsi — final atau masih perlu di-tune dengan data lebih banyak?

---

*Catatan: dokumen ini menggantikan draft v1 (§1–§7 versi awal) sebagai acuan development. Semua contoh angka yang tercantum bersumber dari dokumen referensi `NOPEN_10617` (TVS project) dan dijadikan golden test case, bukan sekadar ilustrasi.*