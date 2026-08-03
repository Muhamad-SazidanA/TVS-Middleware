import { NextResponse } from "next/server";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    if (!batchId) {
      return NextResponse.json({ error: "Missing batchId parameter" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batch: any = await (db as any).batch.findUnique({
      where: { id: batchId },
      include: {
        details: true,
      },
    });

    if (!batch) {
      return NextResponse.json({ error: `Batch not found: ${batchId}` }, { status: 404 });
    }

    // If all files in DetailBatch have fileId (request_file_id), update status to SUCCESS
    const detailsCount = (batch.details || []).length;
    const allHaveFileId = detailsCount > 0 && batch.details.every((d: any) => Boolean(d.fileId));

    if (allHaveFileId && batch.status !== "SUCCESS") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).batch.update({
          where: { id: batchId },
          data: { status: "SUCCESS" },
        });
        batch.status = "SUCCESS";
      } catch (err) {
        console.warn("Failed to update batch status to SUCCESS:", err);
      }
    } else if (!allHaveFileId && (batch.status === "PROCESSING" || batch.status === "PENDING")) {
      const TIMEOUT_MS = 5 * 60 * 1000;
      const now = Date.now();
      const batchTime = new Date(batch.updatedAt || batch.createdAt).getTime();

      if (now - batchTime > TIMEOUT_MS) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db as any).batch.update({
            where: { id: batchId },
            data: { status: "FAILED" },
          });
          batch.status = "FAILED";
        } catch (err) {
          console.warn("Failed to update batch status timeout:", err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        totalFile: batch.totalFile,
        status: batch.status,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        details: (batch.details || []).map((detail: any) => ({
          id: detail.id,
          batchId: detail.batchId,
          fileType: detail.fileType,
          fileId: detail.fileId,
          isi: detail.isi ? JSON.parse(detail.isi) : null,
          createdAt: detail.createdAt,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching batch status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
