"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Check,
  Lock,
} from "lucide-react";
import ComparisonPanel from "./ComparisonPanel";
import {
  adaptBatchToModel,
  buildAllComparisonGroups,
} from "./detailAdapter";
import type {
  BatchComparisonModel,
  BatchDocumentModel,
  ComparisonFieldModel,
  DocumentComparisonGroup,
} from "./detailTypes";
import type { DbEquivalencyGroup } from "~/utils/valueEquivalency";

const DocumentViewer = dynamic(() => import("./DocumentViewer"), {
  ssr: false,
});


// Resilient Viewer Error Boundary preventing viewer failures from crashing the whole detail view
class ViewerErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey: unknown },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; resetKey: unknown }) {
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
      return (
        <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
          <p className="text-sm font-semibold text-slate-800">Pratinjau dokumen tidak dapat ditampilkan</p>
          <p className="text-xs text-slate-500 mt-1">Terjadi kendala saat membaca berkas PDF dokumen ini.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
          >
            Muat ulang viewer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface MatchingDetailViewProps {
  batchId: string;
  initialDocCode?: string;
  onClose: () => void;
  onStatusUpdate?: (batchId: string, newStatus: string) => void;
}

export default function MatchingDetailView({
  batchId,
  initialDocCode = "PIB",
  onClose,
  onStatusUpdate,
}: MatchingDetailViewProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rawBatch, setRawBatch] = useState<any>(null);
  const rawBatchRef = useRef<any>(null);
  rawBatchRef.current = rawBatch;
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [equivalencyGroups, setEquivalencyGroups] = useState<DbEquivalencyGroup[]>([]);
  const initialLoadDoneRef = useRef<string | null>(null);

  // Active view states
  const [currentDocCode, setCurrentDocCode] = useState<string>(initialDocCode); // "PIB" or supporting code
  const [selectedSupportingCode, setSelectedSupportingCode] = useState<string>(
    initialDocCode.toUpperCase() === "PIB" ? "" : initialDocCode
  );
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  // Footer Actions state
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Fetch Batch Data
  const loadBatch = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent && !rawBatchRef.current) setLoading(true);
      setError(null);
      const res = await fetch(`/api/batches/${batchId}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Gagal memuat batch #${batchId}`);
      }
      const data = await res.json();
      if (data.batch) {
        setRawBatch(data.batch);
      } else {
        throw new Error("Data batch tidak ditemukan");
      }
    } catch (err) {
      console.error("Load detail batch error:", err);
      if (!isSilent) setError(err instanceof Error ? err.message : "Gagal memuat data batch.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  // Auto-polling when batch is in processing state
  const isDetailBatchProcessing = useMemo(() => {
    if (!rawBatch) return false;
    const st = (rawBatch.status || "").toLowerCase();
    if (st === "proses" || st === "pending") return true;
    if (Array.isArray(rawBatch.details)) {
      return rawBatch.details.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d: any) => !d.isi || typeof d.isi !== "string" || d.isi.trim().length === 0
      );
    }
    return false;
  }, [rawBatch]);

  useEffect(() => {
    if (!isDetailBatchProcessing) return;

    const timer = setInterval(() => {
      loadBatch(true);
    }, 2500);

    return () => clearInterval(timer);
  }, [isDetailBatchProcessing, loadBatch]);

  // 2. Fetch Equivalency Groups
  const loadEquivalencies = useCallback(async () => {
    try {
      const res = await fetch("/api/equivalencies");
      if (res.ok) {
        const d = await res.json();
        if (d.success && Array.isArray(d.groups)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setEquivalencyGroups(d.groups.map((g: any) => ({
            id: g.id,
            name: g.name,
            category: g.category,
            canonical: g.canonical,
            values: Array.isArray(g.values)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? g.values.map((v: any) => (typeof v === "string" ? v : v.value))
              : [],
          })));
        }
      }
    } catch (err) {
      console.warn("Equivalencies fetch error:", err);
    }
  }, []);

  useEffect(() => {
    if (initialLoadDoneRef.current !== batchId) {
      initialLoadDoneRef.current = batchId;
      setRawBatch(null);
      loadBatch();
      loadEquivalencies();
    }
  }, [batchId, loadBatch, loadEquivalencies]);

  // Lock background scroll when detail view is active
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Transform raw batch into Normalized Batch Model
  const batchModel: BatchComparisonModel | null = useMemo(() => {
    if (!rawBatch) return null;
    return adaptBatchToModel(rawBatch);
  }, [rawBatch]);

  // Initialize selected supporting code when batchModel is loaded
  useEffect(() => {
    if (batchModel && batchModel.supporting.length > 0) {
      if (!selectedSupportingCode || !batchModel.supporting.some(d => d.code.toUpperCase() === selectedSupportingCode.toUpperCase())) {
        setSelectedSupportingCode(batchModel.supporting[0]!.code);
      }
    }
  }, [batchModel, selectedSupportingCode]);

  // Identify document currently loaded in viewer
  const currentLoadedDoc: BatchDocumentModel = useMemo(() => {
    if (!batchModel) {
      return { id: 0, code: "PIB", name: "PIB (acuan)", fileName: "PIB.pdf", fileUrl: "", fields: {}, lineItems: [] };
    }
    if (currentDocCode.toUpperCase() === "PIB") {
      return batchModel.pib;
    }
    return (
      batchModel.supporting.find(
        (d) => d.code.toUpperCase() === currentDocCode.toUpperCase()
      ) || batchModel.pib
    );
  }, [batchModel, currentDocCode]);

  // Build all comparison groups: PIB (acuan) vs each supporting document (Invoice, PL, BL, AK, WL, MS)
  const comparisonGroups: DocumentComparisonGroup[] = useMemo(() => {
    if (!batchModel) return [];
    return buildAllComparisonGroups(batchModel.pib, batchModel.supporting, equivalencyGroups);
  }, [batchModel, equivalencyGroups]);

  // Flattened all fields for DocumentViewer highlights
  const allFields: ComparisonFieldModel[] = useMemo(() => {
    return comparisonGroups.flatMap((g) => g.fields);
  }, [comparisonGroups]);

  // Default active field selection
  useEffect(() => {
    if (allFields.length > 0) {
      const currentExists = allFields.some((f) => f.id === activeFieldId);
      if (!currentExists && !activeFieldId?.startsWith("item-")) {
        // Select first field with status "MISMATCH" (Tidak cocok)
        const firstMismatch = allFields.find((f) => f.status === "MISMATCH");
        if (firstMismatch) {
          setActiveFieldId(firstMismatch.id);
        } else if (allFields[0]) {
          setActiveFieldId(allFields[0].id);
        }
      }
    }
  }, [allFields, activeFieldId]);

  const [viewerTargetPage, setViewerTargetPage] = useState<{ page: number; timestamp: number } | null>(null);

  // Document switcher click handler
  const handleSelectDocCode = (code: string) => {
    setCurrentDocCode(code);
    setSelectedSupportingCode(code);
  };

  // Direct document & page navigator for line items and field clicks
  const handleNavigateToDoc = (docCode: string, page?: number) => {
    setCurrentDocCode(docCode);
    if (docCode.toUpperCase() !== "PIB") {
      setSelectedSupportingCode(docCode);
    }
    if (page) {
      setViewerTargetPage({ page, timestamp: Date.now() });
    }
  };

  // Inner card clicks
  const handleLoadPibInViewer = (fieldId: string) => {
    setCurrentDocCode("PIB");
    setActiveFieldId(fieldId);
  };

  const handleLoadSupportingInViewer = (fieldId: string, docCode: string) => {
    setCurrentDocCode(docCode);
    setSelectedSupportingCode(docCode);
    setActiveFieldId(fieldId);
  };

  // Field edit updated callback
  const handleFieldUpdated = (
    _detailId: number,
    fieldName: string,
    _newValue: string
  ) => {
    showToast(`Field ${fieldName} berhasil disimpan.`);
    // Re-fetch batch to refresh all data & re-evaluate status (silent)
    loadBatch(true);
  };

  const handleManualMatchToggled = (fieldLabel: string, confirmed: boolean) => {
    showToast(
      confirmed
        ? `Field "${fieldLabel}" berhasil dikonfirmasi Match.`
        : `Konfirmasi manual "${fieldLabel}" dibatalkan.`
    );
    loadBatch(true);
  };

  // Manual Note Handlers
  const handleAddManualNote = async (
    targetType: "field" | "line_item",
    targetKey: string,
    text: string,
    docCode?: string,
    detailId?: number
  ) => {
    try {
      const res = await fetch(`/api/batches/${batchId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetKey,
          text,
          docCode,
          detailId,
        }),
      });
      if (!res.ok) {
        throw new Error("Gagal menyimpan catatan.");
      }
      showToast("Catatan berhasil disimpan.");
      await loadBatch(true);
    } catch (err) {
      console.error("Add manual note error:", err);
      showToast(err instanceof Error ? err.message : "Gagal menyimpan catatan.");
      throw err;
    }
  };

  const handleEditManualNote = async (noteId: string, text: string) => {
    try {
      const res = await fetch(`/api/batches/${batchId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, text }),
      });
      if (!res.ok) {
        throw new Error("Gagal memperbarui catatan.");
      }
      showToast("Catatan berhasil diperbarui.");
      await loadBatch(true);
    } catch (err) {
      console.error("Edit manual note error:", err);
      showToast(err instanceof Error ? err.message : "Gagal memperbarui catatan.");
      throw err;
    }
  };

  const handleDeleteManualNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/batches/${batchId}/notes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      if (!res.ok) {
        throw new Error("Gagal menghapus catatan.");
      }
      showToast("Catatan berhasil dihapus.");
      await loadBatch(true);
    } catch (err) {
      console.error("Delete manual note error:", err);
      showToast(err instanceof Error ? err.message : "Gagal menghapus catatan.");
      throw err;
    }
  };

  // Approve Batch Handler ("Setujui file")
  const handleApproveBatch = async () => {
    try {
      setIsApproving(true);
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (!res.ok) {
        throw new Error("Gagal menyetujui file");
      }
      showToast("Batch berhasil disetujui & status tersimpan di database.");
      if (onStatusUpdate) {
        onStatusUpdate(batchId, "APPROVED");
      }
      loadBatch(true);
    } catch (err) {
      console.error("Approve batch error:", err);
      showToast(err instanceof Error ? err.message : "Gagal menyetujui file.");
    } finally {
      setIsApproving(false);
    }
  };

  // Loading state (Solid Full-screen Shell to eliminate background table flicker)
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden">
        {/* Skeleton Header */}
        <header className="h-14 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Kembali ke daftar file"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-800">Memuat berkas...</span>
              <span className="text-xs text-slate-400 font-mono">#{batchId}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Skeleton Body */}
        <main className="flex-1 overflow-hidden p-4 bg-slate-100/70 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm border border-slate-200/80">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-900 mb-3" />
            <p className="font-semibold text-slate-800 text-sm">Memuat detail dokumen...</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">Batch #{batchId}</p>
          </div>
        </main>
      </div>
    );
  }

  // Error state (Solid Full-screen Shell)
  if (error || !batchModel) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Kembali ke daftar file"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm text-slate-800">Detail Dokumen</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 overflow-hidden p-4 bg-slate-100/70 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center shadow-sm border border-slate-200/80">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-2" />
            <p className="font-bold text-slate-800 text-base">Tidak dapat membuka detail</p>
            <p className="text-xs text-slate-500 mt-1">{error || "Data batch tidak ditemukan."}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Kembali ke daftar
              </button>
              <button
                onClick={() => loadBatch()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Coba lagi
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Locked processing state: waiting for all Nanonets OCR webhooks to arrive
  if (isDetailBatchProcessing) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-150">
        <header className="h-14 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Kembali ke daftar file"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-800">Dokumen Sedang Diproses</span>
              <span className="text-xs text-slate-400 font-mono">#{batchId}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-hidden p-4 bg-slate-100/70 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              Dokumen Terkunci & Sedang Diproses
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Batch <span className="font-mono font-semibold text-slate-700">#{batchId}</span> masih menunggu seluruh webhook hasil ekstraksi OCR dari Nanonets. Dokumen akan terbuka otomatis begitu seluruh data selesai diterima.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50/80 border border-blue-200/80 py-2.5 px-4 rounded-xl">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
              <span>Menunggu webhook Nanonets...</span>
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Kembali ke daftar file
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-150">
      {/* Main Areas (Split / Responsive Layout) */}
      <main className="flex-1 overflow-hidden p-2 sm:p-3 bg-slate-100/70">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full overflow-y-auto lg:overflow-hidden">
          {/* LEFT AREA: DOCUMENT VIEWER */}
          <div className="lg:col-span-7 xl:col-span-7 h-[500px] lg:h-full flex flex-col min-h-0">
            <ViewerErrorBoundary resetKey={`${batchId}-${currentDocCode}`}>
              <DocumentViewer
                pibDoc={batchModel.pib}
                supportingDocs={batchModel.supporting}
                currentDocCode={currentDocCode}
                onSelectDocCode={handleSelectDocCode}
                fields={allFields}
                activeFieldId={activeFieldId}
                onSelectField={setActiveFieldId}
                targetPage={viewerTargetPage}
                onBack={onClose}
                className="h-full"
              />
            </ViewerErrorBoundary>
          </div>

          {/* RIGHT AREA: COMPARISON PANEL */}
          <div className="lg:col-span-5 xl:col-span-5 h-[600px] lg:h-full flex flex-col min-h-0">
            <ComparisonPanel
              batchId={batchId}
              pibDoc={batchModel.pib}
              groups={comparisonGroups}
              currentLoadedDoc={currentLoadedDoc}
              activeDocCode={currentDocCode.toUpperCase() === "PIB" ? selectedSupportingCode : currentDocCode}
              onSelectDocCode={handleSelectDocCode}
              activeFieldId={activeFieldId}
              onSelectField={(fieldId, docCode) => {
                setActiveFieldId(fieldId);
                if (docCode && currentDocCode !== "PIB" && currentDocCode.toUpperCase() !== docCode.toUpperCase()) {
                  setCurrentDocCode(docCode);
                }
              }}
              onLoadPibInViewer={handleLoadPibInViewer}
              onLoadSupportingInViewer={handleLoadSupportingInViewer}
              onNavigateToDoc={handleNavigateToDoc}
              onFieldUpdated={handleFieldUpdated}
              onManualMatchToggled={handleManualMatchToggled}
              onAddManualNote={handleAddManualNote}
              onEditManualNote={handleEditManualNote}
              onDeleteManualNote={handleDeleteManualNote}
              className="h-full"
              footer={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    {rawBatch?.status === "APPROVED" && (
                      <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Disetujui
                          {rawBatch.approvedBy?.name ? ` (${rawBatch.approvedBy.name})` : ""}
                        </span>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleApproveBatch}
                    disabled={isApproving}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50 ml-auto"
                  >
                    {isApproving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyetujui...</span>
                      </>
                    ) : rawBatch?.status === "APPROVED" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-slate-300" />
                        <span>Disetujui</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Setujui file</span>
                      </>
                    )}
                  </button>
                </div>
              }
            />
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-xs text-white border border-slate-800 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
