"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  X,
  FileText,
  Upload,
  RefreshCw,
  Plus,
  History,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowRightLeft,
} from "lucide-react";
import {
  DOCUMENT_CATEGORIES,
  getCategoryConfigByInput,
  normalizeCategoryCode,
} from "~/config/documentCategories";
import type { DocumentUpdateRecord } from "./detailTypes";

interface RawDetailItem {
  id: number;
  batchId: string;
  fileType: string;
  fileId: string;
  isi?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface RawBatchData {
  id: string;
  status: string;
  totalFile: number;
  details: RawDetailItem[];
}

export interface BatchDocumentsModalProps {
  batchId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onDocumentsChanged?: (batchId: string, newStatus?: string, message?: string) => void;
}

interface ParsedDetailView {
  id: number;
  categoryCode: string;
  categoryTitle: string;
  categoryNum: number;
  allowMultiple: boolean;
  fileName: string;
  ocrPending: boolean;
  updateHistory: DocumentUpdateRecord[];
  createdAt?: string;
  updatedAt?: string;
}

function formatDateTimeID(iso?: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function parseDetailForModal(det: RawDetailItem): ParsedDetailView {
  const catConfig = getCategoryConfigByInput(det.fileType);
  let originalFileName: string | undefined;
  let fileUrl: string | undefined;
  let updateHistory: DocumentUpdateRecord[] = [];
  let ocrPending = !det.isi || !det.isi.trim();

  if (det.isi) {
    try {
      const p = JSON.parse(det.isi);
      if (typeof p?.originalFileName === "string") originalFileName = p.originalFileName;
      if (typeof p?.fileUrl === "string") fileUrl = p.fileUrl;
      if (Array.isArray(p?.updateHistory)) updateHistory = p.updateHistory;
      if (p?.ocrPending === true) ocrPending = true;
      else if (p?.fields || p?.table) ocrPending = false;
    } catch {
      // ignore JSON parse issues
    }
  }

  const urlBaseName = fileUrl ? decodeURIComponent(fileUrl.split("/").pop() || "") : "";
  const fileName =
    originalFileName ||
    (urlBaseName.toLowerCase().endsWith(".pdf") ? urlBaseName : "") ||
    (det.fileId && det.fileId.toLowerCase().endsWith(".pdf")
      ? det.fileId
      : `${catConfig.code}.pdf`);

  return {
    id: det.id,
    categoryCode: catConfig.code,
    categoryTitle: catConfig.title,
    categoryNum: catConfig.num,
    allowMultiple: catConfig.allowMultiple,
    fileName,
    ocrPending,
    updateHistory,
    createdAt: det.createdAt,
    updatedAt: det.updatedAt,
  };
}

export default function BatchDocumentsModal({
  batchId,
  isOpen,
  onClose,
  onDocumentsChanged,
}: BatchDocumentsModalProps) {
  const [batch, setBatch] = useState<RawBatchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Replace state for an existing document
  const [pendingReplace, setPendingReplace] = useState<{
    detailId: number;
    categoryTitle: string;
    file: File;
  } | null>(null);
  const [submittingDetailId, setSubmittingDetailId] = useState<number | null>(null);
  const replaceInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Add state for an empty / multi-file category
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAddCategory, setSelectedAddCategory] = useState<string>("");
  const [addFile, setAddFile] = useState<File | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const addInputRef = useRef<HTMLInputElement | null>(null);

  const loadBatchDetails = useCallback(
    async (silent = false) => {
      if (!batchId) return;
      if (!silent) setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/batches/${batchId}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.batch) {
          throw new Error(data.error || "Gagal memuat data dokumen batch.");
        }
        setBatch(data.batch);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Gagal memuat dokumen batch.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [batchId]
  );

  useEffect(() => {
    if (isOpen && batchId) {
      setPendingReplace(null);
      setShowAddForm(false);
      setAddFile(null);
      loadBatchDetails(false);
    }
  }, [isOpen, batchId, loadBatchDetails]);

  const uploadedDocs = useMemo<ParsedDetailView[]>(() => {
    if (!batch?.details) return [];
    return batch.details
      .map(parseDetailForModal)
      .sort((a, b) => a.categoryNum - b.categoryNum || a.id - b.id);
  }, [batch]);

  // Categories available to add: empty single-file categories + multi-file categories (PL, Invoice)
  const addableCategories = useMemo(() => {
    const existingSingleCodes = new Set(
      uploadedDocs.map((d) => normalizeCategoryCode(d.categoryCode).toLowerCase())
    );
    return DOCUMENT_CATEGORIES.filter(
      (cat) => cat.allowMultiple || !existingSingleCodes.has(cat.code.toLowerCase())
    );
  }, [uploadedDocs]);

  useEffect(() => {
    if (addableCategories.length > 0) {
      const stillValid = addableCategories.some((c) => c.title === selectedAddCategory);
      if (!stillValid) {
        setSelectedAddCategory(addableCategories[0]!.title);
      }
    }
  }, [addableCategories, selectedAddCategory]);

  // Auto-poll silently while any document inside this batch is waiting on Nanonets OCR
  const hasPendingOcr = useMemo(() => {
    const st = (batch?.status || "").toUpperCase();
    return st === "PROSES" || st === "PENDING" || uploadedDocs.some((d) => d.ocrPending);
  }, [batch?.status, uploadedDocs]);

  useEffect(() => {
    if (!isOpen || !batchId || !hasPendingOcr) return;
    const timer = setInterval(() => {
      loadBatchDetails(true);
    }, 3000);
    return () => clearInterval(timer);
  }, [isOpen, batchId, hasPendingOcr, loadBatchDetails]);

  if (!isOpen || !batchId) return null;

  const rawUpper = (batch?.status || "").toUpperCase();
  const isApproved = rawUpper === "APPROVED";
  const isExported = rawUpper === "EXPORTED" || rawUpper === "ARCHIVED";
  const isReadOnly = isApproved || isExported;
  const isLockedForMutation = isReadOnly || hasPendingOcr;

  const handleConfirmReplace = async () => {
    if (isLockedForMutation || !pendingReplace || submittingDetailId !== null) return;
    setSubmittingDetailId(pendingReplace.detailId);
    setErrorMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", pendingReplace.file, pendingReplace.file.name);
      fd.append("category", pendingReplace.categoryTitle);
      fd.append("detailId", String(pendingReplace.detailId));

      const res = await fetch(`/api/batches/${batchId}/documents`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengganti dokumen.");
      }

      const newName = pendingReplace.file.name;
      setPendingReplace(null);
      await loadBatchDetails(true);
      onDocumentsChanged?.(
        batchId,
        data.status,
        `Dokumen "${pendingReplace.categoryTitle}" diperbarui ke "${newName}".`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengganti dokumen.");
    } finally {
      setSubmittingDetailId(null);
    }
  };

  const handleConfirmAdd = async () => {
    if (isLockedForMutation || !addFile || !selectedAddCategory || isSubmittingAdd) return;
    setIsSubmittingAdd(true);
    setErrorMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", addFile, addFile.name);
      fd.append("category", selectedAddCategory);

      const res = await fetch(`/api/batches/${batchId}/documents`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menambahkan dokumen.");
      }

      const addedName = addFile.name;
      const addedCat = selectedAddCategory;
      setAddFile(null);
      setShowAddForm(false);
      await loadBatchDetails(true);
      onDocumentsChanged?.(
        batchId,
        data.status,
        `Dokumen "${addedName}" (${addedCat}) berhasil ditambahkan.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menambahkan dokumen.");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900">
                Kelola Dokumen Batch
              </h3>
              <span className="text-[11px] font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                #{batchId}
              </span>
              {isExported ? (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3 text-sky-600" />
                  <span>Exported (Terkunci)</span>
                </span>
              ) : isApproved ? (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span>Approved (Terkunci)</span>
                </span>
              ) : hasPendingOcr ? (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3 text-amber-600" />
                  <span>Pending OCR (Terkunci)</span>
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Hanya dokumen yang sudah terunggah yang ditampilkan. Upload ulang otomatis mencatat nama file & tanggal pembaruan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/40">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-2.5 animate-pulse">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-slate-200/80 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-16 rounded-md bg-slate-200/80" />
                      <div className="h-4 w-40 rounded bg-slate-200/70" />
                    </div>
                    <div className="h-7 w-24 rounded-lg bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : uploadedDocs.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
              <FileText className="w-7 h-7 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-700">Belum ada dokumen terunggah</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Gunakan tombol &ldquo;Tambah Dokumen&rdquo; di bawah untuk mengunggah file PDF.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {uploadedDocs.map((doc) => {
                const isThisReplacing =
                  pendingReplace?.detailId === doc.id;
                const isUploadingThis = submittingDetailId === doc.id;
                const historyDesc = [...doc.updateHistory].reverse();

                return (
                  <div
                    key={doc.id}
                    className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-800 border border-slate-200/80 shrink-0 mt-0.5 sm:mt-0">
                          {doc.categoryCode}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-900 truncate max-w-[260px]" title={doc.fileName}>
                              {doc.fileName}
                            </span>
                            {doc.ocrPending ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-600" />
                                <span>Memproses OCR...</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Siap</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{doc.categoryTitle}</span>
                            {doc.createdAt && (
                              <>
                                <span>•</span>
                                <span>Diunggah: {formatDateTimeID(doc.createdAt)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {!isLockedForMutation && (
                        <div className="shrink-0 ml-auto">
                          <input
                            ref={(el) => {
                              replaceInputRefs.current[doc.id] = el;
                            }}
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const picked = e.target.files?.[0];
                              e.target.value = "";
                              if (picked) {
                                setPendingReplace({
                                  detailId: doc.id,
                                  categoryTitle: doc.categoryTitle,
                                  file: picked,
                                });
                              }
                            }}
                          />
                          <button
                            type="button"
                            disabled={submittingDetailId !== null || isSubmittingAdd}
                            onClick={() => replaceInputRefs.current[doc.id]?.click()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                            title={`Upload ulang / ganti file ${doc.categoryTitle}`}
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                            <span>Ganti File</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Inline Replace Confirmation Box */}
                    {isThisReplacing && pendingReplace && (
                      <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-2.5 flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-xs text-blue-950 min-w-0">
                          <span className="font-medium">File baru: </span>
                          <span className="font-semibold break-all">
                            {pendingReplace.file.name}
                          </span>
                          <p className="text-[10.5px] text-blue-700 mt-0.5">
                            Mengganti dokumen lama dan menyimpan catatan pembaruan (nama file &amp; tanggal).
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <button
                            type="button"
                            disabled={isUploadingThis}
                            onClick={() => setPendingReplace(null)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled={isUploadingThis}
                            onClick={handleConfirmReplace}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer disabled:opacity-60"
                          >
                            {isUploadingThis ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Mengunggah...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-3 h-3" />
                                <span>Simpan &amp; Ganti</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Catatan Pembaruan Data (shown ONLY when this document was replaced/updated) */}
                    {historyDesc.length > 0 && (
                      <div className="rounded-lg bg-amber-50/70 border border-amber-200/80 px-3 py-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-amber-900">
                          <History className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>Catatan Pembaruan Data ({historyDesc.length}×)</span>
                        </div>
                        <div className="space-y-1">
                          {historyDesc.map((entry, idx) => (
                            <div
                              key={`${entry.updatedAt}-${idx}`}
                              className="text-[11px] text-amber-900/90 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-4"
                            >
                              <span className="font-semibold text-slate-800">
                                {entry.fileName}
                              </span>
                              <span className="text-amber-700 font-mono text-[10.5px]">
                                • {formatDateTimeID(entry.updatedAt)}
                              </span>
                              {entry.previousFileName && (
                                <span className="text-slate-500 text-[10.5px]">
                                  (sebelumnya: {entry.previousFileName})
                                </span>
                              )}
                              {entry.updatedBy && (
                                <span className="text-slate-500 text-[10.5px]">
                                  oleh {entry.updatedBy}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Section 2: Tambah Dokumen (only available categories out of the 7, collapsed until clicked) */}
          {!isLockedForMutation && !loading && addableCategories.length > 0 && (
            <div className="pt-1">
              {!showAddForm ? (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Dokumen yang Belum Ada</span>
                </button>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900">
                      Tambah Dokumen Susulan
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setAddFile(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>

                  {/* Category Picker (only missing single-file categories + multi-file categories) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-600 block">
                      Pilih Kategori Dokumen (7 Kategori):
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {addableCategories.map((cat) => {
                        const isSelected = selectedAddCategory === cat.title;
                        return (
                          <button
                            key={cat.num}
                            type="button"
                            onClick={() => setSelectedAddCategory(cat.title)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {cat.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* File Dropzone */}
                  <div>
                    <input
                      ref={addInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const picked = e.target.files?.[0];
                        e.target.value = "";
                        if (picked) setAddFile(picked);
                      }}
                    />
                    {addFile ? (
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">
                            {addFile.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAddFile(null)}
                          className="text-xs text-slate-500 hover:text-rose-600 cursor-pointer shrink-0"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const dropped = e.dataTransfer.files?.[0];
                          if (dropped) setAddFile(dropped);
                        }}
                        className="w-full py-4 px-3 rounded-lg border border-dashed border-slate-300 hover:border-slate-500 bg-slate-50/60 hover:bg-slate-50 text-xs text-slate-600 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span>Pilih atau seret file PDF untuk {selectedAddCategory}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={isSubmittingAdd}
                      onClick={() => {
                        setShowAddForm(false);
                        setAddFile(null);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={!addFile || isSubmittingAdd || submittingDetailId !== null}
                      onClick={handleConfirmAdd}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingAdd ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Mengunggah...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Tambahkan Dokumen</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
