# TVS Middleware - Document Processing & OCR Matching Platform

**TVS Middleware** adalah platform aplikasi web modern yang dibangun menggunakan **Next.js (App Router)** dan **Prisma ORM** untuk memproses, mengategorikan, serta mencocokkan dokumen impor/ekspor (seperti PIB, PIB Lanjutan, Invoice, Packing List, Rekap Document, Master BL, dan BL) secara otomatis melalui integrasi **Nanonets OCR Asynchronous API**.

---

## 🚀 Fitur Utama

- **Multi-File Batch Upload**: Mengunggah berkas tunggal atau banyak berkas (*multi-file*) secara bersamaan berdasarkan 7 kategori dokumen resmi.
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

## ⚙️ Panduan Instalasi & Pengaturan

### 1. Prasyarat
- Node.js versi 18.x atau lebih baru
- MySQL Server (misal: MySQL Server di port 3306 / 3308)

### 2. Kloning Repositori & Install Dependensi
```bash
git clone https://github.com/Muhamad-SazidanA/TVS-Middleware.git
cd TVS-Middleware
npm install
```

### 3. Konfigurasi Environment Variable (`.env`)
Buat atau perbarui berkas `.env` di direktori utama:
```env
DATABASE_URL="mysql://root:password@localhost:3308/middleware"

# Nanonets API Configuration
API_KEY="244bd61f-32b0-11ef-94f2-cec13431d72d"

# Model IDs
MODEL_PIB="f058f626-44d2-4b98-b529-bf1e521801aa"
MODEL_PIB_LANJUTAN="422f529a-d099-470a-a194-8397f7c25056"
MODEL_INVOICE="7e9e801b-9f93-41bb-9426-ed884c98a58a"
MODEL_PACKING_LIST="8901ebc3-eb95-46bd-89b5-901121d51111"
MODEL_REKAP_DOCUMENT="3a2072e9-4e00-47b1-91a6-896898b04938"
MODEL_MASTER_BL="3dcf7ab7-53be-4311-b0db-bca5ca1ceae8"
MODEL_BL="bb797fef-0e0a-40a2-a9f8-b5efc1c9ca9a"
```

### 4. Sinkronisasi Database
```bash
npx prisma generate
npx prisma db push
```

### 5. Menjalankan Server Pengembang
```bash
npm run dev
```
Buka browser dan akses [http://localhost:3000](http://localhost:3000).

---

## 📄 Lisensi & Hak Cipta
© 2025 TVS Middleware Project. All rights reserved.
