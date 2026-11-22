"use client";

import React, { useState } from "react";
import { Settings, MoreVertical, ShieldCheck, FileText, HelpCircle } from "lucide-react";

export interface MatchingHeaderProps {
  onOpenAuditLog?: () => void;
  onRefresh?: () => void;
}

export default function MatchingHeader({ onOpenAuditLog, onRefresh }: MatchingHeaderProps) {
  const [kebabOpen, setKebabOpen] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
      {/* Left: Breadcrumb & ILM Badge */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Breadcrumb: PIB / Matching Data */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400 font-medium hover:text-slate-600 transition-colors cursor-pointer">
            PIB
          </span>
          <span className="text-slate-300 font-normal select-none">/</span>
          <span className="text-slate-900 font-semibold tracking-tight">
            Matching Data
          </span>
        </div>

        {/* ILM Badge + Settings Cog */}
        <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
          <span
            className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80 tracking-wide select-none"
            title="Integrated Logistic Matching Module"
          >
            ILM
          </span>
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Pengaturan ILM"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* AI Confidence Dropdown */}
        <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200">
          <label htmlFor="ai-confidence-select" className="text-[11px] text-slate-500 font-medium select-none">
            AI confidence:
          </label>
          <select
            id="ai-confidence-select"
            defaultValue="all"
            className="bg-transparent text-[11px] font-semibold text-slate-700 border-none focus:outline-none cursor-pointer py-0.5 pr-1"
          >
            <option value="all">Semua tingkat</option>
            <option value="high">Tinggi (&gt;90%)</option>
            <option value="medium">Sedang (70–90%)</option>
            <option value="low">Rendah (&lt;70%)</option>
          </select>
        </div>
      </div>

      {/* Right: Kebab Menu Button */}
      <div className="relative self-end sm:self-auto">
        <button
          type="button"
          onClick={() => setKebabOpen(!kebabOpen)}
          className="p-2 bg-white border border-slate-200/90 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          title="Menu opsi lainnya"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {kebabOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setKebabOpen(false)}
            />
            <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-40 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-150">
              {onOpenAuditLog && (
                <button
                  type="button"
                  onClick={() => {
                    setKebabOpen(false);
                    onOpenAuditLog();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>Log audit pipeline</span>
                </button>
              )}
              {onRefresh && (
                <button
                  type="button"
                  onClick={() => {
                    setKebabOpen(false);
                    onRefresh();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span>Sinkronisasi database</span>
                </button>
              )}
              <div className="my-1 border-t border-slate-100" />
              <div className="px-3 py-1.5 text-[11px] text-slate-400 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>USC Middleware v1.2</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
