"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Database,
  Search,
  Calendar,
  Download,
  RefreshCw,
  ExternalLink,
  FileText,
  ChevronDown,
  X,
  Copy,
  Check,
} from "lucide-react";
import MatchingDetailView from "../matching/_components/MatchingDetailView";

interface BatchItem {
  id: string;
  no: number;
  nama: string;
  noPengajuan?: string | null;
  subtext: string;
  totalFile: number;
  status: string;
  rawStatus: string;
  createdAt: string;
  approvedAt?: string | null;
  createdBy?: { id: string; name?: string; email?: string } | null;
  approvedBy?: { id: string; name?: string; email?: string } | null;
  docStatuses?: Record<string, { status: "Match" | "Mismatch" | "Proses" | "-" }>;
}

export default function AllDataPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Export dropdown state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Detail Modal state
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Copy indicator state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const fetchApprovedBatches = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("scope", "all_data");
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/batches?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Gagal memuat data arsip.");
      }
      const data = await res.json();
      setBatches(data.batches || []);
    } catch (err) {
      console.error("Fetch All Data error:", err);
      setError(err instanceof Error ? err.message : "Terjadi kendala saat memuat data.");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, searchQuery]);

  useEffect(() => {
    fetchApprovedBatches();
  }, [fetchApprovedBatches]);

  const handleExport = (mode: "clean" | "with_action_log") => {
    setIsExportOpen(false);
    setIsExporting(true);
    const params = new URLSearchParams();
    params.set("scope", "all_data");
    params.set("mode", mode);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (searchQuery) params.set("search", searchQuery);

    const exportUrl = `/api/export/excel?${params.toString()}`;
    window.location.href = exportUrl;
    setTimeout(() => setIsExporting(false), 2000);
  };

  const formatDateDisplay = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(dateStr);
    }
  };

  // Client-side search refine
  const displayedBatches = useMemo(() => {
    return batches.filter((b) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const matchId = b.id.toLowerCase().includes(q);
      const matchNama = b.nama.toLowerCase().includes(q);
      const matchAju = (b.noPengajuan || "").toLowerCase().includes(q);
      const matchSub = b.subtext.toLowerCase().includes(q);
      const matchCreator = (b.createdBy?.name || b.createdBy?.email || "").toLowerCase().includes(q);
      const matchApprover = (b.approvedBy?.name || b.approvedBy?.email || "").toLowerCase().includes(q);
      return matchId || matchNama || matchAju || matchSub || matchCreator || matchApprover;
    });
  }, [batches, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* 1. Header Bar */}
      <header className="px-5 sm:px-6 py-3.5 bg-white border-b border-slate-200/90 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
              <Database className="w-4 h-4" />
            </div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              All Data (Dokumen Disetujui)
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide flex items-center gap-1 shadow-2xs">
              <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
              <span>Approved</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Arsip terpusat seluruh dokumen impor yang telah disetujui lintas operator
          </p>
        </div>

        {/* Actions & Export Dropdown */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => fetchApprovedBatches()}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs hover:text-slate-900"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-slate-900" : ""}`} />
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportOpen(!isExportOpen)}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? "Mengunduh..." : "Export Excel"}</span>
              <ChevronDown className="w-3 h-3 text-slate-300" />
            </button>

            {isExportOpen && (
              <div
                className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                onMouseLeave={() => setIsExportOpen(false)}
              >
                <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Pilihan Format Export
                </div>
                <button
                  type="button"
                  onClick={() => handleExport("clean")}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex flex-col gap-0.5 cursor-pointer text-xs"
                >
                  <span className="font-semibold text-slate-800">Excel Bersih (Data Saja)</span>
                  <span className="text-[10px] text-slate-400">Ringkasan tabel data dokumen impor</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("with_action_log")}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex flex-col gap-0.5 cursor-pointer text-xs border-t border-slate-50"
                >
                  <span className="font-semibold text-slate-800">Excel Lengkap (+ Log Action)</span>
                  <span className="text-[10px] text-slate-400">Lengkap dengan lembar audit & riwayat revisi</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Filter & Search Toolbar (Matching style) */}
      <div className="px-5 sm:px-6 py-3 bg-white/80 backdrop-blur-xs border-b border-slate-200/80 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. Pengajuan, Importir, Penginput..."
              className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium">Dari:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-slate-800 focus:outline-none cursor-pointer"
            />
            <span className="text-slate-300">|</span>
            <span className="text-[11px] text-slate-500 font-medium">Sampai:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-slate-800 focus:outline-none cursor-pointer"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="ml-1 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Hapus filter tanggal"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Counter */}
        <div className="text-xs text-slate-500 font-medium">
          Menampilkan <span className="font-bold text-slate-900">{displayedBatches.length}</span> dokumen disetujui
        </div>
      </div>

      {/* 3. Main Data Table (Clean, unified with Matching Option B design) */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-2 text-center w-14">Preview</th>
                <th className="py-3 px-4 min-w-[240px]">No. Pengajuan</th>
                <th className="py-3 px-3">Dokumen Terlampir</th>
                <th className="py-3 px-3">Diinput Oleh</th>
                <th className="py-3 px-3">Disetujui Pada</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-700 mb-2" />
                    <span className="font-medium text-xs">Memuat data arsip disetujui...</span>
                  </td>
                </tr>
              ) : displayedBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700 text-sm">Tidak ada dokumen disetujui yang cocok</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {error || "Coba sesuaikan kata kunci pencarian atau rentang tanggal filter Anda."}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedBatches.map((item, idx) => {
                  const displayTitle = item.noPengajuan || item.nama || `Batch #${item.id}`;
                  const displaySubtitle = `Batch #${item.id}`;
                  const isCopied = copiedId === item.id;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedBatchId(item.id)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group select-none"
                    >
                      {/* 1. No */}
                      <td className="py-3 px-3 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>

                      {/* 2. Miniature PDF Thumbnail (like Matching) */}
                      <td className="py-2.5 px-2 text-center">
                        <div className="w-7 h-9 bg-white border border-slate-200 rounded-md shadow-2xs p-1 mx-auto flex flex-col justify-between shrink-0 group-hover:border-slate-300 transition-colors">
                          <div className="space-y-0.5">
                            <div className="h-0.5 bg-slate-300 rounded w-full" />
                            <div className="h-0.5 bg-slate-200 rounded w-4/5" />
                            <div className="h-0.5 bg-slate-200 rounded w-3/5" />
                          </div>
                          <div className="flex justify-end">
                            <span className="text-[6.5px] font-extrabold text-rose-600 bg-rose-50 px-0.5 rounded leading-none border border-rose-100">
                              PDF
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. No. Pengajuan (Option B: Line 1 = Nomor Aju + Copy Button, Line 2 = Batch ID) */}
                      <td className="py-3 px-4 min-w-[240px]">
                        <div className="flex flex-col justify-center">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800 text-xs">
                            <span className="font-semibold text-slate-900 font-mono tracking-tight">
                              {displayTitle}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopy(displayTitle, item.id, e)}
                              className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0"
                              title="Salin no. pengajuan"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {displaySubtitle}
                          </div>
                        </div>
                      </td>

                      {/* 4. Dokumen Terlampir */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {(() => {
                            const docEntries = Object.entries(item.docStatuses || {});
                            const docsToShow =
                              docEntries.length > 0
                                ? docEntries.map(([code]) => (code === "Bill_of_Lading" ? "BL" : code))
                                : ["Invoice", "BL"];

                            return docsToShow.map((code) => (
                              <span
                                key={code}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs"
                                title={`${code}: Match (Telah diverifikasi)`}
                              >
                                <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[2.5]" />
                                <span>{code}</span>
                              </span>
                            ));
                          })()}
                        </div>
                      </td>

                      {/* 5. Diinput Oleh */}
                      <td className="py-2.5 px-3 min-w-[130px]">
                        <div className="font-medium text-slate-800 text-xs">
                          {item.createdBy?.name || "User Staff"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[150px]">
                          {item.createdBy?.email || "-"}
                        </div>
                      </td>

                      {/* 6. Disetujui Pada */}
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-xs">
                        <div className="font-medium text-slate-800">
                          {formatDateDisplay(item.approvedAt || item.createdAt)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Oleh: {item.approvedBy?.name || "Admin Approver"}
                        </div>
                      </td>

                      {/* 7. Status (Vibrant Emerald Approved Badge like Matching) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                          <span>Approved</span>
                        </span>
                      </td>

                      {/* 8. Aksi */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBatchId(item.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-2xs"
                        >
                          <span>Buka Detail</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Matching Detail View Modal */}
      {selectedBatchId && (
        <MatchingDetailView
          batchId={selectedBatchId}
          onClose={() => setSelectedBatchId(null)}
          onStatusUpdate={() => fetchApprovedBatches()}
        />
      )}
    </div>
  );
}
