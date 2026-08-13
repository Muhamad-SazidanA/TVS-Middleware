import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { evaluateDbBatchStatus } from "../route";

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
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 });
    }

    // Evaluate live status from DB details
    const evaluatedStatus = evaluateDbBatchStatus(batch.details || [], batch.totalFile);
    const dbStatusStr = evaluatedStatus === "Matching" ? "MATCHING" : evaluatedStatus === "Mismatching" ? "MISMATCHING" : "PROSES";
    if (batch.status !== dbStatusStr) {
      batch.status = dbStatusStr;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).batch.update({
        where: { id },
        data: { status: dbStatusStr },
      }).catch((e: unknown) => console.warn("Failed async DB status update:", e));
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
      if (status === "Matching") dbStatus = "MATCHING";
      else if (status === "Mismatching") dbStatus = "MISMATCHING";
      else if (status === "Proses") dbStatus = "PROSES";
      updateData.status = dbStatus;
    }

    if (totalFile !== undefined && totalFile !== null) {
      updateData.totalFile = Number(totalFile);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedBatch = await (db as any).batch.update({
      where: { id },
      data: updateData,
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
