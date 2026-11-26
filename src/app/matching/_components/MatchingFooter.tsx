"use client";

import React from "react";
import { Plus, Download, ChevronLeft, ChevronRight } from "lucide-react";

export interface MatchingFooterProps {
  onUploadFile: () => void;
  onDownloadExtractedData: () => void;
  disableDownloadExtracted?: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  rowsPerPage: number;
  onRowsPerPageChange: (newLimit: number) => void;
  totalItems: number;
}

export default function MatchingFooter({
  onUploadFile,
  onDownloadExtractedData,
  disableDownloadExtracted = false,
  currentPage,
  totalPages,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
  totalItems,
}: MatchingFooterProps) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-5 px-4 sm:px-6 py-2.5 bg-white/95 backdrop-blur-xs border-t border-slate-200/90 shadow-[0_-2px_10px_-2px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-auto select-none">
      {/* Left Action Buttons: Unggah file (primary) and Unduh data hasil (secondary) */}
      <div className="flex items-center gap-2">
        {/* Primary Navy Button: Unggah file */}
        <button
          type="button"
          onClick={onUploadFile}
          className="h-8 px-3.5 bg-[#091E42] hover:bg-[#091E42]/90 text-white font-medium text-xs rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors select-none"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Unggah file</span>
        </button>

        {/* Secondary Button: Unduh data hasil */}
        <button
          type="button"
          disabled={disableDownloadExtracted}
          onClick={onDownloadExtractedData}
          className="h-8 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 font-medium text-xs rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors select-none"
          title={
            disableDownloadExtracted
              ? "Terkunci: data Nanonets belum lengkap atau belum ada batch siap unduh"
              : undefined
          }
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>Unduh data hasil</span>
        </button>
      </div>

      {/* Right: Pagination Controls */}
      <div className="flex items-center gap-3 self-end sm:self-auto text-xs text-slate-600">
        {/* Prev & Next Arrows */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Halaman sebelumnya"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="font-medium text-xs px-1 select-none text-slate-700">
            Halaman {currentPage} dari {Math.max(1, totalPages)}
            {totalItems > 0 && (
              <span className="text-slate-400 font-normal ml-1">({totalItems} file)</span>
            )}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Halaman berikutnya"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* Rows per page selector: Baris per halaman: 50 */}
        <div className="flex items-center gap-1.5 select-none">
          <span className="text-slate-500 text-[11px]">Baris per halaman:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
            className="h-7 bg-white border border-slate-200 rounded-md px-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#091E42] cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
    </div>
  );
}
