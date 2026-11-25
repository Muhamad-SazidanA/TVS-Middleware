import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { createBatchLog } from "~/server/logger";
import { logSystemAudit } from "~/server/auditLogger";
import { evaluateBatchMatching } from "~/server/nanonets";
import { loadServerEquivalencyGroups } from "~/server/equivalencyLoader";
import {
  getCategoryConfigByInput,
  normalizeCategoryCode,
} from "~/config/documentCategories";
import {
  saveBatchPdfFile,
  cleanupOrphanBatchPdf,
  dispatchSingleDocumentToNanonets,
} from "~/server/batchDocumentProcessor";
import type { DocumentUpdateRecord } from "~/app/matching/_components/detailTypes";

export const dynamic = "force-dynamic";

function parseDetailMeta(isi?: string | null): {
  fileUrl?: string;
  originalFileName?: string;
  updateHistory: DocumentUpdateRecord[];
  ocrPending?: boolean;
} {
  if (!isi) return { updateHistory: [] };
  try {
    const parsed = typeof isi === "string" ? JSON.parse(isi) : isi;
    return {
      fileUrl: typeof parsed?.fileUrl === "string" ? parsed.fileUrl : undefined,
      originalFileName:
        typeof parsed?.originalFileName === "string"
          ? parsed.originalFileName
          : undefined,
      updateHistory: Array.isArray(parsed?.updateHistory)
        ? parsed.updateHistory
        : [],
      ocrPending: parsed?.ocrPending === true,
    };
  } catch {
    return { updateHistory: [] };
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    if (!batchId) {
      return NextResponse.json(
        { error: "Batch ID wajib diisi." },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batch = await (db as any).batch.findUnique({
      where: { id: batchId },
      include: { details: true },
    });

    if (!batch) {
      return NextResponse.json(
        { error: "Batch tidak ditemukan." },
        { status: 404 }
      );
    }

    if (batch.status === "APPROVED") {
      return NextResponse.json(
        {
          error:
            "Batch sudah disetujui (APPROVED) dan dikunci dari perubahan dokumen.",
        },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const categoryInput = String(formData.get("category") || "").trim();
    const detailIdRaw = formData.get("detailId");
    const targetDetailId =
      detailIdRaw && String(detailIdRaw).trim() !== ""
        ? Number(detailIdRaw)
        : null;

    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "File PDF wajib dipilih dan tidak boleh kosong." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Hanya file berformat PDF yang didukung." },
        { status: 400 }
      );
    }

    if (!categoryInput) {
      return NextResponse.json(
        { error: "Kategori dokumen wajib dipilih." },
        { status: 400 }
      );
    }

    const categoryConfig = getCategoryConfigByInput(categoryInput);
    const existingDetails: Array<{
      id: number;
      fileType: string;
      fileId: string;
      isi?: string | null;
    }> = Array.isArray(batch.details) ? batch.details : [];

    // Locate target detail if replacing an existing document:
    // 1) explicit detailId; or 2) single-file category that already has a detail
    let existingTarget = targetDetailId
      ? existingDetails.find((d) => d.id === targetDetailId) || null
      : null;

    if (targetDetailId && !existingTarget) {
      return NextResponse.json(
        { error: "Dokumen target yang ingin diganti tidak ditemukan di batch ini." },
        { status: 404 }
      );
    }

    if (!existingTarget && !categoryConfig.allowMultiple) {
      existingTarget =
        existingDetails.find(
          (d) =>
            normalizeCategoryCode(d.fileType).toLowerCase() ===
            categoryConfig.code.toLowerCase()
        ) || null;
    }

    const isReplace = Boolean(existingTarget);
    const effectiveCategoryTitle = existingTarget?.fileType || categoryConfig.title;

    const session = await auth();
    const actionByName =
      session?.user?.name || session?.user?.email || "Operator";

    // Track URLs referenced by OTHER details so we don't overwrite or prematurely delete them
    const otherReferencedUrls = new Set<string>();
    for (const det of existingDetails) {
      if (existingTarget && det.id === existingTarget.id) continue;
      const meta = parseDetailMeta(det.isi);
      if (meta.fileUrl) otherReferencedUrls.add(meta.fileUrl);
    }

    const { fileUrl } = await saveBatchPdfFile(
      batchId,
      file,
      otherReferencedUrls
    );

    const prevMeta = existingTarget
      ? parseDetailMeta(existingTarget.isi)
      : { updateHistory: [] };

    const nowIso = new Date().toISOString();
    const previousFileName =
      prevMeta.originalFileName ||
      (prevMeta.fileUrl
        ? decodeURIComponent(prevMeta.fileUrl.split("/").pop() || "")
        : undefined) ||
      (existingTarget?.fileId &&
      existingTarget.fileId.toLowerCase().endsWith(".pdf")
        ? existingTarget.fileId
        : undefined);

    // Only record replacement note when replacing an already-uploaded document.
    // Adding to an empty slot stays a clean addition with no update note.
    const nextUpdateHistory: DocumentUpdateRecord[] = isReplace
      ? [
          ...prevMeta.updateHistory,
          {
            fileName: file.name,
            ...(previousFileName ? { previousFileName } : {}),
            updatedAt: nowIso,
            updatedBy: actionByName,
          },
        ]
      : [];

    const dispatchResult = await dispatchSingleDocumentToNanonets({
      file,
      categoryTitle: effectiveCategoryTitle,
      fileUrl,
      updateHistory: nextUpdateHistory,
    });

    if (dispatchResult.ocrStatus === "FAILED") {
      await cleanupOrphanBatchPdf(batchId, fileUrl, otherReferencedUrls);
      await createBatchLog({
        batchId,
        step: "OCR_DISPATCH",
        stepNumber: 2,
        level: "ERROR",
        title: `Gagal ${isReplace ? "Upload Ulang" : "Tambah"} Dokumen: ${effectiveCategoryTitle}`,
        message: `Gagal mengirim file "${file.name}" ke Nanonets OCR: ${dispatchResult.ocrError}`,
        fileType: effectiveCategoryTitle,
        fileName: file.name,
      }).catch(() => undefined);

      return NextResponse.json(
        {
          error: `Gagal mengirim file ke Nanonets OCR: ${dispatchResult.ocrError || "Unknown error"}`,
        },
        { status: 502 }
      );
    }

    let savedDetail = null;
    if (isReplace && existingTarget) {
      // Remove previous orphaned PDF on disk if replaced by a differently named file
      if (prevMeta.fileUrl && prevMeta.fileUrl !== fileUrl) {
        await cleanupOrphanBatchPdf(
          batchId,
          prevMeta.fileUrl,
          otherReferencedUrls
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      savedDetail = await (db as any).detailBatch.update({
        where: { id: existingTarget.id },
        data: {
          fileId: dispatchResult.requestFileId || file.name,
          nomorAju: null,
          nomorInvoice: null,
          isi: dispatchResult.isiJson,
        },
      });

      await createBatchLog({
        batchId,
        step: "DOC_REPLACED",
        stepNumber: 2,
        level: "INFO",
        title: `Pembaruan Dokumen: ${effectiveCategoryTitle}`,
        message: `${actionByName} mengganti dokumen "${effectiveCategoryTitle}" menjadi "${file.name}"${previousFileName ? ` (sebelumnya: "${previousFileName}")` : ""}.`,
        fileType: effectiveCategoryTitle,
        fileName: file.name,
        details: {
          detailId: existingTarget.id,
          newFileName: file.name,
          previousFileName: previousFileName || null,
          updatedAt: nowIso,
          updatedBy: actionByName,
          requestFileId: dispatchResult.requestFileId,
        },
      }).catch(() => undefined);

      await logSystemAudit({
        action: "UPDATE",
        category: "BATCH_DATA",
        title: `Upload Ulang Dokumen ${effectiveCategoryTitle} (Batch #${batchId})`,
        details: `${actionByName} memperbarui file "${effectiveCategoryTitle}" menjadi "${file.name}" pada ${nowIso}.`,
        metadata: {
          batchId,
          detailId: existingTarget.id,
          category: effectiveCategoryTitle,
          fileName: file.name,
          previousFileName: previousFileName || null,
          updatedAt: nowIso,
        },
        userName: actionByName,
        userEmail: session?.user?.email || undefined,
        userId: session?.user?.id || undefined,
      }).catch(() => undefined);
    } else {
      // Add new document into empty / multi-file slot
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      savedDetail = await (db as any).detailBatch.create({
        data: {
          batchId,
          fileType: effectiveCategoryTitle,
          fileId: dispatchResult.requestFileId || file.name,
          isi: dispatchResult.isiJson,
        },
      });

      await createBatchLog({
        batchId,
        step: "DOC_ADDED",
        stepNumber: 2,
        level: "INFO",
        title: `Tambah Dokumen: ${effectiveCategoryTitle}`,
        message: `${actionByName} menambahkan dokumen baru "${file.name}" (${effectiveCategoryTitle}) ke Batch #${batchId}.`,
        fileType: effectiveCategoryTitle,
        fileName: file.name,
        details: {
          detailId: savedDetail?.id,
          fileName: file.name,
          requestFileId: dispatchResult.requestFileId,
        },
      }).catch(() => undefined);

      await logSystemAudit({
        action: "CREATE",
        category: "BATCH_DATA",
        title: `Tambah Dokumen ${effectiveCategoryTitle} (Batch #${batchId})`,
        details: `${actionByName} menambahkan dokumen "${file.name}" (${effectiveCategoryTitle}) ke Batch #${batchId}.`,
        metadata: {
          batchId,
          detailId: savedDetail?.id,
          category: effectiveCategoryTitle,
          fileName: file.name,
        },
        userName: actionByName,
        userEmail: session?.user?.email || undefined,
        userId: session?.user?.id || undefined,
      }).catch(() => undefined);
    }

    // Re-evaluate batch status across all details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDetails = await (db as any).detailBatch.findMany({
      where: { batchId },
    });

    const anyPendingOcr = allDetails.some((d: { isi?: string | null }) => {
      if (!d.isi || typeof d.isi !== "string" || !d.isi.trim()) return true;
      return parseDetailMeta(d.isi).ocrPending === true;
    });

    let nextBatchStatus = "PROSES";
    if (!anyPendingOcr && allDetails.length > 0) {
      const serverGroups = await loadServerEquivalencyGroups();
      nextBatchStatus = evaluateBatchMatching(allDetails, serverGroups);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).batch.update({
      where: { id: batchId },
      data: {
        status: nextBatchStatus,
        totalFile: allDetails.length,
        errorMessage: null,
      },
    });

    return NextResponse.json({
      success: true,
      mode: isReplace ? "replace" : "add",
      batchId,
      status: nextBatchStatus,
      ocrPending: dispatchResult.ocrStatus === "PENDING",
      detail: savedDetail,
      updateRecord: isReplace
        ? nextUpdateHistory[nextUpdateHistory.length - 1]
        : null,
    });
  } catch (err: unknown) {
    console.error("[API batch documents POST] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses dokumen batch.",
      },
      { status: 500 }
    );
  }
}
