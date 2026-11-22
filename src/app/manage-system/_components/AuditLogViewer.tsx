"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

export interface SystemAuditLogItem {
  id: number;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "OVERRIDE" | string;
  category: "DATA_ACTION" | "EQUIVALENCY" | "BATCH_DATA" | "SYSTEM_SETTING" | string;
  title: string;
  details?: string | null;
  metadata?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

interface AuditStats {
  totalAll: number;
  totalCreates: number;
  totalUpdates: number;
  totalDeletes: number;
  totalOverrides: number;
}

// --- Clean SVG Icons (Zero Emojis) ---
const HistoryIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const SearchIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const RefreshIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const XIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CodeIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
    />
  </svg>
);

const ChevronLeftIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const CATEGORY_TABS: Array<{ id: string; label: string; desc: string }> = [
  { id: "ALL", label: "Semua Kategori", desc: "Seluruh aktivitas perubahan sistem" },
  { id: "DATA_ACTION", label: "Data Actions", desc: "Aturan pipeline & normalisasi data" },
  { id: "EQUIVALENCY", label: "Kamus Ekuivalensi", desc: "Penambahan/perubahan kamus ekuivalen" },
  { id: "BATCH_DATA", label: "Koreksi Dokumen", desc: "Override manual field dokumen batch" },
  { id: "SYSTEM_SETTING", label: "Pengaturan OCR", desc: "Konfigurasi engine & kredensial API" },
];

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "Baru saja";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} jam lalu`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function formatFullDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function getInitials(name?: string | null): string {
  if (!name) return "OP";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] || "") + (parts[1]![0] || "")).toUpperCase();
}

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<SystemAuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalAll: 0,
    totalCreates: 0,
    totalUpdates: 0,
    totalDeletes: 0,
    totalOverrides: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<SystemAuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== "ALL") params.set("category", selectedCategory);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", "25");

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.logs || []);
        if (data.stats) {
          setStats(data.stats);
        }
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.total || 0);
        }
      }
    } catch (err) {
      console.warn("Gagal mengambil data audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, search, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Client-side filter for action type if selected
  const displayedLogs = useMemo(() => {
    if (selectedAction === "ALL") return logs;
    return logs.filter((l) => l.action === selectedAction);
  }, [logs, selectedAction]);

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    setPage(1);
  };

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case "CREATE":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            Tambah
          </span>
        );
      case "UPDATE":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-sky-50 text-sky-700 border border-sky-200">
            Perbarui
          </span>
        );
      case "DELETE":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-rose-50 text-rose-700 border border-rose-200">
            Hapus
          </span>
        );
      case "OVERRIDE":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-50 text-amber-800 border border-amber-200">
            Koreksi Manual
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category.toUpperCase()) {
      case "DATA_ACTION":
        return { label: "Data Action", color: "bg-indigo-50 text-indigo-700 border-indigo-200" };
      case "EQUIVALENCY":
        return { label: "Kamus Ekuivalen", color: "bg-purple-50 text-purple-700 border-purple-200" };
      case "BATCH_DATA":
        return { label: "Koreksi Dokumen", color: "bg-amber-50 text-amber-700 border-amber-200" };
      case "SYSTEM_SETTING":
        return { label: "Pengaturan OCR", color: "bg-blue-50 text-blue-700 border-blue-200" };
      default:
        return { label: category, color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Information & Metric Cards */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <HistoryIcon className="w-4 h-4 text-blue-950" />
              <span>Log Audit & Catatan Perubahan Sistem</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Riwayat transparan siapa yang membuat, memperbarui, menghapus aturan, atau mengoreksi data dokumen secara real-time.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Total Aktivitas
            </span>
            <span className="text-lg font-bold text-slate-900 mt-1">
              {stats.totalAll.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              Penambahan
            </span>
            <span className="text-lg font-bold text-emerald-800 mt-1">
              {stats.totalCreates.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-sky-50/70 border border-sky-200/80 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
              Perubahan
            </span>
            <span className="text-lg font-bold text-sky-800 mt-1">
              {stats.totalUpdates.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200/80 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
              Penghapusan
            </span>
            <span className="text-lg font-bold text-rose-800 mt-1">
              {stats.totalDeletes.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
              Koreksi Manual
            </span>
            <span className="text-lg font-bold text-amber-900 mt-1">
              {stats.totalOverrides.toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        {/* Filter Bar: Category Tabs & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-1">
          {/* Category Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {CATEGORY_TABS.map((tab) => {
              const isActive = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleCategoryChange(tab.id)}
                  title={tab.desc}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? "bg-blue-950 text-white shadow-2xs font-semibold"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Action Filter & Search */}
          <div className="flex items-center gap-2">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-950 transition-all cursor-pointer"
            >
              <option value="ALL">Semua Aksi</option>
              <option value="CREATE">Tambah</option>
              <option value="UPDATE">Perbarui</option>
              <option value="DELETE">Hapus</option>
              <option value="OVERRIDE">Koreksi Manual</option>
            </select>

            <div className="relative w-full md:w-56">
              <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari user, judul, isi log..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-950 focus:bg-white transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Audit Activity Feed / Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Memuat catatan riwayat audit sistem...
          </div>
        ) : displayedLogs.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <HistoryIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold text-slate-800">
              Belum ada catatan aktivitas yang sesuai
            </h3>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              {search || selectedCategory !== "ALL" || selectedAction !== "ALL"
                ? "Coba sesuaikan kata kunci pencarian atau reset filter kategori."
                : "Aktivitas seperti penambahan aturan kamus, perubahan data actions, atau koreksi data akan tercatat otomatis di sini."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayedLogs.map((log) => {
              const catBadge = getCategoryLabel(log.category);
              const initials = getInitials(log.userName);

              return (
                <div
                  key={log.id}
                  className="p-3.5 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  {/* Left Column: User avatar + action details */}
                  <div className="flex items-start gap-3 min-w-0">
                    {/* User Initials Avatar */}
                    <div
                      title={log.userEmail || log.userName || "Operator"}
                      className="w-8 h-8 rounded-full bg-blue-950 text-white flex items-center justify-center text-[11px] font-bold shrink-0 shadow-2xs"
                    >
                      {initials}
                    </div>

                    <div className="min-w-0 space-y-1">
                      {/* Top meta row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900">
                          {log.userName || "Operator"}
                        </span>
                        {log.userEmail && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                            ({log.userEmail})
                          </span>
                        )}
                        <span className="text-slate-300">•</span>
                        {getActionBadge(log.action)}
                        <span
                          className={`px-2 py-0.2 rounded text-[10px] font-medium border ${catBadge.color}`}
                        >
                          {catBadge.label}
                        </span>
                      </div>

                      {/* Title & Details */}
                      <div>
                        <h4 className="font-semibold text-slate-800 break-words">{log.title}</h4>
                        {log.details && (
                          <p className="text-[11px] text-slate-500 mt-0.5 break-words line-clamp-2">
                            {log.details}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Timestamp & Action button */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span
                      title={formatFullDateTime(log.createdAt)}
                      className="text-[11px] font-medium text-slate-600 cursor-help"
                    >
                      {formatRelativeTime(log.createdAt)}
                    </span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                      {new Date(log.createdAt).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    {log.metadata && (
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-950 hover:text-blue-800 hover:underline pt-0.5 cursor-pointer"
                      >
                        <CodeIcon className="w-3 h-3 text-blue-900" />
                        <span>Detail</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Menampilkan entri {(page - 1) * 25 + 1} - {Math.min(page * 25, totalCount)} dari total{" "}
              {totalCount}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-800">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Technical Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-xl p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getActionBadge(selectedLog.action)}
                  <span className="text-xs font-semibold text-slate-900">
                    Detail Log #{selectedLog.id}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-slate-900">{selectedLog.title}</h3>
                <p className="text-[11px] text-slate-500">
                  Oleh {selectedLog.userName || "Operator"} pada{" "}
                  {formatFullDateTime(selectedLog.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {selectedLog.details && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Ringkasan Keterangan:
                </span>
                {selectedLog.details}
              </div>
            )}

            <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Metadata Perubahan (JSON Snapshot):
              </span>
              <div className="flex-1 bg-slate-900 text-slate-100 p-3 rounded-lg overflow-y-auto font-mono text-[11px] leading-relaxed">
                {(() => {
                  try {
                    const parsed = JSON.parse(selectedLog.metadata || "{}");
                    return JSON.stringify(parsed, null, 2);
                  } catch {
                    return selectedLog.metadata || "Tidak ada metadata tambahan.";
                  }
                })()}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Kategori: {selectedLog.category}</span>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
