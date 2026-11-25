"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";

interface DocumentPageSkeletonProps {
  width?: number;
  height?: number;
  /** True when rendered inside an existing bordered page frame (e.g. react-pdf Page loading prop). */
  embedded?: boolean;
  /** True when container width should adapt responsively (used before PDF dimensions are initialized). */
  responsive?: boolean;
}

/**
 * Paper-sheet skeleton matching the A4 document canvas rendered in DocumentViewer.
 */
export function DocumentPageSkeleton({
  width = 795,
  height = 1123,
  embedded = false,
  responsive = false,
}: DocumentPageSkeletonProps) {
  const frameClasses = embedded
    ? "w-full h-full bg-white rounded-xl p-6 sm:p-10 flex flex-col justify-between overflow-hidden select-none"
    : "rounded-xl border border-slate-200/90 bg-white shadow-md p-6 sm:p-10 flex flex-col justify-between shrink-0 overflow-hidden select-none";

  const frameStyle: React.CSSProperties = responsive
    ? { width: "min(100%, 795px)", aspectRatio: "795 / 1123" }
    : {
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${width}px`,
        minHeight: `${height}px`,
      };

  return (
    <div className={frameClasses} style={frameStyle} aria-hidden="true">
      <div className="space-y-6 animate-pulse">
        {/* Document Header Block */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-2.5 w-1/2">
            <div className="h-5 w-44 rounded-md bg-slate-200/80" />
            <div className="h-3 w-60 max-w-full rounded bg-slate-100" />
            <div className="h-3 w-48 max-w-full rounded bg-slate-100" />
          </div>
          <div className="space-y-2 flex flex-col items-end w-1/3">
            <div className="h-4 w-28 rounded-md bg-slate-200/80" />
            <div className="h-3 w-24 rounded bg-slate-100" />
            <div className="h-5 w-20 rounded-full bg-slate-100 border border-slate-200/60" />
          </div>
        </div>

        {/* 2-Column Metadata Blocks (Exporter / Importer / Reference) */}
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((col) => (
            <div
              key={col}
              className="rounded-lg border border-slate-100 bg-slate-50/50 p-3.5 space-y-2"
            >
              <div className="h-2.5 w-24 rounded bg-slate-200/75" />
              <div className="h-3.5 w-4/5 rounded bg-slate-200/80" />
              <div className="h-2.5 w-full rounded bg-slate-100" />
              <div className="h-2.5 w-2/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>

        {/* 3-Column Shipment / Summary Info */}
        <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-100">
          {[0, 1, 2].map((cell) => (
            <div key={cell} className="space-y-1.5">
              <div className="h-2.5 w-16 rounded bg-slate-100" />
              <div className="h-3.5 w-24 max-w-full rounded bg-slate-200/75" />
            </div>
          ))}
        </div>

        {/* Document Line-Items Table Skeleton */}
        <div className="rounded-lg border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-100">
            <div className="col-span-1 h-2.5 rounded bg-slate-200/80" />
            <div className="col-span-5 h-2.5 rounded bg-slate-200/80" />
            <div className="col-span-2 h-2.5 rounded bg-slate-200/80" />
            <div className="col-span-2 h-2.5 rounded bg-slate-200/80" />
            <div className="col-span-2 h-2.5 rounded bg-slate-200/80" />
          </div>
          <div className="divide-y divide-slate-100">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="grid grid-cols-12 gap-2 px-3 py-3 items-center">
                <div className="col-span-1 h-2.5 rounded bg-slate-100" />
                <div className="col-span-5 space-y-1.5">
                  <div className="h-3 w-4/5 rounded bg-slate-200/70" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                </div>
                <div className="col-span-2 h-3 rounded bg-slate-100" />
                <div className="col-span-2 h-3 rounded bg-slate-100" />
                <div className="col-span-2 h-3 rounded bg-slate-200/70" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Totals & Stamp Area */}
      <div className="pt-5 mt-6 border-t border-slate-100 flex items-end justify-between gap-4 animate-pulse">
        <div className="space-y-2 w-1/3">
          <div className="h-2.5 w-28 rounded bg-slate-100" />
          <div className="h-12 w-32 rounded-lg border border-dashed border-slate-200 bg-slate-50/70" />
        </div>
        <div className="space-y-2 w-1/3 flex flex-col items-end">
          <div className="h-3 w-36 rounded bg-slate-100" />
          <div className="h-3 w-32 rounded bg-slate-100" />
          <div className="h-4 w-40 rounded bg-slate-200/80 mt-1" />
        </div>
      </div>
    </div>
  );
}

/**
 * Thumbnail card placeholders matching the far-left page strip in DocumentViewer.
 */
export function ThumbnailStripSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-full animate-pulse" aria-hidden="true">
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          className="w-full flex flex-col items-center rounded-lg p-1.5 bg-white border border-slate-200/80 shadow-2xs"
        >
          <div className="w-8 h-10 rounded border border-slate-200/80 bg-slate-50 flex flex-col justify-between p-1 mb-1">
            <div className="space-y-0.5">
              <div className="h-0.5 w-full rounded-full bg-slate-200" />
              <div className="h-0.5 w-4/5 rounded-full bg-slate-200/80" />
              <div className="h-0.5 w-3/5 rounded-full bg-slate-200/60" />
            </div>
            <div className="h-1.5 w-2 rounded bg-slate-200/80 ml-auto" />
          </div>
          <div className="h-2.5 w-7 rounded bg-slate-200/80" />
        </div>
      ))}
    </div>
  );
}

/**
 * Full DocumentViewer shell skeleton (left 7-column area of MatchingDetailView).
 */
export function DocumentViewerSkeleton({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex flex-col h-full bg-slate-50/70 rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
      {/* Top Viewer Controls Bar */}
      <div className="bg-white border-b border-slate-200/80 px-3 py-2 flex items-center justify-between gap-3 shrink-0">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/70 active:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-medium transition-colors cursor-pointer select-none"
            title="Kembali ke daftar file"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Kembali</span>
          </button>
        ) : (
          <div className="h-7 w-20 rounded-lg bg-slate-100 animate-pulse" />
        )}

        <div className="flex items-center gap-1.5 shrink-0 animate-pulse" aria-hidden="true">
          <div className="h-7 w-28 rounded-lg bg-slate-100 border border-slate-200/70" />
          <div className="h-7 w-7 rounded-lg bg-slate-100 border border-slate-200/70" />
          <div className="h-7 w-24 rounded-lg bg-slate-100 border border-slate-200/70" />
          <div className="h-7 w-24 rounded-lg bg-slate-100 border border-slate-200/70" />
        </div>
      </div>

      {/* Main Viewer Body: Thumbnail Strip + Document Sheet Skeleton */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="w-16 sm:w-20 bg-white border-r border-slate-200/80 shrink-0 overflow-hidden p-1.5 space-y-1.5 flex flex-col items-center">
          <div className="text-[9px] font-semibold text-slate-400 tracking-wider mb-0.5 w-full text-center select-none">
            Hal.
          </div>
          <ThumbnailStripSkeleton count={3} />
        </div>

        <div className="flex-1 overflow-hidden p-4 bg-slate-200/50 flex flex-col items-center">
          <DocumentPageSkeleton responsive />
        </div>
      </div>
    </div>
  );
}

/**
 * ComparisonPanel shell skeleton (right 5-column area of MatchingDetailView).
 */
export function ComparisonPanelSkeleton() {
  return (
    <div
      className="flex flex-col h-full bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
      aria-hidden="true"
    >
      {/* 1. Header Row: Title + Search Input + Segmented Tabs */}
      <div className="p-3.5 border-b border-slate-200/80 bg-white space-y-2.5 shrink-0 animate-pulse">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="h-4 w-36 rounded bg-slate-200/80" />
          <div className="h-5 w-16 rounded-full bg-slate-100 border border-slate-200/70" />
          <div className="h-3 w-44 rounded bg-slate-100" />
        </div>

        {/* Search Input Skeleton */}
        <div className="h-[34px] w-full rounded-xl bg-slate-50/80 border border-slate-200" />

        {/* Segmented Document Switcher Tabs Skeleton */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/70">
          <div className="h-7 w-20 rounded-lg bg-slate-200/80 border border-slate-300/50" />
          <div className="h-7 w-20 rounded-lg bg-slate-100/60" />
          <div className="h-7 w-16 rounded-lg bg-slate-100/60" />
        </div>
      </div>

      {/* 2. Scrollable Body: Sticky Sub-Header + Field Cards */}
      <div className="flex-1 overflow-hidden px-3.5 pb-4 pt-0 space-y-3 bg-slate-50/40">
        {/* Sub-header */}
        <div className="bg-white/95 py-2.5 -mx-3.5 px-3.5 border-b border-slate-200/80 shadow-2xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-5 w-11 rounded bg-blue-50 border border-blue-100" />
            <div className="h-3.5 w-24 rounded bg-slate-200/80" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-4.5 w-16 rounded-full bg-emerald-50 border border-emerald-200/70" />
            <div className="h-4.5 w-18 rounded-full bg-rose-50 border border-rose-200/70" />
          </div>
        </div>

        {/* Field Card Skeletons */}
        <div className="space-y-2.5 pt-1 animate-pulse">
          {[0, 1, 2, 3].map((cardIdx) => (
            <div
              key={cardIdx}
              className="rounded-xl border border-slate-200/90 border-l-3 border-l-slate-200 bg-white p-3 shadow-2xs"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="h-3.5 w-40 rounded bg-slate-200/80" />
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-5 w-14 rounded-full bg-slate-100 border border-slate-200/70" />
                  <div className="w-7 h-7 rounded-full bg-slate-50 border border-slate-200/80" />
                </div>
              </div>

              {/* Side-by-side Value Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                {[0, 1].map((side) => (
                  <div
                    key={side}
                    className="border border-slate-200/80 rounded-lg p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="h-2.5 w-16 rounded bg-slate-100" />
                      <div className="h-3.5 w-9 rounded bg-blue-50 border border-blue-100/70" />
                    </div>
                    <div className="h-3.5 w-4/5 rounded bg-slate-200/80" />
                    <div className="pt-1 border-t border-slate-100 flex justify-end">
                      <div className="w-4 h-4 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes Action Row */}
              <div className="mt-2 pt-2 border-t border-slate-100">
                <div className="h-3 w-16 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Panel Footer Skeleton */}
      <div className="px-3.5 py-2 border-t border-slate-200/80 bg-white flex items-center justify-end gap-2 shrink-0 animate-pulse">
        <div className="h-7 w-32 rounded-lg bg-emerald-50 border border-emerald-200/80" />
        <div className="h-7 w-44 rounded-lg bg-emerald-200/70" />
      </div>
    </div>
  );
}
