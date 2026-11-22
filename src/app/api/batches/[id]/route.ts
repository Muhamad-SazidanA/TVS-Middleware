import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { evaluateDbBatchStatus } from "~/server/matchingEngine";
import { loadServerEquivalencyGroups } from "~/server/equivalencyLoader";

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

    // Evaluate live status from DB details only if batch is still in processing state or requested via revalidate
    const url = new URL(req.url);
    const shouldRevalidate = url.searchParams.get("revalidate") === "true";
    const isProcessing = !batch.status || batch.status === "PROSES" || batch.status === "Proses" || batch.status === "Pending";

    if (isProcessing || shouldRevalidate) {
      const serverGroups = await loadServerEquivalencyGroups();
      const evaluatedStatus = evaluateDbBatchStatus(batch.details || [], batch.totalFile, serverGroups);
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

    if (status) {
      let dbStatus = status;
      if (status === "Matching" || status === "APPROVED" || status === "Approved") {
        dbStatus = "APPROVED";
        const session = await auth();
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
