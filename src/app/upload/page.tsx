"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import ToastNotification, {
  useToastState,
} from "@/app/_components/ui/ToastNotification";

// Inline Icons
const UploadIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const PlusIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const XIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const FileCheckIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RefreshCwIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const CheckCircleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LayersIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

interface FileSlot {
  id: string;
  name: string | null;
  file: File | null;
}

interface UploadCategory {
  num: number;
  title: string;
  allowMultiple: boolean;
  slots: FileSlot[];
}

export default function UploadPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast, showToast, dismissToast } = useToastState();

  // 7 Categories in exact order: PIB (File Acuan) & File Pembanding (AK, WL, MS, Bill of Lading, Packing List, Invoice)
  const [categories, setCategories] = useState<UploadCategory[]>([
    { num: 1, title: "PIB (File Acuan)", allowMultiple: false, slots: [{ id: "pib-1", name: null, file: null }] },
    { num: 2, title: "AK", allowMultiple: false, slots: [{ id: "ak-1", name: null, file: null }] },
    { num: 3, title: "WL", allowMultiple: false, slots: [{ id: "wl-1", name: null, file: null }] },
    { num: 4, title: "MS", allowMultiple: false, slots: [{ id: "ms-1", name: null, file: null }] },
    { num: 5, title: "Bill of Lading", allowMultiple: false, slots: [{ id: "bl-1", name: null, file: null }] },
    { num: 6, title: "Packing List", allowMultiple: true, slots: [{ id: "pkg-1", name: null, file: null }] },
    { num: 7, title: "Invoice", allowMultiple: true, slots: [{ id: "inv-1", name: null, file: null }] },
  ]);

  const handleFileChange = (catNum: number, slotId: string, fileObj: File) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.num === catNum) {
          return {
            ...cat,
            slots: cat.slots.map((slot) => (slot.id === slotId ? { ...slot, name: fileObj.name, file: fileObj } : slot)),
          };
        }
        return cat;
      })
    );
  };

  const addSlot = (catNum: number) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.num === catNum && cat.allowMultiple) {
          const newSlotId = `${cat.title.toLowerCase().replace(/\s+/g, "_")}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          return {
            ...cat,
            slots: [...cat.slots, { id: newSlotId, name: null, file: null }],
          };
        }
        return cat;
      })
    );
  };

  const removeSlot = (catNum: number, slotId: string) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.num === catNum) {
          if (cat.slots.length > 1) {
            return {
              ...cat,
              slots: cat.slots.filter((slot) => slot.id !== slotId),
            };
          } else {
            return {
              ...cat,
              slots: cat.slots.map((slot) => (slot.id === slotId ? { ...slot, name: null, file: null } : slot)),
            };
          }
        }
        return cat;
      })
    );
  };

  const totalUploadedFiles = categories.reduce(
    (acc, cat) => acc + cat.slots.filter((s) => s.name !== null).length,
    0
  );

  const handleSubmitBatch = async () => {
    if (totalUploadedFiles === 0 || isProcessing) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      categories.forEach((cat) => {
        cat.slots.forEach((slot) => {
          if (slot.file) {
            formData.append("files", slot.file, slot.file.name);
            formData.append("categories", cat.title);
          }
        });
      });

      const res = await fetch("/api/upload-batch", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push("/matching");
      } else {
        showToast(data.error || "Gagal memproses batch ke Nanonets OCR.", "error");
      }
    } catch (err: unknown) {
      console.error("Batch submit error:", err);
      showToast("Terjadi kesalahan saat mengirim file ke Nanonets server.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 sm:px-8 py-8 max-w-7xl mx-auto w-full space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-base font-bold text-blue-950">Upload Dokumen</h1>
          <p className="text-xs text-slate-500 mt-0.5">Unggah berkas PIB (File Acuan) dan Dokumen Pembanding</p>
        </div>
      </div>

      {/* Main Content Layout: Left 2-Column Cards Grid (Col-span-9) + Right Compact Summary Card (Col-span-3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* LEFT COLUMN: 7 Upload Cards arranged 2 Cards per Row */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
          {categories.map((cat) => {
            const uploadedCount = cat.slots.filter((s) => s.name !== null).length;

            return (
              <div
                key={cat.num}
                className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs hover:border-blue-300 transition-all duration-150 space-y-3 min-w-0 overflow-hidden"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-blue-950 text-white font-bold text-[10px] flex items-center justify-center shadow-xs shrink-0">
                      {cat.num}
                    </span>
                    <h4 className="text-xs font-bold text-blue-950 truncate min-w-0">{cat.title}</h4>
                  </div>
                  {cat.allowMultiple ? (
                    <span className="text-[9px] font-bold text-blue-900 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full shrink-0">
                      Multi-file {uploadedCount > 0 ? `(${uploadedCount})` : ""}
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium text-slate-400 bg-slate-100/80 px-2 py-0.5 rounded-full shrink-0">
                      Single File
                    </span>
                  )}
                </div>

                {/* Upload Slots List */}
                <div className="space-y-1.5 min-w-0">
                  {cat.slots.map((slot, index) => (
                    <div key={slot.id} className="flex items-center gap-1 min-w-0">
                      {slot.name ? (
                        // Uploaded File Badge
                        <div className="flex-1 min-w-0 bg-emerald-50/70 border border-emerald-200/80 p-2 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 min-w-0 pr-1.5">
                            <FileCheckIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-bold text-slate-800 truncate text-[11px] min-w-0 block" title={slot.name}>
                              {slot.name}
                            </span>
                          </div>
                          <button
                            onClick={() => removeSlot(cat.num, slot.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 focus:outline-none shrink-0"
                            title="Hapus file"
                          >
                            <XIcon className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        </div>
                      ) : (
                        // Dropzone Button Input
                        <div className="flex-1 flex items-center gap-1">
                          <label
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.dataTransfer.files?.[0]) {
                                handleFileChange(cat.num, slot.id, e.dataTransfer.files[0]);
                              }
                            }}
                            className="flex-1 border border-dashed border-slate-300 hover:border-blue-950 bg-slate-50/60 hover:bg-blue-50/50 py-2.5 px-3 rounded-lg text-center cursor-pointer block transition-all group"
                          >
                            <div className="flex items-center justify-center gap-1.5 text-slate-500 group-hover:text-blue-950">
                              <UploadIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-950" />
                              <span className="text-[11px] font-semibold">
                                Drag & Drop / Pilih PDF {cat.allowMultiple && cat.slots.length > 1 ? `#${index + 1}` : ""}
                              </span>
                            </div>
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleFileChange(cat.num, slot.id, e.target.files[0]);
                                }
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {cat.allowMultiple && cat.slots.length > 1 && (
                            <button
                              onClick={() => removeSlot(cat.num, slot.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors focus:outline-none"
                              title="Hapus kolom ini"
                            >
                              <XIcon className="w-3.5 h-3.5 text-rose-500" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Multi-file Add Button for Invoice (3) & Packing List (4) */}
                {cat.allowMultiple && (
                  <button
                    onClick={() => addSlot(cat.num)}
                    className="w-full py-1.5 rounded-lg border border-dashed border-blue-900/30 text-[11px] font-bold text-blue-950 bg-blue-50/30 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1 focus:outline-none"
                  >
                    <PlusIcon className="w-3 h-3 text-blue-950" />
                    <span>Tambah Upload {cat.title}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT COLUMN: 2x Smaller Compact Summary & Action Panel Card */}
        <div className="lg:col-span-3 space-y-3 sticky top-6">
          <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs space-y-3">
            {/* Panel Title */}
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <LayersIcon className="w-3.5 h-3.5 text-blue-950" />
                <h4 className="text-[11px] font-bold text-blue-950">Ringkasan Dokumen</h4>
              </div>
              <span className="text-[9px] font-bold bg-blue-50 text-blue-950 px-1.5 py-0.5 rounded-full border border-blue-200/80">
                {totalUploadedFiles} File
              </span>
            </div>

            {/* Compact Checklist of 7 Document Categories */}
            <div className="space-y-1.5">
              {categories.map((cat) => {
                const count = cat.slots.filter((s) => s.name !== null).length;
                return (
                  <div
                    key={cat.num}
                    className="flex items-center justify-between p-1.5 rounded-md bg-slate-50/60 border border-slate-100 text-[10px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                      <span className="w-3.5 h-3.5 rounded-full bg-blue-950 text-white font-bold text-[8px] flex items-center justify-center shrink-0">
                        {cat.num}
                      </span>
                      <span className="font-semibold text-slate-700 truncate">{cat.title}</span>
                    </div>
                    {count > 0 ? (
                      <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full text-[8.5px] flex items-center gap-0.5 shrink-0">
                        <CheckCircleIcon className="w-2.5 h-2.5 text-emerald-600" />
                        {count}
                      </span>
                    ) : (
                      <span className="font-medium text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-full text-[8.5px] shrink-0">
                        -
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* OCR Processing Notice */}
            <div className="p-2 bg-blue-50/50 border border-blue-100 rounded-lg text-[10px] text-slate-600 space-y-0.5">
              <div className="font-bold text-blue-950 flex items-center gap-1">
                <FileCheckIcon className="w-3 h-3 text-blue-950" />
                <span>Nanonets OCR</span>
              </div>
              <p className="text-[9.5px] leading-tight text-slate-500">
                Otomatis mencocokkan data PIB dengan dokumen pembanding.
              </p>
            </div>

            {/* Action Button inside Right Card */}
            <button
              onClick={handleSubmitBatch}
              disabled={isProcessing || totalUploadedFiles === 0}
              className={`w-full py-2.5 rounded-lg font-bold text-[11px] shadow-2xs flex items-center justify-center gap-1.5 transition-all focus:outline-none ${
                totalUploadedFiles > 0
                  ? "bg-blue-950 hover:bg-blue-900 text-white cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCwIcon className="w-3.5 h-3.5 animate-spin text-white" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  Submit ({totalUploadedFiles})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Top-Right Light Toast Notification */}
      <ToastNotification toast={toast} onClose={dismissToast} />
    </div>
  );
}
