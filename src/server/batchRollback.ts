import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { evaluateDbBatchStatus } from "~/server/matchingEngine";
import { loadServerEquivalencyGroups } from "~/server/equivalencyLoader";
import { loadServerWorkflowSteps } from "~/server/workflowLoader";
import { logSystemAudit } from "~/server/auditLogger";
import {
  getRollbackEligibility,
  type BatchRollbackTarget,
} from "~/utils/workflowStatus";

export interface RollbackSingleResult {
  batchId: string;
  previousStatus: string;
  nextStatus: string;
  target: BatchRollbackTarget;
  ownerName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  batch: any;
}

/**
 * Reverts one or more Exported/Approved batches back to Approved or User Pending Validation,
 * recording ActionLog and SystemAuditLog entries for traceability.
 */
export async function rollbackBatchesInDb(params: {
  batchIds: string[];
  target: BatchRollbackTarget;
  note?: string;
}): Promise<{
  results: RollbackSingleResult[];
  skipped: Array<{ batchId: string; reason: string }>;
}> {
  const uniqueIds = Array.from(
    new Set(params.batchIds.map((id) => String(id).trim()).filter(Boolean))
  );
  if (uniqueIds.length === 0) {
    return { results: [], skipped: [] };
  }

  const session = await auth().catch(() => null);
  const actorName = session?.user?.name || session?.user?.email || "Operator";
  const reasonText = String(params.note || "").trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batches = await (db as any).batch.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      details: true,
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batchById = new Map<string, any>(batches.map((b: any) => [b.id, b]));
  const needsEval = params.target === "USER";
  const [serverGroups, serverDataActions] = needsEval
    ? await Promise.all([loadServerEquivalencyGroups(), loadServerWorkflowSteps()])
    : [[], []];

  const results: RollbackSingleResult[] = [];
  const skipped: Array<{ batchId: string; reason: string }> = [];

  for (const id of uniqueIds) {
    const batch = batchById.get(id);
    if (!batch) {
      skipped.push({ batchId: id, reason: "Batch tidak ditemukan." });
      continue;
    }

    const prevUpper = String(batch.status || "PENDING").toUpperCase();
    const eligibility = getRollbackEligibility(prevUpper);

    if (params.target === "APPROVED" && !eligibility.canRevertToApproved) {
      skipped.push({
        batchId: id,
        reason: `Status ${prevUpper} tidak dapat dikembalikan ke Approved (hanya dari Exported).`,
      });
      continue;
    }

    if (params.target === "USER" && !eligibility.canRevertToUser) {
      skipped.push({
        batchId: id,
        reason: `Status ${prevUpper} tidak dapat dikembalikan ke workspace user (hanya dari Approved/Exported).`,
      });
      continue;
    }

    const ownerName =
      batch.createdBy?.name || batch.createdBy?.email || "User Pembuat";

    let nextStatus = "APPROVED";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if (params.target === "APPROVED") {
      nextStatus = "APPROVED";
      updateData.status = "APPROVED";
      updateData.exportedAt = null;
    } else {
      const evaluatedStatus = evaluateDbBatchStatus(
        batch.details || [],
        batch.totalFile,
        serverGroups,
        serverDataActions
      );
      nextStatus =
        evaluatedStatus === "Matching"
          ? "MATCHING"
          : evaluatedStatus === "Mismatching"
          ? "MISMATCHING"
          : "PROSES";
      updateData.status = nextStatus;
      updateData.approvedAt = null;
      updateData.approvedById = null;
      updateData.exportedAt = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedBatch = await (db as any).batch.update({
      where: { id },
      data: updateData,
      include: {
        details: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        actionLogs: { orderBy: { createdAt: "asc" } },
      },
    });

    const baseMessage =
      params.target === "APPROVED"
        ? `[Rollback] Status dikembalikan dari ${prevUpper} ke Approved (antrean All Data) oleh ${actorName}`
        : `[Rollback] Status dikembalikan dari ${prevUpper} ke Workspace ${ownerName} (${nextStatus}) oleh ${actorName}`;
    const fullNote = reasonText ? `${baseMessage} — Alasan: ${reasonText}` : baseMessage;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).actionLog.create({
        data: {
          batchId: id,
          docType: "Batch",
          docNumber: id,
          fieldName: "Status Batch",
          oldValue: prevUpper,
          newValue: nextStatus,
          notes: fullNote,
          actionBy: actorName,
        },
      });
    } catch (alErr) {
      console.warn("Failed recording rollback actionLog:", alErr);
    }

    await logSystemAudit({
      action: "UPDATE",
      category: "BATCH_DATA",
      title:
        params.target === "APPROVED"
          ? `Kembalikan Batch #${id} ke Approved`
          : `Kembalikan Batch #${id} ke ${ownerName}`,
      details: fullNote,
      metadata: {
        batchId: id,
        fromStatus: prevUpper,
        toStatus: nextStatus,
        rollbackTarget: params.target,
        ownerId: batch.createdById || null,
        ownerName,
        reason: reasonText || null,
      },
    });

    results.push({
      batchId: id,
      previousStatus: prevUpper,
      nextStatus,
      target: params.target,
      ownerName,
      batch: updatedBatch,
    });
  }

  return { results, skipped };
}
