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
 * Checks whether a serialized detail record is still awaiting OCR output.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDetailPendingOcr(d: any): boolean {
  if (!d?.isi || typeof d.isi !== "string" || d.isi.trim().length === 0) {
    return true;
  }
  try {
    const p = JSON.parse(d.isi);
    return p?.ocrPending === true;
  } catch {
    return false;
  }
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

  const hasPendingDetail =
    Array.isArray(batch.details) && batch.details.some(isDetailPendingOcr);
  if (st === "PENDING" || st === "PROSES" || hasPendingDetail) {
    return {
      blocked: true,
      httpStatus: 423,
      error:
        "Dokumen masih berstatus Pending (OCR dalam proses) dan dikunci dari pembukaan atau manipulasi.",
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
