"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";

import MatchingTabsToolbar, {
  type MatchingTabId,
  type TabCounts,
  type ColumnVisibility,
} from "./_components/MatchingTabsToolbar";
import MatchingTable, {
  type TableBatchItem,
  type DocumentStatusCell,
} from "./_components/MatchingTable";
import MatchingFooter from "./_components/MatchingFooter";
import MatchingDetailView from "./_components/MatchingDetailView";
import BatchDocumentsModal from "./_components/BatchDocumentsModal";
import ConfirmDialog from "@/app/_components/ui/ConfirmDialog";

import { evaluateBatchComparison } from "./_components/detailAdapter";
import type { DbEquivalencyGroup } from "~/utils/valueEquivalency";

interface DetailBatch {
  id: number;
  batchId: string;
  fileType: string;
  fileId: string;
  nomorAju?: string | null;
  nomorInvoice?: string | null;
  isi?: string | null;
  createdAt?: string;
}

interface RawBatchItem {
  id: string;
  no: number;
  nama: string;
  noPengajuan?: string | null;
  subtext: string;
  totalFile: number;
  status: "Matching" | "Mismatching" | "Proses" | "Ditolak" | "Failed";
  rawStatus?: string;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
  details?: DetailBatch[];
  docStatuses?: Record<string, DocumentStatusCell>;
}

const defaultColumnVisibility: ColumnVisibility = {
  Invoice: true,
  Bill_of_Lading: true,
};

function calculateDocStatuses(
  batch: RawBatchItem,
  equivalencyGroups: DbEquivalencyGroup[] = []
): Record<string, DocumentStatusCell> {
  const res = evaluateBatchComparison(batch, equivalencyGroups);
  return res.docStatuses;
}

function MatchingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlBatchId = searchParams.get("batchId");
  const initialBatchHandledRef = useRef<string | null>(null);

  // Primary data state
  const [batches, setBatches] = useState<RawBatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [equivalencyGroups, setEquivalencyGroups] = useState<DbEquivalencyGroup[]>([]);

  // Filtering, search, tabs
  const [activeTab, setActiveTab] = useState<MatchingTabId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignedMap, setAssignedMap] = useState<Record<string, string>>({});

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(defaultColumnVisibility);

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | "none">("desc");

  // Selection & Pagination
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50); // Default per spec: "Baris per halaman: 50"

  // Toast notification
  const [toast, setToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });

  const showToast = useCallback((message: string) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 3000);
  }, []);

  // Detail View State (opened on row click or deep link)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedDocCode, setSelectedDocCode] = useState<string>("PIB");
  const [manageFilesBatchId, setManageFilesBatchId] = useState<string | null>(null);

  // Deep-link auto-opening from URL query ?batchId=... with lock guard
  useEffect(() => {
    if (urlBatchId && initialBatchHandledRef.current !== urlBatchId) {
      const target = batches.find((b) => b.id === urlBatchId);
      if (target) {
        initialBatchHandledRef.current = urlBatchId;
        const st = (target.status || "").toLowerCase();
        const isProcessing = st === "proses" || st === "pending";
        if (isProcessing) {
          showToast(`Dokumen batch #${urlBatchId} masih diproses oleh OCR Nanonets, mohon tunggu hingga selesai.`);
          router.replace("/matching", { scroll: false });
          return;
        }
        setSelectedBatchId(urlBatchId);
      } else if (!loading) {
        initialBatchHandledRef.current = urlBatchId;
        setSelectedBatchId(urlBatchId);
      }
    }
  }, [urlBatchId, batches, loading, router, showToast]);

  // Dialogs & Modals
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    batch: TableBatchItem | null;
  }>({
    isOpen: false,
    batch: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch batches from backend with in-flight overlap guard
  const isFetchingRef = useRef<boolean>(false);

  const fetchBatches = useCallback(async (isSilent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (!isSilent) setLoading(true);
      setIsRefreshing(true);
      const res = await fetch("/api/batches?scope=personal", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.batches && Array.isArray(data.batches)) {
          setBatches(data.batches);
        } else if (Array.isArray(data)) {
          setBatches(data);
        }
      }
    } catch (err) {
      console.error("Gagal memuat daftar batch:", err);
    } finally {
      isFetchingRef.current = false;
      if (!isSilent) setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleDetailClose = useCallback(() => {
    setSelectedBatchId(null);
    fetchBatches(true);
    if (urlBatchId) {
      router.replace("/matching", { scroll: false });
    }
  }, [urlBatchId, router, fetchBatches]);

  const handleDetailStatusUpdate = useCallback(() => {
    fetchBatches(true);
  }, [fetchBatches]);

  // Fetch equivalency groups
  const fetchEquivalencies = useCallback(async () => {
    try {
      const res = await fetch("/api/equivalencies");
      if (res.ok) {
        const d = await res.json();
        if (d.success && Array.isArray(d.groups)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: DbEquivalencyGroup[] = d.groups.map((g: any) => ({
            id: g.id,
            name: g.name,
            category: g.category,
            canonical: g.canonical,
            values: Array.isArray(g.values)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? g.values.map((v: any) => (typeof v === "string" ? v : v.value))
              : [],
          }));
          setEquivalencyGroups(mapped);
        }
      }
    } catch (err) {
      console.warn("Gagal memuat aturan equivalency:", err);
    }
  }, []);

  useEffect(() => {
    fetchBatches(false);
    fetchEquivalencies();
  }, [fetchBatches, fetchEquivalencies]);

  // Auto-polling (every 3s) whenever any batch is in PROSES / PENDING status waiting for Nanonets webhooks
  useEffect(() => {
    const hasProcessingBatch = batches.some((b) => {
      const st = (b.status || "").toLowerCase();
      return st === "proses" || st === "pending";
    });

    if (!hasProcessingBatch) return;

    const interval = setInterval(() => {
      fetchBatches(true); // Silent background refresh
    }, 3000);

    return () => clearInterval(interval);
  }, [batches, fetchBatches]);

  // Transform raw batches into TableBatchItem
  const tableBatches = useMemo<TableBatchItem[]>(() => {
    return batches.map((batch, index) => {
      const pibFileName = "PIB.pdf";
      const fields: Record<string, string> = {};
      let pibAjuNo = (batch as any).noPengajuan || "";

      if (batch.details && batch.details.length > 0) {
        const pibDet = batch.details.find((d) => {
          const ft = (d.fileType || "").trim().toLowerCase();
          return ft === "pib" || ft.includes("file acuan") || ft.startsWith("pib");
        });

        if (pibDet) {
          if (!pibAjuNo && pibDet.nomorAju && String(pibDet.nomorAju).trim()) {
            pibAjuNo = String(pibDet.nomorAju).trim();
          }

          if (pibDet.isi) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const parsed: any = typeof pibDet.isi === "string" ? JSON.parse(pibDet.isi) : pibDet.isi;
              const rawFields = parsed?.fields || parsed?.prediction?.fields || {};

              if (!pibAjuNo) {
                pibAjuNo =
                  rawFields["No_Pengajuan"] ||
                  rawFields["Nomor_Pengajuan"] ||
                  rawFields["No_Aju"] ||
                  rawFields["Nomor_Aju"] ||
                  "";
              }

              for (const [k, v] of Object.entries(rawFields)) {
                if (k.endsWith("_action")) continue;
                const actionKey = `${k}_action`;
                const actionVal = rawFields[actionKey];
                if (actionVal !== undefined && actionVal !== null && String(actionVal).trim() !== "") {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  fields[k] = typeof actionVal === "object" ? String((actionVal as any).value || "") : String(actionVal);
                } else if (v !== undefined && v !== null) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  fields[k] = typeof v === "object" ? String((v as any).value || "") : String(v);
                }
              }
            } catch {
              // keep empty fields on JSON error
            }
          }
        }
      }

      if (
        !pibAjuNo &&
        batch.nama &&
        !batch.nama.startsWith("Batch #") &&
        !batch.nama.toLowerCase().includes("united steel")
      ) {
        pibAjuNo = batch.nama;
      }

      // Bind status badges and per-document status directly from server data with dynamic consistency
      const docStatuses = batch.docStatuses || calculateDocStatuses(batch, equivalencyGroups);
      const docStatusList = Object.values(docStatuses).map((d) => d.status);
      const isAnyDocMismatch = docStatusList.some((s) => s === "Mismatch");
      const rawSt = (batch.rawStatus || "").toUpperCase();
      const evalSt = (batch.status || "").toUpperCase();
      const hasError = Boolean(batch.errorMessage && batch.errorMessage.trim() !== "");
      const isFailed =
        rawSt === "FAILED" ||
        rawSt === "ERROR" ||
        rawSt === "DITOLAK" ||
        rawSt === "REJECTED" ||
        evalSt === "FAILED" ||
        evalSt === "DITOLAK" ||
        hasError;
      const isAnyDocProses =
        docStatusList.some((s) => s === "Proses") ||
        evalSt === "PROSES" ||
        evalSt === "PENDING";

      let effectiveStatus: "Matching" | "Mismatching" | "Proses" | "Ditolak" | "Failed" = "Matching";
      if (isFailed) {
        effectiveStatus = "Failed";
      } else if (isAnyDocProses) {
        effectiveStatus = "Proses";
      } else if (isAnyDocMismatch || evalSt === "MISMATCHING") {
        effectiveStatus = "Mismatching";
      } else {
        effectiveStatus = "Matching";
      }

      return {
        id: batch.id,
        no: batch.no || index + 1,
        nama: pibAjuNo || batch.nama || `Batch #${batch.id}`,
        noPengajuan: pibAjuNo || null,
        subtext: batch.subtext || "",
        totalFile: batch.totalFile || (batch.details || []).length || 1,
        status: effectiveStatus,
        assignedTo: assignedMap[batch.id] || (batch as { createdBy?: { name?: string } }).createdBy?.name || null,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        pibFileName,
        fields,
        docStatuses,
      };
    });
  }, [batches, assignedMap, equivalencyGroups]);

  // Check if any batch or document is currently processing
  const hasProcessingBatches = useMemo(() => {
    return batches.some((b) => {
      if (b.status === "Proses" || (b.status as string).toLowerCase() === "pending") {
        return true;
      }
      if (b.docStatuses) {
        return Object.values(b.docStatuses).some((c) => c.status === "Proses");
      }
      return false;
    });
  }, [batches]);

  // Adaptive polling with backoff and visibilitychange pause
  const pollIntervalRef = useRef<number>(5000);
  const consecutivePollsRef = useRef<number>(0);

  useEffect(() => {
    if (!hasProcessingBatches) {
      pollIntervalRef.current = 5000;
      consecutivePollsRef.current = 0;
      return;
    }

    let timeoutId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const scheduleNextPoll = () => {
      if (isCancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      timeoutId = setTimeout(async () => {
        if (isCancelled) return;
        await fetchBatches(true);
        consecutivePollsRef.current += 1;

        // Adaptive backoff: 5s initially, back off to 15s after 6 polls (~30s), 30s after 12 polls
        if (consecutivePollsRef.current > 12) {
          pollIntervalRef.current = 30000;
        } else if (consecutivePollsRef.current > 6) {
          pollIntervalRef.current = 15000;
        } else {
          pollIntervalRef.current = 5000;
        }

        scheduleNextPoll();
      }, pollIntervalRef.current);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (timeoutId) clearTimeout(timeoutId);
        fetchBatches(true);
        scheduleNextPoll();
      } else {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleNextPoll();

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasProcessingBatches, fetchBatches]);

  // Toast notification when background processing completes
  const isFirstLoadRef = useRef(true);
  const prevStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (tableBatches.length === 0) return;

    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      const initialMap: Record<string, string> = {};
      for (const b of tableBatches) {
        initialMap[b.id] = b.status;
      }
      prevStatusesRef.current = initialMap;
      return;
    }

    // Check if any batch transitioned from "Proses" to finalized
    for (const b of tableBatches) {
      const prev = prevStatusesRef.current[b.id];
      if (prev === "Proses" && b.status !== "Proses") {
        const statusLabel =
          b.status === "Matching"
            ? "Validasi lolos"
            : b.status === "Failed" || b.status === "Ditolak"
            ? "Failed"
            : "Perlu review manual";
        showToast(`Batch #${b.id} selesai diproses: ${statusLabel}`);
      }
    }

    const nextMap: Record<string, string> = {};
    for (const b of tableBatches) {
      nextMap[b.id] = b.status;
    }
    prevStatusesRef.current = nextMap;
  }, [tableBatches, showToast]);

  const matchesTabFilter = useCallback((batch: TableBatchItem, tab: MatchingTabId): boolean => {
    switch (tab) {
      case "match":
        return batch.status === "Matching";
      case "mismatch":
        return batch.status === "Mismatching";
      case "failed":
        return batch.status === "Failed" || batch.status === "Ditolak";
      case "all":
      default:
        return true;
    }
  }, []);

  // Compute dynamic counts for the tabs
  const tabCounts = useMemo<TabCounts>(() => {
    return {
      all: tableBatches.length,
      match: tableBatches.filter((b) => matchesTabFilter(b, "match")).length,
      mismatch: tableBatches.filter((b) => matchesTabFilter(b, "mismatch")).length,
      failed: tableBatches.filter((b) => matchesTabFilter(b, "failed")).length,
    };
  }, [tableBatches, matchesTabFilter]);

  // Filter batches by active tab
  const tabFilteredBatches = useMemo(() => {
    return tableBatches.filter((batch) => matchesTabFilter(batch, activeTab));
  }, [tableBatches, activeTab, matchesTabFilter]);

  // Filter batches by search query
  const searchFilteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return tabFilteredBatches;
    const q = searchQuery.toLowerCase().trim();
    return tabFilteredBatches.filter((b) => {
      const matchFileName = b.pibFileName.toLowerCase().includes(q);
      const matchNama = b.nama.toLowerCase().includes(q);
      const matchId = b.id.toLowerCase().includes(q);
      const matchSubtext = b.subtext.toLowerCase().includes(q);
      const matchNoPengajuan = b.noPengajuan ? b.noPengajuan.toLowerCase().includes(q) : false;
      const matchField = Object.values(b.fields).some((val) =>
        val.toLowerCase().includes(q)
      );
      return matchFileName || matchNama || matchId || matchSubtext || matchNoPengajuan || matchField;
    });
  }, [tabFilteredBatches, searchQuery]);

  // Sort batches
  const sortedBatches = useMemo(() => {
    if (!sortColumn || sortDirection === "none") return searchFilteredBatches;

    return [...searchFilteredBatches].sort((a, b) => {
      let valA = "";
      let valB = "";

      if (sortColumn === "createdAt") {
        valA = a.createdAt || "";
        valB = b.createdAt || "";
      } else if (sortColumn === "nama") {
        valA = a.nama;
        valB = b.nama;
      } else if (sortColumn === "status") {
        valA = a.status;
        valB = b.status;
      } else {
        // Document status column or field lookup
        valA = a.docStatuses?.[sortColumn]?.status || a.fields[sortColumn] || "";
        valB = b.docStatuses?.[sortColumn]?.status || b.fields[sortColumn] || "";
      }

      // Check numeric
      const cleanA = valA.replace(/,/g, "");
      const cleanB = valB.replace(/,/g, "");
      const numA = parseFloat(cleanA);
      const numB = parseFloat(cleanB);

      if (!isNaN(numA) && !isNaN(numB) && /^-?\d+(\.\d+)?$/.test(cleanA) && /^-?\d+(\.\d+)?$/.test(cleanB)) {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      return sortDirection === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }, [searchFilteredBatches, sortColumn, sortDirection]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedBatches.length / rowsPerPage));
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedBatches.slice(start, start + rowsPerPage);
  }, [sortedBatches, currentPage, rowsPerPage]);

  // Selection handlers
  const isAllSelected =
    paginatedBatches.length > 0 &&
    paginatedBatches.every((b) => selectedBatchIds.includes(b.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const pageIds = paginatedBatches.map((b) => b.id);
      setSelectedBatchIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedBatches.map((b) => b.id);
      setSelectedBatchIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelectRow = (
    id: string,
    e: React.MouseEvent | React.ChangeEvent
  ) => {
    e.stopPropagation();
    setSelectedBatchIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  // Sorting handler
  const handleSortChange = (colKey: string) => {
    if (sortColumn === colKey) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") setSortDirection("none");
      else setSortDirection("asc");
    } else {
      setSortColumn(colKey);
      setSortDirection("asc");
    }
  };

  // Column visibility handlers
  const handleToggleColumn = (colKey: keyof ColumnVisibility) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [colKey]: !prev[colKey],
    }));
  };

  const handleResetColumns = () => {
    setColumnVisibility(defaultColumnVisibility);
  };

  // Assign handler
  const handleAssign = (batchId: string) => {
    setAssignedMap((prev) => {
      const isCurrentlyAssigned = Boolean(prev[batchId]);
      const nextState = { ...prev };
      if (isCurrentlyAssigned) {
        delete nextState[batchId];
        showToast(`Penugasan batch #${batchId} dibatalkan`);
      } else {
        nextState[batchId] = "Saya";
        showToast(`Batch #${batchId} berhasil ditugaskan ke saya`);
      }
      return nextState;
    });
  };

  // Row Delete Handlers
  const handleDeleteClick = (batch: TableBatchItem) => {
    setDeleteConfirm({
      isOpen: true,
      batch,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.batch) return;
    const batchToDelete = deleteConfirm.batch;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/batches/${batchToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const itemLabel = batchToDelete.noPengajuan || `Batch #${batchToDelete.id}`;
        showToast(`Batch "${itemLabel}" berhasil dihapus`);
        setBatches((prev) => prev.filter((b) => b.id !== batchToDelete.id));
        setSelectedBatchIds((prev) => prev.filter((id) => id !== batchToDelete.id));
        setDeleteConfirm({ isOpen: false, batch: null });
      } else {
        alert(data.error || "Gagal menghapus file batch.");
      }
    } catch (err) {
      console.error("Hapus batch error:", err);
      alert("Terjadi kesalahan jaringan saat menghapus file.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Unified server-side Excel download helper (includes complete Data Action, Kamus, Edit, Setujui, & Catatan logs)
  const triggerServerExcelDownload = async (params: URLSearchParams, fallbackName: string) => {
    const res = await fetch(`/api/export/excel?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Gagal mengunduh file Excel.");
    }
    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") || "";
    const matchName = /filename="?([^"]+)"?/i.exec(disposition);
    const filename = matchName?.[1] || fallbackName;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Single Row Download Handler
  const handleDownloadSingle = async (batch: TableBatchItem) => {
    try {
      const itemLabel = batch.noPengajuan || `Batch #${batch.id}`;
      showToast(`Mengunduh data hasil lengkap untuk ${itemLabel}...`);

      const params = new URLSearchParams();
      params.set("scope", "personal");
      params.set("mode", "with_action_log");
      params.set("batchIds", batch.id);

      await triggerServerExcelDownload(params, `Laporan_Matching_Batch_${batch.id}.xlsx`);
      showToast(`Berhasil mengunduh laporan ${itemLabel}`);
    } catch (err) {
      console.error("Download error:", err);
      showToast(err instanceof Error ? err.message : "Gagal mengunduh data batch.");
    }
  };

  // Handler unduh data hasil
  const handleDownloadExtractedData = async () => {
    const targetBatches =
      selectedBatchIds.length > 0
        ? batches.filter((b) => selectedBatchIds.includes(b.id))
        : batches;

    if (targetBatches.length === 0) {
      showToast("Tidak ada data dokumen untuk diunduh.");
      return;
    }

    try {
      showToast(`Menyiapkan data unduh lengkap untuk ${targetBatches.length} batch...`);

      const params = new URLSearchParams();
      params.set("scope", "personal");
      params.set("mode", "with_action_log");
      if (targetBatches.length <= 100) {
        params.set("batchIds", targetBatches.map((b) => b.id).join(","));
      } else if (searchQuery) {
        params.set("search", searchQuery);
      }

      await triggerServerExcelDownload(params, `Laporan_Matching_${targetBatches.length}_Batch.xlsx`);
      showToast(`Berhasil mengunduh data hasil (${targetBatches.length} batch)`);
    } catch (err) {
      console.error("Bulk download error:", err);
      showToast(err instanceof Error ? err.message : "Gagal mengunduh data hasil.");
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-5 pb-0 sm:pb-0 overflow-hidden min-w-0">
      <div className="flex-1 flex flex-col min-h-0 space-y-3 pb-2.5">
        {/* 1. Tabs & Toolbar: Clean segmented filter tabs (All, Match, Mismatch, Failed) + Toolbar */}
        <div className="shrink-0">
          <MatchingTabsToolbar
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              setCurrentPage(1);
            }}
            counts={tabCounts}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setCurrentPage(1);
            }}
            onRefresh={() => fetchBatches(false)}
            isRefreshing={isRefreshing}
            columnVisibility={columnVisibility}
            onToggleColumn={handleToggleColumn}
            onResetColumns={handleResetColumns}
            hasActiveFilters={activeTab !== "all" || Boolean(searchQuery)}
            onOpenFilterDialog={() => {
              const tabLabels: Record<MatchingTabId, string> = {
                all: "All",
                match: "Match",
                mismatch: "Mismatch",
                failed: "Failed",
              };
              showToast(`Filter aktif: ${tabLabels[activeTab]}`);
            }}
            onExportPersonal={(mode) => {
              const params = new URLSearchParams();
              params.set("scope", "personal");
              params.set("mode", mode);
              if (searchQuery) params.set("search", searchQuery);
              window.location.href = `/api/export/excel?${params.toString()}`;
            }}
          />
        </div>

        {/* 3. Table: Exact 9 columns in order, subtle hover, sticky header, internal scroll */}
        <div className="flex-1 min-h-0">
          <MatchingTable
            batches={paginatedBatches}
            loading={loading}
            searchQuery={searchQuery}
            selectedBatchIds={selectedBatchIds}
            onToggleSelectAll={handleToggleSelectAll}
            onToggleSelectRow={handleToggleSelectRow}
            isAllSelected={isAllSelected}
            onRowClick={(id, docCode) => {
              const target = batches.find((b) => b.id === id);
              const st = (target?.status || "").toLowerCase();
              if (st === "proses" || st === "pending") {
                showToast("Dokumen masih diproses oleh OCR Nanonets, mohon tunggu hingga selesai.");
                return;
              }
              setSelectedBatchId(id);
              setSelectedDocCode(docCode || "PIB");
            }}
            onLockedClick={(id) => {
              showToast(`Batch #${id} masih diproses oleh OCR Nanonets, mohon tunggu hingga selesai.`);
            }}
            onManageFiles={(b) => setManageFilesBatchId(b.id)}
            onDownload={handleDownloadSingle}
            onDelete={handleDeleteClick}
            onAssign={handleAssign}
            onCopyFileName={(val) =>
              showToast(`"${val}" berhasil disalin ke clipboard`)
            }
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            columnVisibility={columnVisibility}
          />
        </div>
      </div>

      {/* 4. Slim Docked Footer at the bottom */}
      <div className="shrink-0">
        <MatchingFooter
          onUploadFile={() => router.push("/upload")}
          onDownloadExtractedData={handleDownloadExtractedData}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(p) => setCurrentPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(n) => {
            setRowsPerPage(n);
            setCurrentPage(1);
          }}
          totalItems={sortedBatches.length}
        />
      </div>

      {/* 5. Detail View (Full Page): Opened when any row is clicked, preserving list state */}
      {selectedBatchId && (
        <MatchingDetailView
          batchId={selectedBatchId}
          initialDocCode={selectedDocCode}
          onClose={handleDetailClose}
          onStatusUpdate={handleDetailStatusUpdate}
        />
      )}

      {/* 5.5 Manage / Add / Replace Documents Modal */}
      <BatchDocumentsModal
        batchId={manageFilesBatchId}
        isOpen={Boolean(manageFilesBatchId)}
        onClose={() => setManageFilesBatchId(null)}
        onDocumentsChanged={(_id, _newStatus, msg) => {
          if (msg) showToast(msg);
          fetchBatches(true);
        }}
      />

      {/* 6. Hapus Confirmation Dialog: "Hapus file ini?" with "Batal" and "Hapus" (only confirm danger style) */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, batch: null })}
        onConfirm={handleConfirmDelete}
        title="Hapus file ini?"
        description={
          deleteConfirm.batch ? (
            <div className="space-y-1.5">
              <p>
                Apakah Anda yakin ingin menghapus batch{" "}
                <strong className="text-slate-800">
                  {deleteConfirm.batch.noPengajuan || `Batch #${deleteConfirm.batch.id}`}
                </strong>
                ?
              </p>
              <p className="text-xs text-slate-500">
                Data hasil ekstraksi dan matching pada file ini akan dihapus secara permanen dari sistem.
              </p>
            </div>
          ) : (
            "Apakah Anda yakin ingin menghapus file ini?"
          )
        }
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* 7. Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-xl border border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default function MatchingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-xs font-semibold">
          Memuat data matching...
        </div>
      }
    >
      <MatchingPageContent />
    </React.Suspense>
  );
}
