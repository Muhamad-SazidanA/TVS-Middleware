import assert from "node:assert/strict";
import test from "node:test";
import {
  isDetailPendingOcr,
  getLockErrorForBatchRecord,
  deriveDocumentWorkflowStatus,
  canApproveBatchEvaluation,
} from "../src/utils/workflowStatus";

test("isDetailPendingOcr identifies empty isi and ocrPending flag accurately", () => {
  assert.equal(isDetailPendingOcr({ isi: "" }), true);
  assert.equal(isDetailPendingOcr({ isi: null }), true);
  assert.equal(
    isDetailPendingOcr({ isi: JSON.stringify({ ocrPending: true, fields: {} }) }),
    true
  );
  assert.equal(
    isDetailPendingOcr({
      isi: JSON.stringify({ ocrPending: false, fields: { No_Invoice: "INV-001" } }),
    }),
    false
  );
});

test("getLockErrorForBatchRecord enforces Pending (423) and Approved/Exported (403) locks", () => {
  const missing = getLockErrorForBatchRecord(null);
  assert.equal(missing.blocked, true);
  assert.equal(missing.httpStatus, 404);

  const pendingStatus = getLockErrorForBatchRecord({ status: "PENDING", details: [] });
  assert.equal(pendingStatus.blocked, true);
  assert.equal(pendingStatus.httpStatus, 423);

  const prosesStatus = getLockErrorForBatchRecord({ status: "PROSES", details: [] });
  assert.equal(prosesStatus.blocked, true);
  assert.equal(prosesStatus.httpStatus, 423);

  const partialPendingDetail = getLockErrorForBatchRecord({
    status: "MISMATCHING",
    details: [
      { isi: JSON.stringify({ fields: { No_Invoice: "1" }, ocrPending: false }) },
      { isi: JSON.stringify({ ocrPending: true }) },
    ],
  });
  assert.equal(partialPendingDetail.blocked, true);
  assert.equal(partialPendingDetail.httpStatus, 423);

  const approved = getLockErrorForBatchRecord({ status: "APPROVED", details: [] });
  assert.equal(approved.blocked, true);
  assert.equal(approved.httpStatus, 403);

  const exported = getLockErrorForBatchRecord({ status: "EXPORTED", details: [] });
  assert.equal(exported.blocked, true);
  assert.equal(exported.httpStatus, 403);

  const archived = getLockErrorForBatchRecord({ status: "ARCHIVED", details: [] });
  assert.equal(archived.blocked, true);
  assert.equal(archived.httpStatus, 403);

  const readyValidation = getLockErrorForBatchRecord({
    status: "MISMATCHING",
    details: [{ isi: JSON.stringify({ ocrPending: false, fields: { a: "1" } }) }],
  });
  assert.equal(readyValidation.blocked, false);
  assert.equal(readyValidation.httpStatus, 200);
});

test("deriveDocumentWorkflowStatus maps raw states and Approve readiness accurately", () => {
  assert.equal(
    deriveDocumentWorkflowStatus({ rawStatus: "PROSES", evaluatedStatus: "Proses" }),
    "Pending"
  );
  assert.equal(
    deriveDocumentWorkflowStatus({
      rawStatus: "MISMATCHING",
      evaluatedStatus: "Mismatching",
      hasPendingDetail: false,
    }),
    "Pending Validation"
  );
  assert.equal(
    deriveDocumentWorkflowStatus({ rawStatus: "APPROVED", evaluatedStatus: "Matching" }),
    "Approved"
  );
  assert.equal(
    deriveDocumentWorkflowStatus({ rawStatus: "EXPORTED", evaluatedStatus: "Matching" }),
    "Exported"
  );
  assert.equal(
    deriveDocumentWorkflowStatus({ rawStatus: "PENDING", errorMessage: "OCR failed" }),
    "Failed"
  );

  // Approve is blocked when mismatches remain, pending, or already approved/exported
  assert.equal(
    canApproveBatchEvaluation({
      totalFields: 12,
      mismatchedFields: 2,
      workflowStatus: "Pending Validation",
    }),
    false
  );
  assert.equal(
    canApproveBatchEvaluation({
      totalFields: 12,
      mismatchedFields: 0,
      workflowStatus: "Pending",
    }),
    false
  );
  assert.equal(
    canApproveBatchEvaluation({
      totalFields: 12,
      mismatchedFields: 0,
      workflowStatus: "Approved",
    }),
    false
  );
  assert.equal(
    canApproveBatchEvaluation({
      totalFields: 12,
      mismatchedFields: 0,
      workflowStatus: "Exported",
    }),
    false
  );
  assert.equal(
    canApproveBatchEvaluation({
      totalFields: 0,
      mismatchedFields: 0,
      workflowStatus: "Pending Validation",
    }),
    false
  );
  assert.equal(
    canApproveBatchEvaluation({
      totalFields: 12,
      mismatchedFields: 0,
      workflowStatus: "Pending Validation",
    }),
    true
  );
});
