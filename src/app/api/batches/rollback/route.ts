import { NextResponse } from "next/server";
import { rollbackBatchesInDb } from "~/server/batchRollback";
import type { BatchRollbackTarget } from "~/utils/workflowStatus";

export const dynamic = "force-dynamic";

/**
 * Bulk rollback endpoint to revert multiple Exported/Approved batches back to Approved or User Pending Validation.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const batchIds = Array.isArray(body?.batchIds)
      ? body.batchIds.map((id: unknown) => String(id).trim()).filter(Boolean)
      : [];
    const targetRaw = String(body?.target || "").toUpperCase();
    const note = typeof body?.note === "string" ? body.note : undefined;

    if (batchIds.length === 0) {
      return NextResponse.json(
        { error: "Pilih minimal 1 batch untuk dikembalikan statusnya." },
        { status: 400 }
      );
    }

    if (targetRaw !== "APPROVED" && targetRaw !== "USER") {
      return NextResponse.json(
        { error: 'Target rollback tidak valid (gunakan "APPROVED" atau "USER").' },
        { status: 400 }
      );
    }

    const target = targetRaw as BatchRollbackTarget;
    const { results, skipped } = await rollbackBatchesInDb({
      batchIds,
      target,
      note,
    });

    if (results.length === 0) {
      return NextResponse.json(
        {
          error: skipped[0]?.reason || "Tidak ada batch yang memenuhi syarat untuk dikembalikan.",
          skipped,
        },
        { status: 400 }
      );
    }

    const message =
      target === "APPROVED"
        ? `${results.length} dokumen berhasil dikembalikan ke antrean Approved.`
        : `${results.length} dokumen berhasil dikembalikan ke workspace user (Pending Validation).`;

    return NextResponse.json({
      success: true,
      message,
      revertedCount: results.length,
      skipped,
      results: results.map((r) => ({
        batchId: r.batchId,
        previousStatus: r.previousStatus,
        nextStatus: r.nextStatus,
        target: r.target,
        ownerName: r.ownerName,
      })),
    });
  } catch (err: unknown) {
    console.error("[API rollback POST] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengembalikan status batch." },
      { status: 500 }
    );
  }
}
