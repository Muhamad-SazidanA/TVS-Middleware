import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { filterCategoryData, evaluateBatchMatching } from "~/server/nanonets";
import { createBatchLog } from "~/server/logger";
import { loadServerWorkflowSteps } from "~/server/workflowLoader";
import { loadServerEquivalencyGroups } from "~/server/equivalencyLoader";
import { applyDataActionsToFields, applyDataActionsToTableRows } from "~/utils/workflowRunner";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
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

    // Mirror webhook payload to webhook.site for live inspection & testing
    const mirrorWebhookUrl = process.env.MIRROR_WEBHOOK_URL || "https://webhook.site/2b387eba-8089-4ceb-8dbe-7f496785e420";
    if (mirrorWebhookUrl) {
      fetch(mirrorWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch((err) => console.warn("[Webhook Mirror] Forwarding error:", err));
    }

    const candidateIds: string[] = [];
    const addId = (v: unknown) => {
      if (typeof v === "string" && v.trim() && !candidateIds.includes(v.trim())) {
        candidateIds.push(v.trim());
      }
    };

    // Top-level candidates
    addId(body?.request_file_id);
    addId(body?.request_id);
    addId(body?.id);
    addId(body?.file_id);
    addId(body?.input);

    // result object
    if (body?.result && !Array.isArray(body.result) && typeof body.result === "object") {
      addId(body.result.request_file_id);
      addId(body.result.request_id);
      addId(body.result.id);
      addId(body.result.file_id);
      addId(body.result.input);
    }

    // result array
    if (Array.isArray(body?.result)) {
      for (const item of body.result) {
        addId(item?.request_file_id);
        addId(item?.request_id);
        addId(item?.id);
        addId(item?.file_id);
        addId(item?.input);
      }
    }

    // summary array
    if (Array.isArray(body?.summary)) {
      for (const item of body.summary) {
        addId(item?.request_file_id);
        addId(item?.request_id);
        addId(item?.id);
        addId(item?.file_id);
      }
    }

    console.log("[Webhook] Extracted candidate IDs:", candidateIds);

    // 3. Find matching detailBatch record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detail: any = null;
    if (candidateIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detail = await (db as any).detailBatch.findFirst({
        where: { fileId: { in: candidateIds } },
        select: { id: true, batchId: true, fileId: true, fileType: true, isi: true },
      });
    }

    // Fallback 1: Match by partial ID or filename in pending detailBatches
    if (!detail && candidateIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pendingDetails = await (db as any).detailBatch.findMany({
        where: {
          OR: [{ isi: null }, { isi: "" }, { isi: { contains: '"ocrPending":true' } }],
        },
        select: { id: true, batchId: true, fileId: true, fileType: true, isi: true },
        orderBy: { createdAt: "desc" },
      });

      for (const candidate of candidateIds) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detail = pendingDetails.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d: any) =>
            d.fileId &&
            (d.fileId.toLowerCase().includes(candidate.toLowerCase()) ||
              candidate.toLowerCase().includes(d.fileId.toLowerCase()))
        );
        if (detail) break;
      }
    }

    // Fallback 2: Take oldest pending detailBatch in a PROSES batch
    if (!detail) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detail = await (db as any).detailBatch.findFirst({
        where: {
          OR: [{ isi: null }, { isi: "" }, { isi: { contains: '"ocrPending":true' } }],
          batch: {
            status: "PROSES",
          },
        },
        select: { id: true, batchId: true, fileId: true, fileType: true, isi: true },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!detail) {
      console.warn("[Webhook] No matching detailBatch found in DB.");
      return NextResponse.json({ success: false, message: "No matching detailBatch record found" }, { status: 200 });
    }

    console.log(`[Webhook] Matched detailBatch id=${detail.id}, batchId=${detail.batchId}, fileType=${detail.fileType}`);

    // STEP 3 LOG: Webhook Event Received for file
    await createBatchLog({
      batchId: detail.batchId,
      step: "OCR_WEBHOOK",
      stepNumber: 3,
      level: "SUCCESS",
      title: `Webhook Callback Diterima: ${detail.fileType}`,
      message: `Menerima payload callback dari Nanonets OCR untuk dokumen "${detail.fileType}" (ID: ${detail.fileId}).`,
      fileType: detail.fileType,
      details: { detailId: detail.id, fileId: detail.fileId, candidateIds },
    });

    // 4. Filter prediction according to detail.fileType
    const filtered = filterCategoryData(body, detail.fileType || "PIB");

    // Apply active Data Action pipeline: adds [fieldName_action] beside each field and table row
    try {
      const activeSteps = await loadServerWorkflowSteps();
      if (activeSteps.length > 0) {
        if (filtered.fields) {
          filtered.fields = applyDataActionsToFields(filtered.fields, detail.fileType || "PIB", activeSteps);
        }
        if (filtered.table && Array.isArray(filtered.table)) {
          filtered.table = applyDataActionsToTableRows(filtered.table, detail.fileType || "PIB", activeSteps);
        }
      }
    } catch (actionErr) {
      console.warn("[Webhook Data Actions] Failed to apply data actions:", actionErr);
    }

    const existingMeta: Record<string, any> = {};
    try {
      if (detail.isi) {
        const prev = JSON.parse(detail.isi);
        if (prev.fileUrl) existingMeta.fileUrl = prev.fileUrl;
        if (prev.originalFileName) existingMeta.originalFileName = prev.originalFileName;
        if (Array.isArray(prev.updateHistory) && prev.updateHistory.length > 0) {
          existingMeta.updateHistory = prev.updateHistory;
        }
      }
    } catch {
      // ignore
    }

    const jsonContent = JSON.stringify({
      ...filtered,
      ...existingMeta,
      ocrPending: false,
    });

    // 5. Update detailBatch.isi by ID!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).detailBatch.update({
      where: { id: detail.id },
      data: { isi: jsonContent },
    });

    console.log(`[Webhook DB] Successfully updated detailBatch id=${detail.id}`);

    const fieldCount = Object.keys(filtered.fields || {}).length;
    const tableCount = (filtered.table || []).length;

    // STEP 4 LOG: Data Extracted & Restructured
    await createBatchLog({
      batchId: detail.batchId,
      step: "DATA_EXTRACTED",
      stepNumber: 4,
      level: "SUCCESS",
      title: `Ekstraksi Data Kategori ${detail.fileType}`,
      message: `Berhasil mengekstrak ${fieldCount} bidang data utama dan ${tableCount} baris tabel untuk ${detail.fileType}.`,
      fileType: detail.fileType,
      details: filtered,
    });

    // 6. Check batch completeness & evaluate matching status
    const batchId = detail.batchId;
    let updatedBatchStatus: string | null = null;

    if (batchId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const batch = await (db as any).batch.findUnique({
        where: { id: batchId },
        include: { details: true },
      });

      if (batch && Array.isArray(batch.details)) {
        const filledDetails = batch.details.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d: any) => {
            if (typeof d.isi !== "string" || !d.isi.trim().length) return false;
            try {
              const p = JSON.parse(d.isi);
              if (p?.ocrPending === true) return false;
            } catch {
              // keep non-JSON string as filled
            }
            return true;
          }
        );

        const isComplete =
          batch.details.length >= (batch.totalFile || 1) &&
          filledDetails.length === batch.details.length;

        if (isComplete) {
          const [serverGroups, serverDataActions] = await Promise.all([
            loadServerEquivalencyGroups(),
            loadServerWorkflowSteps(),
          ]);
          const matchResult = evaluateBatchMatching(
            batch.details,
            serverGroups,
            serverDataActions
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db as any).batch.update({
            where: { id: batchId },
            data: { status: matchResult },
          });
          updatedBatchStatus = matchResult;
          console.log(`[Webhook] Batch #${batchId} status updated to ${matchResult}`);

          // STEP 5 LOG: Matching Cross-Check Evaluated
          await createBatchLog({
            batchId,
            step: "MATCHING_EVAL",
            stepNumber: 5,
            level: matchResult === "MATCHING" ? "SUCCESS" : "WARNING",
            title: "Evaluasi Pencocokan Seluruh Dokumen",
            message: `Seluruh dokumen pendukung selesai diolah. Hasil evaluasi cross-check: ${matchResult}.`,
            details: { status: matchResult, totalFilesProcessed: filledDetails.length },
          });

          // STEP 6 LOG: Data Sempurna (Completion)
          await createBatchLog({
            batchId,
            step: "COMPLETED",
            stepNumber: 6,
            level: matchResult === "MATCHING" ? "SUCCESS" : "WARNING",
            title: "Data Sempurna",
            message: `Pemrosesan batch #${batchId} telah rampung sempurna. Seluruh data siap diverifikasi dan diekspor.`,
            details: { status: matchResult },
          });
        } else {
          // STEP 5 LOG Partial Progress
          await createBatchLog({
            batchId,
            step: "MATCHING_EVAL",
            stepNumber: 5,
            level: "INFO",
            title: "Progres Evaluasi Batch",
            message: `Dokumen ${detail.fileType} selesai (${filledDetails.length}/${batch.totalFile || batch.details.length} file terisi). Menunggu sisa dokumen.`,
            details: { filledCount: filledDetails.length, totalFiles: batch.totalFile },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Webhook processed and batch updated successfully",
      detailId: detail.id,
      batchId,
      batchStatus: updatedBatchStatus,
    });
  } catch (error: unknown) {
    console.error("[Webhook] Error processing:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 200 });
  }
}

