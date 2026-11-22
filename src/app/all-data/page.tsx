"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Database,
  Search,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  FileText,
  ChevronDown,
  X,
} from "lucide-react";
import MatchingDetailView from "../matching/_components/MatchingDetailView";

interface BatchItem {
  id: string;
  no: number;
  nama: string;
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
      const matchSub = b.subtext.toLowerCase().includes(q);
      const matchCreator = (b.createdBy?.name || b.createdBy?.email || "").toLowerCase().includes(q);
      return matchId || matchNama || matchSub || matchCreator;
    });
  }, [batches, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* 1. Header Bar */}
      <header className="px-6 py-3.5 bg-white border-b border-slate-200 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80">
              <Database className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">
              All Data (Dokumen Disetujui)
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60 uppercase">
              Approved
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Arsip terpusat seluruh dokumen impor yang telah disetujui lintas operator
          </p>
        </div>

        {/* Actions & Export Dropdown */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => fetchApprovedBatches()}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-slate-700" : ""}`} />
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportOpen(!isExportOpen)}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? "Mengunduh..." : "Export Excel"}</span>
              <ChevronDown className="w-3 h-3 text-slate-300" />
            </button>

            {isExportOpen && (
              <div
                className="absolute right-0 mt-1 w-60 bg-white rounded-lg shadow-md border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                onMouseLeave={() => setIsExportOpen(false)}
              >
                <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Format Export
                </div>
                <button
                  type="button"
                  onClick={() => handleExport("clean")}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex flex-col gap-0.5 cursor-pointer text-xs"
                >
                  <span className="font-medium text-slate-800">Excel Bersih (Data Saja)</span>
                  <span className="text-[10px] text-slate-400">Ringkasan data dokumen tanpa log</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("with_action_log")}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex flex-col gap-0.5 cursor-pointer text-xs border-t border-slate-50"
                >
                  <span className="font-medium text-slate-800">Excel Lengkap (+ Log Action)</span>
                  <span className="text-[10px] text-slate-400">Lengkap dengan tab riwayat revisi</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Filter & Search Toolbar */}
      <div className="px-6 py-3 bg-white/70 border-b border-slate-200/80 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Batch ID, Importir, Penginput..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
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
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-500 font-medium">Dari:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-slate-800 focus:outline-none"
            />
            <span className="text-slate-300">|</span>
            <span className="text-[11px] text-slate-500 font-medium">Sampai:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-slate-800 focus:outline-none"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="ml-1 p-0.5 text-slate-400 hover:text-slate-600"
                title="Hapus filter tanggal"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Counter */}
        <div className="text-xs text-slate-500">
          Menampilkan <span className="font-bold text-slate-800">{displayedBatches.length}</span> dokumen disetujui
        </div>
      </div>

      {/* 3. Main Data Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-3">Batch ID</th>
                <th className="py-3 px-3">Identitas Dokumen</th>
                <th className="py-3 px-3">Dokumen Terlampir</th>
                <th className="py-3 px-3">Diinput Oleh</th>
                <th className="py-3 px-3">Disetujui Pada</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-700 mb-2" />
                    <span>Memuat data arsip disetujui...</span>
                  </td>
                </tr>
              ) : displayedBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">Tidak ada dokumen approved yang cocok.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Coba sesuaikan kata kunci pencarian atau rentang tanggal filter Anda.
                    </p>
                  </td>
                </tr>
              ) : (
                displayedBatches.map((item, idx) => {
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedBatchId(item.id)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-3 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-medium text-slate-700 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded text-[10.5px]">
                          #{item.id}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <div className="font-semibold text-slate-800 truncate" title={item.nama}>
                          {item.nama}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {item.subtext}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap items-center gap-1 text-[9.5px]">
                          {["Invoice", "Packing_List", "Bill_of_Lading", "AK", "WL", "MS"].map((code) => {
                            const shortCode = code === "Packing_List" ? "PL" : code === "Bill_of_Lading" ? "BL" : code;
                            const st = item.docStatuses?.[code]?.status || "-";
                            const isPresent = st !== "-";
                            return (
                              <span
                                key={code}
                                className={`px-1.5 py-0.2 rounded font-medium border ${
                                  isPresent
                                    ? "bg-slate-100 text-slate-700 border-slate-200"
                                    : "bg-slate-50 text-slate-300 border-slate-100"
                                }`}
                                title={`${shortCode}: ${st}`}
                              >
                                {shortCode}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 min-w-[140px]">
                        <div className="font-medium text-slate-700 text-xs">
                          {item.createdBy?.name || "User Staff"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.createdBy?.email || "-"}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-xs">
                        <div>{formatDateDisplay(item.approvedAt || item.createdAt)}</div>
                        {item.approvedBy && (
                          <div className="text-[10px] text-slate-400">
                            Oleh: {item.approvedBy.name || "Admin"}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 uppercase">
                          <CheckCircle className="w-3 h-3 text-slate-500" />
                          <span>Approved</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBatchId(item.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[11px] font-medium text-slate-600 transition-colors cursor-pointer hover:text-slate-900"
                        >
                          <span>Buka Detail</span>
                          <ExternalLink className="w-3 h-3" />
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
