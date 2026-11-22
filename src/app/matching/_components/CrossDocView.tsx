"use client";

import React, { useState, useMemo } from "react";
import {
  evaluateCrossDocumentMatching,
  type CrossDocBatchReport,
  type CrossCheckItemResult,
} from "~/utils/crossDocMatcher";
import type { DbEquivalencyGroup } from "~/utils/valueEquivalency";

interface CrossDocViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Array<{ fileType: string; isi?: string | null; fileName?: string; [key: string]: any }>;
  equivalencyGroups?: DbEquivalencyGroup[];
}

export default function CrossDocView({ details, equivalencyGroups = [] }: CrossDocViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [onlyMismatches, setOnlyMismatches] = useState<boolean>(false);

  const report: CrossDocBatchReport = useMemo(() => {
    return evaluateCrossDocumentMatching(details, equivalencyGroups);
  }, [details, equivalencyGroups]);

  const filteredResults = useMemo(() => {
    return report.allResults.filter((item) => {
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }
      if (onlyMismatches && item.status !== "MISMATCH") {
        return false;
      }
      return true;
    });
  }, [report, selectedCategory, onlyMismatches]);

  const categories = [
    { id: "ALL", label: "Semua Kategori", count: report.totalRules },
    { id: "INVOICE_VS_PL", label: "Invoice ↔ Packing List", count: report.resultsByCategory.INVOICE_VS_PL?.length || 0 },
    { id: "PL_VS_BL", label: "Packing List ↔ B/L", count: report.resultsByCategory.PL_VS_BL?.length || 0 },
    { id: "PL_VS_WL", label: "Packing List ↔ Weight List", count: report.resultsByCategory.PL_VS_WL?.length || 0 },
    { id: "PL_VS_MS", label: "Packing List ↔ Mill Sheet", count: report.resultsByCategory.PL_VS_MS?.length || 0 },
    { id: "INV_BL_VS_AK", label: "Invoice & BL ↔ Form AK", count: report.resultsByCategory.INV_BL_VS_AK?.length || 0 },
  ];

  return (
    <div className="space-y-5 text-xs">
      {/* 1. Summary Score Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-sm text-blue-950 flex items-center gap-2">
              <span>Cross-check antar dokumen pembanding</span>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-900 border border-blue-200">
                SOP klien
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Validasi silang antar dokumen pendukung impor sesuai matriks acuan{" "}
              <span className="font-semibold text-slate-700">Docmatch USC field.xlsx</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] text-slate-500 font-semibold">Skor konsistensi</div>
              <div className={`text-base font-extrabold ${report.scorePercentage >= 90 ? "text-emerald-700" : report.scorePercentage >= 70 ? "text-amber-700" : "text-rose-700"}`}>
                {report.scorePercentage}% Selaras
              </div>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border ${
              report.isFullyConsistent
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}>
              {report.matchedCount}/{report.evaluatedCount}
            </div>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
            <span className="text-[10px] text-slate-500 font-medium block">Total aturan SOP</span>
            <span className="text-sm font-bold text-slate-800">{report.totalRules} field</span>
          </div>
          <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200/80">
            <span className="text-[10px] text-emerald-700 font-medium block">Selaras (cocok)</span>
            <span className="text-sm font-bold text-emerald-800">{report.matchedCount} field</span>
          </div>
          <div className="bg-rose-50/70 p-2.5 rounded-lg border border-rose-200/80">
            <span className="text-[10px] text-rose-700 font-medium block">Selisih (tidak cocok)</span>
            <span className="text-sm font-bold text-rose-800">{report.mismatchCount} field</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
            <span className="text-[10px] text-slate-500 font-medium block">Belum diunggah</span>
            <span className="text-sm font-bold text-slate-600">{report.skippedCount} field</span>
          </div>
        </div>
      </div>

      {/* 2. Filter Pills Tabs & Mismatch Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                selectedCategory === c.id
                  ? "bg-blue-950 text-white border-blue-950 shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{c.label}</span>
              <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedCategory === c.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {c.count}
              </span>
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={onlyMismatches}
            onChange={(e) => setOnlyMismatches(e.target.checked)}
            className="w-4 h-4 rounded text-blue-950 focus:ring-blue-900 border-slate-300"
          />
          <span className="text-xs font-semibold text-slate-700">Hanya selisih (tidak cocok)</span>
          {report.mismatchCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
              {report.mismatchCount}
            </span>
          )}
        </label>
      </div>

      {/* 3. Cross Check Items List */}
      <div className="space-y-3">
        {filteredResults.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            Tidak ada aturan cross-check yang sesuai dengan filter ini.
          </div>
        ) : (
          filteredResults.map((item: CrossCheckItemResult) => {
            const isMatch = item.status === "MATCH";
            const isMismatch = item.status === "MISMATCH";
            const isSkipped = item.status === "SKIPPED";

            const cardBorder = isMatch
              ? "border-emerald-200 bg-emerald-50/20"
              : isMismatch
              ? "border-rose-200 bg-rose-50/20"
              : "border-slate-200 bg-white";

            const badgeBg = isMatch
              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
              : isMismatch
              ? "bg-rose-100 text-rose-800 border-rose-200"
              : "bg-slate-100 text-slate-600 border-slate-200";

            return (
              <div key={item.ruleId} className={`rounded-xl border p-4 shadow-2xs transition-all ${cardBorder}`}>
                {/* Header item */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-blue-950">{item.fieldLabel}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      {item.categoryLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                      {item.excelRef}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeBg}`}>
                      {item.status}
                    </span>
                  </div>
                </div>

                {/* Values comparison side-by-side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Source Document */}
                  <div className={`p-2.5 rounded-lg border ${
                    isMatch
                      ? "bg-emerald-50/50 border-emerald-200/60"
                      : isMismatch
                      ? "bg-rose-50/50 border-rose-200/60"
                      : "bg-slate-50/60 border-slate-200/60"
                  }`}>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mb-1">
                      <span className="font-semibold text-slate-700">{item.sourceDocType}</span>
                      <span className="truncate max-w-[150px]">{item.sourceFileName}</span>
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-800 whitespace-pre-wrap break-words">
                      {item.sourceValue || "-"}
                    </div>
                  </div>

                  {/* Target Document */}
                  <div className={`p-2.5 rounded-lg border ${
                    isMatch
                      ? "bg-emerald-50/50 border-emerald-200/60"
                      : isMismatch
                      ? "bg-rose-50/50 border-rose-200/60"
                      : "bg-slate-50/60 border-slate-200/60"
                  }`}>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mb-1">
                      <span className="font-semibold text-slate-700">{item.targetDocType}</span>
                      <span className="truncate max-w-[150px]">{item.targetFileName}</span>
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-800 whitespace-pre-wrap break-words">
                      {item.targetValue || "-"}
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-500 gap-1">
                  <div>
                    <span className="font-semibold text-slate-600">Catatan validasi: </span>
                    <span className={isMismatch ? "font-bold text-rose-700" : isMatch ? "text-emerald-700" : "text-slate-500"}>
                      {item.notes}
                    </span>
                  </div>
                  <div className="sm:text-right text-slate-400 font-mono">
                    ID: {item.ruleId}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

