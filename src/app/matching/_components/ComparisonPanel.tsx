"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  Loader2,
  Eye,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import type {
  BatchDocumentModel,
  ComparisonFieldModel,
  DocumentComparisonGroup,
} from "./detailTypes";

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
  className?: string;
}

export default function ComparisonPanel({
  batchId,
  pibDoc: _pibDoc,
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
  className = "",
}: ComparisonPanelProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const defaultDoc = activeDocCode && activeDocCode.toUpperCase() !== "PIB"
    ? activeDocCode
    : (groups[0]?.docCode ?? "Invoice");
  const [selectedDocFilter, setSelectedDocFilter] = useState<string>(defaultDoc);

  // Manual Match confirmation state
  const [togglingManualMatchId, setTogglingManualMatchId] = useState<string | null>(null);

  const handleToggleManualMatch = async (
    field: ComparisonFieldModel,
    docCode: string
  ) => {
    if (togglingManualMatchId) return;
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
      alert(err instanceof Error ? err.message : "Gagal memperbarui status konfirmasi.");
    } finally {
      setTogglingManualMatchId(null);
    }
  };

  useEffect(() => {
    if (activeDocCode && activeDocCode.toUpperCase() !== "PIB") {
      setSelectedDocFilter(activeDocCode);
    }
  }, [activeDocCode]);



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
    if (!onDeleteManualNote) return;
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

  // Field counts and match totals
  const totalMatched = useMemo(() => {
    if (isAllSelected) {
      return groups.reduce((acc, g) => acc + g.matchedCount, 0);
    }
    return currentGroup?.matchedCount ?? 0;
  }, [isAllSelected, groups, currentGroup]);

  const totalMismatched = useMemo(() => {
    if (isAllSelected) {
      return groups.reduce((acc, g) => acc + g.mismatchedCount, 0);
    }
    return currentGroup?.mismatchedCount ?? 0;
  }, [isAllSelected, groups, currentGroup]);

  const totalAllFieldsCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.fields.length, 0);
  }, [groups]);

  const handleTabClick = (docCode: string) => {
    setSelectedDocFilter(docCode);
    if (docCode === "ALL") {
      onSelectDocCode?.("ALL");
    } else {
      onSelectDocCode?.(docCode);
      onNavigateToDoc?.(docCode, 1);
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Auto-scroll to active field card
  useEffect(() => {
    if (activeFieldId) {
      const el = cardRefs.current[activeFieldId];
      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [activeFieldId]);

  // Quick jump to group section


  // Handle open edit
  const handleOpenEdit = (
    e: React.MouseEvent,
    field: ComparisonFieldModel,
    group: DocumentComparisonGroup,
    target: "left" | "right"
  ) => {
    e.stopPropagation();
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
      {/* 1. Header Row: Title + Search Input + Summary Badges */}
      <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/70 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900">
              Data perbandingan {isAllSelected ? "(Semua)" : currentGroup ? `(${currentGroup.docCode})` : ""}
            </h3>
            <span className="text-[11px] font-medium text-slate-500">
              PIB (acuan) vs {isAllSelected ? "Semua Dokumen Pendukung" : currentGroup?.docName || currentGroup?.docCode || "Dokumen"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              <CheckCircle2 className="w-3 h-3" />
              <span>{totalMatched} cocok</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80">
              <AlertTriangle className="w-3 h-3" />
              <span>{totalMismatched} tidak cocok</span>
            </span>
          </div>
        </div>

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
            className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
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

        {/* Supporting Document Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          {/* Tab Semua */}
          <button
            type="button"
            onClick={() => handleTabClick("ALL")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border shrink-0 flex items-center gap-1.5 ${
              isAllSelected
                ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span>Semua</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isAllSelected
                  ? "bg-white/20 text-white"
                  : groups.some((g) => g.mismatchedCount > 0)
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {totalAllFieldsCount}
            </span>
          </button>

          {groups.map((group) => {
            const isFilterActive =
              !isAllSelected &&
              (currentGroup?.docCode || "").toUpperCase() === group.docCode.toUpperCase();
            return (
              <button
                key={group.docCode}
                type="button"
                onClick={() => handleTabClick(group.docCode)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border shrink-0 flex items-center gap-1.5 ${
                  isFilterActive
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span>{group.docCode}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isFilterActive
                      ? "bg-white/20 text-white"
                      : group.mismatchedCount > 0
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {group.fields.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Scrollable Body: Grouped Fields & Grouped Line Items */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3.5 space-y-6 bg-slate-50/40">
        {filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic text-xs bg-white rounded-xl border border-dashed border-slate-200">
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
                {/* Group Section Header */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/90 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs uppercase px-2 py-0.5 rounded-md bg-slate-900 text-white tracking-wide">
                      {group.docCode}
                    </span>
                    <span className="font-bold text-xs text-slate-800">
                      PIB ↔ {group.docName}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      ({group.fields.length} field)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                      {group.matchedCount} cocok
                    </span>
                    {group.mismatchedCount > 0 && (
                      <span className="text-[10px] font-semibold text-rose-800 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full">
                        {group.mismatchedCount} tidak cocok
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateToDoc?.(group.docCode, 1);
                        onLoadSupportingInViewer(
                          group.fields[0]?.id || "",
                          group.docCode
                        );
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                      title={`Buka dokumen ${group.docCode} di viewer PDF`}
                    >
                      <Eye className="w-3 h-3 text-slate-500" />
                      <span>Lihat dokumen</span>
                    </button>
                  </div>
                </div>

                {/* Sub-header: FIELD */}
                <div className="flex items-center justify-between pt-1 pb-0.5">
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
                      {group.matchedCount} cocok
                    </span>
                    {group.mismatchedCount > 0 && (
                      <span className="text-[10px] font-semibold text-rose-800 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full">
                        {group.mismatchedCount} tidak cocok
                      </span>
                    )}
                  </div>
                </div>

                {/* Field Cards for this Group */}
                <div className="space-y-2.5">
                  {group.fields.map((field) => {
                    const isActive = activeFieldId === field.id;
                    const isMatch = field.status === "MATCH";
                    const isMismatch = field.status === "MISMATCH";

                    let statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        -
                      </span>
                    );

                    if (isActive) {
                      statusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white shadow-2xs">
                          Aktif
                        </span>
                      );
                    } else if (field.isManualConfirmed) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                          <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                          Cocok
                        </span>
                      );
                    } else if (isMatch) {
                      statusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                          Cocok
                        </span>
                      );
                    } else if (isMismatch) {
                      statusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200/80">
                          Tidak cocok
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
                        className={`rounded-xl border p-3 transition-all cursor-pointer ${cardBgBorder}`}
                      >
                        {/* Card Title & Status Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-900 tracking-tight">
                            {field.number}. {field.label}
                          </span>
                          {statusBadge}
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

                        {/* Side-by-side Inner Cards with Center Confirmation Indicator / Button */}
                        <div className="relative mt-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-stretch">
                            {/* Left Inner Card: PIB (acuan) */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectField(field.id, "PIB");
                                onNavigateToDoc?.("PIB", field.pibPage || 1);
                                onLoadPibInViewer(field.id);
                              }}
                              className="border border-slate-200/90 bg-white/90 rounded-lg p-2.5 flex flex-col justify-between hover:border-blue-300 hover:shadow-2xs transition-all cursor-pointer group"
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
                            </div>

                            {/* Mobile In-between Button */}
                            <div className="sm:hidden flex items-center justify-center -my-1 z-10">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleManualMatch(field, group.docCode);
                                }}
                                disabled={togglingManualMatchId === field.id}
                                className={`px-3 py-1 rounded-full border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                                  field.isManualConfirmed
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : isMatch
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-white text-slate-500 border-slate-200 hover:text-emerald-600 hover:border-emerald-300"
                                }`}
                                title={
                                  field.isManualConfirmed
                                    ? "Dikonfirmasi manual cocok. Klik untuk membatalkan konfirmasi"
                                    : "Konfirmasi kedua dokumen cocok untuk batch ini"
                                }
                              >
                                {togglingManualMatchId === field.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                ) : (
                                  <Check
                                    className={`w-3.5 h-3.5 ${
                                      field.isManualConfirmed || isMatch
                                        ? "stroke-[2.5]"
                                        : "stroke-2"
                                    }`}
                                  />
                                )}
                                <span>
                                  {field.isManualConfirmed
                                    ? "Cocok (Manual)"
                                    : isMatch
                                    ? "Cocok"
                                    : "Konfirmasi Cocok"}
                                </span>
                              </button>
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
                              className="border border-slate-200/90 bg-white/90 rounded-lg p-2.5 flex flex-col justify-between hover:border-blue-300 hover:shadow-2xs transition-all cursor-pointer group"
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
                            </div>
                          </div>

                          {/* Desktop Floating Center Button (Right between PIB and Supporting Doc) */}
                          <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleManualMatch(field, group.docCode);
                              }}
                              disabled={togglingManualMatchId === field.id}
                              className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center shadow-md ${
                                field.isManualConfirmed
                                  ? "bg-emerald-600 text-white border-white ring-2 ring-emerald-500/40 hover:bg-emerald-700 hover:scale-110 active:scale-95"
                                  : isMatch
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/90 ring-2 ring-white hover:bg-emerald-100 hover:scale-105"
                                  : "bg-white text-slate-400 border-slate-200/90 hover:border-emerald-500 hover:text-emerald-600 hover:scale-110 hover:shadow-lg active:scale-95 ring-2 ring-white"
                              }`}
                              title={
                                field.isManualConfirmed
                                  ? "Dikonfirmasi manual cocok. Klik untuk membatalkan konfirmasi"
                                  : isMatch
                                  ? "Kedua dokumen ini cocok secara sistem. Klik untuk konfirmasi/batal"
                                  : "Klik untuk mengonfirmasi kedua dokumen ini COCOK (hanya untuk batch ini)"
                              }
                            >
                              {togglingManualMatchId === field.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                              ) : (
                                <Check
                                  className={`w-4 h-4 ${
                                    field.isManualConfirmed || isMatch
                                      ? "stroke-[2.5]"
                                      : "stroke-2"
                                  }`}
                                />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Manual Notes on Header Field */}
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
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenNoteModal("edit", note.targetType, note.targetKey, note.docCode, note.detailId, note.text, note.id, `${field.number}. ${field.label}`);
                                      }}
                                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
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
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                      title="Hapus catatan"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenNoteModal("add", "field", field.fieldName, group.docCode, field.supportingDetailId || field.pibDetailId, "", undefined, `${field.number}. ${field.label}`);
                              }}
                              className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ Catatan</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}


                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Inline Edit Modal Dialog */}
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
    </div>
  );
}
