import fs from "fs";
import path from "path";
import { env } from "~/env";
import {
  getModelIdForCategory,
  extractNanonetsId,
  filterCategoryData,
} from "~/server/nanonets";
import { loadServerWorkflowSteps } from "~/server/workflowLoader";
import {
  applyDataActionsToFields,
  applyDataActionsToTableRows,
} from "~/utils/workflowRunner";
import type { DocumentUpdateRecord } from "~/app/matching/_components/detailTypes";

export interface DispatchedDocumentResult {
  fileName: string;
  fileUrl: string | null;
  modelId: string;
  requestFileId: string | null;
  ocrStatus: "INLINE_DONE" | "PENDING" | "FAILED";
  ocrError?: string;
  isiJson: string;
}

/**
 * Saves an uploaded PDF file into `public/uploads/<batchId>/` avoiding collisions
 * with files still referenced by other details in the batch.
 */
export async function saveBatchPdfFile(
  batchId: string,
  file: File,
  referencedUrlsToKeep: Set<string>
): Promise<{ fileUrl: string | null; savedPath: string | null }> {
  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads", batchId);
    await fs.promises.mkdir(uploadDir, { recursive: true });

    const baseSanitized = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.\.+/g, ".");
    const candidateName = baseSanitized.toLowerCase().endsWith(".pdf")
      ? baseSanitized
      : `${baseSanitized}.pdf`;

    let finalName = candidateName;
    let candidateUrl = `/uploads/${batchId}/${encodeURIComponent(finalName)}`;
    if (referencedUrlsToKeep.has(candidateUrl)) {
      finalName = `${Date.now()}_${candidateName}`;
      candidateUrl = `/uploads/${batchId}/${encodeURIComponent(finalName)}`;
    }

    const filePath = path.join(uploadDir, finalName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(filePath, fileBuffer);

    return { fileUrl: candidateUrl, savedPath: filePath };
  } catch (err) {
    console.warn(`[BatchDocumentProcessor] Failed to save PDF "${file.name}":`, err);
    return { fileUrl: null, savedPath: null };
  }
}

/**
 * Deletes an old PDF file on disk if it is inside `public/uploads/<batchId>/`
 * and no longer referenced by any remaining detail in the batch.
 */
export async function cleanupOrphanBatchPdf(
  batchId: string,
  oldFileUrl: string | null | undefined,
  stillReferencedUrls: Set<string>
): Promise<void> {
  if (!oldFileUrl || stillReferencedUrls.has(oldFileUrl)) return;
  try {
    const prefix = `/uploads/${batchId}/`;
    if (!oldFileUrl.startsWith(prefix)) return;
    const decodedRel = decodeURIComponent(oldFileUrl).replace(/^[/\\]+/, "").replace(/\.\.+/g, "");
    const publicRoot = path.resolve(process.cwd(), "public");
    const batchUploadDir = path.resolve(publicRoot, "uploads", batchId);
    const target = path.resolve(publicRoot, decodedRel);
    const relFromBatchDir = path.relative(batchUploadDir, target);
    if (!relFromBatchDir || relFromBatchDir.startsWith("..") || path.isAbsolute(relFromBatchDir)) {
      return;
    }
    await fs.promises.unlink(target).catch(() => undefined);
  } catch {
    // Non-fatal cleanup failure
  }
}

/**
 * Dispatches a single PDF document to Nanonets OCR and builds the normalized `detailBatch.isi` payload,
 * resetting OCR/manual fields cleanly while preserving any replacement `updateHistory`.
 */
export async function dispatchSingleDocumentToNanonets(params: {
  file: File;
  categoryTitle: string;
  fileUrl: string | null;
  updateHistory?: DocumentUpdateRecord[];
}): Promise<DispatchedDocumentResult> {
  const { file, categoryTitle, fileUrl, updateHistory } = params;
  const apiKey = env.API_KEY || "244bd61f-32b0-41ef-94f2-cec13431d72d";
  const authHeader = "Basic " + Buffer.from(apiKey + ":").toString("base64");
  const modelId = getModelIdForCategory(categoryTitle);

  const buildBaseIsi = (extra: Record<string, unknown>) =>
    JSON.stringify({
      ...extra,
      ...(fileUrl ? { fileUrl } : {}),
      originalFileName: file.name,
      ...(updateHistory && updateHistory.length > 0 ? { updateHistory } : {}),
    });

  const nanonetsUrl = `https://app.nanonets.com/api/v2/OCR/Model/${modelId}/LabelFile?async=true`;
  const formData = new FormData();
  formData.append("file", file, file.name);

  try {
    const res = await fetch(nanonetsUrl, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: formData,
      signal: AbortSignal.timeout(15000),
    });

    const responseText = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let jsonResponse: any = null;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch {
      jsonResponse = { rawText: responseText };
    }

    if (!res.ok) {
      const errorMsg = jsonResponse?.message || `HTTP ${res.status}: ${res.statusText}`;
      return {
        fileName: file.name,
        fileUrl,
        modelId,
        requestFileId: null,
        ocrStatus: "FAILED",
        ocrError: errorMsg,
        isiJson: buildBaseIsi({
          fields: {},
          table: [],
          ocrPending: false,
          ocrError: errorMsg,
        }),
      };
    }

    const requestFileId =
      jsonResponse?.result?.[0]?.request_file_id ||
      jsonResponse?.result?.request_file_id ||
      jsonResponse?.request_file_id ||
      jsonResponse?.result?.[0]?.request_id ||
      jsonResponse?.result?.request_id ||
      jsonResponse?.request_id ||
      extractNanonetsId(jsonResponse);

    const preds =
      jsonResponse?.result?.[0]?.prediction ||
      jsonResponse?.result?.prediction ||
      jsonResponse?.prediction;

    if (Array.isArray(preds) && preds.length > 0) {
      const filtered = filterCategoryData(jsonResponse, categoryTitle);
      try {
        const activeSteps = await loadServerWorkflowSteps();
        if (activeSteps.length > 0) {
          if (filtered.fields) {
            filtered.fields = applyDataActionsToFields(
              filtered.fields,
              categoryTitle,
              activeSteps
            );
          }
          if (filtered.table && Array.isArray(filtered.table)) {
            filtered.table = applyDataActionsToTableRows(
              filtered.table,
              categoryTitle,
              activeSteps
            );
          }
        }
      } catch (actErr) {
        console.warn("[BatchDocumentProcessor] Data action error:", actErr);
      }

      return {
        fileName: file.name,
        fileUrl,
        modelId,
        requestFileId,
        ocrStatus: "INLINE_DONE",
        isiJson: buildBaseIsi({ ...filtered, ocrPending: false }),
      };
    }

    return {
      fileName: file.name,
      fileUrl,
      modelId,
      requestFileId,
      ocrStatus: "PENDING",
      isiJson: buildBaseIsi({ fields: {}, table: [], ocrPending: true }),
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      fileName: file.name,
      fileUrl,
      modelId,
      requestFileId: null,
      ocrStatus: "FAILED",
      ocrError: errMsg,
      isiJson: buildBaseIsi({
        fields: {},
        table: [],
        ocrPending: false,
        ocrError: errMsg,
      }),
    };
  }
}
