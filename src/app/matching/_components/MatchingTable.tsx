"use client";

import React, { useState } from "react";
import {
  Download,
  Trash2,
  Copy,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  RefreshCw,
  Lock,
} from "lucide-react";
import type { ColumnVisibility } from "./MatchingTabsToolbar";

export interface DocumentStatusCell {
  status: "Match" | "Mismatch" | "Proses" | "-";
  detailsCount?: number;
}

export interface TableBatchItem {
  id: string;
  no: number;
  nama: string;
  subtext: string;
  totalFile: number;
  status: "Matching" | "Mismatching" | "Proses" | "Ditolak";
  assignedTo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Parsed PIB dynamic fields
  pibFileName: string;
  fields: Record<string, string>;
  docStatuses: Record<string, DocumentStatusCell>;
}

export interface MatchingTableProps {
  batches: TableBatchItem[];
  loading?: boolean;
  searchQuery?: string;
  selectedBatchIds: string[];
  onToggleSelectAll: () => void;
  onToggleSelectRow: (id: string, e: React.MouseEvent | React.ChangeEvent) => void;
  isAllSelected: boolean;
  onRowClick: (id: string, initialDocCode?: string) => void;
  onLockedClick?: (id: string) => void;
  onDownload: (batch: TableBatchItem) => void;
  onDelete: (batch: TableBatchItem) => void;
  onAssign: (batchId: string) => void;
  onCopyFileName: (fileName: string) => void;
  sortColumn: "createdAt" | "nama" | "status" | string;
  sortDirection: "asc" | "desc" | "none";
  onSortChange: (column: string) => void;
  columnVisibility: ColumnVisibility;
}

// Utility to format values with thousand separators and 4 decimals if numeric
export function formatDynamicValue(val: string | number | undefined | null): {
  formatted: string;
  isNumeric: boolean;
} {
  if (val === undefined || val === null || val === "") {
    return { formatted: "-", isNumeric: false };
  }
  const str = String(val).trim();
  if (str === "" || str === "-") {
    return { formatted: "-", isNumeric: false };
  }

  // Already formatted with commas or decimals like 1,045,140.0000 or 1045140.5
  const cleanStr = str.replace(/,/g, "");
  const num = parseFloat(cleanStr);
  if (!isNaN(num) && /^-?\d+(\.\d+)?$/.test(cleanStr)) {
    return {
      formatted: num.toLocaleString("en-US", {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }),
      isNumeric: true,
    };
  }

  return { formatted: str, isNumeric: false };
}

// Format ISO date to dd/mm/yyyy
export function formatDateDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return "-";
  }
}

export default function MatchingTable({
  batches,
  loading = false,
  searchQuery = "",
  selectedBatchIds,
  onToggleSelectAll,
  onToggleSelectRow,
  isAllSelected,
  onRowClick,
  onLockedClick,
  onDownload,
  onDelete,
  onAssign,
  onCopyFileName,
  sortColumn,
  sortDirection,
  onSortChange,
  columnVisibility,
}: MatchingTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (fileName: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fileName).then(() => {
      setCopiedId(id);
      onCopyFileName(fileName);
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    });
  };

  // Supporting document columns evaluated by engine (Invoice and Bill of Lading)
  const docCols: Array<{ key: keyof ColumnVisibility; label: string }> = [
    { key: "Invoice", label: "Invoice" },
    { key: "Bill_of_Lading", label: "Bill of Lading" },
  ];

  const activeDocCols = docCols.filter((col) => columnVisibility[col.key]);

  const renderSortIcon = (colKey: string) => {
    if (sortColumn !== colKey || sortDirection === "none") {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover/col:text-slate-500" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="w-3 h-3 text-slate-900" />;
    }
    return <ArrowDown className="w-3 h-3 text-slate-900" />;
  };

  return (
    <div className="w-full h-full bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col min-h-0">
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full text-left border-collapse min-w-[1250px]">
          {/* Sticky Table Header */}
          <thead>
            <tr className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 tracking-normal z-20 select-none whitespace-nowrap">
              {/* 1. Checkbox Column (Frozen on the left) */}
              <th className="w-[48px] min-w-[48px] max-w-[48px] py-3.5 px-3 text-center sticky left-0 z-30 bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 accent-slate-900 focus:ring-0 cursor-pointer"
                  title="Pilih semua baris"
                />
              </th>

              {/* 2. Thumbnail Column (Frozen on the left) */}
              <th className="w-[56px] min-w-[56px] max-w-[56px] py-3.5 px-2 text-center sticky left-[48px] z-30 bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                {/* Visual thumbnail column header */}
              </th>

              {/* 3. Nama file Column (Frozen on the left with shadow divider) */}
              <th
                onClick={() => onSortChange("nama")}
                className="min-w-[260px] py-3.5 px-4 cursor-pointer group/col hover:text-slate-900 transition-colors sticky left-[104px] z-30 bg-slate-50 border-b border-r border-slate-200 shadow-[6px_0_12px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span>Nama file</span>
                  {renderSortIcon("nama")}
                </div>
              </th>

              {/* 4. Status review Column */}
              <th
                onClick={() => onSortChange("status")}
                className="py-3.5 px-4 text-center cursor-pointer group/col hover:text-slate-900 transition-colors min-w-[150px] whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <span>Status review</span>
                  {renderSortIcon("status")}
                </div>
              </th>

              {/* 5. Ditugaskan ke Column */}
              <th className="py-3.5 px-4 text-center min-w-[130px] whitespace-nowrap">
                <span>Ditugaskan ke</span>
              </th>

              {/* 6. Diunggah pada Column (sortable) */}
              <th
                onClick={() => onSortChange("createdAt")}
                className="py-3.5 px-4 text-center cursor-pointer group/col hover:text-slate-900 transition-colors min-w-[130px] whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <span>Diunggah pada</span>
                  {renderSortIcon("createdAt")}
                </div>
              </th>

              {/* 7. Supporting Document Columns from Nanonets */}
              {activeDocCols.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSortChange(col.key)}
                  className="py-3.5 px-4 text-center cursor-pointer group/col hover:text-slate-900 transition-colors min-w-[110px] whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <span>{col.label}</span>
                    {renderSortIcon(col.key)}
                  </div>
                </th>
              ))}

              {/* 8. Frozen Action Column at the far right */}
              <th className="sticky right-0 z-30 w-24 py-3.5 px-4 text-center bg-slate-50 border-b border-l border-slate-200 shadow-[-6px_0_12px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap">
                <span>Aksi</span>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading && batches.length === 0 ? (
              <tr>
                <td
                  colSpan={7 + activeDocCols.length}
                  className="py-16 text-center text-slate-500"
                >
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-900" />
                  <span className="font-medium text-xs">Memuat data dokumen batch...</span>
                </td>
              </tr>
            ) : batches.length === 0 ? (
              <tr>
                <td
                  colSpan={7 + activeDocCols.length}
                  className="py-16 text-center text-slate-500"
                >
                  <FileText className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-800 text-sm">
                    Tidak ada data dokumen ditemukan
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {searchQuery
                      ? `Tidak ada file yang cocok dengan kata kunci "${searchQuery}"`
                      : "Belum ada dokumen batch yang tersedia."}
                  </p>
                </td>
              </tr>
            ) : (
              batches.map((batch) => {
                const isSelected = selectedBatchIds.includes(batch.id);
                const uploadDate = formatDateDDMMYYYY(batch.createdAt);

                // Status review mapping
                // "Validasi lolos" (neutral soft pill)
                // "Perlu review manual" (warning soft pill)
                // "Ditolak" (danger soft pill)
                let reviewBadge: {
                  label: string;
                  className: string;
                } = {
                  label: "Perlu review manual",
                  className: "bg-amber-50 text-amber-800 border-amber-200/80",
                };

                const isBatchProcessing =
                  batch.status === "Proses" ||
                  (batch.status as string).toLowerCase() === "pending";

                if (isBatchProcessing) {
                  reviewBadge = {
                    label: "Sedang memproses OCR...",
                    className: "bg-blue-50 text-blue-800 border-blue-200",
                  };
                } else if (batch.status === "Matching") {
                  reviewBadge = {
                    label: "Match",
                    className: "bg-emerald-50 text-emerald-800 border border-emerald-200/80",
                  };
                } else if (batch.status === "Ditolak") {
                  reviewBadge = {
                    label: "Ditolak",
                    className: "bg-rose-50 text-rose-800 border border-rose-200/80",
                  };
                }

                return (
                  <tr
                    key={batch.id}
                    onClick={() => {
                      if (isBatchProcessing) {
                        onLockedClick?.(batch.id);
                        return;
                      }
                      onRowClick(batch.id, "PIB");
                    }}
                    className={`group transition-colors select-none ${
                      isBatchProcessing
                        ? "cursor-not-allowed bg-slate-50/50 hover:bg-slate-100/60 opacity-90"
                        : isSelected
                        ? "cursor-pointer bg-blue-50/50 hover:bg-blue-50/70"
                        : "cursor-pointer hover:bg-slate-50/70"
                    }`}
                    title={
                      isBatchProcessing
                        ? "Dokumen masih diproses oleh OCR Nanonets, mohon tunggu hingga selesai."
                        : undefined
                    }
                  >
                    {/* 1. Checkbox Column (Frozen on the left) */}
                    <td
                      className={`w-[48px] min-w-[48px] max-w-[48px] py-3 px-3 text-center sticky left-0 z-10 ${
                        isSelected ? "bg-blue-50 group-hover:bg-blue-100/80" : "bg-white group-hover:bg-slate-50"
                      } transition-colors whitespace-nowrap`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggleSelectRow(batch.id, e)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 accent-slate-900 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* 2. Thumbnail Preview (Frozen on the left) */}
                    <td
                      className={`w-[56px] min-w-[56px] max-w-[56px] py-2.5 px-2 text-center sticky left-[48px] z-10 ${
                        isSelected ? "bg-blue-50 group-hover:bg-blue-100/80" : "bg-white group-hover:bg-slate-50"
                      } transition-colors whitespace-nowrap`}
                    >
                      <div className="w-8 h-10 bg-white border border-slate-200 rounded-md shadow-2xs p-1 mx-auto flex flex-col justify-between shrink-0 group-hover:border-slate-300 transition-colors">
                        <div className="space-y-0.5">
                          <div className="h-0.5 bg-slate-300 rounded w-full" />
                          <div className="h-0.5 bg-slate-200 rounded w-4/5" />
                          <div className="h-0.5 bg-slate-200 rounded w-3/5" />
                          <div className="h-0.5 bg-slate-200 rounded w-4/5" />
                        </div>
                        <div className="flex justify-end">
                          <span className="text-[7px] font-extrabold text-rose-600 bg-rose-50 px-0.5 rounded leading-none border border-rose-100">
                            PDF
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 3. Nama file with Option A: 2 vertical lines (Frozen on the left with shadow divider) */}
                    <td
                      className={`min-w-[260px] py-3 px-4 sticky left-[104px] z-10 ${
                        isSelected ? "bg-blue-50 group-hover:bg-blue-100/80" : "bg-white group-hover:bg-slate-50"
                      } transition-colors border-r border-slate-200/80 shadow-[6px_0_12px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap`}
                    >
                      <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 text-xs whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{batch.pibFileName}</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(batch.pibFileName, batch.id, e)}
                            className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer shrink-0"
                            title="Salin nama file"
                          >
                            {copiedId === batch.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap truncate max-w-[220px]" title={`Batch #${batch.id} - ${batch.nama}`}>
                          #{batch.id} • {batch.nama}
                        </div>
                      </div>
                    </td>

                    {/* 4. Status review pill (strictly 1 line) */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${reviewBadge.className}`}
                      >
                        {isBatchProcessing && (
                          <>
                            <Lock className="w-3 h-3 text-blue-600 shrink-0" />
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                            </span>
                          </>
                        )}
                        <span>{reviewBadge.label}</span>
                      </span>
                    </td>

                    {/* 5. Ditugaskan ke (strictly 1 line) */}
                    <td
                      className="py-3.5 px-4 text-center whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {batch.assignedTo ? (
                        <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                          {batch.assignedTo}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAssign(batch.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer whitespace-nowrap"
                        >
                          Tugaskan
                        </button>
                      )}
                    </td>

                    {/* 6. Diunggah pada (strictly 1 line) */}
                    <td className="py-3.5 px-4 text-center font-mono text-slate-600 text-xs whitespace-nowrap">
                      {uploadDate}
                    </td>

                    {/* 7. Supporting Document Cells (Match / Mismatch / - / Proses, strictly 1 line) */}
                    {activeDocCols.map((col) => {
                      const cell = batch.docStatuses?.[col.key] || { status: "-" };
                      const st = cell.status;

                      return (
                        <td
                          key={col.key}
                          onClick={(e) => {
                            if (st !== "-") {
                              e.stopPropagation();
                              if (isBatchProcessing) {
                                onLockedClick?.(batch.id);
                                return;
                              }
                              onRowClick(batch.id, col.key);
                            }
                          }}
                          className={`py-3.5 px-4 text-center whitespace-nowrap ${
                            isBatchProcessing
                              ? "cursor-not-allowed opacity-75"
                              : st !== "-"
                              ? "cursor-pointer hover:bg-blue-50/70"
                              : ""
                          }`}
                          title={
                            isBatchProcessing
                              ? "Dokumen masih diproses oleh OCR Nanonets, mohon tunggu hingga selesai."
                              : st !== "-"
                              ? `Buka berkas ${col.key} di viewer`
                              : undefined
                          }
                        >
                          {st === "Match" ? (
                            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                              Match
                            </span>
                          ) : st === "Mismatch" ? (
                            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                              Mismatch
                            </span>
                          ) : st === "Proses" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                              <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                              <span>Proses</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-xs select-none">-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* 8. Freeze/Sticky Row actions Column at the far right */}
                    <td
                      className={`sticky right-0 z-10 w-24 py-3.5 px-4 text-center ${
                        isSelected ? "bg-blue-50 group-hover:bg-blue-100/80" : "bg-white group-hover:bg-slate-50"
                      } transition-colors border-l border-slate-200/80 shadow-[-6px_0_12px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Action 1: Unduh */}
                        <button
                          type="button"
                          onClick={() => onDownload(batch)}
                          className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Unduh"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Action 2: Hapus */}
                        <button
                          type="button"
                          onClick={() => onDelete(batch)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
  );
}

