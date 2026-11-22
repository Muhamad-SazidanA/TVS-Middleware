"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { BoundingBox, FieldMatchStatus } from "~/types/documentComparison";

// Configure PDF.js worker
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export interface HighlightItem {
  fieldId: string;
  label: string;
  bbox: BoundingBox;
  status: FieldMatchStatus;
}

export interface PdfViewerProps {
  url: string;
  fileName: string;
  documentRole: "Acuan Utama" | "Pembanding";
  documentTypeLabel?: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  activeFieldId: string | null;
  onFieldSelect: (fieldId: string) => void;
  highlights: HighlightItem[];
  className?: string;
  fallbackMessage?: string;
}

export default function PdfViewer({
  url,
  fileName,
  documentRole,
  documentTypeLabel,
  currentPage,
  onPageChange,
  zoom,
  onZoomChange,
  activeFieldId,
  onFieldSelect,
  highlights,
  className = "",
  fallbackMessage = "Dokumen PDF fisik tidak tersedia untuk batch ini",
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAutoZoomEnabled, setIsAutoZoomEnabled] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const activeHighlightRef = useRef<HTMLButtonElement | null>(null);
  const pendingScrollFieldIdRef = useRef<string | null>(null);
  const lastCenteredFieldIdRef = useRef<string | null>(null);

  // Pre-flight check on URL to prevent PDF.js unhandled 404 runtime exceptions
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setIsNotFound(false);
    setLoadError(null);
    setNumPages(null);

    fetch(url, { method: "HEAD", signal: controller.signal })
      .then((res) => {
        if (res.status === 404 || res.status === 400 || res.status === 403) {
          setIsNotFound(true);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Network errors will be handled defensively by react-pdf or loadError
      });

    return () => {
      controller.abort();
    };
  }, [url]);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setLoadError(null);
    setIsNotFound(false);
    if (currentPage > numPages) {
      onPageChange(1);
    }
  };

  const handleDocumentLoadError = (err: Error) => {
    const msg = err?.message || "";
    if (msg.includes("404") || msg.includes("Unexpected server response (404)")) {
      setIsNotFound(true);
      setIsLoading(false);
      setLoadError(null);
      return;
    }
    console.warn(`[PdfViewer] Error loading ${fileName}:`, msg);
    setIsLoading(false);
    setLoadError(msg || "Gagal memuat dokumen PDF.");
  };

  const handleZoomIn = () => {
    onZoomChange(Math.min(zoom + 15, 200));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(zoom - 15, 50));
  };

  const handleZoomReset = () => {
    onZoomChange(100);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (numPages && currentPage < numPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Filter highlights applicable for this current page
  const pageHighlights = highlights.filter(
    (h) => h.bbox && Number(h.bbox.page) === Number(currentPage)
  );

  const activeHlOnCurrentPage = pageHighlights.find(
    (h) => h.fieldId === activeFieldId
  );

  // Smooth scroll and centering engine
  const scrollToHighlight = useCallback(
    (fieldId: string, smooth: boolean = true) => {
      const container = containerRef.current;
      if (!container || container.clientWidth === 0) return;

      const hl = highlights.find(
        (h) => h.fieldId === fieldId && Number(h.bbox.page) === Number(currentPage)
      );
      if (!hl?.bbox) return;

      let deltaX = 0;
      let deltaY = 0;

      if (activeHighlightRef.current) {
        const boxRect = activeHighlightRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        deltaX = boxRect.left + boxRect.width / 2 - (containerRect.left + containerRect.width / 2);
        deltaY = boxRect.top + boxRect.height / 2 - (containerRect.top + containerRect.height / 2);
      } else if (pageWrapperRef.current) {
        const pageRect = pageWrapperRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const boxCenterX =
          pageRect.left +
          ((hl.bbox.x + hl.bbox.width / 2) / 100) * pageRect.width;
        const boxCenterY =
          pageRect.top +
          ((hl.bbox.y + hl.bbox.height / 2) / 100) * pageRect.height;
        deltaX = boxCenterX - (containerRect.left + containerRect.width / 2);
        deltaY = boxCenterY - (containerRect.top + containerRect.height / 2);
      } else {
        return;
      }

      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      const maxScrollTop = container.scrollHeight - container.clientHeight;

      const targetLeft = Math.max(0, Math.min(container.scrollLeft + deltaX, maxScrollLeft));
      const targetTop = Math.max(0, Math.min(container.scrollTop + deltaY, maxScrollTop));

      container.scrollTo({
        left: targetLeft,
        top: targetTop,
        behavior: smooth ? "smooth" : "auto",
      });
    },
    [highlights, currentPage]
  );

  // React to activeFieldId changes (Auto-zoom & trigger centering)
  useEffect(() => {
    if (!activeFieldId || isNotFound) {
      lastCenteredFieldIdRef.current = null;
      return;
    }

    if (activeFieldId === lastCenteredFieldIdRef.current) return;

    const targetHighlight = highlights.find((h) => h.fieldId === activeFieldId);
    if (!targetHighlight?.bbox) return;

    const targetPage = Number(targetHighlight.bbox.page);
    let willTriggerRerender = false;

    // 1. Check if page navigation is needed
    if (targetPage && targetPage !== currentPage) {
      willTriggerRerender = true;
      onPageChange(targetPage);
    }

    // 2. Check if adaptive auto-zoom is needed
    if (isAutoZoomEnabled && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const basePageWidth = 595;
      const boxWidthPxAt100 = (targetHighlight.bbox.width / 100) * basePageWidth;
      const availableWidth = Math.max(containerWidth - 32, 200);

      let targetZoom = 140; // Sweet spot reading scale
      if (targetHighlight.bbox.width > 50 && boxWidthPxAt100 > 0) {
        targetZoom = Math.round((availableWidth / boxWidthPxAt100) * 100);
      }
      targetZoom = Math.max(100, Math.min(targetZoom, 160));

      // Preserve higher zoom if user manually zoomed beyond targetZoom
      if (zoom < targetZoom) {
        willTriggerRerender = true;
        onZoomChange(targetZoom);
      }
    }

    pendingScrollFieldIdRef.current = activeFieldId;

    if (!willTriggerRerender) {
      // Page and zoom are unchanged; center immediately on next frame
      requestAnimationFrame(() => {
        scrollToHighlight(activeFieldId, true);
        lastCenteredFieldIdRef.current = activeFieldId;
        pendingScrollFieldIdRef.current = null;
      });
    }
  }, [
    activeFieldId,
    currentPage,
    zoom,
    isAutoZoomEnabled,
    isNotFound,
    highlights,
    onPageChange,
    onZoomChange,
    scrollToHighlight,
  ]);

  // Two-phase render synchronization: Page render complete callback
  const handlePageRenderSuccess = () => {
    setIsLoading(false);
    if (pendingScrollFieldIdRef.current) {
      const targetId = pendingScrollFieldIdRef.current;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToHighlight(targetId, true);
          lastCenteredFieldIdRef.current = targetId;
          pendingScrollFieldIdRef.current = null;
        });
      });
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-slate-100 rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs ${className}`}
    >
      {/* Top Bar Header */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        {/* Document Role & Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight shrink-0 border ${
              documentRole === "Acuan Utama"
                ? "bg-blue-50 text-blue-900 border-blue-200"
                : "bg-purple-50 text-purple-900 border-purple-200"
            }`}
          >
            {documentRole}
          </span>
          {documentTypeLabel && (
            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
              {documentTypeLabel}
            </span>
          )}
          <span
            className="font-medium text-slate-700 truncate text-[11px]"
            title={fileName}
          >
            {fileName}
          </span>
        </div>

        {/* Navigation, Centering & Zoom Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Manual Center Button */}
          {activeHlOnCurrentPage && !isNotFound && (
            <button
              type="button"
              onClick={() => scrollToHighlight(activeFieldId!, true)}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
              title="Pusatkan sorotan aktif"
            >
              <svg
                className="w-3 h-3 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="7" strokeWidth="2" />
                <line x1="12" y1="2" x2="12" y2="6" strokeWidth="2" />
                <line x1="12" y1="18" x2="12" y2="22" strokeWidth="2" />
                <line x1="2" y1="12" x2="6" y2="12" strokeWidth="2" />
                <line x1="18" y1="12" x2="22" y2="12" strokeWidth="2" />
              </svg>
              <span>Pusatkan</span>
            </button>
          )}

          {/* Auto-Zoom Toggle Button */}
          {!isNotFound && (
            <button
              type="button"
              onClick={() => setIsAutoZoomEnabled((prev) => !prev)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                isAutoZoomEnabled
                  ? "bg-blue-50 text-blue-900 border-blue-200"
                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
              }`}
              title={
                isAutoZoomEnabled
                  ? "Auto-zoom aktif (klik untuk matikan)"
                  : "Auto-zoom mati (klik untuk aktifkan)"
              }
            >
              Auto {isAutoZoomEnabled ? "On" : "Off"}
            </button>
          )}

          {/* Page Navigation */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-1 py-0.5">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={isNotFound || currentPage <= 1 || isLoading}
              className="px-1 text-slate-600 hover:text-blue-950 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
              title="Halaman sebelumnya"
            >
              &lt;
            </button>
            <span className="px-1.5 text-[11px] font-mono text-slate-700 select-none">
              {isNotFound ? "- / -" : `${currentPage} / ${numPages || "-"}`}
            </span>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={isNotFound || !numPages || currentPage >= numPages || isLoading}
              className="px-1 text-slate-600 hover:text-blue-950 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
              title="Halaman berikutnya"
            >
              &gt;
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-1 py-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={isNotFound || zoom <= 50}
              className="px-1 text-slate-600 hover:text-blue-950 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
              title="Perkecil"
            >
              -
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              disabled={isNotFound}
              className="px-1 text-[10px] font-mono text-slate-700 hover:text-blue-950 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer select-none"
              title="Reset zoom 100%"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={isNotFound || zoom >= 200}
              className="px-1 text-slate-600 hover:text-blue-950 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
              title="Perbesar"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* PDF Viewport Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-3 flex justify-center bg-slate-200/50 relative"
      >
        {isNotFound ? (
          <div className="m-auto p-6 max-w-sm w-full bg-white rounded-xl border border-slate-200 text-center shadow-xs">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h4 className="font-semibold text-slate-800 text-sm">
              Dokumen fisik tidak tersedia
            </h4>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {fallbackMessage}. Data perbandingan tetap dapat ditinjau melalui daftar field di panel tengah.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                Tipe: {documentTypeLabel || fileName}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                Status: Hanya data OCR
              </span>
            </div>
          </div>
        ) : loadError ? (
          <div className="m-auto p-4 max-w-sm bg-white rounded-xl border border-rose-200 text-center shadow-xs">
            <p className="font-bold text-rose-900 text-xs">Gagal memuat PDF</p>
            <p className="text-[11px] text-slate-500 mt-1 break-words">{loadError}</p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-200"
            >
              Buka file di tab baru
            </a>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={
              <div className="m-auto flex flex-col items-center justify-center p-6 text-slate-500">
                <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs font-medium">Memuat PDF {fileName}...</span>
              </div>
            }
            className="flex flex-col items-center"
          >
            <div
              ref={pageWrapperRef}
              className="relative shadow-md rounded border border-slate-300 bg-white"
            >
              <Page
                pageNumber={currentPage}
                scale={zoom / 100}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onRenderSuccess={handlePageRenderSuccess}
                className="overflow-hidden"
              />

              {/* Bounding Box Highlights Overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: "100%",
                  height: "100%",
                }}
              >
                {pageHighlights.map((hl) => {
                  const isActive = activeFieldId === hl.fieldId;
                  const { x, y, width, height } = hl.bbox;

                  return (
                    <button
                      key={hl.fieldId}
                      ref={isActive ? activeHighlightRef : null}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFieldSelect(hl.fieldId);
                      }}
                      className={`absolute pointer-events-auto transition-all cursor-pointer rounded-xs text-left group ${
                        isActive
                          ? "border-2 border-blue-600 bg-blue-500/30 ring-2 ring-blue-300 ring-offset-1 z-30"
                          : "border border-blue-500/80 bg-blue-400/15 hover:bg-blue-500/25 hover:border-blue-700 z-10"
                      }`}
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                      }}
                      title={`${hl.label} (Klik untuk pilih field)`}
                    >
                      {/* Floating tooltip on hover */}
                      <span className="absolute -top-5 left-0 px-1 py-0.2 rounded bg-blue-950 text-white text-[9px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xs z-40">
                        {hl.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}
