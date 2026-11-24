"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Grid,
  FileText,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import type { BatchDocumentModel, ComparisonFieldModel, NormalizedBbox } from "./detailTypes";

export interface ViewerHighlightItem {
  id: string;
  fieldId: string;
  number?: string;
  rowNumber?: number;
  label: string;
  bbox: NormalizedBbox;
  page: number;
  status?: string;
  isTableItem?: boolean;
  rowIndex?: number;
}

// Configure PDF.js worker locally from /public (0ms network latency, no unpkg CDN delay)
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

const PDF_OPTIONS = {
  cMapUrl: "/cmaps/",
  standardFontDataUrl: "/standard_fonts/",
};

// Resilient Page Error Boundary to prevent "Invalid page request" from crashing the view
class PageErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode; resetKey: unknown },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode; resetKey: unknown }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidUpdate(prevProps: { resetKey: unknown }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export interface DocumentViewerProps {
  // Document selection
  pibDoc: BatchDocumentModel;
  supportingDocs: BatchDocumentModel[];
  currentDocCode: string; // "PIB" or supporting doc code
  onSelectDocCode: (code: string) => void;

  // Comparison fields & active field
  fields: ComparisonFieldModel[];
  activeFieldId: string | null;
  onSelectField: (fieldId: string) => void;

  // Explicit page navigation request (e.g. from line items card click)
  targetPage?: { page: number; timestamp: number } | null;

  // Optional back callback (returns to files / batch list)
  onBack?: () => void;

  className?: string;
}

export default function DocumentViewer({
  pibDoc,
  supportingDocs,
  currentDocCode,
  onSelectDocCode,
  fields,
  activeFieldId,
  onSelectField,
  targetPage,
  onBack,
  className = "",
}: DocumentViewerProps) {
  // Identify currently active document
  const isPibActive = currentDocCode.toUpperCase() === "PIB";
  const activeDoc: BatchDocumentModel = isPibActive
    ? pibDoc
    : supportingDocs.find(
        (d) => d.code.toLowerCase() === currentDocCode.toLowerCase()
      ) || pibDoc;

  // PDF Viewport state
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1); // Target requested page
  const [pageInput, setPageInput] = useState<string>("1");
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Double-buffering slots for seamless, flicker-free page transitions:
  // Slot 0 and Slot 1 hold page numbers. activeSlot is the currently visible one.
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [slot0Page, setSlot0Page] = useState<number>(1);
  const [slot1Page, setSlot1Page] = useState<number | null>(null);
  const renderedSlot0Ref = useRef<number | null>(null);
  const renderedSlot1Ref = useRef<number | null>(null);

  // Safe clamped target page number
  const safeTargetPage =
    numPages && numPages > 0
      ? Math.min(Math.max(1, currentPage || 1), numPages)
      : 1;

  // Currently visible rendered page number on the active slot
  const visiblePage = activeSlot === 0 ? slot0Page : (slot1Page ?? slot0Page);
  const safeVisiblePage =
    numPages && numPages > 0
      ? Math.min(Math.max(1, visiblePage || 1), numPages)
      : 1;

  const isRenderingTarget = safeTargetPage !== safeVisiblePage;
  const targetPageRef = useRef<number>(safeTargetPage);
  targetPageRef.current = safeTargetPage;

  // Detect landscape documents (e.g. WL, MS, or width > height)
  const isLandscapeDoc =
    activeDoc.code?.toUpperCase() === "WL" ||
    activeDoc.code?.toUpperCase() === "MS";

  // Dynamic page dimensions for virtualization placeholders (portrait: 795 x 1123, landscape: 1123 x 795)
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({
    width: isLandscapeDoc ? 1123 : 795,
    height: isLandscapeDoc ? 795 : 1123,
  });

  // Suppress harmless pdfjs cancellation / abort errors when navigating rapidly
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason || "");
      const name = reason?.name || "";
      if (
        name === "AbortError" ||
        name === "RenderingCancelledException" ||
        msg.includes("signal is aborted") ||
        msg.includes("RenderingCancelledException") ||
        msg.includes("Worker was destroyed") ||
        msg.includes("cancelled")
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  const handlePageLoadSuccess = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (page: any) => {
      const w = page.originalWidth || page.width;
      const h = page.originalHeight || page.height;
      if (w && h) {
        setPageSize((prev) => {
          if (Math.round(prev.width) === Math.round(w) && Math.round(prev.height) === Math.round(h)) {
            return prev;
          }
          return { width: Math.round(w), height: Math.round(h) };
        });
      }
    },
    []
  );

  const isLandscape =
    isLandscapeDoc ||
    pageSize.width > pageSize.height;

  const baseWidth = pageSize.width || (isLandscape ? 1123 : 795);
  const baseHeight = pageSize.height || (isLandscape ? 795 : 1123);

  const scaledWidth = Math.round(baseWidth * (zoom / 100));
  const scaledHeight = Math.round(baseHeight * (zoom / 100));

  // Sync pageInput with safeTargetPage
  useEffect(() => {
    setPageInput(String(safeTargetPage));
  }, [safeTargetPage]);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const activeHighlightRef = useRef<HTMLButtonElement | null>(null);
  const lastCenteredFieldRef = useRef<string | null>(null);
  const lastTargetTimestampRef = useRef<number | null>(null);
  const isInitialFieldRef = useRef<boolean>(true);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentDocKey = `${activeDoc.code}-${activeDoc.id}-${activeDoc.fileUrl}`;
  const lastDocKeyRef = useRef<string>("");
  const pendingTargetPageRef = useRef<number | null>(null);

  // Helper to change page seamlessly
  const changeToPage = useCallback(
    (pageNum: number, shouldScroll: boolean = false) => {
      if (!numPages) {
        pendingTargetPageRef.current = pageNum;
        return;
      }
      pendingTargetPageRef.current = null;
      const clamped = Math.min(Math.max(1, pageNum), numPages);
      setCurrentPage(clamped);
      setPageInput(String(clamped));

      if (shouldScroll) {
        isProgrammaticScrollRef.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        pageRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", block: "start" });
        scrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 800);
      }

      setSlot0Page(clamped);
      renderedSlot0Ref.current = clamped;
    },
    [numPages]
  );

  // Slot render handlers
  const handleSlotRenderSuccess = useCallback(
    (slotIndex: 0 | 1, renderedPage: number) => {
      if (slotIndex === 0) {
        renderedSlot0Ref.current = renderedPage;
      } else {
        renderedSlot1Ref.current = renderedPage;
      }
      if (renderedPage === targetPageRef.current) {
        setActiveSlot(slotIndex);
      }
    },
    []
  );

  const handleSlotRenderError = useCallback(
    (slotIndex: 0 | 1, renderedPage: number, err: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyErr = err as any;
      if (anyErr?.message?.includes("cancelled") || anyErr?.name === "RenderingCancelledException") {
        return;
      }
      if (slotIndex === 0) {
        if (renderedSlot0Ref.current === renderedPage) renderedSlot0Ref.current = null;
      } else {
        if (renderedSlot1Ref.current === renderedPage) renderedSlot1Ref.current = null;
      }
      console.warn(`[DocumentViewer] Slot ${slotIndex} page ${renderedPage} render error:`, err);
      // Fallback: if render fails for target page, still swap so UI doesn't hang indefinitely
      if (renderedPage === targetPageRef.current) {
        setActiveSlot(slotIndex);
      }
    },
    []
  );

  // Fallback safety timer: if target page rendering does not complete within 3s, swap slot
  useEffect(() => {
    if (isRenderingTarget) {
      const timer = setTimeout(() => {
        const inactiveSlot = activeSlot === 0 ? 1 : 0;
        const targetOnInactive = inactiveSlot === 0 ? slot0Page : slot1Page;
        if (targetOnInactive === safeTargetPage) {
          setActiveSlot(inactiveSlot);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isRenderingTarget, activeSlot, slot0Page, slot1Page, safeTargetPage]);

  // Reset viewer state ONLY when active document identity actually changes
  useEffect(() => {
    if (lastDocKeyRef.current !== currentDocKey) {
      lastDocKeyRef.current = currentDocKey;
      setIsLoading(true);
      setIsNotFound(false);
      setLoadError(null);
      setNumPages(null);
      setCurrentPage(1);
      setPageInput("1");
      setSlot0Page(1);
      setSlot1Page(null);
      setActiveSlot(0);
      renderedSlot0Ref.current = null;
      renderedSlot1Ref.current = null;
      lastTargetTimestampRef.current = null;
      const isLandscapeNext =
        activeDoc.code?.toUpperCase() === "WL" ||
        activeDoc.code?.toUpperCase() === "MS";
      setPageSize({
        width: isLandscapeNext ? 1123 : 795,
        height: isLandscapeNext ? 795 : 1123,
      });
    }
  }, [currentDocKey, activeDoc.code]);

  const handleDocumentLoadSuccess = ({ numPages: loadedPages }: { numPages: number }) => {
    setNumPages(loadedPages);
    setIsLoading(false);
    setLoadError(null);
    setIsNotFound(false);
    const requestedP = pendingTargetPageRef.current || targetPage?.page || 1;
    pendingTargetPageRef.current = null;
    const initialP = Math.min(Math.max(1, requestedP), loadedPages);
    setCurrentPage(initialP);
    setPageInput(String(initialP));
    setSlot0Page(initialP);
    setSlot1Page(null);
    setActiveSlot(0);
    renderedSlot0Ref.current = null;
    renderedSlot1Ref.current = null;

    if (initialP > 1) {
      isProgrammaticScrollRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 1200);
      setTimeout(() => {
        pageRefs.current[initialP]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  };

  // If a pending page request was buffered while PDF was loading, execute it once numPages arrives
  useEffect(() => {
    if (numPages && pendingTargetPageRef.current) {
      const p = pendingTargetPageRef.current;
      pendingTargetPageRef.current = null;
      changeToPage(p);
    }
  }, [numPages, changeToPage]);

  const handleDocumentLoadError = (err: Error) => {
    const msg = err?.message || "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (err as any)?.name || "";
    const isMissing =
      msg.includes("404") ||
      msg.includes("Unexpected server response (404)") ||
      msg.includes("Missing PDF") ||
      msg.includes("not found") ||
      name === "MissingPDFException" ||
      name === "UnexpectedResponseException";

    if (isMissing) {
      setIsNotFound(true);
      setIsLoading(false);
      setLoadError(null);
      return;
    }
    console.warn(`[DocumentViewer] Load error for ${activeDoc.fileName}:`, msg);
    setIsLoading(false);
    setLoadError(msg || "Dokumen fisik tidak tersedia");
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z + 15, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 15, 50));
  const handleZoomReset = () => setZoom(100);

  // Rotate handler
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Page navigation handlers
  const handlePrevPage = () => {
    if (safeTargetPage > 1) {
      changeToPage(safeTargetPage - 1, true);
    }
  };
  const handleNextPage = () => {
    if (numPages && safeTargetPage < numPages) {
      changeToPage(safeTargetPage + 1, true);
    }
  };

  // 1. Header field highlights
  const headerHighlights = useMemo<ViewerHighlightItem[]>(() => {
    return fields
      .filter((f) => {
        if (isPibActive) return true;
        return !f.docCode || f.docCode.toUpperCase() === currentDocCode.toUpperCase();
      })
      .map((f) => {
        const bbox = isPibActive ? f.pibBbox : f.supportingBbox;
        const page = isPibActive ? f.pibPage : f.supportingPage;
        return {
          id: `hdr-${f.id}`,
          fieldId: f.id,
          number: f.number,
          label: f.label,
          bbox: bbox!,
          page: bbox?.page ?? page ?? 1,
          status: f.status,
          isTableItem: false,
        };
      })
      .filter((h) => Boolean(h.bbox));
  }, [fields, isPibActive, currentDocCode]);

  // In matching section, only header fields are matched and highlighted
  const allHighlights = useMemo<ViewerHighlightItem[]>(() => {
    return headerHighlights;
  }, [headerHighlights]);

  // Helper to check if a highlight is active
  const isHighlightActive = useCallback(
    (hl: ViewerHighlightItem): boolean => {
      if (!activeFieldId) return false;
      return activeFieldId.toLowerCase().trim() === hl.fieldId.toLowerCase().trim();
    },
    [activeFieldId]
  );

  // Clear activeHighlightRef whenever activeFieldId or visible page changes
  useEffect(() => {
    activeHighlightRef.current = null;
  }, [activeFieldId, safeTargetPage]);

  // Centering on active highlight
  const scrollToHighlight = useCallback(
    (_fieldId: string) => {
      const container = containerRef.current;
      if (!container || container.clientWidth === 0) return;

      const hl = allHighlights.find((h) => isHighlightActive(h) && Number(h.page || 1) === safeTargetPage);
      if (!hl?.bbox) return;

      const pageEl = pageRefs.current[safeTargetPage];

      isProgrammaticScrollRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 800);

      if (activeHighlightRef.current) {
        const boxRect = activeHighlightRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const deltaX = boxRect.left + boxRect.width / 2 - (containerRect.left + containerRect.width / 2);
        const deltaY = boxRect.top + boxRect.height / 2 - (containerRect.top + containerRect.height / 2);
        container.scrollTo({
          left: Math.max(0, container.scrollLeft + deltaX),
          top: Math.max(0, container.scrollTop + deltaY),
          behavior: "smooth",
        });
      } else if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const boxCenterX = pageRect.left + ((hl.bbox.x + hl.bbox.width / 2) / 100) * pageRect.width;
        const boxCenterY = pageRect.top + ((hl.bbox.y + hl.bbox.height / 2) / 100) * pageRect.height;
        const deltaX = boxCenterX - (containerRect.left + containerRect.width / 2);
        const deltaY = boxCenterY - (containerRect.top + containerRect.height / 2);
        container.scrollTo({
          left: Math.max(0, container.scrollLeft + deltaX),
          top: Math.max(0, container.scrollTop + deltaY),
          behavior: "smooth",
        });
      }
    },
    [allHighlights, isHighlightActive, safeTargetPage]
  );

  // Navigate page and auto-zoom when activeFieldId changes
  useEffect(() => {
    if (!activeFieldId || isNotFound) {
      lastCenteredFieldRef.current = null;
      return;
    }
    if (activeFieldId === lastCenteredFieldRef.current) return;
    lastCenteredFieldRef.current = activeFieldId;

    // If this is the initial default field selection on batch load, preserve 100% overview zoom
    if (isInitialFieldRef.current) {
      isInitialFieldRef.current = false;
    } else {
      // Auto-zoom to 160% optimal reading scale if not in comfortable range (140%-180%)
      setZoom((prevZoom) => {
        if (prevZoom < 140 || prevZoom > 180) {
          return 160;
        }
        return prevZoom;
      });
    }

    const hl = allHighlights.find((h) => isHighlightActive(h));
    if (hl && hl.page && typeof hl.page === "number" && !isNaN(hl.page)) {
      changeToPage(hl.page, true);
      return;
    }

    // Fallback: Field without bbox in fields list
    const f = fields.find((item) => item.id === activeFieldId);
    if (f) {
      const pageFallback = isPibActive ? f.pibPage : f.supportingPage;
      if (pageFallback && typeof pageFallback === "number" && !isNaN(pageFallback)) {
        changeToPage(pageFallback, true);
      }
    }
  }, [activeFieldId, isNotFound, isPibActive, fields, allHighlights, isHighlightActive, changeToPage]);

  // Center on highlight once page has switched to safeTargetPage or zoom scale has updated
  useEffect(() => {
    if (activeFieldId && safeTargetPage) {
      const hl = allHighlights.find((h) => isHighlightActive(h) && Number(h.page || 1) === safeTargetPage);
      if (hl) {
        const timer = setTimeout(() => {
          requestAnimationFrame(() => {
            scrollToHighlight(activeFieldId);
          });
        }, 120);
        return () => clearTimeout(timer);
      }
    }
  }, [activeFieldId, safeTargetPage, zoom, allHighlights, isHighlightActive, scrollToHighlight]);

  // Handle explicit target page navigation (e.g. from line items card click)
  useEffect(() => {
    if (targetPage && targetPage.page && targetPage.timestamp !== lastTargetTimestampRef.current) {
      lastTargetTimestampRef.current = targetPage.timestamp;
      isInitialFieldRef.current = false;
      changeToPage(targetPage.page, true);

      // User explicit click: ensure optimal auto-zoom
      if (activeFieldId) {
        setZoom((prevZoom) => {
          if (prevZoom < 140 || prevZoom > 180) {
            return 160;
          }
          return prevZoom;
        });
      }
    }
  }, [targetPage, changeToPage, activeFieldId]);

  // Render bounding box highlights overlay for a given page number
  const renderHighlightsOverlay = (pageNumber: number) => {
    const pageHighlights = allHighlights.filter((h) => Number(h.page) === pageNumber);

    const visibleHighlights = pageHighlights.filter((hl) => {
      const isActive = isHighlightActive(hl);
      return showGrid || isActive;
    });

    if (visibleHighlights.length === 0) return null;

    return (
      <div className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }}>
        {visibleHighlights.map((hl) => {
          const isActive = isHighlightActive(hl);
          const { x, y, width, height } = hl.bbox;
          const isTable = Boolean(hl.isTableItem);

          return (
            <button
              key={hl.id}
              ref={isActive ? (el) => { if (el) activeHighlightRef.current = el; } : null}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                isInitialFieldRef.current = false;
                setZoom((prevZoom) => {
                  if (prevZoom < 140 || prevZoom > 180) {
                    return 160;
                  }
                  return prevZoom;
                });
                onSelectField(hl.fieldId);
              }}
              className={`absolute pointer-events-auto transition-all cursor-pointer text-left group ${
                isActive
                  ? "border-2 border-blue-600 bg-blue-500/15 ring-2 ring-blue-400/40 ring-offset-1 z-30 rounded-xs"
                  : "border border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-600 hover:bg-emerald-500/20 z-10 rounded-xs"
              }`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
              title={
                isTable
                  ? `Baris #${hl.rowNumber}: ${hl.label} (Klik untuk pilih)`
                  : `${hl.number ? `${hl.number}. ` : ""}${hl.label} (Klik untuk pilih)`
              }
            >
              {/* Badge: For table items, show a single row badge on the first cell to prevent horizontal clumping */}
              {(!isTable || hl.label.toLowerCase().includes("pos tarif") || hl.label.toLowerCase().includes("hs") || x < 25) && (
                <span
                  className={`absolute -top-4 left-0 px-1.5 py-0.2 rounded text-[9px] font-bold shadow-xs select-none pointer-events-none whitespace-nowrap z-40 ${
                    isActive
                      ? "bg-blue-600 text-white ring-1 ring-blue-700"
                      : "bg-emerald-700/85 text-white"
                  }`}
                >
                  {isTable ? `Baris #${hl.rowNumber}` : hl.number ? `${hl.number}. ${hl.label}` : hl.label}
                </span>
              )}

              {/* Hover Tooltip */}
              <span className="absolute -bottom-6 left-0 px-1.5 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-40">
                {isTable ? `Baris #${hl.rowNumber}: ${hl.label}` : `${hl.number ? `${hl.number}. ` : ""}${hl.label}`}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  // Viewport-aware tracking of visible page via IntersectionObserver for vertical scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !numPages || numPages <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScrollRef.current) return;

        let bestEntry: IntersectionObserverEntry | null = null;
        let maxVisibleHeight = 0;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const visibleHeight = entry.intersectionRect.height;
            if (visibleHeight > maxVisibleHeight) {
              maxVisibleHeight = visibleHeight;
              bestEntry = entry;
            }
          }
        }
        if (bestEntry && maxVisibleHeight > Math.min(container.clientHeight * 0.35, 200)) {
          const pageNumAttr = (bestEntry.target as HTMLElement).getAttribute("data-page-number");
          if (pageNumAttr) {
            const p = parseInt(pageNumAttr, 10);
            if (!isNaN(p) && p >= 1 && p <= numPages && p !== safeTargetPage) {
              changeToPage(p, false);
            }
          }
        }
      },
      {
        root: container,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      }
    );

    Object.values(pageRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [numPages, safeTargetPage, changeToPage]);

  return (
    <div className={`flex flex-col h-full bg-slate-50/70 rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs ${className}`}>
      {/* 1. Document Switcher Segmented Control */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {/* PIB Option (Always first) */}
          <button
            type="button"
            onClick={() => onSelectDocCode("PIB")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border shrink-0 flex items-center gap-1.5 ${
              isPibActive
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            <FileText className={`w-3.5 h-3.5 ${isPibActive ? "text-white" : "text-slate-400"}`} />
            <span>PIB (acuan)</span>
          </button>

          {/* Dynamic Supporting Document Options */}
          {supportingDocs.map((doc) => {
            const isSelected = !isPibActive && currentDocCode.toUpperCase() === doc.code.toUpperCase();
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelectDocCode(doc.code)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <span className="font-mono">{doc.code}</span>
                <span className="text-[11px] opacity-75 hidden sm:inline truncate max-w-[120px]">
                  {doc.name !== doc.code ? `(${doc.name})` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Top Viewer Controls Bar */}
      <div className="flex border-b border-slate-200/80 shrink-0">
        {/* Left: Back button container aligned with thumbnail sidebar below */}
        {onBack && (
          <div className="w-28 sm:w-32 bg-slate-100/80 border-r border-slate-200/80 p-1.5 flex items-center justify-center shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer group"
              title="Kembali ke daftar file"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-800 transition-colors shrink-0" />
              <span className="truncate">Kembali</span>
            </button>
          </div>
        )}

        {/* Right: Controls Bar aligned with PDF canvas */}
        <div className="flex-1 px-3.5 py-2 bg-slate-50/90 flex items-center justify-between gap-2 min-w-0 flex-wrap">
          {/* Document Info */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-slate-800 text-xs truncate max-w-[180px] sm:max-w-[240px]" title={activeDoc.fileName}>
              {activeDoc.fileName}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600 border border-slate-300/60">
              {isPibActive ? "Dokumen acuan" : "Dokumen pendukung"}
            </span>
          </div>

          {/* Toolbar Controls */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* Tampilkan grid toggle */}
          <button
            type="button"
            onClick={() => setShowGrid((prev) => !prev)}
            className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              showGrid
                ? "bg-blue-50 text-blue-800 border-blue-200 shadow-2xs font-semibold"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
            title="Tampilkan seluruh bounding box field pada halaman ini"
          >
            <Grid className="w-3.5 h-3.5 text-slate-500" />
            <span>Tampilkan grid</span>
          </button>

          {/* Rotate Button */}
          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 rounded-lg text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            title="Putar halaman 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Page Navigation */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-1 py-0.5">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={isNotFound || safeTargetPage <= 1 || isLoading}
              className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Halaman sebelumnya"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1 px-1">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pageInput}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9]/g, "");
                  setPageInput(clean);
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const maxPages = numPages || safeTargetPage;
                  const clamped =
                    isNaN(val) || val < 1
                      ? safeTargetPage
                      : Math.min(Math.max(1, val), maxPages);
                  e.target.value = String(clamped);
                  setPageInput(String(clamped));
                  changeToPage(clamped, true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const inputEl = e.target as HTMLInputElement;
                    const val = parseInt(inputEl.value, 10);
                    const maxPages = numPages || safeTargetPage;
                    const clamped =
                      isNaN(val) || val < 1
                        ? safeTargetPage
                        : Math.min(Math.max(1, val), maxPages);
                    inputEl.value = String(clamped);
                    setPageInput(String(clamped));
                    changeToPage(clamped, true);
                    inputEl.blur();
                  }
                }}
                className="w-10 text-center text-xs font-mono font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded py-0.5 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
              <span className="text-xs font-mono text-slate-500">
                / {numPages || "-"}
              </span>
              {isRenderingTarget && (
                <span title="Memuat halaman...">
                  <RefreshCw className="w-3 h-3 text-blue-600 animate-spin shrink-0 ml-0.5" />
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={isNotFound || !numPages || safeTargetPage >= numPages || isLoading}
              className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Halaman berikutnya"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-1 py-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={isNotFound || zoom <= 50}
              className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Perkecil zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              disabled={isNotFound}
              className="px-1.5 text-[11px] font-mono text-slate-700 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer select-none"
              title="Reset zoom 100%"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={isNotFound || zoom >= 200}
              className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Perbesar zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* 3. Main Body: Split between Vertical Thumbnail Strip & Central Canvas Viewport */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Far-Left Vertical Thumbnail Strip (OUTSIDE <Document>, permanently stable layout) */}
        <div className="w-28 sm:w-32 bg-slate-100/80 border-r border-slate-200/80 shrink-0 overflow-y-auto p-2 space-y-2.5 flex flex-col items-center">
          <div className="text-[10px] font-semibold text-slate-500 tracking-wider mb-0.5 w-full text-center">
            Halaman
          </div>
          {numPages && numPages > 0 ? (
            Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
              const isSelectedPage = safeTargetPage === pageNum;
              const isRenderingThis = isSelectedPage && isRenderingTarget;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => changeToPage(pageNum, true)}
                  className={`group w-full flex flex-col items-center rounded-xl p-2 transition-all cursor-pointer ${
                    isSelectedPage
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white hover:bg-slate-200/80 text-slate-700 border border-slate-200/80"
                  }`}
                  title={`Pindah ke Halaman ${pageNum}`}
                >
                  <div
                    className={`w-11 h-13 rounded-md border flex flex-col justify-between p-1.5 mb-1 transition-colors ${
                      isSelectedPage
                        ? "bg-white/10 border-white/30"
                        : "bg-slate-50 border-slate-200 group-hover:border-slate-300"
                    }`}
                  >
                    <div className="space-y-1">
                      <div
                        className={`h-1 rounded-full w-full ${
                          isSelectedPage ? "bg-white/80" : "bg-slate-200"
                        }`}
                      />
                      <div
                        className={`h-1 rounded-full w-4/5 ${
                          isSelectedPage ? "bg-white/60" : "bg-slate-200"
                        }`}
                      />
                      <div
                        className={`h-1 rounded-full w-3/5 ${
                          isSelectedPage ? "bg-white/60" : "bg-slate-200"
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between w-full">
                      {isRenderingThis && (
                        <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-300" />
                      )}
                      <span
                        className={`text-[8px] font-mono font-bold ml-auto ${
                          isSelectedPage ? "text-white" : "text-slate-400"
                        }`}
                      >
                        {pageNum}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold">
                    Hal. {pageNum}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 w-full">
              {[1, 2].map((i) => (
                <div key={i} className="w-full h-18 rounded-xl bg-slate-200/50 animate-pulse border border-slate-200/60" />
              ))}
            </div>
          )}
        </div>

        {/* Central PDF Canvas Viewport Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-4 flex justify-center bg-slate-200/50 relative"
        >
          {isNotFound || loadError ? (
            <div className="m-auto p-6 max-w-sm w-full bg-white rounded-2xl border border-slate-200 text-center shadow-xs">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">Dokumen fisik tidak tersedia</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                File PDF {activeDoc.fileName} belum diunggah untuk batch ini. Data perbandingan tetap dapat ditinjau melalui panel sebelah kanan.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-2">
                <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                  {activeDoc.code}
                </span>
              </div>
            </div>
          ) : (
            <Document
              file={activeDoc.fileUrl}
              options={PDF_OPTIONS}
              suspense={false}
              onLoadSuccess={handleDocumentLoadSuccess}
              onLoadError={handleDocumentLoadError}
              loading={
                <div className="m-auto flex flex-col items-center justify-center p-8 text-slate-500 w-full h-full min-h-[400px]">
                  <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-3" />
                  <span className="text-xs font-semibold text-slate-700">Memuat berkas {activeDoc.fileName}...</span>
                </div>
              }
              error={
                <div className="m-auto p-6 max-w-sm w-full bg-white rounded-2xl border border-slate-200 text-center shadow-xs">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Dokumen fisik tidak tersedia</h4>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    File PDF {activeDoc.fileName} belum diunggah untuk batch ini. Data perbandingan tetap dapat ditinjau melalui panel sebelah kanan.
                  </p>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-2">
                    <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                      {activeDoc.code}
                    </span>
                  </div>
                </div>
              }
              className="flex flex-col items-center w-full min-h-full"
            >
              {numPages && numPages > 0 ? (
                <div className="flex flex-col items-center py-4 w-full min-h-full space-y-4">
                  {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                    const isWithinBufferWindow = Math.abs(pageNum - safeTargetPage) <= 1;

                    // Pages outside the buffer window render as lightweight placeholder divs with same dimensions
                    if (!isWithinBufferWindow) {
                      return (
                        <div
                          key={`page-placeholder-${pageNum}`}
                          ref={(el) => {
                            pageRefs.current[pageNum] = el;
                          }}
                          data-page-number={pageNum}
                          className="rounded-xl border border-dashed border-slate-300/80 bg-white/60 flex flex-col items-center justify-center text-slate-400 shrink-0 select-none shadow-2xs"
                          style={{
                            width: `${scaledWidth}px`,
                            height: `${scaledHeight}px`,
                            minWidth: `${scaledWidth}px`,
                            minHeight: `${scaledHeight}px`,
                            transform: rotation ? `rotate(${rotation}deg)` : undefined,
                          }}
                        >
                          <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-slate-50/80 border border-slate-200/60">
                            <FileText className="w-7 h-7 text-slate-300" />
                            <span className="text-xs font-bold text-slate-500">Halaman {pageNum}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {isLandscape ? "Landscape (~1123×795)" : "Portrait (~795×1123)"}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // Buffer / Visible pages: mount PDF <Page> and highlights overlay
                    return (
                      <div
                        key={`page-${pageNum}`}
                        ref={(el) => {
                          pageRefs.current[pageNum] = el;
                        }}
                        data-page-number={pageNum}
                        className="rounded-xl border border-slate-300 bg-white transition-shadow shrink-0 shadow-md relative overflow-hidden"
                        style={{
                          minWidth: `${scaledWidth}px`,
                          minHeight: `${scaledHeight}px`,
                          transform: rotation ? `rotate(${rotation}deg)` : undefined,
                          transition: "transform 0.2s ease",
                        }}
                      >
                        {/* Page Number Tag */}
                        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-mono px-2.5 py-1 rounded-md z-20 pointer-events-none shadow-xs flex items-center gap-1.5">
                          <span className="font-bold">Hal. {pageNum}</span>
                          <span className="text-slate-300 text-[10px]">/ {numPages}</span>
                          {pageNum === safeTargetPage && isRenderingTarget && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-300 pl-1.5 border-l border-white/20">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              <span>Memuat hal. {safeTargetPage}...</span>
                            </span>
                          )}
                        </div>

                        <PageErrorBoundary
                          resetKey={`page-${activeDoc.fileUrl}-${pageNum}-${zoom}-${rotation}`}
                          fallback={
                            <div
                              className="p-8 text-center text-slate-500 text-xs"
                              style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
                            >
                              Halaman {pageNum} tidak dapat ditampilkan.
                            </div>
                          }
                        >
                          <Page
                            pageNumber={pageNum}
                            scale={zoom / 100}
                            suspense={false}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            className="overflow-hidden rounded-xl"
                            onLoadSuccess={handlePageLoadSuccess}
                            onRenderSuccess={() => {
                              if (pageNum === safeTargetPage) {
                                handleSlotRenderSuccess(0, pageNum);
                              }
                            }}
                            onRenderError={(err) => {
                              if (pageNum === safeTargetPage) {
                                handleSlotRenderError(0, pageNum, err);
                              }
                            }}
                            loading={
                              <div
                                className="flex flex-col items-center justify-center bg-white rounded-xl"
                                style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
                              >
                                <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-2" />
                                <span className="text-[11px] text-slate-400">Merender halaman {pageNum}...</span>
                              </div>
                            }
                          />
                        </PageErrorBoundary>

                        {/* Bounding Box Highlights */}
                        {renderHighlightsOverlay(pageNum)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="m-auto flex flex-col items-center justify-center p-8 text-slate-500 w-full h-full min-h-[400px]">
                  <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-3" />
                  <span className="text-xs font-semibold text-slate-700">Memuat berkas {activeDoc.fileName}...</span>
                </div>
              )}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
