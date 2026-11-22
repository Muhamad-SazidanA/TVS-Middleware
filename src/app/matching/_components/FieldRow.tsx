"use client";

import React from "react";
import type { ComparisonField } from "~/types/documentComparison";

interface FieldRowProps {
  field: ComparisonField;
  isActive: boolean;
  onSelect: (fieldId: string) => void;
  onOpenEdit?: (params: {
    detailId: number;
    docTitle: string;
    fieldName: string;
    fieldLabel: string;
    currentValue: string;
    oppositeValue: string;
    tableIndex?: number;
  }) => void;
}

export default function FieldRow({
  field,
  isActive,
  onSelect,
  onOpenEdit,
}: FieldRowProps) {
  const isMatch = field.status === "MATCH";
  const isMismatch = field.status === "MISMATCH";

  // Check bbox availability
  const hasPibLoc = Boolean(field.pibBbox);
  const hasPembandingLoc = Boolean(field.pembandingBbox);
  const hasAnyLoc = hasPibLoc || hasPembandingLoc;

  return (
    <div
      onClick={() => onSelect(field.id)}
      className={`rounded-xl border p-2.5 transition-all cursor-pointer text-xs select-none relative ${
        isActive
          ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/30 shadow-xs"
          : isMatch
          ? "border-emerald-200/80 bg-white hover:bg-emerald-50/30 shadow-2xs"
          : isMismatch
          ? "border-rose-200/90 bg-white hover:bg-rose-50/30 shadow-2xs"
          : "border-slate-200 bg-white hover:bg-slate-50/60 shadow-2xs"
      }`}
    >
      {/* Header Row: Label & Status Indicator */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-slate-800 text-[11px] truncate">
            {field.number ? `${field.number}. ` : ""}{field.label}
          </span>
          {!hasAnyLoc && (
            <span
              className="text-[9.5px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0 italic"
              title="Koordinat bounding box tidak ditemukan pada OCR"
            >
              Lokasi tidak tersedia
            </span>
          )}
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-1 shrink-0">
          {isActive ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-2xs">
              Aktif
            </span>
          ) : isMatch ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Cocok
            </span>
          ) : isMismatch ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
              Tidak cocok
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              Info
            </span>
          )}
        </div>
      </div>

      {/* Side-by-side comparison boxes */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {/* Left: PIB Reference Value */}
        <div
          className={`p-2 rounded-lg border flex flex-col justify-between ${
            isActive
              ? "bg-white/90 border-blue-200 text-blue-950"
              : isMatch
              ? "bg-emerald-50/50 border-emerald-100 text-emerald-950"
              : isMismatch
              ? "bg-rose-50/50 border-rose-100 text-rose-950"
              : "bg-slate-50/70 border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-[9.5px] font-semibold text-slate-500 tracking-tight mb-0.5">
            <span>PIB (acuan)</span>
            <div className="flex items-center gap-1">
              {field.isManualLeft && (
                <span className="text-[9px] text-amber-700 bg-amber-100 border border-amber-300 px-1 rounded font-normal normal-case">
                  Diedit manual
                </span>
              )}
              {hasPibLoc && (
                <span className="text-blue-700 font-mono text-[9px] bg-blue-50 px-1 rounded border border-blue-200">
                  Hal. {field.pibBbox?.page}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span
              className="font-medium text-slate-800 line-clamp-2 break-words text-[11px]"
              title={field.pibValue || "-"}
            >
              {field.pibValue || "-"}
            </span>
            {field.detailIdLeft && onOpenEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEdit({
                    detailId: field.detailIdLeft!,
                    docTitle: "PIB (File Acuan)",
                    fieldName: field.fieldName || field.label,
                    fieldLabel: `${field.number ? `${field.number}. ` : ""}${field.label}`,
                    currentValue: field.pibValue || "-",
                    oppositeValue: field.pembandingValue || "-",
                    tableIndex: field.tableIndexLeft,
                  });
                }}
                className="p-1 rounded text-slate-400 hover:text-blue-900 hover:bg-slate-200/80 transition-colors shrink-0 cursor-pointer"
                title={`Koreksi ${field.label} pada PIB`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Right: Pembanding Value */}
        <div
          className={`p-2 rounded-lg border flex flex-col justify-between ${
            isActive
              ? "bg-white/90 border-blue-200 text-blue-950"
              : isMatch
              ? "bg-emerald-50/50 border-emerald-100 text-emerald-950"
              : isMismatch
              ? "bg-rose-50/50 border-rose-100 text-rose-950"
              : "bg-slate-50/70 border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-[9.5px] font-semibold text-slate-500 tracking-tight mb-0.5">
            <span>{field.category || "Pembanding"}</span>
            <div className="flex items-center gap-1">
              {field.isManualRight && (
                <span className="text-[9px] text-amber-700 bg-amber-100 border border-amber-300 px-1 rounded font-normal normal-case">
                  Diedit manual
                </span>
              )}
              {hasPembandingLoc && (
                <span className="text-blue-700 font-mono text-[9px] bg-blue-50 px-1 rounded border border-blue-200">
                  Hal. {field.pembandingBbox?.page}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span
              className="font-medium text-slate-800 line-clamp-2 break-words text-[11px]"
              title={field.pembandingValue || "-"}
            >
              {field.pembandingValue || "-"}
            </span>
            {field.detailIdRight && onOpenEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEdit({
                    detailId: field.detailIdRight!,
                    docTitle: field.category || "Pembanding",
                    fieldName: field.fieldName || field.label,
                    fieldLabel: `${field.number ? `${field.number}. ` : ""}${field.label}`,
                    currentValue: field.pembandingValue || "-",
                    oppositeValue: field.pibValue || "-",
                    tableIndex: field.tableIndexRight,
                  });
                }}
                className="p-1 rounded text-slate-400 hover:text-blue-900 hover:bg-slate-200/80 transition-colors shrink-0 cursor-pointer"
                title={`Koreksi ${field.label} pada ${field.category || "Pembanding"}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Equivalence dictionary note if match reason present */}
      {isMatch && field.matchReason && field.pibValue !== "-" && field.pembandingValue !== "-" && (
        <div className="mt-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 font-medium flex items-center justify-between">
          <span>{field.matchReason}</span>
          <span className="text-[9px] text-emerald-600 font-semibold tracking-wider">Ekuivalen kamus</span>
        </div>
      )}
    </div>
  );
}

