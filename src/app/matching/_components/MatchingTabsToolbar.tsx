"use client";

import React, { useState } from "react";
import {
  RefreshCw,
  Search,
  SlidersHorizontal,
  Columns,
  RotateCcw,
  Download,
  ChevronDown,
} from "lucide-react";

export type MatchingTabId = "all" | "match" | "mismatch" | "failed";

export interface TabCounts {
  all: number;
  match: number;
  mismatch: number;
  failed: number;
}

export interface ColumnVisibility {
  Invoice: boolean;
  Bill_of_Lading: boolean;
  Packing_List?: boolean;
  AK?: boolean;
  WL?: boolean;
  MS?: boolean;
}

export interface MatchingTabsToolbarProps {
  activeTab: MatchingTabId;
  onTabChange: (tab: MatchingTabId) => void;
  counts: TabCounts;
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

  const tabs: Array<{
    id: MatchingTabId;
    label: string;
    count: number;
    badgeClass: string;
  }> = [
    {
      id: "all",
      label: "All",
      count: counts.all,
      badgeClass: "bg-slate-200/80 text-slate-700 border-slate-300/60",
    },
    {
      id: "match",
      label: "Match",
      count: counts.match,
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    },
    {
      id: "mismatch",
      label: "Mismatch",
      count: counts.mismatch,
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200/70",
    },
    {
      id: "failed",
      label: "Failed",
      count: counts.failed,
      badgeClass: "bg-red-100/80 text-red-800 border-red-200/80",
    },
  ];

  const columnKeys: Array<{ key: keyof ColumnVisibility; label: string }> = [
    { key: "Invoice", label: "Invoice" },
    { key: "Bill_of_Lading", label: "Bill of Lading" },
  ];

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      {/* Left: Clean segmented filter tabs (All, Match, Mismatch, Failed) */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/70 overflow-x-auto no-scrollbar self-start">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors duration-150 whitespace-nowrap cursor-pointer select-none flex items-center gap-1.5 ${
                isActive
                  ? "bg-slate-200/80 text-slate-900 border-slate-300/60"
                  : "text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/40"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-mono font-semibold border transition-colors duration-150 ${tab.badgeClass}`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
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
            placeholder="Cari no. pengajuan / batch"
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
