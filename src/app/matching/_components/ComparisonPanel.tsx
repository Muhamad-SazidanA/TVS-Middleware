"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Pencil,
  AlertTriangle,
  X,
  Save,
  Loader2,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Archive,
  Lock,
  FolderUp,
  History,
} from "lucide-react";
import type {
  BatchDocumentModel,
  ChangeEventCategory,
  ComparisonFieldModel,
  DocumentComparisonGroup,
  FieldChangeEvent,
} from "./detailTypes";
import { getNextMismatchTarget } from "~/utils/mismatchCycle";

const CHANGE_CATEGORY_STYLES: Record<
  ChangeEventCategory,
  { badge: string; text: string }
> = {
  DATA_ACTION: {
    badge: "bg-teal-50 text-teal-800 border-teal-200",
    text: "text-teal-700",
  },
  KAMUS: {
    badge: "bg-violet-50 text-violet-800 border-violet-200",
    text: "text-violet-700",
  },
  EDIT: {
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    text: "text-amber-700",
  },
  SETUJUI_SATUAN: {
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    text: "text-emerald-700",
  },
  SETUJUI_ALL: {
    badge: "bg-emerald-100/80 text-emerald-900 border-emerald-300",
    text: "text-emerald-800",
  },
  SETUJUI_BERKAS: {
    badge: "bg-blue-50 text-blue-800 border-blue-200",
    text: "text-blue-700",
  },
  BATAL_SETUJUI: {
    badge: "bg-rose-50 text-rose-800 border-rose-200",
    text: "text-rose-700",
  },
  DOC_UPDATE: {
    badge: "bg-sky-50 text-sky-800 border-sky-200",
    text: "text-sky-700",
  },
};

function formatNoteDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const month = months[d.getMonth()] || "";
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month}, ${hours}:${mins}`;
  } catch {
    return dateStr;
  }
}

export interface ComparisonPanelProps {
  batchId: string;
  pibDoc: BatchDocumentModel;
  groups: DocumentComparisonGroup[];
  currentLoadedDoc: BatchDocumentModel;
  activeDocCode?: string;
  onSelectDocCode?: (docCode: string) => void;
  activeFieldId: string | null;
  onSelectField: (fieldId: string, docCode?: string) => void;
  onLoadPibInViewer: (fieldId: string) => void;
  onLoadSupportingInViewer: (fieldId: string, docCode: string) => void;
  onNavigateToDoc?: (docCode: string, page?: number) => void;
  onFieldUpdated: (detailId: number, fieldName: string, newValue: string) => void;
  onManualMatchToggled?: (fieldLabel: string, confirmed: boolean) => void;
  onAddManualNote?: (
    targetType: "field" | "line_item",
    targetKey: string,
    text: string,
    docCode?: string,
    detailId?: number
  ) => Promise<void>;
  onEditManualNote?: (noteId: string, text: string) => Promise<void>;
  onDeleteManualNote?: (noteId: string) => Promise<void>;
  onManageDocuments?: () => void;
  onNotify?: (message: string, type?: "success" | "info" | "warning" | "error") => void;
  batchChangeLogs?: FieldChangeEvent[];
  workflowStatus?: "Pending" | "Pending Validation" | "Approved" | "Exported" | "Failed";
  isReadOnly?: boolean;
  footer?: React.ReactNode;
  className?: string;
}

export default function ComparisonPanel({
  batchId,
  pibDoc,
  groups,
  currentLoadedDoc,
  activeDocCode,
  onSelectDocCode,
  activeFieldId,
  onSelectField,
  onLoadPibInViewer,
  onLoadSupportingInViewer,
  onNavigateToDoc,
  onFieldUpdated,
  onManualMatchToggled,
  onAddManualNote,
  onEditManualNote,
  onDeleteManualNote,
  onManageDocuments,
  onNotify,
  batchChangeLogs = [],
  workflowStatus = "Pending Validation",
  isReadOnly = false,
  footer,
  className = "",
}: ComparisonPanelProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const defaultDoc =
    activeDocCode && activeDocCode.toUpperCase() !== "PIB"
      ? activeDocCode
      : "ALL";
  const [internalDocFilter, setInternalDocFilter] = useState<string>(defaultDoc);
  const isControlledFilter = Boolean(
    activeDocCode && activeDocCode.toUpperCase() !== "PIB"
  );
  const selectedDocFilter = isControlledFilter
    ? activeDocCode!
    : internalDocFilter;

  // Manual Match confirmation state
  const [togglingManualMatchId, setTogglingManualMatchId] = useState<string | null>(null);

  const handleToggleManualMatch = async (
    field: ComparisonFieldModel,
    docCode: string
  ) => {
    if (isReadOnly || togglingManualMatchId) return;
    setTogglingManualMatchId(field.id);
    try {
      const newConfirmed = !field.isManualConfirmed;
      const res = await fetch(`/api/batches/${batchId}/manual-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          detailId: field.supportingDetailId || field.pibDetailId,
          fieldId: field.id,
          fieldName: field.fieldName,
          fieldLabel: field.label,
          docCode: field.docCode || docCode,
          confirmed: newConfirmed,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal memperbarui status konfirmasi.");
      }

      if (onManualMatchToggled) {
        onManualMatchToggled(field.label, newConfirmed);
      } else {
        onFieldUpdated(
          field.supportingDetailId || field.pibDetailId || 0,
          field.label,
          ""
        );
      }
    } catch (err) {
      console.error("Toggle manual match error:", err);
      onNotify?.(
        err instanceof Error ? err.message : "Gagal memperbarui status konfirmasi.",
        "error"
      );
    } finally {
      setTogglingManualMatchId(null);
    }
  };

  // Inline edit state
  const [editingField, setEditingField] = useState<{
    fieldId: string;
    target: "left" | "right";
    detailId: number;
    fieldName: string;
    fieldLabel: string;
    docLabel: string;
    currentValue: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Manual note dialog state
  const [noteDialog, setNoteDialog] = useState<{
    mode: "add" | "edit";
    noteId?: string;
    targetType: "field" | "line_item";
    targetKey: string;
    docCode?: string;
    detailId?: number;
    text: string;
    label: string;
  } | null>(null);
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const handleOpenNoteModal = (
    mode: "add" | "edit",
    targetType: "field" | "line_item",
    targetKey: string,
    docCode?: string,
    detailId?: number,
    initialText: string = "",
    noteId?: string,
    label: string = ""
  ) => {
    if (isReadOnly) return;
    setNoteError(null);
    setNoteDialog({
      mode,
      noteId,
      targetType,
      targetKey,
      docCode,
      detailId,
      text: initialText,
      label,
    });
  };

  const handleSaveNote = async () => {
    if (!noteDialog || !noteDialog.text.trim()) return;
    try {
      setIsSavingNote(true);
      setNoteError(null);
      if (noteDialog.mode === "add") {
        if (onAddManualNote) {
          await onAddManualNote(
            noteDialog.targetType,
            noteDialog.targetKey,
            noteDialog.text.trim(),
            noteDialog.docCode,
            noteDialog.detailId
          );
        }
      } else if (noteDialog.mode === "edit" && noteDialog.noteId) {
        if (onEditManualNote) {
          await onEditManualNote(noteDialog.noteId, noteDialog.text.trim());
        }
      }
      setNoteDialog(null);
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Gagal menyimpan catatan.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (isReadOnly || !onDeleteManualNote) return;
    try {
      await onDeleteManualNote(noteId);
    } catch (err) {
      console.error("Delete note error:", err);
    }
  };

  // References for scrolling
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastCycledFieldIdRef = useRef<string | null>(null);
  const pendingScrollBlockRef = useRef<"nearest" | "center">("nearest");

  const isAllSelected =
    (selectedDocFilter || "").toUpperCase() === "ALL" ||
    (selectedDocFilter || "").toUpperCase() === "SEMUA";

  // Active document group (strictly one document at a time when filtered, or null if "ALL")
  const currentGroup = useMemo(() => {
    if (isAllSelected) return null;
    const targetDoc = (selectedDocFilter || "").toUpperCase();
    return (
      groups.find((g) => g.docCode.toUpperCase() === targetDoc) ||
      groups[0] ||
      null
    );
  }, [groups, selectedDocFilter, isAllSelected]);

  // Filter fields and line items of groups based on search query
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const source = isAllSelected ? groups : currentGroup ? [currentGroup] : [];
    if (!q) return source;

    return source
      .map((g) => {
        const matchingFields = g.fields.filter(
          (f) =>
            f.label.toLowerCase().includes(q) ||
            f.pibValue.toLowerCase().includes(q) ||
            f.supportingValue.toLowerCase().includes(q) ||
            f.number.toLowerCase().includes(q)
        );
        return {
          ...g,
          fields: matchingFields,
          lineItems: [],
        };
      })
      .filter((g) => g.fields.length > 0);
  }, [isAllSelected, groups, currentGroup, searchQuery]);

  const totalAllFieldsCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.fields.length, 0);
  }, [groups]);

  const totalAllMatchedCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.matchedCount, 0);
  }, [groups]);

  const totalAllMismatchedCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.mismatchedCount, 0);
  }, [groups]);

  const handleTabClick = (docCode: string) => {
    if (docCode.toUpperCase() === selectedDocFilter.toUpperCase()) return;
    if (!isControlledFilter) {
      setInternalDocFilter(docCode);
    }
    onSelectDocCode?.(docCode);
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop > 0) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const tabItems = useMemo(() => {
    const anyMismatch = groups.some((g) => g.mismatchedCount > 0);
    return [
      {
        code: "ALL",
        label: "Semua",
        count: totalAllFieldsCount,
        isMatch: !anyMismatch,
        isActive: isAllSelected,
        title: `Semua: ${totalAllFieldsCount} field`,
      },
      ...groups.map((group) => {
        const isDocMatch = group.mismatchedCount === 0;
        return {
          code: group.docCode,
          label: group.docCode,
          count: group.fields.length,
          isMatch: isDocMatch,
          isActive:
            !isAllSelected &&
            (currentGroup?.docCode || "").toUpperCase() === group.docCode.toUpperCase(),
          title: `${group.docCode}: ${group.fields.length} field (${
            isDocMatch ? "Semua Match" : `${group.mismatchedCount} Mismatch`
          })`,
        };
      }),
    ];
  }, [groups, totalAllFieldsCount, isAllSelected, currentGroup]);

  // Auto-scroll to active field card
  useEffect(() => {
    if (activeFieldId) {
      const el = cardRefs.current[activeFieldId];
      const block = pendingScrollBlockRef.current;
      pendingScrollBlockRef.current = "nearest";
      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          block,
        });
      }
    }
  }, [activeFieldId]);

  const allVisibleMismatchTargets = useMemo(() => {
    return filteredGroups.flatMap((group) =>
      group.fields
        .filter((f) => f.status === "MISMATCH")
        .map((field) => ({
          fieldId: field.id,
          docCode: group.docCode,
          field,
        }))
    );
  }, [filteredGroups]);

  const handleCycleMismatchTargets = (
    targets: Array<{ fieldId: string; docCode: string; field: ComparisonFieldModel }>
  ) => {
    const next = getNextMismatchTarget(
      targets,
      activeFieldId,
      lastCycledFieldIdRef.current
    );
    if (!next) return;

    const { field, docCode } = next;
    const hasSupportingLoc =
      field.supportingValue !== "Tidak ada di dokumen ini" &&
      Boolean(field.supportingBbox || field.supportingPage);
    const targetDoc = hasSupportingLoc ? docCode : "PIB";
    const targetPage = hasSupportingLoc
      ? field.supportingBbox?.page || field.supportingPage || 1
      : field.pibBbox?.page || field.pibPage || 1;

    lastCycledFieldIdRef.current = field.id;
    pendingScrollBlockRef.current = "center";
    onSelectField(field.id, targetDoc);
    onNavigateToDoc?.(targetDoc, targetPage);

    // Explicitly center card even when re-selecting the only mismatch
    const el = cardRefs.current[field.id];
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

  // Quick jump to group section


  // Handle open edit
  const handleOpenEdit = (
    e: React.MouseEvent,
    field: ComparisonFieldModel,
    group: DocumentComparisonGroup,
    target: "left" | "right"
  ) => {
    e.stopPropagation();
    if (isReadOnly) return;
    const isLeft = target === "left";
    const detailId = isLeft ? field.pibDetailId : field.supportingDetailId;
    if (!detailId) return;

    const val = isLeft ? field.pibValue : field.supportingValue;
    const docLabel = isLeft ? "PIB (acuan)" : group.docCode;

    setEditingField({
      fieldId: field.id,
      target,
      detailId,
      fieldName: field.fieldName,
      fieldLabel: `${field.number}. ${field.label}`,
      docLabel,
      currentValue: val === "Tidak ada di dokumen ini" ? "" : val,
    });
    setEditValue(val === "Tidak ada di dokumen ini" ? "" : val);
    setEditError(null);
  };

  // Submit field edit
  const handleSaveEdit = async () => {
    if (!editingField) return;
    try {
      setIsSavingEdit(true);
      setEditError(null);

      const res = await fetch(`/api/batches/${batchId}/field-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          detailId: editingField.detailId,
          fieldName: editingField.fieldName,
          newValue: editValue,
          oldValue: editingField.currentValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menyimpan perubahan nilai");
      }

      onFieldUpdated(editingField.detailId, editingField.fieldName, editValue);
      setEditingField(null);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan"
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden ${className}`}
    >
      {/* 1. Header Row: Title + Workflow Status + Component Summary + Search Input */}
      <div className="p-3.5 border-b border-slate-200/80 bg-white space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm text-slate-900">
              Data perbandingan {isAllSelected ? "(Semua)" : currentGroup ? `(${currentGroup.docCode})` : ""}
            </h3>
            {workflowStatus === "Exported" ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                <Archive className="w-3 h-3 text-sky-600" />
                <span>Exported</span>
              </span>
            ) : workflowStatus === "Approved" ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Approved</span>
              </span>
            ) : workflowStatus === "Pending" ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <Lock className="w-3 h-3 text-amber-600" />
                <span>Pending</span>
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Pending Validation
              </span>
            )}
            {(() => {
              const hasMismatch = isAllSelected
                ? groups.some((g) => g.mismatchedCount > 0)
                : (currentGroup?.mismatchedCount ?? 0) > 0;
              if (!hasMismatch) {
                return (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Match
                  </span>
                );
              }
              const canCycleAll = allVisibleMismatchTargets.length > 0;
              return (
                <button
                  type="button"
                  onClick={() => handleCycleMismatchTargets(allVisibleMismatchTargets)}
                  disabled={!canCycleAll}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 transition-all ${
                    canCycleAll
                      ? "cursor-pointer hover:bg-rose-100 hover:border-rose-300 active:scale-95"
                      : "opacity-60 cursor-default"
                  }`}
                  title={
                    canCycleAll
                      ? "Klik untuk melompati field mismatch secara berurutan"
                      : "Tidak ada field mismatch yang tampil"
                  }
                >
                  Mismatch
                </button>
              );
            })()}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {batchChangeLogs.length > 0 && (
              <button
                type="button"
                onClick={() => setHistoryModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Lihat seluruh log perubahan batch (Data Action, Kamus, Edit, Setujui)"
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Log ({batchChangeLogs.length})</span>
              </button>
            )}
            {onManageDocuments && !isReadOnly && (
              <button
                type="button"
                onClick={onManageDocuments}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Kelola, tambah, atau upload ulang dokumen batch"
              >
                <FolderUp className="w-3.5 h-3.5 text-slate-500" />
                <span>Kelola File</span>
              </button>
            )}
          </div>
        </div>

        {/* Matched vs Mismatched Component Summary */}
        <div className="flex items-center justify-between gap-2 flex-wrap px-2.5 py-1.5 rounded-xl bg-slate-50/90 border border-slate-200/80 text-[11px]">
          <span className="text-slate-600 font-medium truncate">
            Komponen:{" "}
            <strong className="text-slate-900 font-semibold">
              PIB (acuan)
            </strong>{" "}
            vs{" "}
            <span className="text-slate-700 font-medium">
              {isAllSelected
                ? groups.length > 0
                  ? groups.map((g) => g.docCode).join(", ")
                  : "Dokumen Pendukung"
                : currentGroup?.docName || currentGroup?.docCode || "Dokumen"}
            </span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono text-[10.5px]">
              {totalAllMatchedCount}/{totalAllFieldsCount} cocok
            </span>
            {totalAllMismatchedCount > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 font-mono text-[10.5px]">
                {totalAllMismatchedCount} mismatch
              </span>
            ) : totalAllFieldsCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10.5px]">
                <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                Semua tervalidasi
              </span>
            ) : null}
          </div>
        </div>

        {isReadOnly && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              Mode <strong className="font-semibold text-slate-800">Read-only ({workflowStatus})</strong>: edit nilai, konfirmasi manual, dan catatan dikunci.
            </span>
          </div>
        )}

        {/* PIB document replacement note if replaced */}
        {pibDoc?.updateHistory && pibDoc.updateHistory.length > 0 && (() => {
          const latestPibUpdate = pibDoc.updateHistory[pibDoc.updateHistory.length - 1];
          if (!latestPibUpdate) return null;
          return (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900">
              <History className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="truncate">
                PIB diperbarui: <strong className="font-semibold">{latestPibUpdate.fileName}</strong> • {formatNoteDate(latestPibUpdate.updatedAt)}
              </span>
            </div>
          );
        })()}

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isAllSelected
                ? "Cari field atau tabel di semua dokumen..."
                : `Cari field atau tabel di dokumen ${currentGroup?.docCode || ""}...`
            }
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5 cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Supporting Document Switcher Tabs (Smooth Segmented Pill) */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/70 overflow-x-auto no-scrollbar">
          {tabItems.map((tab) => (
            <button
              key={tab.code}
              type="button"
              onClick={() => handleTabClick(tab.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors duration-150 cursor-pointer select-none shrink-0 flex items-center gap-1.5 ${
                tab.isActive
                  ? "bg-slate-200/80 text-slate-900 border-slate-300/60"
                  : "text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/40"
              }`}
              title={tab.title}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-mono font-semibold border transition-colors duration-150 ${
                  tab.isMatch
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                    : "bg-rose-50 text-rose-700 border-rose-200/70"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Scrollable Body: Grouped Fields & Grouped Line Items */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3.5 pb-4 pt-0 space-y-6 bg-slate-50/40">
        {filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic text-xs bg-white rounded-xl border border-dashed border-slate-200 mt-3.5">
            Tidak ada perbandingan field yang sesuai dengan kata kunci pencarian.
          </div>
        ) : (
          filteredGroups.map((group) => {
            return (
              <div
                key={group.docCode}
                ref={(el) => {
                  groupRefs.current[group.docCode] = el;
                }}
                className="space-y-3"
              >
                {/* Sub-header: FIELD (Sticky / Fixed at the top) */}
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs py-2.5 -mx-3.5 px-3.5 border-b border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      Field
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      Header ({group.fields.length} field)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                      {group.matchedCount} Match
                    </span>
                    {group.mismatchedCount > 0 && (() => {
                      const groupMismatchTargets = group.fields
                        .filter((f) => f.status === "MISMATCH")
                        .map((field) => ({
                          fieldId: field.id,
                          docCode: group.docCode,
                          field,
                        }));
                      const canCycleGroup = groupMismatchTargets.length > 0;
                      return (
                        <button
                          type="button"
                          onClick={() => handleCycleMismatchTargets(groupMismatchTargets)}
                          disabled={!canCycleGroup}
                          className={`text-[10px] font-semibold text-rose-800 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full transition-all ${
                            canCycleGroup
                              ? "cursor-pointer hover:bg-rose-100 hover:border-rose-300 active:scale-95"
                              : "opacity-60 cursor-default"
                          }`}
                          title={
                            canCycleGroup
                              ? `Klik untuk mengarahkan ke field mismatch ${group.docCode} secara berurutan`
                              : `Field mismatch ${group.docCode} sedang tersembunyi oleh pencarian`
                          }
                        >
                          {group.mismatchedCount} Mismatch
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {/* Supporting document replacement note if updated/replaced */}
                {group.supportingDoc?.updateHistory && group.supportingDoc.updateHistory.length > 0 && (() => {
                  const latestUpdate =
                    group.supportingDoc.updateHistory[
                      group.supportingDoc.updateHistory.length - 1
                    ];
                  if (!latestUpdate) return null;
                  return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900">
                      <History className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="truncate">
                        {group.docCode} diperbarui:{" "}
                        <strong className="font-semibold">{latestUpdate.fileName}</strong> •{" "}
                        {formatNoteDate(latestUpdate.updatedAt)}
                      </span>
                    </div>
                  );
                })()}

                {/* Field Cards for this Group */}
                <div className="space-y-2.5 pt-1">
                  {group.fields.map((field) => {
                    const isActive = activeFieldId === field.id;
                    const isMatch = field.status === "MATCH";
                    const isMismatch = field.status === "MISMATCH";

                    let statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        -
                      </span>
                    );

                    if (field.isManualConfirmed) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                          <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                          Match
                        </span>
                      );
                    } else if (isMatch) {
                      statusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                          Match
                        </span>
                      );
                    } else if (isMismatch) {
                      statusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200/80">
                          Mismatch
                        </span>
                      );
                    }

                    let cardBgBorder =
                      "border-slate-200/90 bg-white hover:border-slate-300 shadow-2xs";
                    if (isActive) {
                      cardBgBorder =
                        "border-blue-500 bg-blue-50/20 ring-1 ring-blue-400 shadow-2xs";
                    } else if (isMatch) {
                      cardBgBorder =
                        "border-slate-200/90 border-l-3 border-l-emerald-500 bg-white hover:border-slate-300 shadow-2xs";
                    } else if (isMismatch) {
                      cardBgBorder =
                        "border-slate-200/90 border-l-3 border-l-rose-500 bg-white hover:border-slate-300 shadow-2xs";
                    }

                    const isLoadedPib =
                      (currentLoadedDoc?.code || "").toUpperCase() === "PIB";
                    const isLoadedSupporting =
                      (currentLoadedDoc?.code || "").toUpperCase() ===
                      group.docCode.toUpperCase();

                    const isPibActive = isActive && isLoadedPib;
                    const isSupportingActive = isActive && isLoadedSupporting;

                    const pibCardStyle = isPibActive
                      ? "border-blue-500 bg-blue-50/25 ring-1 ring-blue-400 shadow-2xs"
                      : "border-slate-300 bg-white hover:border-blue-400 hover:ring-1 hover:ring-blue-300 hover:shadow-2xs";

                    const supportingCardStyle = isSupportingActive
                      ? "border-blue-500 bg-blue-50/25 ring-1 ring-blue-400 shadow-2xs"
                      : "border-slate-300 bg-white hover:border-blue-400 hover:ring-1 hover:ring-blue-300 hover:shadow-2xs";

                    return (
                      <div
                        key={field.id}
                        ref={(el) => {
                          cardRefs.current[field.id] = el;
                        }}
                        onClick={() => {
                          onSelectField(field.id, group.docCode);
                          if (currentLoadedDoc.code.toUpperCase() === "PIB") {
                            onNavigateToDoc?.("PIB", field.pibPage || 1);
                          } else {
                            if (field.supportingPage && field.supportingValue !== "Tidak ada di dokumen ini") {
                              onNavigateToDoc?.(group.docCode, field.supportingPage);
                            } else {
                              onNavigateToDoc?.("PIB", field.pibPage || 1);
                            }
                          }
                        }}
                        className={`scroll-mt-14 rounded-xl border p-3 transition-all cursor-pointer ${cardBgBorder}`}
                      >
                        {/* Card Title & Status Badge + Confirm Button */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-900 tracking-tight">
                            {field.number}. {field.label}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {statusBadge}
                            {!isReadOnly && (
                              isMatch && !field.isManualConfirmed ? (
                                <div
                                  className="w-7 h-7 rounded-full border border-slate-200/70 bg-slate-50/70 text-slate-300 flex items-center justify-center shrink-0 cursor-not-allowed opacity-40 shadow-2xs"
                                  title="Field ini sudah cocok (Match) secara otomatis"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-2" />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleManualMatch(field, group.docCode);
                                  }}
                                  disabled={togglingManualMatchId === field.id}
                                  className={`w-7 h-7 rounded-full border transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs ${
                                    field.isManualConfirmed
                                      ? "bg-emerald-50 text-emerald-600 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 ring-2 ring-emerald-400/20"
                                      : "bg-white text-slate-400 border-slate-200 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/60"
                                  }`}
                                  title={
                                    field.isManualConfirmed
                                      ? "Dikonfirmasi manual Match. Klik untuk membatalkan konfirmasi"
                                      : "Konfirmasi manual sebagai Match (hanya untuk batch ini)"
                                  }
                                >
                                  {togglingManualMatchId === field.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                  ) : (
                                    <Check
                                      className={`w-3.5 h-3.5 ${
                                        field.isManualConfirmed
                                          ? "stroke-[2.5]"
                                          : "stroke-2"
                                      }`}
                                    />
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {field.matchReason && (
                          <p className="text-[10px] text-emerald-700 font-medium mt-0.5 italic flex items-center gap-1">
                            <span>{field.matchReason}</span>
                            {field.manualConfirmedBy && (
                              <span className="not-italic text-emerald-600 text-[9.5px]">
                                (oleh {field.manualConfirmedBy})
                              </span>
                            )}
                          </p>
                        )}

                        {/* Side-by-side Inner Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                          {/* Left Inner Card: PIB (acuan) */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectField(field.id, "PIB");
                              onNavigateToDoc?.("PIB", field.pibPage || 1);
                              onLoadPibInViewer(field.id);
                            }}
                            className={`border rounded-lg p-2.5 flex flex-col justify-between transition-all cursor-pointer group ${pibCardStyle}`}
                            title="Klik untuk melihat dokumen PIB pada viewer"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] font-semibold text-slate-500 tracking-wide">
                                  PIB (acuan)
                                </span>
                                {field.pibPage ? (
                                  <span className="text-[9px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                                    Hal. {field.pibPage}
                                  </span>
                                ) : null}
                              </div>

                              <div className="text-xs font-semibold text-slate-800 break-words leading-snug">
                                {field.pibValue || "-"}
                                {field.pibIsManual && (
                                  <span className="ml-1 text-[9px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-200">
                                    diedit
                                  </span>
                                )}
                              </div>

                              {field.pibIsDataAction && field.pibOriginalValue && (
                                <div className="mt-1.5 px-2 py-1 bg-slate-50 border border-slate-200/90 rounded-md text-[10.5px] text-slate-700 leading-snug">
                                  <span className="font-semibold text-slate-800">Data Action:</span>{" "}
                                  <span className="text-slate-500 line-through font-mono">{field.pibOriginalValue}</span>{" "}
                                  <span className="text-slate-400">{"->"}</span>{" "}
                                  <span className="text-slate-900 font-medium font-mono">{field.pibValue}</span>
                                </div>
                              )}

                              {!field.pibBbox && (
                                <p className="text-[10px] text-slate-400 italic mt-0.5">
                                  Lokasi tidak tersedia
                                </p>
                              )}
                            </div>

                            {!isReadOnly && (
                              <div className="flex items-center justify-end mt-1.5 pt-1 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleOpenEdit(e, field, group, "left")
                                  }
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                  title="Edit nilai PIB"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Right Inner Card: Supporting Document */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectField(field.id, group.docCode);
                              if (field.supportingPage && field.supportingValue !== "Tidak ada di dokumen ini") {
                                onNavigateToDoc?.(group.docCode, field.supportingPage);
                              } else {
                                onNavigateToDoc?.(group.docCode, 1);
                              }
                              onLoadSupportingInViewer(field.id, group.docCode);
                            }}
                            className={`border rounded-lg p-2.5 flex flex-col justify-between transition-all cursor-pointer group ${supportingCardStyle}`}
                            title={`Klik untuk melihat dokumen ${group.docCode} pada viewer`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] font-semibold text-slate-500 tracking-wide">
                                  {group.docCode}
                                </span>
                                {field.supportingPage &&
                                field.supportingValue !==
                                  "Tidak ada di dokumen ini" ? (
                                  <span className="text-[9px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                                    Hal. {field.supportingPage}
                                  </span>
                                ) : null}
                              </div>

                              <div
                                className={`text-xs font-semibold break-words leading-snug ${
                                  field.supportingValue ===
                                  "Tidak ada di dokumen ini"
                                    ? "text-slate-400 italic font-normal"
                                    : "text-slate-800"
                                }`}
                              >
                                {field.supportingValue}
                                {field.supportingIsManual && (
                                  <span className="ml-1 text-[9px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-200">
                                    diedit
                                  </span>
                                )}
                              </div>

                              {field.supportingIsDataAction && field.supportingOriginalValue && (
                                <div className="mt-1.5 px-2 py-1 bg-slate-50 border border-slate-200/90 rounded-md text-[10.5px] text-slate-700 leading-snug">
                                  <span className="font-semibold text-slate-800">Data Action:</span>{" "}
                                  <span className="text-slate-500 line-through font-mono">{field.supportingOriginalValue}</span>{" "}
                                  <span className="text-slate-400">{"->"}</span>{" "}
                                  <span className="text-slate-900 font-medium font-mono">{field.supportingValue}</span>
                                </div>
                              )}

                              {!field.supportingBbox &&
                                field.supportingValue !==
                                  "Tidak ada di dokumen ini" && (
                                  <p className="text-[10px] text-slate-400 italic mt-0.5">
                                    Lokasi tidak tersedia
                                  </p>
                                )}
                            </div>

                            {!isReadOnly && (
                              <div className="flex items-center justify-end mt-1.5 pt-1 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleOpenEdit(e, field, group, "right")
                                  }
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                  title={`Edit nilai ${group.docCode}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Chronological Change History (Data Action, Kamus, Edit, Setujui Satuan/All) */}
                        {field.changeHistory && field.changeHistory.length > 0 && (
                          <div
                            className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                              <History className="w-3 h-3 text-slate-400" />
                              <span>Riwayat Perubahan ({field.changeHistory.length})</span>
                            </div>
                            <div className="space-y-1">
                              {field.changeHistory.map((ev) => {
                                const style = CHANGE_CATEGORY_STYLES[ev.category] || CHANGE_CATEGORY_STYLES.EDIT;
                                return (
                                  <div
                                    key={ev.id}
                                    className="px-2 py-1.5 rounded-md bg-slate-50/90 border border-slate-200/70 text-[10.5px] text-slate-700 leading-snug space-y-0.5"
                                  >
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span
                                          className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-semibold border ${style.badge}`}
                                        >
                                          {ev.categoryLabel}
                                        </span>
                                        <span className="text-[9.5px] font-medium text-slate-500">
                                          [{ev.docType}]
                                        </span>
                                      </div>
                                      <span className="text-[9.5px] text-slate-400 shrink-0">
                                        {ev.actor}
                                        {ev.timestamp ? ` • ${formatNoteDate(ev.timestamp)}` : ""}
                                      </span>
                                    </div>

                                    {ev.category === "KAMUS" ? (
                                      <div className="text-[10.5px] text-slate-700">
                                        <span className="font-mono text-slate-600">{ev.oldValue}</span>{" "}
                                        <span className="text-slate-400">{"->"}</span>{" "}
                                        <span className={`font-medium ${style.text}`}>{ev.newValue}</span>
                                        {ev.notes && (
                                          <div className="text-[9.5px] text-slate-500 mt-0.5">{ev.notes}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-[10.5px] break-words">
                                        <span className="text-slate-500 line-through font-mono">{ev.oldValue}</span>{" "}
                                        <span className="text-slate-400">{"->"}</span>{" "}
                                        <span className={`font-medium font-mono ${style.text}`}>{ev.newValue}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Manual Notes on Header Field */}
                        {(!isReadOnly ||
                          Boolean(field.manualNotes && field.manualNotes.length > 0)) && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                            {field.manualNotes && field.manualNotes.length > 0 && (
                              <div className="space-y-1">
                                {field.manualNotes.map((note) => (
                                  <div key={note.id} className="flex items-start justify-between gap-2 px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-md text-[11px] text-slate-700">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 mb-0.5">
                                        <span className="font-medium text-slate-600">{note.author || "Operator"}</span>
                                        {note.docCode && <span className="text-slate-500">[{note.docCode}]</span>}
                                        <span>•</span>
                                        <span>{formatNoteDate(note.createdAt)}</span>
                                      </div>
                                      <p className="text-slate-800 font-normal leading-relaxed break-words">{note.text}</p>
                                    </div>
                                    {!isReadOnly && (
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenNoteModal("edit", note.targetType, note.targetKey, note.docCode, note.detailId, note.text, note.id, `${field.number}. ${field.label}`);
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                                          title="Edit catatan"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteNote(note.id);
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                          title="Hapus catatan"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {!isReadOnly && (
                              <div className="flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenNoteModal("add", "field", field.fieldName, group.docCode, field.supportingDetailId || field.pibDetailId, "", undefined, `${field.number}. ${field.label}`);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Catatan</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}


                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Panel Footer (Actions Slot) */}
      {footer && (
        <div className="px-3.5 py-2 border-t border-slate-200/80 bg-white flex items-center shrink-0">
          {footer}
        </div>
      )}

      {/* 5. Inline Edit Modal Dialog */}
      {editingField && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Edit nilai field
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingField.fieldLabel} • {editingField.docLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nilai saat ini:
                </label>
                <div className="px-3 py-2 bg-slate-50 rounded-xl text-xs text-slate-600 font-mono border border-slate-200">
                  {editingField.currentValue || "(kosong)"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nilai baru:
                </label>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Masukkan nilai yang benar..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  autoFocus
                />
              </div>

              {editError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{editError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit || editValue === editingField.currentValue}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isSavingEdit ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Simpan perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Manual Note Dialog Modal */}
      {noteDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  {noteDialog.mode === "add" ? "Tambah Catatan Manual" : "Edit Catatan Manual"}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {noteDialog.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoteDialog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Isi catatan
              </label>
              <textarea
                value={noteDialog.text}
                onChange={(e) => setNoteDialog({ ...noteDialog, text: e.target.value })}
                placeholder="Tuliskan catatan verifikasi di sini..."
                rows={3}
                className="w-full text-xs font-normal border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                autoFocus
              />
              {noteError && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{noteError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setNoteDialog(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={isSavingNote || !noteDialog.text.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
              >
                {isSavingNote ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Full Batch Audit Log Modal */}
      {historyModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setHistoryModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Log Lengkap Perubahan Batch #{batchId}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menampilkan seluruh Data Action, Kamus Ekuivalensi, Edit Nilai, dan Setujui (Satuan/All/Berkas).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {batchChangeLogs.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Belum ada riwayat perubahan pada batch ini.
                </div>
              ) : (
                batchChangeLogs.map((ev, idx) => {
                  const style = CHANGE_CATEGORY_STYLES[ev.category] || CHANGE_CATEGORY_STYLES.EDIT;
                  return (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10.5px] font-mono text-slate-400">#{idx + 1}</span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${style.badge}`}
                          >
                            {ev.categoryLabel}
                          </span>
                          <span className="font-semibold text-slate-800 truncate">
                            {ev.fieldLabel || ev.fieldName}
                          </span>
                          <span className="text-[10.5px] text-slate-500">[{ev.docType}]</span>
                        </div>
                        <span className="text-[10.5px] text-slate-400 shrink-0">
                          {ev.actor}
                          {ev.timestamp ? ` • ${formatNoteDate(ev.timestamp)}` : ""}
                        </span>
                      </div>

                      <div className="text-[11px] pl-6 break-words">
                        <span className="text-slate-500 line-through font-mono">{ev.oldValue}</span>{" "}
                        <span className="text-slate-400">{"->"}</span>{" "}
                        <span className={`font-semibold font-mono ${style.text}`}>{ev.newValue}</span>
                      </div>
                      {ev.notes && (
                        <div className="text-[10.5px] text-slate-500 pl-6">{ev.notes}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
