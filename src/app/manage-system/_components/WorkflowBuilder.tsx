"use client";

import React, { useState, useEffect, useMemo } from "react";
import CustomSelect from "@/app/_components/ui/CustomSelect";
import CustomMultiSelect from "@/app/_components/ui/CustomMultiSelect";
import ConfirmDialog from "@/app/_components/ui/ConfirmDialog";
import type {
  WorkflowStep,
  WorkflowActionType,
  WorkflowDocScope,
  ActionConfig,
  UscDocumentType,
} from "~/types/workflow";
import type { PipelineExecutionResult } from "~/utils/workflowRunner";
import {
  applyWorkflowStep,
  executeDataPipeline,
  validateWorkflowStep,
} from "~/utils/workflowRunner";
import {
  getFieldOptionsForDocument,
  normalizeDocumentType,
  resolveFieldValue,
} from "~/utils/documentRegistry";

// --- Clean SVG Icons (Zero Emojis) ---
const PlusIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const ArrowUpIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ArrowDownIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ArrowRightIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const ChevronRightIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const ChevronDownIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CopyIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const PlayIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SparklesIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z"
    />
  </svg>
);

const ScissorsIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879a3 3 0 11-4.242-4.242 3 3 0 014.242 0M9.879 9.879L12 12m-2.121-2.121a3 3 0 10-4.242-4.242 3 3 0 004.242 4.242z"
    />
  </svg>
);

const HashIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
  </svg>
);

const SearchIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const CalendarIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ShieldCheckIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);

const TagIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const TypeIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 5v14m4-7h8m-4-7v14" />
  </svg>
);

const XIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const DragHandleIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <circle cx="8" cy="6" r="1.5" />
    <circle cx="16" cy="6" r="1.5" />
    <circle cx="8" cy="12" r="1.5" />
    <circle cx="16" cy="12" r="1.5" />
    <circle cx="8" cy="18" r="1.5" />
    <circle cx="16" cy="18" r="1.5" />
  </svg>
);

const DatabaseIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 3.582 4 8 4s8-2 8-4V7M4 7c0 2 3.582 4 8 4s8-2 8-4M4 7c0-2 3.582-4 8-4s8 2 8 4m0 5c0 2-3.582 4-8 4s-8-2-8-4" />
  </svg>
);

const CheckCircleIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InfoIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SlidersIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

const StarIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const PencilIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
);

const EyeIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const RefreshIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const CheckCircleFilledIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const HelpCircleIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BranchIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7a2 2 0 100-4 2 2 0 000 4zm10 14a2 2 0 100-4 2 2 0 000 4zm0-14a2 2 0 100-4 2 2 0 000 4zM7 7v10a2 2 0 002 2h8m-8-2V7" />
  </svg>
);

const AlertTriangleIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const AlertCircleIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="12" r="10" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
  </svg>
);

function DocumentThumbnail({ fileUrl, className = "w-10 h-13" }: { fileUrl?: string; className?: string }) {
  if (fileUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={fileUrl}
        alt="Doc preview"
        className={`${className} object-cover rounded border border-slate-200 bg-white shadow-2xs shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${className} rounded border border-slate-200/90 bg-white p-1 flex flex-col justify-between shrink-0 shadow-2xs relative overflow-hidden`}
    >
      <div className="space-y-0.5">
        <div className="h-1 w-3/4 bg-rose-400/80 rounded-xs" />
        <div className="h-0.5 w-1/2 bg-slate-300 rounded-xs" />
      </div>
      <div className="space-y-0.5 py-0.5 border-y border-slate-100">
        <div className="flex justify-between gap-0.5">
          <div className="h-0.5 w-2/5 bg-slate-400 rounded-xs" />
          <div className="h-0.5 w-1/4 bg-slate-300 rounded-xs" />
        </div>
        <div className="flex justify-between gap-0.5">
          <div className="h-0.5 w-1/3 bg-slate-300 rounded-xs" />
          <div className="h-0.5 w-1/4 bg-slate-300 rounded-xs" />
        </div>
        <div className="flex justify-between gap-0.5">
          <div className="h-0.5 w-1/2 bg-slate-300 rounded-xs" />
          <div className="h-0.5 w-1/5 bg-slate-400 rounded-xs" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="h-1.5 w-3 bg-slate-800 rounded-xs" />
        <div className="h-0.5 w-2 bg-slate-400 rounded-xs" />
      </div>
    </div>
  );
}

const STORAGE_KEY = "system_workflow_data_actions";

// USC Document Tabs definition (strictly 1 file per tab, no emojis)
export interface DocumentTabDef {
  id: UscDocumentType;
  label: string;
  fullName: string;
  badge: string;
  isReference?: boolean;
}

const USC_DOCUMENT_TABS: DocumentTabDef[] = [
  { id: "pib", label: "PIB", fullName: "Pemberitahuan Impor Barang", badge: "Acuan", isReference: true },
  { id: "ci", label: "Commercial Invoice", fullName: "Commercial Invoice (CI)", badge: "Pembanding" },
  { id: "pl", label: "Packing List", fullName: "Packing List (PL)", badge: "Pembanding" },
  { id: "bl", label: "Bill of Lading", fullName: "Bill of Lading (BL)", badge: "Pembanding" },
  { id: "ak", label: "Form AK", fullName: "Certificate of Origin (Form AK)", badge: "Pembanding" },
  { id: "wl", label: "Weight List", fullName: "Weight List (WL)", badge: "Pembanding" },
  { id: "ms", label: "Mill Test Cert", fullName: "Mill Test Certificate (MTC)", badge: "Pembanding" },
];

const DOC_SCOPE_OPTIONS: { label: string; value: WorkflowDocScope }[] = [
  { label: "PIB (File Acuan)", value: "pib" },
  { label: "Commercial Invoice (CI)", value: "ci" },
  { label: "Packing List (PL)", value: "pl" },
  { label: "Bill of Lading (BL)", value: "bl" },
  { label: "Form AK (Certificate of Origin)", value: "ak" },
  { label: "Weight List (WL)", value: "wl" },
  { label: "Mill Test Certificate (MTC)", value: "ms" },
  { label: "Semua Dokumen (Global Fallback)", value: "all" },
];

export interface ActionCatalogItem {
  type: WorkflowActionType;
  title: string;
  category: "text" | "number" | "date" | "cleansing" | "validation" | "advanced";
  categoryLabel: string;
  description: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  defaultConfig: ActionConfig;
  defaultName: string;
  badge: string;
}

const ACTION_CATALOG: ActionCatalogItem[] = [
  {
    type: "remove_characters",
    title: "Remove characters",
    category: "cleansing",
    categoryLabel: "Cleansing",
    badge: "Cleansing",
    description: "Hapus tanda baca, simbol, atau karakter non-alfanumerik spesifik dari field data.",
    icon: ScissorsIcon,
    defaultName: "Remove characters",
    defaultConfig: {
      type: "remove_characters",
      config: {
        mode: "custom",
        removePunctuation: true,
        customChars: "",
      },
    },
  },
  {
    type: "number_formatting",
    title: "Number formatting",
    category: "number",
    categoryLabel: "Number & Math",
    badge: "Formatting",
    description: "Hilangkan koma ribuan (5,458.00 -> 5458.00), atur desimal, dan bersihkan satuan.",
    icon: HashIcon,
    defaultName: "Number formatting",
    defaultConfig: {
      type: "number_formatting",
      config: {
        thousandsSeparator: "none",
        decimalFormat: "dot",
        roundDecimals: 2,
        stripCurrency: false,
        stripUnits: true,
      },
    },
  },
  {
    type: "trim_whitespace",
    title: "Strip / clean text",
    category: "cleansing",
    categoryLabel: "Cleansing",
    badge: "Cleansing",
    description: "Bersihkan spasi di awal/akhir dan rapikan spasi berlebih menjadi satu spasi rapi.",
    icon: SparklesIcon,
    defaultName: "Strip whitespace",
    defaultConfig: {
      type: "trim_whitespace",
      config: {
        trimEdges: true,
        collapseMultiple: true,
        removeAllSpaces: false,
      },
    },
  },
  {
    type: "replace_text",
    title: "Find and Replace",
    category: "text",
    categoryLabel: "Text Actions",
    badge: "Transform",
    description: "Cari teks spesifik atau ekspresi regex dan ganti secara otomatis dengan nilai baru.",
    icon: SearchIcon,
    defaultName: "Find and Replace",
    defaultConfig: {
      type: "replace_text",
      config: {
        findText: "",
        replaceWith: "",
        isRegex: false,
        matchCase: false,
      },
    },
  },
  {
    type: "case_transform",
    title: "Change case",
    category: "text",
    categoryLabel: "Text Actions",
    badge: "Transform",
    description: "Ubah huruf teks menjadi UPPERCASE, lowercase, atau Title Case.",
    icon: TypeIcon,
    defaultName: "Change case",
    defaultConfig: {
      type: "case_transform",
      config: {
        transform: "uppercase",
      },
    },
  },
  {
    type: "date_normalize",
    title: "Format date / time",
    category: "date",
    categoryLabel: "Date & Format",
    badge: "Standardize",
    description: "Samakan berbagai format tanggal OCR (YYYY-MM-DD, DD/MM/YYYY) ke format standar seragam.",
    icon: CalendarIcon,
    defaultName: "Format date",
    defaultConfig: {
      type: "date_normalize",
      config: {
        targetFormat: "DD/MM/YYYY",
      },
    },
  },
  {
    type: "prefix_suffix",
    title: "Prefix & Suffix",
    category: "text",
    categoryLabel: "Text Actions",
    badge: "Transform",
    description: "Tambahkan atau buang awalan/akhiran kode (misal: hapus prefix 'INV-').",
    icon: TagIcon,
    defaultName: "Prefix & Suffix",
    defaultConfig: {
      type: "prefix_suffix",
      config: {
        operation: "remove_prefix",
        value: "",
      },
    },
  },
  {
    type: "validation_rule",
    title: "Validation rule",
    category: "validation",
    categoryLabel: "Validation",
    badge: "Validation",
    description: "Validasi apakah nilai wajib diisi, berupa angka, atau memenuhi pola regex.",
    icon: ShieldCheckIcon,
    defaultName: "Validation rule",
    defaultConfig: {
      type: "validation_rule",
      config: {
        condition: "not_empty",
        onFail: "warning",
      },
    },
  },
  {
    type: "value_mapping",
    title: "Value mapping / Alias",
    category: "advanced",
    categoryLabel: "Advanced & Lookup",
    badge: "Equivalency",
    description: "Petakan kata tertentu ke nilai standar (misal: jika ada kata 'jakarta' -> 'TANJUNG PRIOK').",
    icon: DatabaseIcon,
    defaultName: "Value mapping",
    defaultConfig: {
      type: "value_mapping",
      config: {
        mappings: [{ keyword: "jakarta", mappedValue: "TANJUNG PRIOK" }],
        mode: "replace",
      },
    },
  },
];

interface SampleDocument {
  id: string;
  docScope: WorkflowDocScope;
  fileName: string;
  fileSize?: string;
  fileUrl?: string;
  pageCount?: string;
  isDb?: boolean;
  batchId?: string;
  fieldValues: Record<string, string>;
}

const SAMPLE_DOCUMENTS: SampleDocument[] = [
  // Commercial Invoice (CI) - Match exact Nanonets user screenshot
  {
    id: "sample-ci-1",
    docScope: "ci",
    fileName: "Invoice.pdf",
    fileSize: "650 KB",
    pageCount: "Page 1/3",
    fieldValues: {
      "Tanggal_Invoice": "Mar. 18, 2025",
      "No_Invoice": "USC-INV-2026-8801",
      "Seller": "POSCO ASIA CO., LTD.",
      "Buyer": "PT. UNITED STEEL CENTER INDONESIA",
      "Nilai_Total_Invoice": "USD 58,450.00",
      "Valuta": "USD",
      "Incoterms": "CIF JAKARTA",
      "Berat_Bersih": "48,500.00 KGS",
      "Berat_Kotor": "49,120.00 KGS",
      "Gross Weight": "49,120.00 KGS",
      "Jumlah_Coil": "4 COILS",
    },
  },
  {
    id: "sample-ci-2",
    docScope: "ci",
    fileName: "Invoice.pdf",
    fileSize: "720 KB",
    pageCount: "Page 1/2",
    fieldValues: {
      "Tanggal_Invoice": "15/03/2025",
      "No_Invoice": "INV/2025/USC-002",
      "Seller": "MARUBENI-ITOCHU STEEL KOREA LTD",
      "Buyer": "PT. UNITED STEEL CENTER INDONESIA",
      "Nilai_Total_Invoice": "USD 62,100.00",
      "Gross Weight": "52,300.00 KGS",
    },
  },
  {
    id: "sample-ci-3",
    docScope: "ci",
    fileName: "Invoice.pdf",
    fileSize: "510 KB",
    pageCount: "Page 1/4",
    fieldValues: {
      "Tanggal_Invoice": "2025-03-20",
      "No_Invoice": "POSCO-INV-9901",
      "Seller": "POSCO",
      "Buyer": "PT. UNITED STEEL CENTER INDONESIA",
      "Nilai_Total_Invoice": "USD 45,800.00",
      "Gross Weight": "38,200.00 KGS",
    },
  },
  // PIB
  {
    id: "sample-pib-1",
    docScope: "pib",
    fileName: "PIB_Acuan_040300_2026.pdf",
    fileSize: "1.2 MB",
    pageCount: "Page 1/3",
    fieldValues: {
      "Nomor Pengajuan": "040300-001892-20260320-008801",
      "No_Invoice": "USC-INV-2026-8801",
      "Tanggal_Invoice": "15-03-2026",
      "No_BL": "HDMU98234150",
      "Tanggal_BL": "20-03-2026",
      "Nama_Importir": "PT. UNITED STEEL CENTER INDONESIA",
      "Pemilik_Barang": "PT. UNITED STEEL CENTER INDONESIA",
      "Nama_Pengirim": "POSCO ASIA CO., LTD.",
      "Identitas_Pengirim": "POSCO ASIA CO., LTD.",
      "Nama_Penjual": "POSCO",
      "Identitas_Penjual": "POSCO",
      "Pelabuhan_Muat": "BUSAN, KOREA",
      "Pelabuhan_Tujuan": "TANJUNG PRIOK, JAKARTA",
      "Cara_Penyerahan": "CIF",
      "Terms_of_Delivery": "CIF",
      "Incoterms": "CIF",
      "Valuta": "USD",
      "Nilai_Pabean": "58,450.00",
      "Berat_Bersih": "48,500.00 KGS",
      "Berat_Kotor": "49,120.00 KGS",
      "Gross Weight": "49,120.00 KGS",
      "Jumlah_Coil": "4",
      "No_Peti": "TEMU7192841",
      "Pos_Tarif": "7208.38.00",
      "Spek_Material": "SPHC 2.3 X 1219 X C",
    },
  },
  {
    id: "sample-pib-2",
    docScope: "pib",
    fileName: "PIB_Steel_Coils_02.pdf",
    fileSize: "840 KB",
    fieldValues: {
      "Nomor Pengajuan": "010203 - 004812 / 2024",
      "Nama_Importir": "PT. UNITED STEEL CENTER INDONESIA",
      "Pemilik_Barang": "PT. UNITED STEEL CENTER INDONESIA",
      "Identitas_Penjual": "MARUBENI-ITOCHU STEEL INC",
      "Nama_Penjual": "MARUBENI-ITOCHU STEEL INC",
      "No_Invoice": "INV/2024/0998-A",
      "Nilai_Pabean": "$ 919,989.49",
      "Berat_Bersih": "1,045.140 MT",
      "Berat_Kotor": "1,050.500 MT",
      "Gross Weight": "1,050.500 MT",
      "Jumlah_Coil": "12",
      "Pos_Tarif": "7209.16.00",
    },
  },
  // Commercial Invoice (CI)
  {
    id: "sample-ci-4",
    docScope: "ci",
    fileName: "Commercial_Invoice_USC8801.pdf",
    fileSize: "650 KB",
    fieldValues: {
      "No_Invoice": "USC-INV-2026-8801",
      "Tanggal_Invoice": "Mar. 15, 2026",
      "Seller": "POSCO ASIA CO., LTD.",
      "Buyer": "PT. UNITED STEEL CENTER INDONESIA",
      "Nilai_Total_Invoice": "USD 58,450.00",
      "Valuta": "USD",
      "Incoterms": "CIF JAKARTA",
      "Berat_Bersih": "48,500.00 KGS",
      "Berat_Kotor": "49,120.00 KGS",
      "Gross Weight": "49,120.00 KGS",
      "Jumlah_Coil": "4 COILS",
    },
  },
  // Packing List (PL)
  {
    id: "sample-pl-1",
    docScope: "pl",
    fileName: "Packing_List_Steel_Coils.pdf",
    fileSize: "520 KB",
    fieldValues: {
      "No_Invoice": "USC-INV-2026-8801",
      "Tanggal_PL": "15/03/2026",
      "Supplier": "POSCO ASIA CO., LTD.",
      "Buyer": "PT. UNITED STEEL CENTER INDONESIA",
      "Port_Of_Loading": "BUSAN, S. KOREA",
      "Port_Of_Discharge": "JAKARTA (TANJUNG PRIOK)",
      "Berat_Bersih": "48500.00 KG",
      "Berat_Kotor": "49120.00 KG",
      "Gross Weight": "49,120.00 KGS",
      "Total_Coil": "4",
    },
  },
  // Bill of Lading (BL)
  {
    id: "sample-bl-1",
    docScope: "bl",
    fileName: "Bill_Of_Lading_HDMU.pdf",
    fileSize: "980 KB",
    fieldValues: {
      "No_BL": "HDMU98234150",
      "Tanggal_BL": "20/03/2026",
      "Shipper": "POSCO ASIA CO., LTD.",
      "Consignee": "PT. UNITED STEEL CENTER INDONESIA",
      "Vessel_Name": "MV HYUNDAI VOYAGER 042W",
      "Port_Of_Loading": "BUSAN PORT",
      "Port_Of_Discharge": "TANJUNG PRIOK, JAKARTA",
      "Gross_Weight": "49,120.00 KGS",
      "Gross Weight": "49,120.00 KGS",
      "Total_Package": "4 PACKAGES (STEEL COILS)",
      "Container_No": "TEMU7192841",
    },
  },
  // Form AK
  {
    id: "sample-ak-1",
    docScope: "ak",
    fileName: "Form_AK_Certificate_Origin.pdf",
    fileSize: "1.1 MB",
    fieldValues: {
      "No_Referensi": "K001-25-0170799",
      "Tanggal_Sertifikat": "2026-03-18",
      "Exporter": "POSCO",
      "Consignee": "PT. UNITED STEEL CENTER INDONESIA",
      "Port_Of_Discharge": "TANJUNG PRIOK",
      "Vessel": "HYUNDAI VOYAGER",
      "Departure_Date": "2026-03-20",
      "No_Invoice_Ref": "USC-INV-2026-8801",
      "HS_Code": "7208.38.00",
      "Origin_Criterion": "WO",
    },
  },
  // Weight List (WL)
  {
    id: "sample-wl-1",
    docScope: "wl",
    fileName: "Weight_List_Coils.pdf",
    fileSize: "430 KB",
    fieldValues: {
      "No_Dokumen": "WL-2026-0320-USC",
      "Supplier": "POSCO",
      "Description": "HOT ROLLED STEEL SHEET IN COILS",
      "Total_Coil": "4",
      "Total_Net_Weight": "48,500.00",
      "Total_Gross_Weight": "49,120.00",
      "Gross Weight": "49,120.00",
      "Net_Weight": "48500",
      "Gross_Weight": "49120",
    },
  },
  // Mill Test Certificate (MS/MTC)
  {
    id: "sample-ms-1",
    docScope: "ms",
    fileName: "Mill_Test_Certificate_Posco.pdf",
    fileSize: "770 KB",
    fieldValues: {
      "No_Sertifikat": "MTC-POSCO-2026-901",
      "Steelmaker": "POSCO GWANGYANG WORKS",
      "Grade": "SPHC",
      "Standard": "JIS G 3131",
      "Certificate_Date": "2026-03-12",
      "Weight": "48,500 KG",
      "Heat_No": "H928104",
      "Coil_No": "C88102-1",
    },
  },
];

// --- Dedicated Action Config Editors (Slim & Clean) ---

function RemoveCharactersEditor({
  action,
  onChange,
}: {
  action: Extract<ActionConfig, { type: "remove_characters" }>;
  onChange: (newAction: ActionConfig) => void;
}) {
  const cfg = action.config;
  const isPunctuation = cfg.removePunctuation ?? (cfg.mode === "punctuation");
  const isNumbers = cfg.removeNumbers ?? false;
  const isAlphabets = cfg.removeAlphabets ?? false;
  const isSpecialChars = cfg.removeSpecialChars ?? false;
  const isWhitespace = cfg.removeWhitespace ?? false;

  const toggleOption = (key: "removePunctuation" | "removeNumbers" | "removeAlphabets" | "removeSpecialChars" | "removeWhitespace") => {
    onChange({
      type: "remove_characters",
      config: {
        ...cfg,
        mode: "custom",
        [key]: !cfg[key],
      },
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
          Pilih Karakter yang Dihapus:
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "removePunctuation" as const, label: "Punctuation (.-/#,)", active: isPunctuation },
            { key: "removeNumbers" as const, label: "Numbers (0-9)", active: isNumbers },
            { key: "removeAlphabets" as const, label: "Alphabets (a-z)", active: isAlphabets },
            { key: "removeSpecialChars" as const, label: "Special Chars (@#$)", active: isSpecialChars },
            { key: "removeWhitespace" as const, label: "Whitespace (Spasi)", active: isWhitespace },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleOption(item.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                item.active
                  ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
          Karakter Kustom Tambahan:
        </label>
        <input
          type="text"
          value={cfg.customChars || ""}
          onChange={(e) => {
            onChange({
              type: "remove_characters",
              config: {
                ...cfg,
                mode: "custom",
                customChars: e.target.value,
              },
            });
          }}
          placeholder="Ketik karakter spesifik yang ingin dihapus..."
          className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
        />
      </div>
    </div>
  );
}

function NumberFormattingEditor({
  action,
  onChange,
}: {
  action: Extract<ActionConfig, { type: "number_formatting" }>;
  onChange: (newAction: ActionConfig) => void;
}) {
  const cfg = action.config;
  const currentSep = cfg.thousandsSeparator || (cfg.removeCommas ? "none" : "none");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Pemisah 3 Angka / Ribuan */}
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Pemisah Ribuan (3 Angka)
          </label>
          <CustomSelect
            value={currentSep}
            onChange={(val) => {
              onChange({
                type: "number_formatting",
                config: {
                  ...cfg,
                  thousandsSeparator: val as "none" | "comma" | "dot",
                  removeCommas: val === "none",
                },
              });
            }}
            options={[
              { label: "Tanpa Pemisah (1234567.89)", value: "none" },
              { label: "Koma Ribuan — US / Intl (1,234,567.89)", value: "comma" },
              { label: "Titik Ribuan — ID / Eropa (1.234.567,89)", value: "dot" },
            ]}
            size="sm"
          />
        </div>

        {/* Pembulatan Desimal */}
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Pembulatan Desimal
          </label>
          <CustomSelect
            value={String(cfg.roundDecimals ?? -1)}
            onChange={(val) => {
              onChange({
                type: "number_formatting",
                config: {
                  ...cfg,
                  roundDecimals: parseInt(val, 10),
                },
              });
            }}
            options={[
              { label: "Pertahankan Desimal Asli", value: "-1" },
              { label: "0 Desimal (Bulat)", value: "0" },
              { label: "2 Desimal (0.00)", value: "2" },
              { label: "4 Desimal (0.0000)", value: "4" },
            ]}
            size="sm"
          />
        </div>
      </div>

      {/* Checkboxes: Pembersihan Ekstra */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={!!cfg.stripUnits}
            onChange={(e) => {
              onChange({
                type: "number_formatting",
                config: {
                  ...cfg,
                  stripUnits: e.target.checked,
                },
              });
            }}
            className="rounded text-blue-950 focus:ring-0 w-3.5 h-3.5"
          />
          <span>Hapus Satuan (kg, pcs, dll)</span>
        </label>

        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={!!cfg.stripCurrency}
            onChange={(e) => {
              onChange({
                type: "number_formatting",
                config: {
                  ...cfg,
                  stripCurrency: e.target.checked,
                },
              });
            }}
            className="rounded text-blue-950 focus:ring-0 w-3.5 h-3.5"
          />
          <span>Hapus Simbol Mata Uang (USD, IDR, $, dll)</span>
        </label>
      </div>
    </div>
  );
}

function ReplaceTextEditor({
  action,
  onChange,
}: {
  action: Extract<ActionConfig, { type: "replace_text" }>;
  onChange: (newAction: ActionConfig) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
          Teks yang Dicari (Find)
        </label>
        <input
          type="text"
          value={action.config.findText}
          onChange={(e) => {
            onChange({
              type: "replace_text",
              config: {
                ...action.config,
                findText: e.target.value,
              },
            });
          }}
          placeholder="Contoh: USD atau INV-"
          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-slate-400"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
          Ganti Dengan (Replace With)
        </label>
        <input
          type="text"
          value={action.config.replaceWith}
          onChange={(e) => {
            onChange({
              type: "replace_text",
              config: {
                ...action.config,
                replaceWith: e.target.value,
              },
            });
          }}
          placeholder="Kosongkan jika ingin menghapus"
          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-slate-400"
        />
      </div>
    </div>
  );
}

function TrimWhitespaceEditor({
  action,
  onChange,
}: {
  action: Extract<ActionConfig, { type: "trim_whitespace" }>;
  onChange: (newAction: ActionConfig) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
        <input
          type="checkbox"
          checked={action.config.trimEdges}
          onChange={(e) => {
            onChange({
              type: "trim_whitespace",
              config: {
                ...action.config,
                trimEdges: e.target.checked,
              },
            });
          }}
          className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
        />
        <span className="text-xs text-slate-700 font-medium">Trim Awal & Akhir</span>
      </label>

      <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
        <input
          type="checkbox"
          checked={action.config.collapseMultiple}
          onChange={(e) => {
            onChange({
              type: "trim_whitespace",
              config: {
                ...action.config,
                collapseMultiple: e.target.checked,
              },
            });
          }}
          className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
        />
        <span className="text-xs text-slate-700 font-medium">Rapikan Spasi Ganda</span>
      </label>

      <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
        <input
          type="checkbox"
          checked={action.config.removeAllSpaces}
          onChange={(e) => {
            onChange({
              type: "trim_whitespace",
              config: {
                ...action.config,
                removeAllSpaces: e.target.checked,
              },
            });
          }}
          className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
        />
        <span className="text-xs text-slate-700 font-medium">Hapus Seluruh Spasi</span>
      </label>
    </div>
  );
}

function CaseTransformEditor({
  action,
  onChange,
}: {
  action: Extract<ActionConfig, { type: "case_transform" }>;
  onChange: (newAction: ActionConfig) => void;
}) {
  const transform = action.config.transform;
  return (
    <div className="flex flex-wrap gap-1.5">
      {[
        { id: "uppercase", label: "UPPERCASE" },
        { id: "lowercase", label: "lowercase" },
        { id: "titlecase", label: "Title Case" },
      ].map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => {
            onChange({
              type: "case_transform",
              config: {
                transform: opt.id as "uppercase" | "lowercase" | "titlecase",
              },
            });
          }}
          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            transform === opt.id
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DateNormalizeEditor({
  action,
  onChange,
}: {
  action: Extract<ActionConfig, { type: "date_normalize" }>;
  onChange: (newAction: ActionConfig) => void;
}) {
  const targetFormat = action.config.targetFormat || "DD/MM/YYYY";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputOrder = (action.config as any).inputOrder || "Day first (EU)";

  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-[11px] text-slate-500 block mb-1">Select input date order</label>
        <select
          value={inputOrder}
          onChange={(e) => {
            onChange({
              type: "date_normalize",
              config: {
                ...action.config,
                inputOrder: e.target.value,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any,
            });
          }}
          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="Day first (EU)">Day first (EU)</option>
          <option value="Month first (US)">Month first (US)</option>
          <option value="Year first (ISO)">Year first (ISO)</option>
        </select>
      </div>

      <div>
        <label className="text-[11px] text-slate-500 block mb-1">Select output date format</label>
        <select
          value={targetFormat}
          onChange={(e) => {
            onChange({
              type: "date_normalize",
              config: {
                ...action.config,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                targetFormat: e.target.value as any,
              },
            });
          }}
          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
          <option value="DD-MM-YYYY">DD-MM-YYYY</option>
          <option value="DD MMM YYYY">DD MMM YYYY</option>
        </select>
      </div>
    </div>
  );
}

function PrefixSuffixEditor({
  action,
  onChange,
}: {
  action: Extract<ActionConfig, { type: "prefix_suffix" }>;
  onChange: (newAction: ActionConfig) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
          Operasi
        </label>
        <CustomSelect
          value={action.config.operation}
          onChange={(val) => {
            onChange({
              type: "prefix_suffix",
              config: {
                ...action.config,
                operation: val as "add_prefix" | "remove_prefix" | "add_suffix" | "remove_suffix",
              },
            });
          }}
          options={[
            { label: "Hapus Awalan (Remove Prefix)", value: "remove_prefix" },
            { label: "Tambah Awalan (Add Prefix)", value: "add_prefix" },
            { label: "Hapus Akhiran (Remove Suffix)", value: "remove_suffix" },
            { label: "Tambah Akhiran (Add Suffix)", value: "add_suffix" },
          ]}
          size="sm"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
          Nilai Teks
        </label>
        <input
          type="text"
          value={action.config.value}
          onChange={(e) => {
            onChange({
              type: "prefix_suffix",
              config: {
                ...action.config,
                value: e.target.value,
              },
            });
          }}
          placeholder="Contoh: INV- atau EXP-"
          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono"
        />
      </div>
    </div>
  );
}

function ValidationRuleEditor({
  action,
  onChange,
}: {
  action: Extract<ActionConfig, { type: "validation_rule" }>;
  onChange: (newAction: ActionConfig) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
          Kondisi
        </label>
        <CustomSelect
          value={action.config.condition}
          onChange={(val) => {
            onChange({
              type: "validation_rule",
              config: {
                ...action.config,
                condition: val as "not_empty" | "is_number" | "min_length" | "max_length" | "regex_match",
              },
            });
          }}
          options={[
            { label: "Wajib Diisi (Not Empty)", value: "not_empty" },
            { label: "Harus Angka (Is Number)", value: "is_number" },
            { label: "Panjang Minimal", value: "min_length" },
            { label: "Panjang Maksimal", value: "max_length" },
            { label: "Cocok dengan Regex", value: "regex_match" },
          ]}
          size="sm"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
          Parameter
        </label>
        <input
          type="text"
          value={action.config.paramValue || ""}
          onChange={(e) => {
            onChange({
              type: "validation_rule",
              config: {
                ...action.config,
                paramValue: e.target.value,
              },
            });
          }}
          placeholder="Contoh: 5 atau ^[0-9]+$"
          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
          Jika Gagal
        </label>
        <CustomSelect
          value={action.config.onFail}
          onChange={(val) => {
            onChange({
              type: "validation_rule",
              config: {
                ...action.config,
                onFail: val as "warning" | "error" | "fallback",
              },
            });
          }}
          options={[
            { label: "Tandai Warning", value: "warning" },
            { label: "Blokir / Error", value: "error" },
            { label: "Ganti Default", value: "fallback" },
          ]}
          size="sm"
        />
      </div>
    </div>
  );
}

function ValueMappingEditor({
  action,
  onChange,
}: {
  action: Extract<ActionConfig, { type: "value_mapping" }>;
  onChange: (newAction: ActionConfig) => void;
}) {
  const [newKeyword, setNewKeyword] = useState("");
  const [newVal, setNewVal] = useState("");

  const mappings = action.config.mappings || [];
  const mode = action.config.mode || "replace";

  const handleAdd = () => {
    if (!newKeyword.trim() || !newVal.trim()) return;
    onChange({
      type: "value_mapping",
      config: {
        ...action.config,
        mappings: [...mappings, { keyword: newKeyword.trim(), mappedValue: newVal.trim() }],
      },
    });
    setNewKeyword("");
    setNewVal("");
  };

  const handleRemove = (idx: number) => {
    onChange({
      type: "value_mapping",
      config: {
        ...action.config,
        mappings: mappings.filter((_, i) => i !== idx),
      },
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Metode:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => onChange({ type: "value_mapping", config: { ...action.config, mode: "replace" } })}
              className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors ${
                mode === "replace" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange({ type: "value_mapping", config: { ...action.config, mode: "append" } })}
              className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors ${
                mode === "append" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Append
            </button>
          </div>
        </div>
      </div>

      {/* Existing mappings pills */}
      <div className="flex flex-wrap gap-1.5">
        {mappings.map((m, idx) => (
          <div
            key={idx}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs font-mono"
          >
            <span>&quot;{m.keyword}&quot;</span>
            <ArrowRightIcon className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-900">&quot;{m.mappedValue}&quot;</span>
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="text-slate-400 hover:text-rose-600 p-0.5"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new mapping line */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          placeholder="Kata kunci..."
          className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono"
        />
        <ArrowRightIcon className="w-3 h-3 text-slate-400 shrink-0" />
        <input
          type="text"
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          placeholder="Nilai target..."
          className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newKeyword.trim() || !newVal.trim()}
          className="px-3 py-1 bg-blue-950 text-white rounded-lg text-xs font-semibold hover:bg-blue-900 disabled:opacity-40 cursor-pointer shadow-2xs transition-colors"
        >
          Tambah
        </button>
      </div>
    </div>
  );
}

// --- Main WorkflowBuilder Component (Clean & Slim, Zero Emojis) ---

export default function WorkflowBuilder() {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [activeDocTab, setActiveDocTab] = useState<UscDocumentType>("pib");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>("");
  const [modalCategory, setModalCategory] = useState<string>("all");
  const [showSandbox, setShowSandbox] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "warning" | "info" | "error";
  } | null>(null);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [savingStepId, setSavingStepId] = useState<string | null>(null);

  const showToast = (
    message: string,
    type: "success" | "warning" | "info" | "error" = "info",
    duration = 3500
  ) => {
    setToast({ message, type });
    if (duration > 0) {
      setTimeout(() => {
        setToast((current) => (current?.message === message ? null : current));
      }, duration);
    }
  };

  // DB uploaded files for live testing
  const [uploadedDbFiles, setUploadedDbFiles] = useState<SampleDocument[]>([]);

  // Accordion & Test states per step
  const [openOutputSettings, setOpenOutputSettings] = useState<Record<string, boolean>>({});
  const [openTestSection, setOpenTestSection] = useState<Record<string, boolean>>({});
  const [openTestFileDropdown, setOpenTestFileDropdown] = useState<Record<string, boolean>>({});
  const [testFileSearch, setTestFileSearch] = useState<Record<string, string>>({});
  const [selectedTestFileId, setSelectedTestFileId] = useState<Record<string, string>>({});
  const [testResultTabs, setTestResultTabs] = useState<Record<string, "input" | "output">>({});
  const [stepRunResults, setStepRunResults] = useState<
    Record<
      string,
      {
        timestamp: string;
        fileId: string;
        fileName: string;
        fileUrl?: string;
        fields: Array<{ fieldName: string; inputVal: string; outputVal: string; page: string }>;
      }
    >
  >({});

  // Sandbox State
  const [sandboxDoc, setSandboxDoc] = useState<string>("pib");
  const [sandboxField, setSandboxField] = useState<string>("Nomor Aju");
  const [sandboxInput, setSandboxInput] = useState<string>("   010203 - 004812 / 2024 (5,458.00 kgs)   ");
  const [sandboxResult, setSandboxResult] = useState<PipelineExecutionResult | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info" | "success";
    isAlert?: boolean;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
  });

  // Load steps on mount
  useEffect(() => {
    let isMounted = true;
    const loadSteps = async () => {
      try {
        if (localStorage.getItem("tvs_workflow_data_actions")) {
          localStorage.removeItem("tvs_workflow_data_actions");
        }
        const res = await fetch("/api/data-actions");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.steps)) {
            if (!isMounted) return;
            setSteps(data.steps);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.steps));
            const exp: Record<string, boolean> = {};
            data.steps.forEach((s: WorkflowStep) => {
              exp[s.id] = true;
            });
            setExpandedSteps(exp);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to load steps from server API:", err);
      }

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && isMounted) {
            setSteps(parsed);
            const exp: Record<string, boolean> = {};
            parsed.forEach((s: WorkflowStep) => {
              exp[s.id] = true;
            });
            setExpandedSteps(exp);
          }
        }
      } catch {
        if (isMounted) setSteps([]);
      }
    };

    loadSteps();

    const loadTestFiles = async () => {
      try {
        const res = await fetch("/api/test-files");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.files) && isMounted) {
            setUploadedDbFiles(data.files);
          }
        }
      } catch (err) {
        console.warn("Failed to load test files from DB:", err);
      }
    };
    loadTestFiles();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
      setHasChanges(false);

      await fetch("/api/data-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });

      showToast("Data Actions tersimpan ke Server & Database.", "success");
    } catch {
      setConfirmDialog({
        isOpen: true,
        title: "Gagal Menyimpan",
        description: "Gagal menyimpan konfigurasi pipeline ke server.",
        variant: "danger",
        isAlert: true,
      });
    }
  };

  const handleResetDefault = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Kosongkan Seluruh Pipeline?",
      description: "Semua aturan modifikasi yang belum tersimpan akan dihapus.",
      confirmText: "Kosongkan",
      variant: "warning",
      onConfirm: async () => {
        setSteps([]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        try {
          await fetch("/api/data-actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ steps: [] }),
          });
        } catch {
          // ignore
        }
        setHasChanges(false);
        showToast("Pipeline Data Actions telah dikosongkan.", "info");
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleAddStepFromCatalog = (catalogItem: ActionCatalogItem) => {
    const newId = `step-${Date.now()}`;
    const targetDoc = activeDocTab;

    const newStep: WorkflowStep = {
      id: newId,
      name: `${catalogItem.defaultName} (${targetDoc.toUpperCase()})`,
      description: catalogItem.description,
      docScope: targetDoc,
      targetField: "",
      targetFields: [],
      outputMode: "new_field",
      outputFieldName: "",
      action: JSON.parse(JSON.stringify(catalogItem.defaultConfig)),
      enabled: true,
      sampleInput: "",
    };

    setSteps([...steps, newStep]);
    setExpandedSteps((prev) => ({ ...prev, [newId]: true }));
    setShowAddModal(false);
    setHasChanges(true);
  };

  const handleDeleteStep = (id: string) => {
    const stepToDelete = steps.find((s) => s.id === id);
    setConfirmDialog({
      isOpen: true,
      title: "Hapus Langkah?",
      description: `Hapus aturan "${stepToDelete?.name || "ini"}"?`,
      confirmText: "Hapus",
      variant: "danger",
      onConfirm: () => {
        setSteps(steps.filter((s) => s.id !== id));
        setHasChanges(true);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleDuplicateStep = (step: WorkflowStep) => {
    const newId = `step-${Date.now()}`;
    const dup: WorkflowStep = {
      ...JSON.parse(JSON.stringify(step)),
      id: newId,
      name: `${step.name} (Copy)`,
    };
    const idx = steps.findIndex((s) => s.id === step.id);
    const updated = [...steps];
    updated.splice(idx + 1, 0, dup);
    setSteps(updated);
    setExpandedSteps((prev) => ({ ...prev, [newId]: true }));
    setHasChanges(true);
  };

  const handleMoveStep = (stepId: string, direction: "up" | "down") => {
    const currentActiveIdx = activeDocumentSteps.findIndex((s) => s.id === stepId);
    if (currentActiveIdx === -1) return;
    const targetActiveIdx = direction === "up" ? currentActiveIdx - 1 : currentActiveIdx + 1;
    if (targetActiveIdx < 0 || targetActiveIdx >= activeDocumentSteps.length) return;

    const currentStep = activeDocumentSteps[currentActiveIdx]!;
    const targetStep = activeDocumentSteps[targetActiveIdx]!;

    const fullCurrentIdx = steps.findIndex((s) => s.id === currentStep.id);
    const fullTargetIdx = steps.findIndex((s) => s.id === targetStep.id);
    if (fullCurrentIdx === -1 || fullTargetIdx === -1) return;

    const updated = [...steps];
    const temp = updated[fullCurrentIdx]!;
    updated[fullCurrentIdx] = updated[fullTargetIdx]!;
    updated[fullTargetIdx] = temp;
    setSteps(updated);
    setHasChanges(true);
  };

  const handleToggleStep = (id: string) => {
    setSteps(
      steps.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    setHasChanges(true);
  };

  const updateStep = (id: string, partial: Partial<WorkflowStep>) => {
    setSteps(
      steps.map((s) => (s.id === id ? { ...s, ...partial } : s))
    );
    setHasChanges(true);
    setStepErrors((prev) => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return prev;
    });
  };

  const handleDoneStep = async (step: WorkflowStep) => {
    if (savingStepId === step.id) return;

    // 1. Validate required target fields and configuration options
    const validation = validateWorkflowStep(step);

    if (!validation.isValid) {
      setStepErrors((prev) => ({ ...prev, [step.id]: validation.warning || "Data masih kosong" }));
      showToast(validation.warning || "Data masih kosong", "warning");
      return;
    }

    // Clear step error
    setStepErrors((prev) => {
      const next = { ...prev };
      delete next[step.id];
      return next;
    });

    // 2. Prepare pipeline with latest step
    const exists = steps.some((s) => s.id === step.id);
    const updatedSteps = exists ? steps.map((s) => (s.id === step.id ? step : s)) : [...steps, step];
    setSteps(updatedSteps);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSteps));
    setHasChanges(false);

    // 3. Persist pipeline configuration to /api/data-actions
    setSavingStepId(step.id);
    try {
      const res = await fetch("/api/data-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: updatedSteps }),
      });
      if (!res.ok) {
        throw new Error("Gagal menyimpan ke server");
      }
      showToast("Konfigurasi Data Actions berhasil disimpan di server", "success");
      // 4. Collapse step card editor only on successful save
      setExpandedSteps((prev) => ({ ...prev, [step.id]: false }));
    } catch (err) {
      console.warn("Gagal menyimpan pipeline:", err);
      showToast("Gagal menyimpan ke server", "error");
    } finally {
      setSavingStepId(null);
    }
  };

  const getFilesForStep = (step: WorkflowStep): SampleDocument[] => {
    const targetDoc = normalizeDocumentType(step.docScope);
    let combined: SampleDocument[];
    if (targetDoc !== "all") {
      const dbMatches = uploadedDbFiles.filter((d) => normalizeDocumentType(d.docScope) === targetDoc);
      const sampleMatches = SAMPLE_DOCUMENTS.filter((d) => normalizeDocumentType(d.docScope) === targetDoc);
      combined = [...dbMatches, ...sampleMatches];
      if (combined.length === 0) combined = sampleMatches;
    } else {
      combined = [...uploadedDbFiles, ...SAMPLE_DOCUMENTS];
    }
    const seen = new Set<string>();
    return combined.filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
  };

  const handleRunNanonetsTest = (step: WorkflowStep, fileId?: string) => {
    const validOptions = getFieldOptionsForDocument(step.docScope);
    const validValuesSet = new Set(validOptions.map((o) => o.value));

    const rawTargets = Array.isArray(step.targetFields) && step.targetFields.length > 0
      ? step.targetFields
      : step.targetField && step.targetField !== "*"
      ? step.targetField.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const targets = validValuesSet.size > 0
      ? rawTargets.filter((t) => validValuesSet.has(t))
      : rawTargets;

    if (targets.length === 0) {
      return;
    }

    const files = getFilesForStep(step);
    const chosenFile = files.find((f) => f.id === fileId) || files[0] || SAMPLE_DOCUMENTS[0]!;

    // Find all preceding enabled steps for this document scope up to current step
    const targetDocNorm = normalizeDocumentType(chosenFile.docScope || step.docScope);
    const docSteps = steps.filter((s) => {
      const sDoc = normalizeDocumentType(s.docScope);
      return sDoc === targetDocNorm || sDoc === "all";
    });
    const currentStepIdx = docSteps.findIndex((s) => s.id === step.id);
    const precedingSteps = currentStepIdx > 0 ? docSteps.slice(0, currentStepIdx) : [];

    const fieldResults = targets.map((field) => {
      // Resolve value using direct match, synonyms (e.g. Nama_Importir <-> Pemilik_Barang), and normalized keys
      const resolved = resolveFieldValue(chosenFile.fieldValues, field);
      const isFound = resolved.found;
      const rawVal = resolved.found ? resolved.value : null;

      // If truly not found in this document:
      if (!isFound || rawVal === null) {
        return {
          fieldName: field,
          inputVal: "-",
          outputVal: "-",
          page: chosenFile.pageCount || "Page 1/3",
          isEmpty: true,
        };
      }

      // Chain through all preceding enabled steps that apply to this field
      let chainedInput = rawVal;
      for (const prevStep of precedingSteps) {
        if (!prevStep.enabled) continue;

        const prevTargets = Array.isArray(prevStep.targetFields) && prevStep.targetFields.length > 0
          ? prevStep.targetFields
          : prevStep.targetField && prevStep.targetField !== "*"
          ? prevStep.targetField.split(",").map((s) => s.trim()).filter(Boolean)
          : ["*"];

        const isMatch =
          prevTargets.includes("*") ||
          prevTargets.some((t) => {
            const cleanT = t.toLowerCase().replace(/[^a-z0-9]/g, "");
            const cleanF = field.toLowerCase().replace(/[^a-z0-9]/g, "");
            return cleanT === cleanF || cleanT.includes(cleanF) || cleanF.includes(cleanT);
          });

        if (isMatch) {
          const prevRes = applyWorkflowStep(chainedInput, prevStep, chosenFile.docScope);
          if (prevRes.applied) {
            chainedInput = prevRes.output;
          }
        }
      }

      // Execute current step on top of the chained input
      const res = applyWorkflowStep(chainedInput, { ...step, enabled: true }, chosenFile.docScope);
      return {
        fieldName: field,
        inputVal: String(chainedInput),
        outputVal: String(res.output),
        page: chosenFile.pageCount || "Page 1/3",
        isEmpty: false,
      };
    });

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    setStepRunResults((prev) => ({
      ...prev,
      [step.id]: {
        timestamp,
        fileId: chosenFile.id,
        fileName: chosenFile.fileName,
        fileUrl: chosenFile.fileUrl,
        fields: fieldResults,
      },
    }));

    if (!testResultTabs[step.id]) {
      setTestResultTabs((prev) => ({ ...prev, [step.id]: "output" }));
    }
  };

  const runSandbox = () => {
    const result = executeDataPipeline(sandboxInput, sandboxField, sandboxDoc, steps);
    setSandboxResult(result);
  };

  useEffect(() => {
    if (showSandbox) {
      runSandbox();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sandboxInput, sandboxField, sandboxDoc, steps, showSandbox]);

  const activeDocumentSteps = useMemo(() => {
    const activeDocNorm = normalizeDocumentType(activeDocTab);
    return steps.filter((step) => {
      const stepDocNorm = normalizeDocumentType(step.docScope);
      const matchDoc = stepDocNorm === activeDocNorm || (stepDocNorm === "all" && activeDocNorm === "pib");
      const targetFieldsStr = Array.isArray(step.targetFields)
        ? step.targetFields.join(" ")
        : (step.targetField || "");
      const matchSearch =
        searchQuery.trim() === "" ||
        (step.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        targetFieldsStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (step.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchDoc && matchSearch;
    });
  }, [steps, activeDocTab, searchQuery]);

  const docCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of USC_DOCUMENT_TABS) {
      const tabNorm = normalizeDocumentType(tab.id);
      counts[tab.id] = steps.filter((s) => {
        const sNorm = normalizeDocumentType(s.docScope);
        return sNorm === tabNorm;
      }).length;
    }
    return counts;
  }, [steps]);

  const filteredCatalog = useMemo(() => {
    return ACTION_CATALOG.filter((item) => {
      const matchCategory = modalCategory === "all" || item.category === modalCategory;
      const matchSearch =
        modalSearch.trim() === "" ||
        item.title.toLowerCase().includes(modalSearch.toLowerCase()) ||
        item.description.toLowerCase().includes(modalSearch.toLowerCase()) ||
        item.categoryLabel.toLowerCase().includes(modalSearch.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [modalCategory, modalSearch]);

  const activeDocDef = USC_DOCUMENT_TABS.find((t) => t.id === activeDocTab) || USC_DOCUMENT_TABS[0]!;

  return (
    <div className="space-y-4">
      {/* Toast Alert (Clean & Slim, Zero Emojis) */}
      {toast && (
        <div
          className={`px-3.5 py-2.5 rounded-lg text-xs flex items-center justify-between shadow-2xs transition-all ${
            toast.type === "warning"
              ? "bg-amber-50 border border-amber-200 text-amber-900"
              : toast.type === "error"
              ? "bg-rose-50 border border-rose-200 text-rose-900"
              : toast.type === "info"
              ? "bg-blue-50 border border-blue-200 text-blue-900"
              : "bg-emerald-50 border border-emerald-200 text-emerald-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "warning" && (
              <AlertTriangleIcon className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            {toast.type === "error" && (
              <AlertCircleIcon className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            {toast.type === "info" && (
              <InfoIcon className="w-4 h-4 text-blue-900 shrink-0" />
            )}
            {toast.type === "success" && (
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 ml-3 cursor-pointer"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Slim Workflow Stages Stepper Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 px-3.5 py-2 shadow-2xs">
        <div className="flex items-center justify-between text-xs overflow-x-auto no-scrollbar gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold flex items-center justify-center">
              1
            </span>
            <span className="text-slate-600 text-xs">Batch Upload</span>
          </div>
          <ArrowRightIcon className="w-3 h-3 text-slate-300 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold flex items-center justify-center">
              2
            </span>
            <span className="text-slate-600 text-xs">AI OCR</span>
          </div>
          <ArrowRightIcon className="w-3 h-3 text-slate-300 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-4 h-4 rounded-full bg-blue-950 text-white font-mono text-[10px] font-semibold flex items-center justify-center">
              3
            </span>
            <span className="text-blue-950 text-xs font-semibold">Data Actions (Active)</span>
          </div>
          <ArrowRightIcon className="w-3 h-3 text-slate-300 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold flex items-center justify-center">
              4
            </span>
            <span className="text-slate-600 text-xs">Canonical Matching</span>
          </div>
          <ArrowRightIcon className="w-3 h-3 text-slate-300 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold flex items-center justify-center">
              5
            </span>
            <span className="text-slate-600 text-xs">Review & Export</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Bar (Clean & Slim) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-slate-900">Data Actions</h2>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 font-mono">
            {steps.length} Rules Active
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari aksi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-950 focus:bg-white w-36 transition-all"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-950 hover:bg-blue-900 text-white transition-colors cursor-pointer shadow-2xs"
          >
            <PlusIcon className="w-3 h-3" />
            <span>Add step</span>
          </button>
        </div>
      </div>

      {/* Slim Segmented Document Switcher Tabs (Strictly 1 File / Doc at a time, Zero Emojis) */}
      <div className="border-b border-slate-200 pb-px">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {USC_DOCUMENT_TABS.map((tab) => {
            const isActive = activeDocTab === tab.id;
            const count = docCounts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDocTab(tab.id)}
                className={`group px-3 py-2 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? "border-blue-950 text-blue-950 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
              >
                {tab.isReference && (
                  <StarIcon className={`w-3 h-3 ${isActive ? "text-blue-950" : "text-slate-400 group-hover:text-slate-600"}`} />
                )}
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium ${
                      isActive ? "bg-blue-950 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
                {tab.isReference && (
                  <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                    Ref
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTIVE DOCUMENT DATA ACTIONS CONTAINER */}
      <div className="space-y-3">
        {activeDocumentSteps.length === 0 ? (
          // Clean & Slim Empty State (Zero Emojis)
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-2.5">
            <div className="mx-auto w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <SlidersIcon className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900">
                Belum ada aturan aksi untuk {activeDocDef.fullName}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mx-auto">
                Konfigurasi pembersihan, standardisasi format, atau mapping data khusus untuk dokumen ini sebelum proses pencocokan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 hover:bg-blue-900 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            >
              <PlusIcon className="w-3 h-3" />
              <span>Tambah Aksi Baru</span>
            </button>
          </div>
        ) : (
          // Slim Action Cards List
          activeDocumentSteps.map((step, index) => {
            const isExpanded = !!expandedSteps[step.id];
            const actionDef =
              ACTION_CATALOG.find((c) => c.type === step.action.type) || ACTION_CATALOG[0]!;
            const StepIcon = actionDef.icon;

            const validOptions = getFieldOptionsForDocument(step.docScope);
            const validValuesSet = new Set(validOptions.map((o) => o.value));

            const currentTargetFields = (
              Array.isArray(step.targetFields)
                ? step.targetFields
                : step.targetField && step.targetField !== "*"
                ? step.targetField.split(",").map((s) => s.trim()).filter(Boolean)
                : []
            ).filter((val) => validValuesSet.has(val));

            return (
              <div key={step.id} id={step.id} className="relative group">
                {/* Connecting Line between steps */}
                {index > 0 && (
                  <div className="flex items-center justify-center py-0.5">
                    <div className="w-px h-2 bg-slate-200" />
                  </div>
                )}

                {/* Slim Step Card */}
                <div
                  className={`bg-white rounded-xl border transition-all ${
                    step.enabled
                      ? "border-slate-200/90 shadow-2xs hover:border-slate-300"
                      : "border-slate-200 opacity-60 bg-slate-50/50"
                  }`}
                >
                  {/* SLIM CARD HEADER */}
                  <div className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Drag Handle */}
                      <div className="text-slate-300 cursor-grab hover:text-slate-500 shrink-0">
                        <DragHandleIcon className="w-3.5 h-3.5" />
                      </div>

                      {/* Step Number */}
                      <span className="text-xs font-semibold text-slate-400 w-4 text-center shrink-0">
                        {index + 1}
                      </span>

                      {/* Action Icon in rounded container */}
                      <div className="w-7 h-7 rounded-lg bg-blue-50/70 border border-blue-200/80 text-blue-900 flex items-center justify-center shrink-0 shadow-2xs">
                        <StepIcon className="w-3.5 h-3.5" />
                      </div>

                      {/* Title & Field Badges */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <input
                            type="text"
                            value={step.name}
                            onChange={(e) => updateStep(step.id, { name: e.target.value })}
                            className="text-xs font-semibold text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-950 px-1 py-0.5 rounded transition-all"
                          />
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200/70">
                            {actionDef.badge}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] border font-mono truncate max-w-[240px] ${
                              currentTargetFields.length > 0
                                ? "text-slate-700 bg-slate-50 border-slate-200 font-semibold"
                                : "text-slate-400 bg-slate-50/50 border-dashed border-slate-200 italic"
                            }`}
                          >
                            {currentTargetFields.length > 0
                              ? currentTargetFields.join(", ")
                              : "Belum ada field dipilih"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Controls Toolbar */}
                    <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                      {/* Toggle */}
                      <label className="relative inline-flex items-center cursor-pointer mr-1.5">
                        <input
                          type="checkbox"
                          checked={step.enabled}
                          onChange={() => handleToggleStep(step.id)}
                          className="sr-only peer"
                        />
                        <div className="w-7 h-3.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-950"></div>
                      </label>

                      {/* Move Up */}
                      <button
                        onClick={() => handleMoveStep(step.id, "up")}
                        disabled={index === 0}
                        title="Geser ke Atas"
                        className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        <ArrowUpIcon className="w-3 h-3" />
                      </button>

                      {/* Move Down */}
                      <button
                        onClick={() => handleMoveStep(step.id, "down")}
                        disabled={index === activeDocumentSteps.length - 1}
                        title="Geser ke Bawah"
                        className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        <ArrowDownIcon className="w-3 h-3" />
                      </button>

                      {/* Duplicate */}
                      <button
                        onClick={() => handleDuplicateStep(step)}
                        title="Duplikat"
                        className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                      >
                        <CopyIcon className="w-3 h-3" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteStep(step.id)}
                        title="Hapus"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>

                      {/* Expand / Collapse */}
                      <button
                        onClick={() => setExpandedSteps((prev) => ({ ...prev, [step.id]: !isExpanded }))}
                        className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 ml-0.5 cursor-pointer"
                      >
                        <ChevronDownIcon
                          className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* SLIM CARD BODY */}
                  {isExpanded && (
                    <div className="p-3.5 space-y-3 bg-slate-50/40 rounded-b-xl border-t border-slate-100 text-xs animate-in fade-in duration-100">
                      {/* Step Validation Warning Alert */}
                      {stepErrors[step.id] && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-center justify-between shadow-2xs">
                          <div className="flex items-center gap-2">
                            <AlertTriangleIcon className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="font-semibold">{stepErrors[step.id]}</span>
                          </div>
                          <span className="text-[11px] text-amber-700">Mohon lengkapi target field dan opsi konfigurasi.</span>
                        </div>
                      )}

                      {/* SECTION 1: APPLY TO FIELD */}
                      <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 space-y-2.5">
                        <div className="flex items-start gap-2">
                          <PencilIcon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-slate-800">Apply to field</div>
                            <div className="text-[11px] text-slate-500">Select one or more fields</div>
                          </div>
                        </div>

                        <CustomMultiSelect
                          values={currentTargetFields}
                          onChange={(vals) => {
                            const first = vals[0] || "";
                            updateStep(step.id, {
                              targetFields: vals,
                              targetField: vals.join(", "),
                              outputFieldName: first ? `${first}_action` : "",
                            });
                          }}
                          options={validOptions}
                          size="md"
                          placeholder="Select one or more fields"
                        />

                        {/* Action Specific Editor */}
                        <div className="pt-2 border-t border-slate-100">
                          {step.action.type === "remove_characters" && (
                            <RemoveCharactersEditor
                              action={step.action}
                              onChange={(newAction) => updateStep(step.id, { action: newAction })}
                            />
                          )}
                          {step.action.type === "number_formatting" && (
                            <NumberFormattingEditor
                              action={step.action}
                              onChange={(newAction) => updateStep(step.id, { action: newAction })}
                            />
                          )}
                          {step.action.type === "replace_text" && (
                            <ReplaceTextEditor
                              action={step.action}
                              onChange={(newAction) => updateStep(step.id, { action: newAction })}
                            />
                          )}
                          {step.action.type === "trim_whitespace" && (
                            <TrimWhitespaceEditor
                              action={step.action}
                              onChange={(newAction) => updateStep(step.id, { action: newAction })}
                            />
                          )}
                          {step.action.type === "case_transform" && (
                            <CaseTransformEditor
                              action={step.action}
                              onChange={(newAction) => updateStep(step.id, { action: newAction })}
                            />
                          )}
                          {step.action.type === "date_normalize" && (
                            <DateNormalizeEditor
                              action={step.action}
                              onChange={(newAction) => updateStep(step.id, { action: newAction })}
                            />
                          )}
                          {step.action.type === "prefix_suffix" && (
                            <PrefixSuffixEditor
                              action={step.action}
                              onChange={(newAction) => updateStep(step.id, { action: newAction })}
                            />
                          )}
                          {step.action.type === "validation_rule" && (
                            <ValidationRuleEditor
                              action={step.action}
                              onChange={(newAction) => updateStep(step.id, { action: newAction })}
                            />
                          )}
                          {step.action.type === "value_mapping" && (
                            <ValueMappingEditor
                              action={step.action}
                              onChange={(newAction) => updateStep(step.id, { action: newAction })}
                            />
                          )}
                        </div>
                      </div>

                      {/* SECTION 2: OUTPUT SETTINGS (Collapsible Accordion) */}
                      <div className="bg-white rounded-lg border border-slate-200/90 overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenOutputSettings((prev) => ({
                              ...prev,
                              [step.id]: !prev[step.id],
                            }))
                          }
                          className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <PencilIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs font-semibold text-slate-800">Output Settings</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({step.outputMode === "original_field" ? "Update field asli" : "Buat field baru"})
                            </span>
                          </div>
                          <ChevronRightIcon
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                              openOutputSettings[step.id] ? "rotate-90" : ""
                            }`}
                          />
                        </button>

                        {openOutputSettings[step.id] && (() => {
                          const displayedTarget =
                            (Array.isArray(step.targetFields) && step.targetFields[0]) ||
                            (step.targetField ? step.targetField.split(",")[0]?.trim() : "") ||
                            "";
                          const fallbackActionLabel = displayedTarget ? `${displayedTarget}_action` : "[fieldName]_action";
                          const inPlaceLabel = displayedTarget || "Field";

                          return (
                            <div className="p-3.5 border-t border-slate-100 space-y-3 bg-slate-50/40 animate-in fade-in duration-100">
                              {/* Descriptive Guidance on Output Settings */}
                              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200/80 text-[11px] text-slate-600 leading-relaxed space-y-1.5">
                                <div className="font-semibold text-blue-950 flex items-center gap-1.5">
                                  <InfoIcon className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                                  <span>Panduan Output Settings</span>
                                </div>
                                <p className="text-slate-600">
                                  Output Settings menentukan bagaimana data hasil transformasi disimpan pada dokumen:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                                  <li>
                                    <strong className="text-slate-800">Create as new field:</strong> Menyimpan hasil ke field baru terpisah (misalnya <code className="text-blue-950 font-semibold px-1 py-0.5 bg-blue-100/70 rounded font-mono text-[10px]">{fallbackActionLabel}</code>) sehingga data asli dari Nanonets OCR tetap tersimpan utuh untuk kebutuhan audit.
                                  </li>
                                  <li>
                                    <strong className="text-slate-800">Update existing field:</strong> Menimpa (overwrite) nilai field target secara langsung (in-place) pada dokumen untuk langsung digunakan oleh Canonical Matching Engine.
                                  </li>
                                </ul>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                  Mode Penyimpanan Output:
                                </label>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <label
                                  className={`flex-1 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                    step.outputMode !== "original_field"
                                      ? "bg-blue-50/70 border-blue-950 text-blue-950 font-semibold ring-1 ring-blue-950/20"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`outputMode-${step.id}`}
                                    checked={step.outputMode !== "original_field"}
                                    onChange={() => updateStep(step.id, { outputMode: "new_field" })}
                                    className="sr-only"
                                  />
                                  <div className="text-xs font-semibold">Create as new field</div>
                                  <div className="text-[10px] text-slate-500 font-normal mt-0.5 font-mono">
                                    Output: {step.outputFieldName || fallbackActionLabel}
                                  </div>
                                </label>

                                <label
                                  className={`flex-1 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                    step.outputMode === "original_field"
                                      ? "bg-blue-50/70 border-blue-950 text-blue-950 font-semibold ring-1 ring-blue-950/20"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`outputMode-${step.id}`}
                                    checked={step.outputMode === "original_field"}
                                    onChange={() => updateStep(step.id, { outputMode: "original_field" })}
                                    className="sr-only"
                                  />
                                  <div className="text-xs font-semibold">Update existing field</div>
                                  <div className="text-[10px] text-slate-500 font-normal mt-0.5 font-mono">
                                    In-place: {inPlaceLabel}
                                  </div>
                                </label>
                              </div>

                              {/* Custom Output Field Name Input when Create as new field is active */}
                              {step.outputMode !== "original_field" && (
                                <div className="pt-2 border-t border-slate-100 space-y-1">
                                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                                    Nama Field Output Kustom (Opsional):
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={step.outputFieldName || ""}
                                      onChange={(e) => updateStep(step.id, { outputFieldName: e.target.value })}
                                      placeholder={fallbackActionLabel}
                                      className="flex-1 max-w-sm px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-950"
                                    />
                                    <span className="text-[11px] text-slate-400">
                                      Default: <code className="font-mono text-slate-600">{fallbackActionLabel}</code>
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* SECTION 3: TEST THIS ACTION (Collapsible Accordion matching Screenshots 1, 2, 3) */}
                      {(() => {
                        const allFiles = getFilesForStep(step);
                        const searchQ = (testFileSearch[step.id] || "").toLowerCase().trim();
                        const filteredStepFiles = searchQ
                          ? allFiles.filter(
                              (f) =>
                                f.fileName.toLowerCase().includes(searchQ) ||
                                (f.batchId && f.batchId.toLowerCase().includes(searchQ))
                            )
                          : allFiles;

                        const chosenFileId = selectedTestFileId[step.id];
                        const activeFile =
                          filteredStepFiles.find((f) => f.id === chosenFileId) ||
                          allFiles.find((f) => f.id === chosenFileId) ||
                          filteredStepFiles[0] ||
                          allFiles[0] ||
                          SAMPLE_DOCUMENTS[0]!;

                        const isDropdownOpen = !!openTestFileDropdown[step.id];
                        const isSectionOpen = openTestSection[step.id] ?? true;
                        const stepResult = stepRunResults[step.id];
                        const activeTab = testResultTabs[step.id] || "output";

                        return (
                          <div className="bg-white rounded-lg border border-slate-200/90 overflow-hidden">
                            {/* Accordion Header */}
                            <button
                              type="button"
                              onClick={() =>
                                setOpenTestSection((prev) => ({
                                  ...prev,
                                  [step.id]: prev[step.id] === undefined ? false : !prev[step.id],
                                }))
                              }
                              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <EyeIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="text-xs font-semibold text-slate-800">
                                  Test this Action
                                </span>
                              </div>
                              <ChevronRightIcon
                                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                                  isSectionOpen ? "rotate-90" : ""
                                }`}
                              />
                            </button>

                            {/* Accordion Body */}
                            {isSectionOpen && (
                              <div className="p-3.5 border-t border-slate-100 space-y-3.5 bg-white animate-in fade-in duration-100">
                                <div>
                                  <label className="text-xs text-slate-600 font-medium block mb-1.5">
                                    Select file to test with
                                  </label>

                                  <div className="relative">
                                    <div className="flex items-center gap-2">
                                      {/* Trigger */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenTestFileDropdown((prev) => ({
                                            ...prev,
                                            [step.id]: !prev[step.id],
                                          }))
                                        }
                                        className={`flex-1 flex items-center justify-between px-3 py-2 bg-white border rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                          isDropdownOpen
                                            ? "border-blue-500 ring-2 ring-blue-500/20 text-slate-900"
                                            : "border-slate-300 text-slate-800 hover:border-slate-400"
                                        }`}
                                      >
                                        <span className="truncate">{activeFile.fileName}</span>
                                        <ChevronDownIcon
                                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                                            isDropdownOpen ? "rotate-180" : ""
                                          }`}
                                        />
                                      </button>

                                      {/* Run Test Button */}
                                      <button
                                        type="button"
                                        disabled={currentTargetFields.length === 0}
                                        onClick={() => handleRunNanonetsTest(step, activeFile.id)}
                                        title={
                                          currentTargetFields.length === 0
                                            ? "Pilih field pada 'Apply to field' terlebih dahulu"
                                            : "Jalankan pengujian"
                                        }
                                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-xs transition-colors shrink-0 shadow-2xs ${
                                          currentTargetFields.length === 0
                                            ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                                            : "bg-blue-950 hover:bg-blue-900 text-white cursor-pointer"
                                        }`}
                                      >
                                        <RefreshIcon className="w-3.5 h-3.5" />
                                        <span>Run Test</span>
                                      </button>
                                    </div>

                                    {/* Dropdown Menu (Screenshot 1) */}
                                    {isDropdownOpen && (
                                      <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-100">
                                        <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                                          <div className="relative">
                                            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                            <input
                                              type="text"
                                              value={testFileSearch[step.id] || ""}
                                              onChange={(e) =>
                                                setTestFileSearch((prev) => ({
                                                  ...prev,
                                                  [step.id]: e.target.value,
                                                }))
                                              }
                                              placeholder="Search by file name"
                                              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </div>
                                          <div className="px-1 pt-1.5 text-[11px] text-slate-400 font-medium">
                                            Showing {filteredStepFiles.length} results
                                          </div>
                                        </div>

                                        <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
                                          {filteredStepFiles.map((file, fileIdx) => (
                                            <div
                                              key={`${file.id}-${fileIdx}`}
                                              onClick={() => {
                                                setSelectedTestFileId((prev) => ({
                                                  ...prev,
                                                  [step.id]: file.id,
                                                }));
                                                setOpenTestFileDropdown((prev) => ({
                                                  ...prev,
                                                  [step.id]: false,
                                                }));
                                              }}
                                              className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                                                activeFile.id === file.id
                                                  ? "bg-blue-50/70 text-blue-950 font-medium"
                                                  : "hover:bg-slate-50 text-slate-700"
                                              }`}
                                            >
                                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <DocumentThumbnail fileUrl={file.fileUrl} className="w-7 h-9" />
                                                <div className="truncate">
                                                  <div className="text-xs font-medium truncate">
                                                    {file.fileName}
                                                  </div>
                                                  {file.isDb && (
                                                    <div className="text-[10px] text-blue-600 font-mono">
                                                      Batch #{file.batchId} • Webhook
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {currentTargetFields.length === 0 && (
                                    <div className="mt-2 py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-center gap-2">
                                      <InfoIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>
                                        Belum ada field yang dipilih. Pilih satu atau lebih field di bagian{" "}
                                        <strong className="text-slate-800 font-medium">Apply to field</strong> di atas untuk mengaktifkan pengujian.
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Results Section (Screenshots 2 & 3) */}
                                {stepResult && currentTargetFields.length > 0 && (
                                  <div className="pt-2 space-y-3">
                                    <div className="text-xs font-semibold text-slate-800">Results</div>

                                    {/* Green Banner */}
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/90 text-xs">
                                      <CheckCircleFilledIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                                      <span className="font-semibold text-slate-900">
                                        Test ran successfully
                                      </span>
                                      <span className="text-slate-500 font-mono text-[11px] ml-1">
                                        {stepResult.timestamp}
                                      </span>
                                    </div>

                                    {/* Document Preview & Data Tabs */}
                                    <div className="flex items-start gap-3.5 pt-1">
                                      {/* Left: Document Thumbnail */}
                                      <div className="shrink-0 pt-0.5">
                                        <DocumentThumbnail fileUrl={stepResult.fileUrl} className="w-14 h-19" />
                                      </div>

                                      {/* Right: Data Tabs & Fields */}
                                      <div className="flex-1 min-w-0">
                                        {/* Tab Switcher */}
                                        <div className="flex items-center gap-6 border-b border-slate-200 mb-2.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setTestResultTabs((prev) => ({
                                                ...prev,
                                                [step.id]: "input",
                                              }))
                                            }
                                            className={`pb-2 text-xs font-semibold transition-colors cursor-pointer relative ${
                                              activeTab === "input"
                                                ? "text-blue-950 border-b-2 border-blue-950 -mb-[1px]"
                                                : "text-slate-500 hover:text-slate-800"
                                            }`}
                                          >
                                            Input data
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setTestResultTabs((prev) => ({
                                                ...prev,
                                                [step.id]: "output",
                                              }))
                                            }
                                            className={`pb-2 text-xs font-semibold transition-colors cursor-pointer relative ${
                                              activeTab === "output"
                                                ? "text-blue-950 border-b-2 border-blue-950 -mb-[1px]"
                                                : "text-slate-500 hover:text-slate-800"
                                            }`}
                                          >
                                            Output results
                                          </button>
                                        </div>

                                        {/* Fields List */}
                                        <div className="space-y-2.5">
                                          {stepResult.fields
                                            .filter((fItem) => currentTargetFields.includes(fItem.fieldName))
                                            .map((fItem, fIdx) => (
                                              <div key={fIdx} className="space-y-1">
                                                <label className="text-[11px] text-slate-600 font-semibold block">
                                                  {fItem.fieldName}
                                                </label>
                                                {fItem.inputVal === "-" ? (
                                                  <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs flex items-center justify-between">
                                                    <span className="text-slate-500 italic text-[11px] truncate mr-2">
                                                      (Field tidak ditemukan pada dokumen {activeFile.fileName})
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 shrink-0 font-sans">
                                                      {fItem.page}
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <div className="w-full bg-slate-50/90 border border-slate-200/90 rounded-lg px-3 py-2 text-xs flex items-center justify-between">
                                                    <span className="font-mono text-slate-800 font-medium truncate mr-2">
                                                      {activeTab === "input" ? fItem.inputVal : fItem.outputVal}
                                                    </span>
                                                    <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0 font-sans">
                                                      {activeTab === "input" && (
                                                        <span className="flex items-center gap-0.5">
                                                          <span className="font-mono">⤹</span> 0
                                                        </span>
                                                      )}
                                                      <span>{fItem.page}</span>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* CARD FOOTER BAR (Done button only) */}
                      <div className="pt-2.5 flex items-center justify-end border-t border-slate-100">
                        <button
                          type="button"
                          disabled={savingStepId === step.id}
                          onClick={() => handleDoneStep(step)}
                          className={`px-4 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs ${
                            savingStepId === step.id ? "opacity-70 cursor-not-allowed" : ""
                          }`}
                        >
                          {savingStepId === step.id ? "Menyimpan..." : "Done"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Bottom Add Step Button */}
        {activeDocumentSteps.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="w-full py-2 rounded-lg border border-dashed border-slate-300 hover:border-blue-950 bg-white hover:bg-slate-50 text-slate-600 hover:text-blue-950 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <PlusIcon className="w-3 h-3 text-slate-500" />
            <span>+ Add step to {activeDocDef.label}</span>
          </button>
        )}
      </div>


      {/* MODERN SLIM MODAL "Add a new step" (Zero Emojis) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-xs font-semibold text-slate-900">Add step to {activeDocDef.label}</h3>
                <p className="text-[11px] text-slate-500">Pilih tipe aksi modifikasi data untuk dokumen ini.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 pb-1 shrink-0">
              <div className="relative">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari tipe aksi..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="px-3 py-1.5 shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {[
                  { id: "all", label: `All (${ACTION_CATALOG.length})` },
                  { id: "cleansing", label: "Cleansing" },
                  { id: "number", label: "Number & Math" },
                  { id: "text", label: "Text" },
                  { id: "date", label: "Date" },
                  { id: "validation", label: "Validation" },
                  { id: "advanced", label: "Advanced" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setModalCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      modalCategory === cat.id
                        ? "bg-blue-950 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Grid */}
            <div className="p-3 overflow-y-auto no-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredCatalog.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.type}
                      type="button"
                      onClick={() => handleAddStepFromCatalog(cat)}
                      className="p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-left transition-all flex items-start justify-between gap-2 cursor-pointer group"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-900 group-hover:text-slate-950 truncate">
                            {cat.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 leading-snug line-clamp-1 mt-0.5">
                            {cat.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRightIcon className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 shrink-0 mt-1" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
        isAlert={confirmDialog.isAlert}
      />
    </div>
  );
}
