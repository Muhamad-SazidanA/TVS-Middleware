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
  Archive,
  Minus,
  RotateCcw,
  Undo2,
} from "lucide-react";
import ToastNotification, { useToastState } from "@/app/_components/ui/ToastNotification";
import ConfirmDialog from "@/app/_components/ui/ConfirmDialog";
import MatchingDetailView from "../matching/_components/MatchingDetailView";
import type { BatchRollbackTarget } from "~/utils/workflowStatus";

interface BatchItem {
  id: string;
  no: number;
  nama: string;
  noPengajuan?: string | null;
  subtext: string;
  totalFile: number;
  status: string;
  workflowStatus?: "Approved" | "Exported" | string;
  rawStatus: string;
  createdAt: string;
  approvedAt?: string | null;
  exportedAt?: string | null;
  createdBy?: { id: string; name?: string; email?: string } | null;
  approvedBy?: { id: string; name?: string; email?: string } | null;
  docStatuses?: Record<string, { status: "Match" | "Mismatch" | "Proses" | "-" }>;
}

function parseFilenameFromHeader(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = /filename="?([^";\n]+)"?/i.exec(disposition);
  return match?.[1]?.trim() || fallback;
}

export default function AllDataPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Archive View: default shows Approved queue; optional Exported archive keeps DB queue clean
  const [archiveView, setArchiveView] = useState<"approved" | "exported">("approved");

  // Selection state for batch export
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Export dropdown state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Detail Modal state
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Rollback modal state (supports single row or bulk selected rows)
  const [rollbackModal, setRollbackModal] = useState<{
    isOpen: boolean;
    batchIds: string[];
    target: BatchRollbackTarget;
    label: string;
    ownerName?: string;
  } | null>(null);
  const [rollbackNote, setRollbackNote] = useState("");
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Copy & toast state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToastState();

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const fetchAllDataBatches = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("scope", "all_data");
      params.set("status", archiveView === "exported" ? "EXPORTED" : "APPROVED");
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/batches?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Gagal memuat data All Data.");
      }
      const data = await res.json();
      const nextBatches: BatchItem[] = data.batches || [];
      setBatches(nextBatches);
      setSelectedIds((prev) =>
        prev.filter((id) => nextBatches.some((item) => item.id === id))
      );
    } catch (err) {
      console.error("Fetch All Data error:", err);
      setError(err instanceof Error ? err.message : "Terjadi kendala saat memuat data.");
    } finally {
      setIsLoading(false);
    }
  }, [archiveView, startDate, endDate, searchQuery]);

  useEffect(() => {
    fetchAllDataBatches();
  }, [fetchAllDataBatches]);

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

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedVisibleIds = useMemo(
    () => displayedBatches.filter((b) => selectedSet.has(b.id)).map((b) => b.id),
    [displayedBatches, selectedSet]
  );

  const isAllVisibleSelected =
    displayedBatches.length > 0 && selectedVisibleIds.length === displayedBatches.length;
  const isSomeVisibleSelected =
    selectedVisibleIds.length > 0 && selectedVisibleIds.length < displayedBatches.length;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      const visibleSet = new Set(displayedBatches.map((b) => b.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set(selectedIds);
      for (const b of displayedBatches) {
        merged.add(b.id);
      }
      setSelectedIds(Array.from(merged));
    }
  };

  const toggleSelectRow = (batchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(batchId)
        ? prev.filter((id) => id !== batchId)
        : [...prev, batchId]
    );
  };

  const executeRollback = async () => {
    if (!rollbackModal || rollbackModal.batchIds.length === 0 || isRollingBack) return;
    setIsRollingBack(true);
    try {
      const res = await fetch("/api/batches/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchIds: rollbackModal.batchIds,
          target: rollbackModal.target,
          note: rollbackNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengembalikan status dokumen.");
      }

      const revertedSet = new Set(rollbackModal.batchIds);
      setSelectedIds((prev) => prev.filter((id) => !revertedSet.has(id)));
      setRollbackModal(null);
      setRollbackNote("");
      showToast(data.message || "Status dokumen berhasil dikembalikan.", "success");
      await fetchAllDataBatches();
    } catch (err) {
      console.error("Rollback error:", err);
      showToast(
        err instanceof Error ? err.message : "Gagal mengembalikan status dokumen.",
        "error"
      );
    } finally {
      setIsRollingBack(false);
    }
  };

  const openRollbackConfirm = (params: {
    batchIds: string[];
    target: BatchRollbackTarget;
    label: string;
    ownerName?: string;
  }) => {
    setRollbackNote("");
    setRollbackModal({
      isOpen: true,
      ...params,
    });
  };

  const handleExport = async (mode: "clean" | "with_action_log") => {
    setIsExportOpen(false);
    const targetIds =
      selectedVisibleIds.length > 0
        ? selectedVisibleIds
        : displayedBatches.map((b) => b.id);

    if (targetIds.length === 0) {
      showToast("Tidak ada dokumen pada daftar untuk di-export.", "warning");
      return;
    }

    setIsExporting(true);
    const shouldMarkExported = archiveView === "approved";

    try {
      const res = await fetch("/api/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          scope: "all_data",
          status: archiveView === "exported" ? "EXPORTED" : "APPROVED",
          batchIds: targetIds,
          markExported: shouldMarkExported,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: searchQuery || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal mengexport file Excel.");
      }

      const blob = await res.blob();
      const filename = parseFilenameFromHeader(
        res.headers.get("Content-Disposition"),
        `DocMatch_AllData_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      const exportedHeaderCount = Number(res.headers.get("X-Exported-Count") || "0");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (shouldMarkExported) {
        const count = exportedHeaderCount > 0 ? exportedHeaderCount : targetIds.length;
        showToast(
          `${count} dokumen berhasil di-export ke Excel & status otomatis berubah menjadi Exported.`,
          "success"
        );
        setSelectedIds([]);
        await fetchAllDataBatches();
      } else {
        showToast(
          `File arsip Excel untuk ${targetIds.length} dokumen berhasil diunduh.`,
          "success"
        );
      }
    } catch (err) {
      console.error("Export Excel failed:", err);
      showToast(
        err instanceof Error ? err.message : "Gagal mengexport file Excel.",
        "error"
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* 1. Header Bar */}
      <header className="px-5 sm:px-6 py-3.5 bg-white border-b border-slate-200/90 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
              <Database className="w-4 h-4" />
            </div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              All Data
            </h1>
            {archiveView === "approved" ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide flex items-center gap-1 shadow-2xs">
                <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                <span>Approved</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase tracking-wide flex items-center gap-1 shadow-2xs">
                <Archive className="w-3 h-3 text-sky-600" />
                <span>Arsip Exported</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {archiveView === "approved"
              ? "Daftar dokumen berstatus Approved siap Export to Excel. Setelah berhasil di-export, status otomatis berubah menjadi Exported."
              : "Arsip dokumen yang sudah berhasil di-export ke Excel dan telah dipindahkan dari antrean aktif."}
          </p>
        </div>

        {/* Actions & Export Dropdown */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {selectedVisibleIds.length > 0 && archiveView === "exported" && (
            <button
              type="button"
              onClick={() =>
                openRollbackConfirm({
                  batchIds: selectedVisibleIds,
                  target: "APPROVED",
                  label: `${selectedVisibleIds.length} dokumen Exported`,
                })
              }
              disabled={isRollingBack || isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              title="Kembalikan dokumen Exported terpilih ke antrean Approved"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Ke Approved ({selectedVisibleIds.length})</span>
            </button>
          )}

          {selectedVisibleIds.length > 0 && (
            <button
              type="button"
              onClick={() =>
                openRollbackConfirm({
                  batchIds: selectedVisibleIds,
                  target: "USER",
                  label: `${selectedVisibleIds.length} dokumen terpilih`,
                })
              }
              disabled={isRollingBack || isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              title="Kembalikan dokumen terpilih ke workspace masing-masing user pembuat (Pending Validation)"
            >
              <Undo2 className="w-3.5 h-3.5 text-slate-600" />
              <span>Ke User ({selectedVisibleIds.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchAllDataBatches()}
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
              disabled={isExporting || displayedBatches.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isExporting
                  ? "Mengexport..."
                  : selectedVisibleIds.length > 0
                  ? `Export to Excel (${selectedVisibleIds.length})`
                  : "Export to Excel"}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-300" />
            </button>

            {isExportOpen && (
              <div
                className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                onMouseLeave={() => setIsExportOpen(false)}
              >
                <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {selectedVisibleIds.length > 0
                    ? `Export ${selectedVisibleIds.length} Dokumen Terpilih`
                    : `Export Semua (${displayedBatches.length} Dokumen)`}
                </div>
                <button
                  type="button"
                  onClick={() => handleExport("clean")}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex flex-col gap-0.5 cursor-pointer text-xs"
                >
                  <span className="font-semibold text-slate-800">Excel Bersih (Data Saja)</span>
                  <span className="text-[10px] text-slate-400">
                    {archiveView === "approved"
                      ? "Unduh tabel ringkasan & otomatis ubah status ke Exported"
                      : "Unduh ulang tabel ringkasan arsip Exported"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("with_action_log")}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex flex-col gap-0.5 cursor-pointer text-xs border-t border-slate-50"
                >
                  <span className="font-semibold text-slate-800">Excel Lengkap (+ Log Action)</span>
                  <span className="text-[10px] text-slate-400">
                    {archiveView === "approved"
                      ? "Lengkap dengan audit log & otomatis ubah status ke Exported"
                      : "Unduh ulang arsip lengkap dengan lembar audit log"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. View Switcher + Filter & Search Toolbar */}
      <div className="px-5 sm:px-6 py-3 bg-white/80 backdrop-blur-xs border-b border-slate-200/80 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Queue Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setArchiveView("approved");
                setSelectedIds([]);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                archiveView === "approved"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Antrean Approved
            </button>
            <button
              type="button"
              onClick={() => {
                setArchiveView("exported");
                setSelectedIds([]);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                archiveView === "exported"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Arsip Exported
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-64 sm:w-72">
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

        {/* Counter & selection pill */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          {selectedVisibleIds.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-semibold">
              <span>{selectedVisibleIds.length} dipilih</span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-slate-300 hover:text-white cursor-pointer"
                title="Batal pilih semua"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <span>
            Menampilkan <span className="font-bold text-slate-900">{displayedBatches.length}</span>{" "}
            {archiveView === "exported" ? "arsip export" : "dokumen disetujui"}
          </span>
        </div>
      </div>

      {/* 3. Main Data Table */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-11">
                  <button
                    type="button"
                    onClick={toggleSelectAllVisible}
                    disabled={displayedBatches.length === 0}
                    className={`w-4 h-4 rounded border mx-auto flex items-center justify-center transition-colors ${
                      displayedBatches.length === 0
                        ? "border-slate-200 bg-slate-100 cursor-not-allowed opacity-50"
                        : isAllVisibleSelected || isSomeVisibleSelected
                        ? "border-slate-900 bg-slate-900 text-white cursor-pointer"
                        : "border-slate-300 bg-white hover:border-slate-500 cursor-pointer"
                    }`}
                    title={isAllVisibleSelected ? "Batal pilih semua" : "Pilih semua baris tampil"}
                  >
                    {isAllVisibleSelected ? (
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    ) : isSomeVisibleSelected ? (
                      <Minus className="w-3 h-3 stroke-[2.5]" />
                    ) : null}
                  </button>
                </th>
                <th className="py-3 px-2 text-center w-10">No</th>
                <th className="py-3 px-2 text-center w-14">Preview</th>
                <th className="py-3 px-4 min-w-[230px]">No. Pengajuan</th>
                <th className="py-3 px-3">Dokumen Terlampir</th>
                <th className="py-3 px-3">Diinput Oleh</th>
                <th className="py-3 px-3">
                  {archiveView === "exported" ? "Diexport Pada" : "Disetujui Pada"}
                </th>
                <th className="py-3 px-3 text-center">Status Dokumen</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-700 mb-2" />
                    <span className="font-medium text-xs">
                      {archiveView === "exported"
                        ? "Memuat arsip dokumen Exported..."
                        : "Memuat data dokumen Approved..."}
                    </span>
                  </td>
                </tr>
              ) : displayedBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700 text-sm">
                      {archiveView === "exported"
                        ? "Belum ada dokumen berstatus Exported"
                        : "Tidak ada dokumen Approved di antrean"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {error ||
                        (archiveView === "approved"
                          ? "Dokumen yang telah di-Approve akan muncul di sini hingga di-export ke Excel."
                          : "Dokumen yang sudah berhasil di-export ke Excel akan tercatat sebagai arsip di sini.")}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedBatches.map((item, idx) => {
                  const displayTitle = item.noPengajuan || item.nama || `Batch #${item.id}`;
                  const displaySubtitle = `Batch #${item.id}`;
                  const isCopied = copiedId === item.id;
                  const isSelected = selectedSet.has(item.id);
                  const isExportedItem =
                    item.workflowStatus === "Exported" ||
                    item.rawStatus?.toUpperCase() === "EXPORTED" ||
                    item.rawStatus?.toUpperCase() === "ARCHIVED";

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedBatchId(item.id)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group select-none ${
                        isSelected ? "bg-slate-50/90" : ""
                      }`}
                    >
                      {/* 1. Checkbox */}
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(e) => toggleSelectRow(item.id, e)}
                      >
                        <button
                          type="button"
                          onClick={(e) => toggleSelectRow(item.id, e)}
                          className={`w-4 h-4 rounded border mx-auto flex items-center justify-center transition-colors cursor-pointer ${
                            isSelected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white group-hover:border-slate-500"
                          }`}
                          aria-label={`Pilih batch ${item.id}`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </button>
                      </td>

                      {/* 2. No */}
                      <td className="py-3 px-2 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>

                      {/* 3. Miniature PDF Thumbnail */}
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

                      {/* 4. No. Pengajuan */}
                      <td className="py-3 px-4 min-w-[230px]">
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

                      {/* 5. Dokumen Terlampir */}
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

                      {/* 6. Diinput Oleh */}
                      <td className="py-2.5 px-3 min-w-[130px]">
                        <div className="font-medium text-slate-800 text-xs">
                          {item.createdBy?.name || "User Staff"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[150px]">
                          {item.createdBy?.email || "-"}
                        </div>
                      </td>

                      {/* 7. Timestamp */}
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-xs">
                        <div className="font-medium text-slate-800">
                          {archiveView === "exported"
                            ? formatDateDisplay(item.exportedAt || item.approvedAt || item.createdAt)
                            : formatDateDisplay(item.approvedAt || item.createdAt)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Disetujui: {item.approvedBy?.name || "Admin Approver"}
                        </div>
                      </td>

                      {/* 8. Status Dokumen */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isExportedItem ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs">
                            <Archive className="w-3.5 h-3.5 text-sky-600" />
                            <span>Exported</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                            <span>Approved</span>
                          </span>
                        )}
                      </td>

                      {/* 9. Aksi */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isExportedItem && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRollbackConfirm({
                                  batchIds: [item.id],
                                  target: "APPROVED",
                                  label: displayTitle,
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
                              title="Kembalikan dari arsip Exported ke antrean Approved"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                              <span>Ke Approved</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRollbackConfirm({
                                batchIds: [item.id],
                                target: "USER",
                                label: displayTitle,
                                ownerName:
                                  item.createdBy?.name ||
                                  item.createdBy?.email ||
                                  "User Pembuat",
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
                            title={`Kembalikan ke workspace ${
                              item.createdBy?.name || "user"
                            } (Pending Validation)`}
                          >
                            <Undo2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Ke User</span>
                          </button>

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

      {/* 4. Matching Detail View Modal (opens read-only for Approved / Exported) */}
      {selectedBatchId && (
        <MatchingDetailView
          batchId={selectedBatchId}
          onClose={() => setSelectedBatchId(null)}
          onStatusUpdate={(_id, newStatus) => {
            const upper = String(newStatus || "").toUpperCase();
            if (
              upper === "MATCHING" ||
              upper === "MISMATCHING" ||
              upper === "PROSES" ||
              upper === "PENDING"
            ) {
              setSelectedBatchId(null);
            }
            fetchAllDataBatches();
          }}
        />
      )}

      {/* 5. Confirm Rollback Dialog */}
      <ConfirmDialog
        isOpen={Boolean(rollbackModal?.isOpen)}
        onClose={() => {
          if (!isRollingBack) {
            setRollbackModal(null);
            setRollbackNote("");
          }
        }}
        onConfirm={() => {
          void executeRollback();
        }}
        variant="info"
        isLoading={isRollingBack}
        title={
          rollbackModal?.target === "APPROVED"
            ? "Kembalikan ke Antrean Approved?"
            : "Kembalikan ke Workspace User?"
        }
        confirmText={
          rollbackModal?.target === "APPROVED"
            ? "Kembalikan ke Approved"
            : "Kembalikan ke User"
        }
        description={
          <div className="space-y-2.5">
            <p>
              {rollbackModal?.target === "APPROVED" ? (
                <>
                  <strong className="text-slate-900">{rollbackModal?.label}</strong> akan
                  dikembalikan dari arsip <strong>Exported</strong> ke antrean{" "}
                  <strong>Approved</strong> untuk dapat di-export ulang.
                </>
              ) : (
                <>
                  <strong className="text-slate-900">{rollbackModal?.label}</strong> akan
                  dikembalikan ke status <strong>Pending Validation</strong> di workspace{" "}
                  <strong className="text-slate-900">
                    {rollbackModal?.ownerName || "masing-masing user pembuat"}
                  </strong>{" "}
                  agar dapat diedit/divalidasi ulang.
                </>
              )}
            </p>
            <div>
              <input
                type="text"
                value={rollbackNote}
                onChange={(e) => setRollbackNote(e.target.value)}
                placeholder="Alasan / catatan pengembalian (opsional)"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white"
              />
            </div>
          </div>
        }
      />

      {/* Slim Light Top-Right Toast Notifications */}
      <ToastNotification items={[toast]} onClose={dismissToast} />
    </div>
  );
}
