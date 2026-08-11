import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { filterCategoryData, evaluateBatchMatching } from "~/server/nanonets";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1. Parse JSON body dari Nanonets
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      const text = await req.text();
      try { body = JSON.parse(text); } catch { body = null; }
    }

    if (!body) {
      return NextResponse.json({ success: false, message: "Empty body" }, { status: 200 });
    }

    // 2. Kumpulkan semua kandidat request_file_id dari webhook body
    const candidateIds: string[] = [];
    const addId = (v: unknown) => {
      if (typeof v === "string" && v.trim() && !candidateIds.includes(v.trim())) {
        candidateIds.push(v.trim());
      }
    };

    // Top-level
    addId(body?.request_file_id);
    addId(body?.request_id);
    addId(body?.id);

    // result as OBJECT (actual webhook POST format)
    if (body?.result && !Array.isArray(body.result) && typeof body.result === "object") {
      addId(body.result.request_file_id);
      addId(body.result.request_id);
      addId(body.result.id);
    }

    // result as ARRAY (GET API format)
    if (Array.isArray(body?.result)) {
      for (const item of body.result) {
        addId(item?.request_file_id);
        addId(item?.request_id);
        addId(item?.id);
      }
    }

    console.log("[Webhook] Candidate IDs:", candidateIds);

    if (candidateIds.length === 0) {
      console.warn("[Webhook] No IDs found. body keys:", Object.keys(body));
      return NextResponse.json({ success: false, message: "No IDs found in webhook body" }, { status: 200 });
    }

    // 3. Cari record di detail_batches yang fileId cocok dengan salah satu kandidat ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = await (db as any).detailBatch.findFirst({
      where: { fileId: { in: candidateIds } },
      select: { id: true, batchId: true, fileId: true, fileType: true },
    });

    console.log("[Webhook] Matched detail:", detail
      ? `id=${detail.id} batchId=${detail.batchId} fileId=${detail.fileId} fileType=${detail.fileType}`
      : `NOT FOUND (candidates: ${candidateIds.join(", ")})`
    );

    // 4. Filter prediction → minimal { fields, table }
    const filtered = filterCategoryData(body, detail?.fileType ?? "PIB");
    const jsonContent = JSON.stringify(filtered);

    // 5. Update detail_batches.isi
    const targetFileId = detail?.fileId ? detail.fileId : candidateIds[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateRes = await (db as any).detailBatch.updateMany({
      where: {
        fileId: detail?.fileId ? detail.fileId : { in: candidateIds },
      },
      data: { isi: jsonContent },
    });

    console.log(`[Webhook DB] updated=${updateRes.count} rows for fileId="${targetFileId}"`);

    // 6. Cek kelengkapan Batch & hitung status MATCHING / MISMATCHING otomatis
    const batchId = detail?.batchId;
    let batchStatusUpdated: string | null = null;

    if (batchId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const batch = await (db as any).batch.findUnique({
        where: { id: batchId },
        include: { details: true },
      });

      if (batch && Array.isArray(batch.details)) {
        const completedDetails = batch.details.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d: any) => typeof d.isi === "string" && d.isi.trim().length > 0
        );

        const isBatchComplete =
          batch.details.length >= (batch.totalFile || 1) &&
          completedDetails.length === batch.details.length;

        if (isBatchComplete) {
          // Evaluasi matching lintas file dalam 1 batch
          const matchResult = evaluateBatchMatching(batch.details);

          // Update status batch di MySQL (MATCHING / MISMATCHING)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db as any).batch.update({
            where: { id: batchId },
            data: { status: matchResult },
          });

          batchStatusUpdated = matchResult;
          console.log(`[Batch Status Update] Batch #${batchId} COMPLETED (${completedDetails.length}/${batch.totalFile}). Status updated to "${matchResult}".`);
        } else {
          console.log(`[Batch Progress] Batch #${batchId} status remains PROSES (${completedDetails.length}/${batch.totalFile || batch.details.length} files filled).`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
      matchedFileId: targetFileId,
      updatedCount: updateRes.count,
      batchId: batchId || null,
      batchStatus: batchStatusUpdated,
    });
  } catch (error: unknown) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 200 });
  }
}
