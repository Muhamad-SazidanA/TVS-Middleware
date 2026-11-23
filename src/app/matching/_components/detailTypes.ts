import type { BoundingBox, FieldMatchStatus } from "~/types/documentComparison";
import type { MatchedItemResult } from "~/utils/canonicalMatcher";

export interface NormalizedBbox extends BoundingBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ManualNote {
  id: string;
  targetType: "field" | "line_item";
  targetKey: string;
  docCode?: string;
  detailId?: number;
  text: string;
  author?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DocumentFieldData {
  value: string;
  originalValue?: string;
  isManual?: boolean;
  isDataAction?: boolean;
  dataActionNote?: string;
  page?: number;
  bbox?: NormalizedBbox;
}

export interface BatchDocumentModel {
  id: number;
  code: string; // "PIB", "Invoice", "PL", "BL", "AK", "WL", "MS"
  name: string; // "PIB (acuan)", "Commercial Invoice (CI)", etc.
  fileName: string;
  fileUrl: string;
  fields: Record<string, DocumentFieldData>;
  lineItems: Array<Record<string, unknown>>;
  manualNotes?: ManualNote[];
  rawIsi?: unknown;
}

export interface ComparisonFieldModel {
  id: string;
  number: string;
  label: string;
  fieldName: string;
  docCode?: string; // "Invoice", "PL", "BL", "AK", "WL", "MS"
  status: FieldMatchStatus;
  isManualConfirmed?: boolean;
  manualConfirmedBy?: string;
  manualConfirmedAt?: string;
  pibValue: string;
  pibPage?: number;
  pibBbox?: NormalizedBbox;
  pibIsManual?: boolean;
  pibIsDataAction?: boolean;
  pibOriginalValue?: string;
  pibDataActionNote?: string;
  pibManualNotes?: ManualNote[];
  pibDetailId?: number;
  supportingValue: string;
  supportingPage?: number;
  supportingBbox?: NormalizedBbox;
  supportingIsManual?: boolean;
  supportingIsDataAction?: boolean;
  supportingOriginalValue?: string;
  supportingDataActionNote?: string;
  supportingManualNotes?: ManualNote[];
  supportingDetailId?: number;
  matchReason?: string;
  manualNotes?: ManualNote[];
}

export interface DocumentComparisonGroup {
  docCode: string; // "Invoice", "PL", "BL", "AK", "WL", "MS"
  docName: string; // "Invoice", "PL (Packing List)", "BL (Bill of Lading)", etc.
  supportingDoc: BatchDocumentModel;
  fields: ComparisonFieldModel[];
  matchedCount: number;
  mismatchedCount: number;
  lineItems: MatchedItemResult[];
  lineItemsMatchedCount: number;
  lineItemsMismatchedCount: number;
}

export interface BatchComparisonModel {
  id: string;
  nama: string;
  status: string;
  pib: BatchDocumentModel;
  supporting: BatchDocumentModel[];
}
