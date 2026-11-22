"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import BatchLogModal from "./_components/BatchLogModal";

interface BatchItem {
  id: number | string;
  no?: number;
  nama: string;
  subtext?: string;
  totalFile: number;
  status: "Matching" | "Mismatching" | "Proses";
  createdAt?: string;
  updatedAt?: string;
  details?: Array<{
    id?: number;
    fileType: string;
    fileId: string;
    isi?: string;
  }>;
}

export default function OperationsDashboardPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLogBatch, setSelectedLogBatch] = useState<{
    id: string;
    nama: string;
    status: string;
  } | null>(null);

  const fetchBatches = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/batches", { cache: "no-store" });
      const data = await res.json();
      if (data?.batches && Array.isArray(data.batches)) {
        setBatches(data.batches);
      } else if (Array.isArray(data)) {
        setBatches(data);
      }
    } catch (err) {
      console.warn("Gagal mengambil data batch:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Operational metrics
  const totalBatches = batches.length;
  const matchingCount = batches.filter((b) => b.status === "Matching").length;
  const mismatchingCount = batches.filter((b) => b.status === "Mismatching").length;
  const prosesCount = batches.filter((b) => b.status === "Proses").length;
  const totalFiles = batches.reduce((acc, b) => acc + (b.totalFile || (b.details || []).length || 0), 0);

  const recentBatches = [...batches]
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, 8);

  const uscDocs = [
    { code: "PIB", name: "Pemberitahuan Impor Barang", desc: "Dokumen acuan utama pabean", color: "bg-blue-50 text-blue-900 border-blue-200" },
    { code: "CI", name: "Commercial Invoice", desc: "Valuasi komersial & harga satuan", color: "bg-indigo-50 text-indigo-900 border-indigo-200" },
    { code: "PL", name: "Packing List", desc: "Daftar kemasan, coil & berat bersih", color: "bg-teal-50 text-teal-900 border-teal-200" },
    { code: "BL", name: "Bill of Lading", desc: "Manifest muatan, kontainer & pelayaran", color: "bg-cyan-50 text-cyan-900 border-cyan-200" },
    { code: "AK", name: "Form AK (COO)", desc: "Surat Keterangan Asal preferensial", color: "bg-amber-50 text-amber-900 border-amber-200" },
    { code: "WL", name: "Weight List", desc: "Rincian spesifik timbangan tiap coil", color: "bg-emerald-50 text-emerald-900 border-emerald-200" },
    { code: "MS", name: "Mill Test Certificate", desc: "Sertifikasi kimia & mekanik pabrik baja", color: "bg-violet-50 text-violet-900 border-violet-200" },
  ];

  return (
    <div className="h-full overflow-y-auto px-6 sm:px-8 py-8 max-w-7xl mx-auto w-full space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Operational Middleware System
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            PT. UNITED STEEL CENTER INDONESIA
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Pusat otomasi evaluasi keselarasan dokumen pabean baja import. Mengintegrasikan ekstraksi OCR AI 7 dokumen pabean, Data Actions Pipeline, dan Canonical Matching Engine.
          </p>
        </div>

        {/* Quick action buttons in header */}
        <div className="relative z-10 flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-white/10">
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-blue-950 hover:bg-slate-100 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4 text-blue-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Dokumen Batch
          </Link>

          <Link
            href="/matching"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-900/60 hover:bg-blue-900 text-white border border-white/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Tabel Matching & Evaluasi
          </Link>

          <Link
            href="/manage-system"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Konfigurasi Sistem
          </Link>
        </div>
      </div>

      {/* 2. Metric KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Batch</span>
            <span className="p-1.5 bg-blue-50 text-blue-900 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{isLoading ? "..." : totalBatches}</div>
          <div className="mt-1 text-[11px] text-slate-500">Batch pengiriman baja</div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200/80 p-4 shadow-2xs bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Matching</span>
            <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-900">{isLoading ? "..." : matchingCount}</div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium">
            {totalBatches > 0 ? `${Math.round((matchingCount / totalBatches) * 100)}% dokumen selaras` : "0%"}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-rose-200/80 p-4 shadow-2xs bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Mismatching</span>
            <span className="p-1.5 bg-rose-100 text-rose-800 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-900">{isLoading ? "..." : mismatchingCount}</div>
          <div className="mt-1 text-[11px] text-rose-700 font-medium">Perlu verifikasi fisik/data</div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-2xs bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Dalam Proses</span>
            <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
              <svg className="w-4 h-4 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-900">{isLoading ? "..." : prosesCount}</div>
          <div className="mt-1 text-[11px] text-amber-700 font-medium">Menunggu file / OCR</div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total File</span>
            <span className="p-1.5 bg-slate-100 text-slate-800 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{isLoading ? "..." : totalFiles}</div>
          <div className="mt-1 text-[11px] text-slate-500">Dokumen terunggah</div>
        </div>
      </div>

      {/* 3. USC 7 Documents Inventory */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-blue-950">7 Dokumen Resmi Pabean PT. UNITED STEEL CENTER INDONESIA</h2>
            <p className="text-xs text-slate-500 mt-0.5">Struktur dokumen wajib cross-check keselarasan data impor pabean</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            Full 7-Document Spec
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {uscDocs.map((doc) => (
            <div key={doc.code} className={`p-3 rounded-lg border ${doc.color} space-y-1`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs tracking-wide">{doc.code}</span>
                <span className="text-[10px] font-bold uppercase opacity-75">Resmi</span>
              </div>
              <div className="text-xs font-semibold">{doc.name}</div>
              <div className="text-[11px] opacity-80 leading-snug">{doc.desc}</div>
            </div>
          ))}
          <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 flex flex-col justify-center items-center text-center space-y-1">
            <span className="text-xs font-bold text-blue-950">Canonical Matching</span>
            <span className="text-[11px] text-slate-500">Evaluasi Header & Line Item secara otomatis dan serentak</span>
          </div>
        </div>
      </div>

      {/* 4. Recent Batches Table with BatchLogModal */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-blue-950">Aktivitas Batch Terbaru</h2>
            <p className="text-xs text-slate-500 mt-0.5">Daftar batch dokumen impor yang diproses oleh sistem</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchBatches}
              disabled={isLoading}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Segarkan data"
            >
              <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <Link
              href="/matching"
              className="text-xs font-bold text-blue-950 hover:underline inline-flex items-center gap-1"
            >
              Lihat Seluruh Batch ({batches.length}) →
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider bg-slate-50/50">
                <th className="py-2.5 px-3 font-semibold">ID Batch</th>
                <th className="py-2.5 px-3 font-semibold">Informasi Importir / PIB</th>
                <th className="py-2.5 px-3 font-semibold">Total File</th>
                <th className="py-2.5 px-3 font-semibold">Status Matching</th>
                <th className="py-2.5 px-3 font-semibold">Tanggal Pembuatan</th>
                <th className="py-2.5 px-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Memuat daftar batch...
                  </td>
                </tr>
              ) : recentBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada batch dokumen. Silakan unggah dokumen di menu Upload.
                  </td>
                </tr>
              ) : (
                recentBatches.map((batch) => {
                  const statusBg =
                    batch.status === "Matching"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : batch.status === "Mismatching"
                      ? "bg-rose-50 text-rose-800 border-rose-200"
                      : "bg-amber-50 text-amber-800 border-amber-200";

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-800">
                        #{batch.id}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{batch.nama}</div>
                        {batch.subtext && <div className="text-[11px] text-slate-500">{batch.subtext}</div>}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-600">
                        {batch.totalFile || (batch.details || []).length || 0} File
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBg}`}>
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              batch.status === "Matching"
                                ? "bg-emerald-500"
                                : batch.status === "Mismatching"
                                ? "bg-rose-500"
                                : "bg-amber-500 animate-pulse"
                            }`}
                          ></span>
                          {batch.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {batch.createdAt
                          ? new Date(batch.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() =>
                              setSelectedLogBatch({
                                id: String(batch.id),
                                nama: batch.nama,
                                status: batch.status,
                              })
                            }
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Buka Log Pipeline & Audit"
                          >
                            Log Audit
                          </button>
                          <Link
                            href={`/matching?batchId=${batch.id}`}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg transition-colors inline-block"
                          >
                            Detail
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Batch Log Modal */}
      {selectedLogBatch && (
        <BatchLogModal
          batchId={selectedLogBatch.id}
          batchTitle={selectedLogBatch.nama}
          batchStatus={selectedLogBatch.status}
          isOpen={Boolean(selectedLogBatch)}
          onClose={() => setSelectedLogBatch(null)}
        />
      )}
    </div>
  );
}
