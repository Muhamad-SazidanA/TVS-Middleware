# Middleware System - Document Processing & OCR Matching Platform

**Middleware System** adalah platform aplikasi web modern yang dibangun menggunakan **Next.js (App Router)** dan **Prisma ORM** untuk memproses, mengategorikan, serta mencocokkan dokumen secara otomatis melalui integrasi **Nanonets OCR Asynchronous API**.

---

## 🚀 Fitur Utama

- **Multi-File Batch Upload**: Mengunggah berkas tunggal atau banyak berkas (*multi-file*) secara bersamaan berdasarkan 7 kategori dokumen resmi (PIB, PIB Lanjutan, Invoice, Packing List, Rekap Document, Master BL, dan BL).
- **Integrasi Asynchronous Nanonets OCR**: Pengiriman berkas secara paralel menggunakan API Asynchronous (`LabelFile?async=true`) untuk efisiensi pemrosesan tingkat tinggi.
- **Sistem Pelacakan Batch Otomatis**:
  - Format **Batch ID** otomatis berurutan (contoh: `0001`, `0002`, `0003`, dst).
  - Manajemen status lifecycle otomatis (`PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `SUCCESS` / `FAILED`).
- **Database Schema Terstruktur**:
  - **Tabel `batches`**: Menyimpan ID Batch, total berkas, status pemrosesan, dan timestamp.
  - **Tabel `detail_batches`**: Menyimpan ID, relasi Batch ID, kategori dokumen (*fileType*), ID unik Nanonets (`fileId` / `request_file_id`), dan payload ekstraksi data JSON (`isi`).
- **Dukungan Callback Webhook**: Siap menerima callback real-time dari Nanonets (`POST /api/webhooks/nanonets`) untuk otomatisasi populasi data ekstraksi OCR.
- **Antarmuka Premium & Clean**: Desain UI modern dengan sidebar navigasi responsif, indikator status real-time, serta **Navy Blue Sleek Scrollbar**.

---

## 🛠️ Teknologi yang Digunakan

- **Core & Framework**: [Next.js 15](https://nextjs.org/) (App Router, Turbopack), React 19, TypeScript
- **Database & ORM**: MySQL, [Prisma ORM 6](https://www.prisma.io/)
- **Styling & UI**: Tailwind CSS 4, Lucide React Icons
- **OCR Engine**: [Nanonets API v2](https://nanonets.com/) (Asynchronous Model Labeling)

---

## 🗄️ Skema Database (Prisma Schema)

```prisma
model Batch {
    id        String        @id
    totalFile Int           @default(0)
    status    String        @default("PENDING")
    createdAt DateTime      @default(now())
    updatedAt DateTime      @updatedAt
    details   DetailBatch[]

    @@map("batches")
}

model DetailBatch {
    id        Int      @id @default(autoincrement())
    batchId   String
    fileType  String
    fileId    String
    isi       String?  @db.Text
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    batch Batch @relation(fields: [batchId], references: [id], onDelete: Cascade)

    @@map("detail_batches")
}
```

---

## 🔒 Konfigurasi Environment Variable (`.env`)

> ⚠️ **PENTING (KEAMANAN)**: Berkas `.env` berisi Kunci API rahasia dan kredensial basis data. **JANGAN PERNAH** memublikasikan berkas `.env` asli atau kunci API ke repositori publik/GitHub! Berkas `.env` sudah secara otomatis masuk ke dalam `.gitignore`.

Gunakan berkas `.env.example` sebagai acuan saat membuat `.env` baru pada lingkungan lokal/production:

```env
# Koneksi Database MySQL
DATABASE_URL="mysql://username:password@localhost:3306/nama_database"

# Kredensial Nanonets API Key (Secret Key)
API_KEY="your_nanonets_api_key_here"

# Nanonets Model IDs (Disesuaikan dengan ID Model di Nanonets Console)
MODEL_PIB="your_pib_model_id_here"
MODEL_PIB_LANJUTAN="your_pib_lanjutan_model_id_here"
MODEL_INVOICE="your_invoice_model_id_here"
MODEL_PACKING_LIST="your_packing_list_model_id_here"
MODEL_REKAP_DOCUMENT="your_rekap_document_model_id_here"
MODEL_MASTER_BL="your_master_bl_model_id_here"
MODEL_BL="your_bl_model_id_here"
```

### Penjelasan Variabel:
- **`DATABASE_URL`**: String koneksi MySQL lokal/server basis data Anda.
- **`API_KEY`**: API Key rahasia yang diperoleh dari dashboard Nanonets.
- **`MODEL_*`**: ID unik Model OCR di Nanonets untuk masing-masing kategori dokumen.

---

## ⚙️ Panduan Instalasi & Pengaturan

### 1. Prasyarat
- Node.js versi 18.x atau lebih baru
- MySQL Server

### 2. Kloning Repositori & Install Dependensi
```bash
git clone https://github.com/Muhamad-SazidanA/TVS-Middleware.git
cd TVS-Middleware
npm install
```

### 3. Buat Berkas `.env`
Salin `.env.example` ke `.env` lalu isi dengan nilai variabel lingkungan Anda:
```bash
cp .env.example .env
```

### 4. Sinkronisasi Skema Database
```bash
npx prisma generate
npx prisma db push
```

### 5. Menjalankan Server Pengembang
```bash
npm run dev
```
Akses aplikasi melalui browser di [http://localhost:3000](http://localhost:3000).

---

## 📄 Lisensi & Hak Cipta
© 2025 Middleware System Project. All rights reserved.
