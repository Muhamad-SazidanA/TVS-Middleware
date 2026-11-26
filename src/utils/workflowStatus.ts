export type DocumentWorkflowStatus =
  | "Pending"
  | "Pending Validation"
  | "Approved"
  | "Exported"
  | "Failed";

export interface BatchLockCheckResult {
  blocked: boolean;
  httpStatus: number;
  error: string;
}

/**
 * Checks whether parsed OCR JSON contains any non-empty extracted header field or table row.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasExtractedDetailContent(parsed: any): boolean {
  const fieldsObj =
    parsed?.fields && typeof parsed.fields === "object"
      ? (parsed.fields as Record<string, unknown>)
      : {};
  const hasFieldValue = Object.values(fieldsObj).some((val) => {
    const raw =
      val && typeof val === "object" && "value" in val
        ? (val as { value?: unknown }).value
        : val;
    if (raw === undefined || raw === null) return false;
    const str = String(raw).trim();
    return str !== "" && str !== "-";
  });
  const hasTableRows = Array.isArray(parsed?.table) && parsed.table.length > 0;
  return hasFieldValue || hasTableRows;
}

/**
 * Checks whether a serialized detail record is still awaiting Nanonets OCR output.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDetailPendingOcr(d: any): boolean {
  if (!d?.isi || typeof d.isi !== "string" || d.isi.trim().length === 0) {
    return true;
  }
  try {
    const p = JSON.parse(d.isi);
    if (p?.ocrPending === true) return true;
    if (p?.ocrError) return false;
    if (p?.ocrPending === false) return false;
    // Empty placeholder JSON (e.g., pre-initialized before Nanonets webhook callback) counts as pending
    return !hasExtractedDetailContent(p);
  } catch {
    return false;
  }
}

/**
 * Identifies whether a detail record's fileType represents the primary PIB reference document.
 */
export function isPibDetailType(fileType?: string | null): boolean {
  const ft = String(fileType || "").trim().toLowerCase();
  return ft === "pib" || ft.includes("file acuan") || ft.startsWith("pib");
}

/**
 * Checks whether a batch is still incomplete: fewer details received than uploaded totalFile,
 * missing/pending PIB reference document, or any detail record still awaiting Nanonets OCR.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasIncompleteBatchDetails(batch: any): boolean {
  if (!batch) return true;
  const details = Array.isArray(batch.details) ? batch.details : [];
  if (details.length === 0) return true;

  const expectedTotal = Number(batch.totalFile || 0);
  if (expectedTotal > 0 && details.length < expectedTotal) {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (details.some((d: any) => isDetailPendingOcr(d))) {
    return true;
  }

  // When details carry fileType metadata, require the primary PIB document to be present and OCR-complete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasTypedDetails = details.some((d: any) => typeof d?.fileType === "string" && d.fileType.trim().length > 0);
  if (hasTypedDetails) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pibDetail = details.find((d: any) => isPibDetailType(d?.fileType));
    if (!pibDetail || isDetailPendingOcr(pibDetail)) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates server mutation lock rules for a batch record based on its status and details.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLockErrorForBatchRecord(batch: any): BatchLockCheckResult {
  if (!batch) {
    return { blocked: true, httpStatus: 404, error: "Batch tidak ditemukan." };
  }

  const st = String(batch.status || "").toUpperCase();
  if (st === "EXPORTED" || st === "ARCHIVED") {
    return {
      blocked: true,
      httpStatus: 403,
      error: "Dokumen sudah berstatus Exported (arsip read-only) dan tidak dapat dimanipulasi.",
    };
  }

  if (st === "APPROVED") {
    return {
      blocked: true,
      httpStatus: 403,
      error: "Dokumen sudah berstatus Approved (read-only) dan tidak dapat dimanipulasi.",
    };
  }

  if (st === "PENDING" || st === "PROSES" || hasIncompleteBatchDetails(batch)) {
    return {
      blocked: true,
      httpStatus: 423,
      error:
        "Dokumen masih berstatus Pending (menunggu kelengkapan data OCR Nanonets) dan dikunci dari pembukaan atau manipulasi.",
    };
  }

  return { blocked: false, httpStatus: 200, error: "" };
}

/**
 * Normalizes raw database/evaluation states into the canonical UI workflow status.
 */
export function deriveDocumentWorkflowStatus(params: {
  rawStatus?: string | null;
  evaluatedStatus?: string | null;
  errorMessage?: string | null;
  hasPendingDetail?: boolean;
  hasIncompleteDetails?: boolean;
}): DocumentWorkflowStatus {
  const rawUpper = String(params.rawStatus || "PENDING").toUpperCase();
  const hasErr = Boolean(params.errorMessage && String(params.errorMessage).trim());

  if (
    hasErr ||
    rawUpper === "FAILED" ||
    rawUpper === "ERROR" ||
    rawUpper === "DITOLAK" ||
    rawUpper === "REJECTED"
  ) {
    return "Failed";
  }

  if (rawUpper === "EXPORTED" || rawUpper === "ARCHIVED") {
    return "Exported";
  }

  if (rawUpper === "APPROVED") {
    return "Approved";
  }

  if (
    params.hasPendingDetail ||
    params.hasIncompleteDetails ||
    params.evaluatedStatus === "Proses" ||
    rawUpper === "PENDING" ||
    rawUpper === "PROSES"
  ) {
    return "Pending";
  }

  return "Pending Validation";
}

/**
 * Enforces the UI/API rule that Approve is only allowed once OCR is finished and 0 mismatches remain.
 */
export function canApproveBatchEvaluation(params: {
  totalFields: number;
  mismatchedFields: number;
  workflowStatus: DocumentWorkflowStatus;
}): boolean {
  return (
    params.workflowStatus === "Pending Validation" &&
    params.totalFields > 0 &&
    params.mismatchedFields === 0
  );
}
