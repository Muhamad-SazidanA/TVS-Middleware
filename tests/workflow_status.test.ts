import assert from "node:assert/strict";
import test from "node:test";
import {
  isDetailPendingOcr,
  hasIncompleteBatchDetails,
  getLockErrorForBatchRecord,
  deriveDocumentWorkflowStatus,
  canApproveBatchEvaluation,
  getRollbackEligibility,
} from "../src/utils/workflowStatus";
import { evaluateBatchComparison } from "../src/app/matching/_components/detailAdapter";

test("isDetailPendingOcr identifies empty isi, legacy placeholders, and ocrPending flag accurately", () => {
  assert.equal(isDetailPendingOcr({ isi: "" }), true);
  assert.equal(isDetailPendingOcr({ isi: null }), true);
  assert.equal(
    isDetailPendingOcr({ isi: JSON.stringify({ ocrPending: true, fields: {} }) }),
    true
  );
  // Pre-initialized placeholder without ocrPending flag and zero extracted fields/table rows
  assert.equal(
    isDetailPendingOcr({
      isi: JSON.stringify({ fields: {}, table: [], fileUrl: "/uploads/a.pdf", originalFileName: "a.pdf" }),
    }),
    true
  );
  assert.equal(
    isDetailPendingOcr({
      isi: JSON.stringify({ ocrPending: false, fields: {}, table: [] }),
    }),
    false
  );
  assert.equal(
    isDetailPendingOcr({
      isi: JSON.stringify({ fields: {}, table: [], ocrError: "Timeout" }),
    }),
    false
  );
  assert.equal(
    isDetailPendingOcr({
      isi: JSON.stringify({ ocrPending: false, fields: { No_Invoice: "INV-001" } }),
    }),
    false
  );
});

test("hasIncompleteBatchDetails rejects partial uploads, missing PIB, and unreceived Nanonets webhooks", () => {
  assert.equal(hasIncompleteBatchDetails({ totalFile: 2, details: [] }), true);

  // 2 of 3 uploaded files arrived, 3rd still missing
  assert.equal(
    hasIncompleteBatchDetails({
      totalFile: 3,
      details: [
        { fileType: "PIB", isi: JSON.stringify({ ocrPending: false, fields: { No_Invoice: "INV-1" } }) },
        { fileType: "Invoice", isi: JSON.stringify({ ocrPending: false, fields: { No_Invoice: "INV-1" } }) },
      ],
    }),
    true
  );

  // Total count matches, but primary PIB document is absent
  assert.equal(
    hasIncompleteBatchDetails({
      totalFile: 2,
      details: [
        { fileType: "Invoice", isi: JSON.stringify({ ocrPending: false, fields: { No_Invoice: "INV-1" } }) },
        { fileType: "Bill of Lading", isi: JSON.stringify({ ocrPending: false, fields: { No_BL: "BL-1" } }) },
      ],
    }),
    true
  );

  // All files present with PIB complete, but 1 supporting doc is still ocrPending
  assert.equal(
    hasIncompleteBatchDetails({
      totalFile: 2,
      details: [
        { fileType: "PIB", isi: JSON.stringify({ ocrPending: false, fields: { No_Invoice: "INV-1" } }) },
        { fileType: "Invoice", isi: JSON.stringify({ ocrPending: true, fields: {} }) },
      ],
    }),
    true
  );

  // Complete batch: totalFile matches, PIB + supporting doc finished OCR
  assert.equal(
    hasIncompleteBatchDetails({
      totalFile: 2,
      details: [
        { fileType: "PIB", isi: JSON.stringify({ ocrPending: false, fields: { No_Invoice: "INV-1" } }) },
        { fileType: "Invoice", isi: JSON.stringify({ ocrPending: false, fields: { No_Invoice: "INV-1" } }) },
      ],
    }),
    false
  );
});

test("getLockErrorForBatchRecord enforces Pending (423) on incomplete Nanonets batches and Approved/Exported (403) locks", () => {
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

  const partialCountMismatch = getLockErrorForBatchRecord({
    status: "MATCHING",
    totalFile: 3,
    details: [
      { fileType: "PIB", isi: JSON.stringify({ fields: { No_Invoice: "INV-1" }, ocrPending: false }) },
      { fileType: "Invoice", isi: JSON.stringify({ fields: { No_Invoice: "INV-1" }, ocrPending: false }) },
    ],
  });
  assert.equal(partialCountMismatch.blocked, true);
  assert.equal(partialCountMismatch.httpStatus, 423);

  const missingPibLock = getLockErrorForBatchRecord({
    status: "MISMATCHING",
    totalFile: 1,
    details: [
      { fileType: "Invoice", isi: JSON.stringify({ fields: { No_Invoice: "INV-1" }, ocrPending: false }) },
    ],
  });
  assert.equal(missingPibLock.blocked, true);
  assert.equal(missingPibLock.httpStatus, 423);

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

test("evaluateBatchComparison keeps partial/incomplete Nanonets batches in Proses instead of Matching/Mismatching", () => {
  const partialBatch = evaluateBatchComparison({
    totalFile: 3,
    details: [
      {
        id: 1,
        fileType: "PIB",
        isi: JSON.stringify({ ocrPending: false, fields: { No_Invoice: "INV-001" } }),
      },
      {
        id: 2,
        fileType: "Invoice",
        isi: JSON.stringify({ ocrPending: false, fields: { No_Invoice: "INV-001" } }),
      },
    ],
  });
  assert.equal(partialBatch.status, "Proses");

  const pendingPibBatch = evaluateBatchComparison({
    totalFile: 2,
    details: [
      {
        id: 1,
        fileType: "PIB",
        isi: JSON.stringify({ ocrPending: true, fields: {} }),
      },
      {
        id: 2,
        fileType: "Invoice",
        isi: JSON.stringify({ ocrPending: false, fields: { No_Invoice: "INV-001" } }),
      },
    ],
  });
  assert.equal(pendingPibBatch.status, "Proses");
  assert.equal(pendingPibBatch.docStatuses.Invoice?.status, "Proses");
});

test("deriveDocumentWorkflowStatus maps raw states, incomplete details, and Approve readiness accurately", () => {
  assert.equal(
    deriveDocumentWorkflowStatus({ rawStatus: "PROSES", evaluatedStatus: "Proses" }),
    "Pending"
  );
  assert.equal(
    deriveDocumentWorkflowStatus({
      rawStatus: "MISMATCHING",
      evaluatedStatus: "Mismatching",
      hasIncompleteDetails: true,
    }),
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

  // Approve is allowed when mismatches remain once OCR completes, but blocked when pending, empty, or already approved/exported
  assert.equal(
    canApproveBatchEvaluation({
      totalFields: 12,
      mismatchedFields: 4,
      workflowStatus: "Pending Validation",
    }),
    true
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

test("getRollbackEligibility enforces Exported -> Approved/User and Approved -> User transitions", () => {
  assert.deepEqual(getRollbackEligibility("EXPORTED"), {
    canRevertToApproved: true,
    canRevertToUser: true,
  });
  assert.deepEqual(getRollbackEligibility("ARCHIVED"), {
    canRevertToApproved: true,
    canRevertToUser: true,
  });
  assert.deepEqual(getRollbackEligibility("APPROVED"), {
    canRevertToApproved: false,
    canRevertToUser: true,
  });
  assert.deepEqual(getRollbackEligibility("MATCHING"), {
    canRevertToApproved: false,
    canRevertToUser: false,
  });
  assert.deepEqual(getRollbackEligibility("PENDING"), {
    canRevertToApproved: false,
    canRevertToUser: false,
  });
});
