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
  CheckCheck,
  Lock,
  Archive,
} from "lucide-react";
import ToastNotification, {
  useToastState,
  type ToastItem,
} from "@/app/_components/ui/ToastNotification";
import ComparisonPanel from "./ComparisonPanel";
import BatchDocumentsModal from "./BatchDocumentsModal";
import {
  ComparisonPanelSkeleton,
  DocumentViewerSkeleton,
} from "./MatchingSkeletons";
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
import { buildBatchChangeLogs } from "~/utils/changeLogBuilder";
import type { DbEquivalencyGroup } from "~/utils/valueEquivalency";
import {
  isDetailPendingOcr,
  deriveDocumentWorkflowStatus,
  canApproveBatchEvaluation,
} from "~/utils/workflowStatus";
import type { WorkflowStep } from "~/types/workflow";

const DocumentViewer = dynamic(() => import("./DocumentViewer"), {
  ssr: false,
  loading: () => <DocumentViewerSkeleton />,
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

// Helpers for detecting OCR processing state without locking the workspace
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isDetailRecordOcrPending(d: any): boolean {
  return isDetailPendingOcr(d);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDetailDisplayName(d: any): string {
  try {
    const p = typeof d?.isi === "string" ? JSON.parse(d.isi) : null;
    if (typeof p?.originalFileName === "string" && p.originalFileName.trim()) {
      return p.originalFileName.trim();
    }
  } catch {
    // ignore invalid JSON metadata
  }
  return String(d?.fileId || d?.fileType || "Dokumen");
}

const OCR_NOTICE_TOAST_ID = "detail-ocr-refresh-notice";

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
  const [dataActionSteps, setDataActionSteps] = useState<WorkflowStep[]>([]);
  const [dataActionsLoaded, setDataActionsLoaded] = useState<boolean>(false);
  const initialLoadDoneRef = useRef<string | null>(null);

  // Active view states
  const [currentDocCode, setCurrentDocCode] = useState<string>(initialDocCode); // "PIB" or supporting code
  const [selectedSupportingCode, setSelectedSupportingCode] = useState<string>("ALL");
  const [activeTabCode, setActiveTabCode] = useState<string>("ALL");
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  // Footer Actions state
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isBulkApproving, setIsBulkApproving] = useState<boolean>(false);
  const [docsModalOpen, setDocsModalOpen] = useState<boolean>(false);
  const { toast, showToast, dismissToast } = useToastState();

  // Non-blocking background OCR tracking state
  const trackedPendingIdsRef = useRef<Set<number>>(new Set());
  const [readyOcrUpdate, setReadyOcrUpdate] = useState<{
    names: string[];
    stillPendingCount: number;
  } | null>(null);
  const [dismissedPendingSig, setDismissedPendingSig] = useState<string | null>(null);
  const [isRefreshingInPlace, setIsRefreshingInPlace] = useState<boolean>(false);

  // 1. Fetch Batch Data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadBatch = useCallback(async (isSilent = false): Promise<any | null> => {
    try {
      if (!isSilent && !rawBatchRef.current) setLoading(true);
      setError(null);
      const res = await fetch(`/api/batches/${batchId}`, { cache: "no-store" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Gagal memuat batch #${batchId}`);
      }
      const data = await res.json();
      if (data.batch) {
        setRawBatch(data.batch);
        return data.batch;
      } else {
        throw new Error("Data batch tidak ditemukan");
      }
    } catch (err) {
      console.error("Load detail batch error:", err);
      if (!isSilent) setError(err instanceof Error ? err.message : "Gagal memuat data batch.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  // Identify documents still waiting on Nanonets OCR without locking Detail View
  const pendingOcrDocs = useMemo(() => {
    if (!rawBatch || !Array.isArray(rawBatch.details)) return [];
    return rawBatch.details
      .filter(isDetailRecordOcrPending)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d: any) => ({
        id: Number(d.id),
        name: getDetailDisplayName(d),
      }));
  }, [rawBatch]);

  const pendingSignature = useMemo(
    () => pendingOcrDocs.map((d: { id: number; name: string }) => `${d.id}:${d.name}`).join("|"),
    [pendingOcrDocs]
  );

  // Register any currently pending document IDs for silent completion detection
  useEffect(() => {
    for (const d of pendingOcrDocs) {
      if (d.id) trackedPendingIdsRef.current.add(d.id);
    }
  }, [pendingOcrDocs]);

  const hasPendingOcr = pendingOcrDocs.length > 0;

  // Poll quietly in background without overwriting live workspace until user clicks Refresh
  useEffect(() => {
    if (!hasPendingOcr || readyOcrUpdate) return;

    let cancelled = false;
    const pollOcrCompletion = async () => {
      try {
        const res = await fetch(`/api/batches/${batchId}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const latest = data?.batch;
        if (!latest || !Array.isArray(latest.details) || cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentIds = new Set((rawBatchRef.current?.details || []).map((d: any) => Number(d.id)));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completedDocs = latest.details.filter((d: any) => {
          if (isDetailRecordOcrPending(d)) return false;
          const idNum = Number(d.id);
          return trackedPendingIdsRef.current.has(idNum) || !currentIds.has(idNum);
        });

        if (completedDocs.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stillPendingCount = latest.details.filter((d: any) => isDetailRecordOcrPending(d)).length;
          const names: string[] = Array.from(
            new Set(completedDocs.map(getDetailDisplayName))
          );
          setReadyOcrUpdate({ names, stillPendingCount });
          onStatusUpdate?.(batchId, latest.status || "UPDATED");
        } else {
          // Batch status flipped out of pending even without per-doc tracking match
          const st = String(latest.status || "").toLowerCase();
          if (st !== "proses" && st !== "pending") {
            setReadyOcrUpdate({ names: [], stillPendingCount: 0 });
            onStatusUpdate?.(batchId, latest.status || "UPDATED");
          }
        }
      } catch (err) {
        console.warn("Background OCR check error:", err);
      }
    };

    const timer = setInterval(pollOcrCompletion, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [batchId, hasPendingOcr, readyOcrUpdate, onStatusUpdate]);

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

  const loadDataActions = useCallback(async () => {
    try {
      const res = await fetch("/api/data-actions", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        if (d.success && Array.isArray(d.steps)) {
          setDataActionSteps(d.steps);
        } else {
          setDataActionSteps([]);
        }
      }
    } catch (err) {
      console.warn("Data actions fetch error:", err);
    } finally {
      setDataActionsLoaded(true);
    }
  }, []);

  const handleRefreshInPlace = useCallback(async () => {
    if (isRefreshingInPlace) return;
    setIsRefreshingInPlace(true);
    try {
      trackedPendingIdsRef.current.clear();
      const [updated] = await Promise.all([
        loadBatch(true),
        loadEquivalencies(),
        loadDataActions(),
      ]);
      setReadyOcrUpdate(null);
      setDismissedPendingSig(null);
      if (updated) {
        onStatusUpdate?.(batchId, updated.status || "UPDATED");
        showToast("Data detail berhasil diperbarui.", "success");
      } else {
        showToast("Gagal memuat ulang data detail.", "error");
      }
    } finally {
      setIsRefreshingInPlace(false);
    }
  }, [isRefreshingInPlace, loadBatch, loadEquivalencies, loadDataActions, onStatusUpdate, batchId, showToast]);

  const ocrBannerItem: ToastItem | null = useMemo(() => {
    if (readyOcrUpdate) {
      const label =
        readyOcrUpdate.names.length > 0
          ? readyOcrUpdate.names.join(", ")
          : `Batch #${batchId}`;
      return {
        id: OCR_NOTICE_TOAST_ID,
        type: "success",
        message: `Data baru (${label}) sudah di-upload & siap dimuat.`,
        actionLabel: "Refresh",
        actionLoading: isRefreshingInPlace,
        onAction: handleRefreshInPlace,
        duration: 0,
      };
    }

    if (pendingOcrDocs.length > 0 && dismissedPendingSig !== pendingSignature) {
      const label =
        pendingOcrDocs.length === 1
          ? pendingOcrDocs[0]!.name
          : `${pendingOcrDocs.length} dokumen`;
      return {
        id: OCR_NOTICE_TOAST_ID,
        type: "info",
        isLoading: true,
        message: `Memproses OCR (${label}) di latar belakang...`,
        duration: 0,
      };
    }

    return null;
  }, [
    readyOcrUpdate,
    pendingOcrDocs,
    dismissedPendingSig,
    pendingSignature,
    batchId,
    isRefreshingInPlace,
    handleRefreshInPlace,
  ]);

  useEffect(() => {
    if (initialLoadDoneRef.current !== batchId) {
      initialLoadDoneRef.current = batchId;
      setRawBatch(null);
      loadBatch();
      loadEquivalencies();
      loadDataActions();
    }
  }, [batchId, loadBatch, loadEquivalencies, loadDataActions]);

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
    if (!rawBatch || !dataActionsLoaded) return null;
    return adaptBatchToModel(rawBatch, dataActionSteps);
  }, [rawBatch, dataActionsLoaded, dataActionSteps]);

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
    return buildAllComparisonGroups(
      batchModel.pib,
      batchModel.supporting,
      equivalencyGroups,
      dataActionSteps
    );
  }, [batchModel, equivalencyGroups, dataActionSteps]);

  // Flattened all fields for DocumentViewer highlights
  const allFields: ComparisonFieldModel[] = useMemo(() => {
    return comparisonGroups.flatMap((g) => g.fields);
  }, [comparisonGroups]);

  // Complete chronological batch change logs (Data Action, Kamus, Edit, Setujui Satuan/All/Berkas)
  const batchChangeLogs = useMemo(() => {
    if (!rawBatch || !dataActionsLoaded) return [];
    return buildBatchChangeLogs(rawBatch, allFields, dataActionSteps);
  }, [rawBatch, allFields, dataActionsLoaded, dataActionSteps]);

  // Active document group & title for footer actions
  const isAllSelected =
    !activeTabCode ||
    activeTabCode.toUpperCase() === "ALL" ||
    activeTabCode.toUpperCase() === "SEMUA";

  const activeGroup = useMemo(() => {
    if (isAllSelected) return null;
    return (
      comparisonGroups.find(
        (g) => g.docCode.toUpperCase() === activeTabCode.toUpperCase()
      ) || null
    );
  }, [isAllSelected, activeTabCode, comparisonGroups]);

  const activeDocTitle = isAllSelected
    ? "Semua"
    : activeGroup
    ? activeGroup.docName
    : "Semua";

  // Strictly only mismatch fields that are not yet manually confirmed
  const fieldsToApprove = useMemo(() => {
    const pool =
      isAllSelected || !activeGroup
        ? comparisonGroups.flatMap((g) => g.fields)
        : activeGroup.fields;
    return pool.filter(
      (f) => f.status === "MISMATCH" && !f.isManualConfirmed
    );
  }, [isAllSelected, activeGroup, comparisonGroups]);

  const pendingCount = fieldsToApprove.length;
  const isAllDocMatched = pendingCount === 0;

  const workflowStatus = deriveDocumentWorkflowStatus({
    rawStatus: rawBatch?.status,
    errorMessage: rawBatch?.errorMessage,
    hasPendingDetail: hasPendingOcr,
  });
  const isBatchExported = workflowStatus === "Exported";
  const isBatchApproved = workflowStatus === "Approved";
  const isBatchPendingLocked = workflowStatus === "Pending";

  const isDetailReadOnly = isBatchApproved || isBatchExported || isBatchPendingLocked;

  const totalBatchFields = allFields.length;
  const totalBatchMismatchRemaining = useMemo(
    () =>
      allFields.filter((f) => f.status === "MISMATCH" && !f.isManualConfirmed)
        .length,
    [allFields]
  );
  const canApproveBatch = canApproveBatchEvaluation({
    totalFields: totalBatchFields,
    mismatchedFields: totalBatchMismatchRemaining,
    workflowStatus,
  });

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

  // Document comparison tab switcher (filters right panel only; keeps left PDF viewer steady)
  const handleSelectDocCode = (code: string) => {
    setActiveTabCode(code);
  };

  // Direct document & page navigator for line items and field clicks
  const handleNavigateToDoc = (docCode: string, page?: number) => {
    if (docCode) {
      setCurrentDocCode(docCode);
      if (activeTabCode.toUpperCase() !== "ALL" && docCode.toUpperCase() !== "PIB") {
        setSelectedSupportingCode(docCode);
      }
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
    if (docCode) {
      setCurrentDocCode(docCode);
      if (activeTabCode.toUpperCase() !== "ALL") {
        setSelectedSupportingCode(docCode);
      }
    }
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
    if (onStatusUpdate) {
      onStatusUpdate(batchId, "UPDATED");
    }
  };

  const handleManualMatchToggled = (fieldLabel: string, confirmed: boolean) => {
    showToast(
      confirmed
        ? `Field "${fieldLabel}" berhasil dikonfirmasi Match.`
        : `Konfirmasi manual "${fieldLabel}" dibatalkan.`
    );
    loadBatch(true);
    if (onStatusUpdate) {
      onStatusUpdate(batchId, "UPDATED");
    }
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
      showToast(err instanceof Error ? err.message : "Gagal menyimpan catatan.", "error");
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
      showToast(err instanceof Error ? err.message : "Gagal memperbarui catatan.", "error");
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
      showToast(err instanceof Error ? err.message : "Gagal menghapus catatan.", "error");
      throw err;
    }
  };

  // Bulk approve handler for currently open tab (images 2)
  const handleApproveActiveDoc = async () => {
    if (isDetailReadOnly || isBulkApproving) return;
    try {
      setIsBulkApproving(true);
      if (fieldsToApprove.length === 0) {
        showToast("Tidak ada field mismatch yang perlu disetujui.", "info");
        return;
      }

      const res = await fetch(`/api/batches/${batchId}/manual-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: true,
          docCode: isAllSelected ? "ALL" : activeGroup ? activeGroup.docCode : "ALL",
          fields: fieldsToApprove.map((f) => ({
            fieldId: f.id,
            fieldName: f.fieldName,
            fieldLabel: f.label,
            docCode: f.docCode || (activeGroup ? activeGroup.docCode : undefined),
            detailId: f.supportingDetailId || f.pibDetailId,
          })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal menyetujui field dokumen.");
      }

      showToast(`${fieldsToApprove.length} field mismatch pada "${activeDocTitle}" berhasil disetujui.`);
      await loadBatch(true);
    } catch (err) {
      console.error("Approve active doc error:", err);
      showToast(err instanceof Error ? err.message : "Gagal menyetujui dokumen.", "error");
    } finally {
      setIsBulkApproving(false);
    }
  };

  // Approve Batch Handler ("Approve")
  const handleApproveBatch = async () => {
    if (!canApproveBatch || isApproving || isBulkApproving) return;
    try {
      setIsApproving(true);
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal menyetujui berkas");
      }
      showToast("Dokumen berhasil di-Approve dan dipindahkan ke All Data.");
      if (onStatusUpdate) {
        onStatusUpdate(batchId, "APPROVED");
      }
      await loadBatch(true);
    } catch (err) {
      console.error("Approve batch error:", err);
      showToast(err instanceof Error ? err.message : "Gagal menyetujui berkas.", "error");
    } finally {
      setIsApproving(false);
    }
  };

  // Loading state matching exact post-load split layout (7/5 viewer + comparison skeleton)
  if (loading || !dataActionsLoaded) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-hidden p-2 sm:p-3 bg-slate-100/70">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full overflow-y-auto lg:overflow-hidden">
            {/* LEFT AREA: DOCUMENT VIEWER SKELETON */}
            <div className="lg:col-span-7 xl:col-span-7 h-[500px] lg:h-full flex flex-col min-h-0">
              <DocumentViewerSkeleton onBack={onClose} />
            </div>

            {/* RIGHT AREA: COMPARISON PANEL SKELETON */}
            <div className="lg:col-span-5 xl:col-span-5 h-[600px] lg:h-full flex flex-col min-h-0">
              <ComparisonPanelSkeleton />
            </div>
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

  // Pending Lock state (cannot be opened or manipulated while OCR is still processing)
  if (isBatchPendingLocked) {
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
            <span className="font-bold text-sm text-slate-800">
              Detail Dokumen #{batchId}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <Lock className="w-3 h-3 text-amber-600" />
              <span>Pending (Terkunci)</span>
            </span>
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
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center shadow-sm border border-slate-200/80 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-base">
                Akses Detail Terkunci (Status: Pending)
              </p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Dokumen pada batch{" "}
                <span className="font-mono font-semibold text-slate-700">#{batchId}</span>{" "}
                masih dalam proses ekstraksi OCR
                {pendingOcrDocs.length > 0
                  ? ` (${pendingOcrDocs.map((d: { name: string }) => d.name).join(", ")})`
                  : ""}
                . Akses detail pencocokan dan manipulasi data dikunci hingga seluruh dokumen selesai diproses menjadi{" "}
                <strong className="text-slate-700">Pending Validation</strong>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Kembali ke Daftar File
              </button>
              <button
                type="button"
                onClick={handleRefreshInPlace}
                disabled={isRefreshingInPlace}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingInPlace ? "animate-spin" : ""}`} />
                <span>Cek Status OCR</span>
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
              activeDocCode={activeTabCode}
              onSelectDocCode={handleSelectDocCode}
              activeFieldId={activeFieldId}
              onSelectField={(fieldId, docCode) => {
                setActiveFieldId(fieldId);
                if (docCode && currentDocCode.toUpperCase() !== docCode.toUpperCase()) {
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
              onManageDocuments={isDetailReadOnly ? undefined : () => setDocsModalOpen(true)}
              onNotify={(msg, type) => showToast(msg, type || "info")}
              batchChangeLogs={batchChangeLogs}
              workflowStatus={workflowStatus}
              isReadOnly={isDetailReadOnly}
              className="h-full"
              footer={
                <div className="flex items-center justify-between w-full gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    {isBatchExported ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-sky-800 bg-sky-50 border border-sky-200">
                        <Archive className="w-3.5 h-3.5 text-sky-600" />
                        <span>
                          Status: Exported (Arsip Read-only)
                          {rawBatch?.approvedBy?.name ? ` • ${rawBatch.approvedBy.name}` : ""}
                        </span>
                      </span>
                    ) : isBatchApproved ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                        <span>
                          Status: Approved
                          {rawBatch?.approvedBy?.name ? ` (${rawBatch.approvedBy.name})` : ""}
                        </span>
                      </span>
                    ) : totalBatchMismatchRemaining > 0 ? (
                      <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg">
                        Validasi {totalBatchMismatchRemaining} mismatch tersisa untuk Approve
                      </span>
                    ) : totalBatchFields > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                        <span>Semua {totalBatchFields} komponen tervalidasi</span>
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    {!isDetailReadOnly && (
                      <button
                        type="button"
                        onClick={handleApproveActiveDoc}
                        disabled={isBulkApproving || isApproving || isAllDocMatched}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          isAllDocMatched
                            ? "bg-slate-50 text-slate-400 border border-slate-200 opacity-60 cursor-not-allowed"
                            : "bg-emerald-50 hover:bg-emerald-100/90 active:bg-emerald-200 text-emerald-800 border border-emerald-300 hover:border-emerald-400 cursor-pointer shadow-2xs"
                        }`}
                        title={
                          isAllDocMatched
                            ? `Tidak ada field mismatch pada tab ${activeDocTitle}`
                            : `Menyetujui ${pendingCount} field mismatch pada tab ${activeDocTitle}`
                        }
                      >
                        {isBulkApproving ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                            <span>Menyetujui...</span>
                          </>
                        ) : isAllDocMatched ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2] text-slate-400" />
                            <span>{activeDocTitle} Cocok</span>
                          </>
                        ) : (
                          <>
                            <CheckCheck className="w-3.5 h-3.5 stroke-[2.2] text-emerald-600" />
                            <span>Setujui {activeDocTitle}</span>
                            <span className="ml-0.5 px-1.5 py-0.2 text-[10.5px] font-mono font-bold rounded-full bg-emerald-200/70 text-emerald-900 border border-emerald-300/60">
                              {pendingCount}
                            </span>
                          </>
                        )}
                      </button>
                    )}

                    {isBatchExported ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-sky-800 bg-sky-50 border border-sky-200">
                        <Archive className="w-3.5 h-3.5 text-sky-600" />
                        <span>Exported (Read-only)</span>
                      </span>
                    ) : isBatchApproved ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-emerald-800 bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Approved (Read-only)</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApproveBatch}
                        disabled={!canApproveBatch || isApproving || isBulkApproving}
                        className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-2xs ${
                          canApproveBatch
                            ? "text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 cursor-pointer hover:shadow-xs shadow-emerald-600/20"
                            : "bg-slate-200 text-slate-400 border border-slate-200 cursor-not-allowed"
                        }`}
                        title={
                          canApproveBatch
                            ? "Approve seluruh dokumen dan pindahkan ke tabel All Data"
                            : totalBatchMismatchRemaining > 0
                            ? `Tombol Approve aktif setelah ${totalBatchMismatchRemaining} field mismatch tersisa divalidasi`
                            : "Belum ada komponen pencocokan yang siap di-Approve"
                        }
                      >
                        {isApproving ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Approve</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </main>

      {/* Manage / Add / Replace Documents Modal */}
      <BatchDocumentsModal
        batchId={batchId}
        isOpen={docsModalOpen}
        onClose={() => setDocsModalOpen(false)}
        onDocumentsChanged={async (_id, newStatus, msg) => {
          setDismissedPendingSig(null);
          setReadyOcrUpdate(null);
          const refreshed = await loadBatch(true);
          const stillPending = Array.isArray(refreshed?.details)
            ? refreshed.details.some(isDetailRecordOcrPending)
            : false;
          if (!stillPending && msg) {
            showToast(msg, "success");
          }
          onStatusUpdate?.(batchId, newStatus || "UPDATED");
        }}
      />

      {/* Non-blocking Top-Right Light Toast & OCR Refresh Notifications */}
      <ToastNotification
        items={[ocrBannerItem, toast]}
        onClose={(id) => {
          if (id === OCR_NOTICE_TOAST_ID) {
            if (readyOcrUpdate) {
              setReadyOcrUpdate(null);
            } else {
              setDismissedPendingSig(pendingSignature);
            }
            return;
          }
          dismissToast();
        }}
      />
    </div>
  );
}
