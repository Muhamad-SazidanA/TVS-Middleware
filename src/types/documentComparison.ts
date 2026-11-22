export interface BoundingBox {
  page: number; // 1-indexed page number
  x: number; // 0-100 percentage from left
  y: number; // 0-100 percentage from top
  width: number; // 0-100 percentage width
  height: number; // 0-100 percentage height
}

export type FieldMatchStatus = "MATCH" | "MISMATCH" | "NEUTRAL";

export interface ComparisonField {
  id: string;
  number: string;
  label: string;
  status: FieldMatchStatus;
  pibValue: string;
  pembandingValue: string;
  matchReason?: string;
  isManualLeft?: boolean;
  isManualRight?: boolean;
  pibBbox?: BoundingBox;
  pembandingBbox?: BoundingBox;
  noteLeft?: string;
  noteRight?: string;
  fieldName?: string;
  category?: string;
  detailIdLeft?: number;
  detailIdRight?: number;
  tableIndexLeft?: number;
  tableIndexRight?: number;
}

