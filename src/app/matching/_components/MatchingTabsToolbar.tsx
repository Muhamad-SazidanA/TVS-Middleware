"use client";

import React, { useState } from "react";
import {
  RefreshCw,
  Search,
  SlidersHorizontal,
  Columns,
  Plus,
  RotateCcw,
  Download,
  ChevronDown,
} from "lucide-react";

export type MatchingTabId =
  | "all"
  | "approved"
  | "assigned"
  | "in_review"
  | "rejected";

export interface TabCounts {
  all: number;
  approved: number;
  assigned: number;
  in_review: number;
  rejected: number;
}

export interface ColumnVisibility {
  Invoice: boolean;
  Packing_List: boolean;
  Bill_of_Lading: boolean;
  AK: boolean;
  WL: boolean;
  MS: boolean;
}

export interface MatchingTabsToolbarProps {
  activeTab: MatchingTabId;
  onTabChange: (tab: MatchingTabId) => void;
  counts: TabCounts;
  onAddBatch?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  columnVisibility: ColumnVisibility;
  onToggleColumn: (colKey: keyof ColumnVisibility) => void;
  onResetColumns?: () => void;
  hasActiveFilters?: boolean;
  onOpenFilterDialog?: () => void;
  onExportPersonal?: (mode: "clean" | "with_action_log") => void;
}

export default function MatchingTabsToolbar({
  activeTab,
  onTabChange,
  counts,
  onAddBatch,
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing = false,
  columnVisibility,
  onToggleColumn,
  onResetColumns,
  hasActiveFilters = false,
  onOpenFilterDialog,
  onExportPersonal,
}: MatchingTabsToolbarProps) {
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  const tabs: Array<{ id: MatchingTabId; label: string; count: number }> = [
    { id: "all", label: "Semua file", count: counts.all },
    { id: "approved", label: "Disetujui", count: counts.approved },
    { id: "assigned", label: "Ditugaskan ke saya", count: counts.assigned },
    { id: "in_review", label: "Dalam review", count: counts.in_review },
    { id: "rejected", label: "Ditolak", count: counts.rejected },
  ];

  const columnKeys: Array<{ key: keyof ColumnVisibility; label: string }> = [
    { key: "Invoice", label: "Invoice" },
    { key: "Packing_List", label: "Packing List" },
    { key: "Bill_of_Lading", label: "Bill of Lading" },
    { key: "AK", label: "AK" },
    { key: "WL", label: "WL" },
    { key: "MS", label: "MS" },
  ];

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
      {/* Left: Pill style tabs with dynamic counts & + button */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all whitespace-nowrap cursor-pointer select-none flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#091E42] text-white font-bold shadow-xs"
                  : "bg-slate-100/70 hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 font-medium"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive
                    ? "bg-white/20 text-white font-bold"
                    : "bg-slate-200/80 text-slate-600 font-medium"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}

        {/* Plus Button */}
        <button
          type="button"
          onClick={onAddBatch}
          className="p-1.5 rounded-full bg-slate-100/70 hover:bg-slate-200/80 text-slate-500 hover:text-[#091E42] transition-colors cursor-pointer shrink-0"
          title="Tambah batch baru"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: Toolbar (Refresh, Search, Filter, Column visibility) */}
      <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
        {/* Refresh Icon Button */}
        <button
          type="button"
          onClick={onRefresh}
          className="p-2 bg-white border border-slate-200/90 rounded-xl text-slate-500 hover:text-[#091E42] hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          title="Segarkan data"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#091E42]" : ""}`}
          />
        </button>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama file"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-48 sm:w-56 pl-8.5 pr-3 py-1.5 bg-white border border-slate-200/90 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#091E42] focus:ring-1 focus:ring-[#091E42] transition-all shadow-2xs"
          />
        </div>

        {/* Filter Button */}
        <button
          type="button"
          onClick={onOpenFilterDialog}
          className={`px-3 py-1.5 bg-white border rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer ${
            hasActiveFilters
              ? "border-blue-500 text-blue-900 bg-blue-50/50"
              : "border-slate-200/90 text-slate-700 hover:bg-slate-50"
          }`}
          title="Filter data dokumen"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          <span>Filter</span>
        </button>

        {/* Personal Export Dropdown Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            className="px-3 py-1.5 bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Export Excel Workspace Data"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {exportDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setExportDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Export Workspace (Personal)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    if (onExportPersonal) onExportPersonal("clean");
                    else window.location.href = "/api/export/excel?scope=personal&mode=clean";
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex flex-col gap-0.5 cursor-pointer text-xs"
                >
                  <span className="font-semibold text-slate-800">Mode 1: Excel Bersih</span>
                  <span className="text-[10px] text-slate-400">1 sheet ringkasan data tanpa log audit</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    if (onExportPersonal) onExportPersonal("with_action_log");
                    else window.location.href = "/api/export/excel?scope=personal&mode=with_action_log";
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex flex-col gap-0.5 cursor-pointer text-xs border-t border-slate-50"
                >
                  <span className="font-semibold text-emerald-900">Mode 2: Lengkap (+ Log Action)</span>
                  <span className="text-[10px] text-slate-400">2 tab sheet: Data Dokumen & Riwayat Revisi</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Column Visibility Toggle Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setColumnDropdownOpen(!columnDropdownOpen)}
            className="p-2 bg-white border border-slate-200/90 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Pengaturan visibilitas kolom"
          >
            <Columns className="w-4 h-4" />
          </button>

          {columnDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setColumnDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-2 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-500 tracking-wider">
                    Kolom dinamis
                  </span>
                  {onResetColumns && (
                    <button
                      type="button"
                      onClick={onResetColumns}
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto py-1">
                  {columnKeys.map((col) => {
                    const isVisible = columnVisibility[col.key];
                    return (
                      <label
                        key={col.key}
                        className="px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => onToggleColumn(col.key)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-[#091E42] accent-[#091E42] focus:ring-0 cursor-pointer"
                        />
                        <span
                          className={`font-mono text-xs ${
                            isVisible ? "text-slate-800 font-semibold" : "text-slate-400"
                          }`}
                        >
                          {col.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
