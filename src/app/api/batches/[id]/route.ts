import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { evaluateDbBatchStatus } from "~/server/matchingEngine";
import { loadServerEquivalencyGroups } from "~/server/equivalencyLoader";
import { loadServerWorkflowSteps } from "~/server/workflowLoader";
import { evaluateBatchComparison } from "~/app/matching/_components/detailAdapter";
import { getLockErrorForBatchRecord } from "~/server/batchGuards";
import { hasIncompleteBatchDetails } from "~/utils/workflowStatus";

export const dynamic = "force-dynamic";

// 1. GET SINGLE BATCH DETAIL
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batch = await (db as any).batch.findUnique({
      where: { id },
      include: {
        details: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        actionLogs: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 });
    }

    // Evaluate live status from DB details unless explicitly approved, exported, or rejected
    const url = new URL(req.url);
    const shouldRevalidate = url.searchParams.get("revalidate") === "true";
    const isLocked =
      batch.status === "APPROVED" ||
      batch.status === "EXPORTED" ||
      batch.status === "ARCHIVED" ||
      batch.status === "DITOLAK";

    if (!isLocked || shouldRevalidate) {
      const [serverGroups, serverDataActions] = await Promise.all([
        loadServerEquivalencyGroups(),
        loadServerWorkflowSteps(),
      ]);
      const evaluatedStatus = evaluateDbBatchStatus(
        batch.details || [],
        batch.totalFile,
        serverGroups,
        serverDataActions
      );
      const dbStatusStr = evaluatedStatus === "Matching" ? "MATCHING" : evaluatedStatus === "Mismatching" ? "MISMATCHING" : "PROSES";
      if (batch.status !== dbStatusStr) {
        batch.status = dbStatusStr;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db as any).batch.update({
          where: { id },
          data: { status: dbStatusStr },
        }).catch((e: unknown) => console.warn("Failed async DB status update:", e));
      }
    }

    if (!isLocked) {
      const hasIncomplete = hasIncompleteBatchDetails(batch);
      if (hasIncomplete || batch.status === "PENDING" || batch.status === "PROSES") {
        return NextResponse.json(
          {
            error:
              "Dokumen masih berstatus Pending (data OCR Nanonets belum lengkap) dan dikunci dari pembukaan.",
            workflowStatus: "Pending",
          },
          { status: 423 }
        );
      }
    }

    return NextResponse.json({ success: true, batch });
  } catch (error: unknown) {
    console.error("Error fetching single batch:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

// 2. UPDATE BATCH STATUS / TOTALFILE (PUT)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, totalFile } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    let approvalActorName = "Operator";
    let isApprovingBatch = false;

    if (status) {
      let dbStatus = status;
      if (status === "Matching" || status === "APPROVED" || status === "Approved") {
        dbStatus = "APPROVED";
        isApprovingBatch = true;
        const session = await auth();
        approvalActorName = session?.user?.name || session?.user?.email || "Operator";
        updateData.approvedAt = new Date();
        if (session?.user?.id) {
          updateData.approvedById = session.user.id;
        }
      } else if (status === "Mismatching" || status === "MISMATCHING") {
        dbStatus = "MISMATCHING";
      } else if (status === "Proses" || status === "PROSES") {
        dbStatus = "PROSES";
      } else if (status === "DRAFT" || status === "Draft") {
        dbStatus = "DRAFT";
      } else if (status === "PENDING" || status === "Pending") {
        dbStatus = "PENDING";
      }
      updateData.status = dbStatus;
    }

    if (totalFile !== undefined && totalFile !== null) {
      updateData.totalFile = Number(totalFile);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prevBatch = await (db as any).batch.findUnique({
      where: { id },
      include: { details: true },
    });

    if (!prevBatch) {
      return NextResponse.json({ error: "Batch tidak ditemukan." }, { status: 404 });
    }

    const prevUpper = String(prevBatch.status || "").toUpperCase();
    const isRequestedExported =
      String(status || "").toUpperCase() === "EXPORTED" ||
      String(status || "").toUpperCase() === "ARCHIVED";

    if (prevUpper === "EXPORTED" || prevUpper === "ARCHIVED") {
      return NextResponse.json(
        { error: "Dokumen sudah berstatus Exported (arsip read-only) dan tidak dapat diubah." },
        { status: 403 }
      );
    }

    if (prevUpper === "APPROVED" && status && !isRequestedExported) {
      return NextResponse.json(
        {
          error:
            "Dokumen sudah berstatus Approved (read-only) dan tidak dapat dimanipulasi.",
        },
        { status: 403 }
      );
    }

    let approvedMismatchCount = 0;

    if (isApprovingBatch) {
      const lockCheck = getLockErrorForBatchRecord(prevBatch);
      if (lockCheck.blocked) {
        return NextResponse.json(
          { error: lockCheck.error },
          { status: lockCheck.httpStatus }
        );
      }

      const [serverGroups, serverDataActions] = await Promise.all([
        loadServerEquivalencyGroups(),
        loadServerWorkflowSteps(),
      ]);
      const evalResult = evaluateBatchComparison(prevBatch, serverGroups, serverDataActions);
      if (evalResult.totalFields === 0) {
        return NextResponse.json(
          { error: "Belum ada komponen pencocokan yang siap untuk di-Approve." },
          { status: 400 }
        );
      }

      approvedMismatchCount = evalResult.mismatchedFields;
    }

    if (status === "EXPORTED" || status === "Exported") {
      updateData.status = "EXPORTED";
      updateData.exportedAt = new Date();
    }

    if (isApprovingBatch && prevBatch.status !== "APPROVED") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).actionLog.create({
          data: {
            batchId: id,
            docType: "Batch",
            docNumber: id,
            fieldName: "Status Batch",
            oldValue: prevBatch.status || "MISMATCHING",
            newValue: "APPROVED",
            notes:
              approvedMismatchCount > 0
                ? `[Approve] Dokumen disetujui (${approvedMismatchCount} field mismatch tercatat) & dipindahkan ke antrean All Data oleh ${approvalActorName}`
                : `[Approve] Dokumen disetujui & dipindahkan ke antrean All Data oleh ${approvalActorName}`,
            actionBy: approvalActorName,
          },
        });
      } catch (alErr) {
        console.warn("Failed recording batch approval actionLog:", alErr);
      }
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

    return NextResponse.json({
      success: true,
      message: "Batch berhasil diperbarui",
      batch: updatedBatch,
    });
  } catch (error: unknown) {
    console.error("Error updating batch:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui batch di database" },
      { status: 500 }
    );
  }
}

// 3. DELETE SINGLE BATCH (DELETE)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).batch.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Batch #${id} berhasil dihapus dari database`,
    });
  } catch (error: unknown) {
    console.error("Error deleting single batch:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus batch dari database" },
      { status: 500 }
    );
  }
}
