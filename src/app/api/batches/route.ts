import { NextResponse } from "next/server";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

// 1. READ ALL BATCHES (GET)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase() || "";
    const statusFilter = searchParams.get("status") || "ALL";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawBatches: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rawBatches = await (db as any).batch.findMany({
        include: {
          details: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (dbErr) {
      console.warn("Error querying database for batches:", dbErr);
      rawBatches = [];
    }

    // Process and format batches
    const formattedBatches = rawBatches.map((batch: any, index: number) => {
      // Find PIB detail or identity information from detail_batches
      const pibDetail = (batch.details || []).find(
        (d: any) => d.fileType === "PIB" || d.fileType?.toLowerCase()?.includes("pib")
      );

      let pibName = `Batch #${batch.id}`;
      let pibSubtext = "";

      if (pibDetail?.isi) {
        try {
          const parsed = typeof pibDetail.isi === "string" ? JSON.parse(pibDetail.isi) : pibDetail.isi;
          const resultData = parsed?.result?.[0]?.prediction || parsed?.prediction || parsed;

          const noAju =
            resultData?.no_aju?.value ||
            resultData?.nomor_aju?.value ||
            resultData?.no_pib?.value ||
            resultData?.nomor_pib?.value ||
            parsed?.no_aju ||
            parsed?.nomor_pib;

          const importir =
            resultData?.nama_importir?.value ||
            resultData?.importir?.value ||
            parsed?.nama_importir;

          if (noAju) {
            pibName = `PIB ${noAju}`;
            if (importir) pibSubtext = String(importir);
          } else if (importir) {
            pibName = `PIB ${importir}`;
          }
        } catch {
          // Fallback if JSON parse fails
        }
      }

      if (!pibSubtext) {
        const fileCountStr = `${batch.totalFile || (batch.details || []).length} file pendukung`;
        pibSubtext = batch.createdAt
          ? `${fileCountStr} • ${new Date(batch.createdAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}`
          : fileCountStr;
      }

      // Normalize status to exactly 3 values: Matching, Mismatching, Proses
      let normalizedStatus: "Matching" | "Mismatching" | "Proses" = "Proses";
      const rawStatusStr = String(batch.status || "").toUpperCase();

      if (rawStatusStr === "MATCHING" || rawStatusStr === "SUCCESS" || rawStatusStr === "MATCHED") {
        normalizedStatus = "Matching";
      } else if (rawStatusStr === "MISMATCHING" || rawStatusStr === "FAILED" || rawStatusStr === "MISMATCHED") {
        normalizedStatus = "Mismatching";
      } else {
        normalizedStatus = "Proses";
      }

      return {
        id: batch.id,
        no: index + 1,
        nama: pibName,
        subtext: pibSubtext,
        totalFile: batch.totalFile || (batch.details || []).length || 0,
        status: normalizedStatus,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        details: batch.details || [],
      };
    });

    // Filter search
    let filteredBatches = formattedBatches;
    if (search) {
      filteredBatches = filteredBatches.filter(
        (b) =>
          b.nama.toLowerCase().includes(search) ||
          b.id.toLowerCase().includes(search) ||
          b.subtext.toLowerCase().includes(search)
      );
    }

    // Filter status
    if (statusFilter && statusFilter.toUpperCase() !== "ALL") {
      const targetStatus =
        statusFilter.toUpperCase() === "MATCHING"
          ? "Matching"
          : statusFilter.toUpperCase() === "MISMATCHING"
          ? "Mismatching"
          : "Proses";
      filteredBatches = filteredBatches.filter((b) => b.status === targetStatus);
    }

    return NextResponse.json({
      success: true,
      batches: filteredBatches,
      total: filteredBatches.length,
    });
  } catch (error: unknown) {
    console.error("Error in GET /api/batches:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error", batches: [] },
      { status: 500 }
    );
  }
}

// 2. CREATE A NEW BATCH (POST)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, totalFile, status } = body;

    let newBatchId = id;
    if (!newBatchId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await (db as any).batch.count();
      newBatchId = String(count + 1).padStart(4, "0");
    }

    // Normalize status for DB
    let dbStatus = "PROSES";
    if (status === "Matching") dbStatus = "MATCHING";
    else if (status === "Mismatching") dbStatus = "MISMATCHING";
    else if (status === "Proses") dbStatus = "PROSES";
    else dbStatus = status || "PROSES";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createdBatch = await (db as any).batch.create({
      data: {
        id: newBatchId,
        totalFile: Number(totalFile) || 0,
        status: dbStatus,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Batch berhasil dibuat",
      batch: createdBatch,
    });
  } catch (error: unknown) {
    console.error("Error in POST /api/batches:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat batch di database" },
      { status: 500 }
    );
  }
}

// 3. BULK DELETE BATCHES (DELETE)
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Array of batch IDs required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deleteResult = await (db as any).batch.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count} batch berhasil dihapus dari database`,
      deletedCount: deleteResult.count,
    });
  } catch (error: unknown) {
    console.error("Error in DELETE /api/batches:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus batch dari database" },
      { status: 500 }
    );
  }
}
