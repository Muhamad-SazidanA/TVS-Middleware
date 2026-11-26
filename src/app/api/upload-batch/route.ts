import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { env } from "~/env";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { getModelIdForCategory, extractNanonetsId, filterCategoryData } from "~/server/nanonets";
import { createBatchLog } from "~/server/logger";
import { loadServerWorkflowSteps } from "~/server/workflowLoader";
import { loadServerEquivalencyGroups } from "~/server/equivalencyLoader";
import { applyDataActionsToFields, applyDataActionsToTableRows } from "~/utils/workflowRunner";
import { hasIncompleteBatchDetails } from "~/utils/workflowStatus";

export const dynamic = "force-dynamic";

interface ProcessFileResult {
  fileName: string;
  category: string;
  modelId: string;
  requestId: string | null;
  status: "SUCCESS" | "FAILED";
  error?: string;
  rawResponse?: unknown;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const categories = formData.getAll("categories") as string[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided in upload request." },
        { status: 400 }
      );
    }

    const apiKey = env.API_KEY || "244bd61f-32b0-11ef-94f2-cec13431d72d";
    const authHeader = "Basic " + Buffer.from(apiKey + ":").toString("base64");

    // 1. Generate sequential formatted Batch ID (0001, 0002, 0003...) avoiding ID collision
    let formattedBatchId = "0001";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingBatches = await (db as any).batch.findMany({
        select: { id: true },
      });
      let maxId = 0;
      for (const b of existingBatches) {
        const num = parseInt(b.id, 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
      formattedBatchId = String(maxId + 1).padStart(4, "0");
    } catch {
      formattedBatchId = String(Date.now()).slice(-4);
    }

    // Create Batch record in DB with PENDING status (Masuk Antrian)
    const session = await auth();
    let batch = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch = await (db as any).batch.create({
        data: {
          id: formattedBatchId,
          totalFile: files.length,
          status: "PENDING",
          createdById: session?.user?.id || null,
        },
      });
    } catch (dbErr) {
      console.warn("Database batch record creation fallback:", dbErr);
    }

    const batchId = batch?.id || formattedBatchId;

    // STEP 1 LOG: Batch Created & File Upload Initialized
    await createBatchLog({
      batchId,
      step: "UPLOAD_INIT",
      stepNumber: 1,
      level: "SUCCESS",
      title: "Inisiasi Upload Batch",
      message: `Batch #${batchId} berhasil dibuat dengan total ${files.length} file dokumen.`,
      details: { totalFile: files.length, fileNames: files.map((f) => f.name), categories },
    });

    // 2. Dispatch all files in parallel via async=true to Nanonets OCR
    const results: ProcessFileResult[] = await Promise.all(
      files.map(async (file, index) => {
        const category = categories[index] || "PIB";
        let modelId = "f058f626-44d2-4b98-b529-bf1e521801aa";

        try {
          modelId = getModelIdForCategory(category);
        } catch {
          console.warn(`Fallback model ID used for category: ${category}`);
        }

        // Save physical file locally for coordinate zoom viewer & reference comparison
        let fileUrl: string | null = null;
        try {
          const uploadDir = path.join(process.cwd(), "public", "uploads", batchId);
          await fs.promises.mkdir(uploadDir, { recursive: true });
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const filePath = path.join(uploadDir, sanitizedFileName);
          const fileBuffer = Buffer.from(await file.arrayBuffer());
          await fs.promises.writeFile(filePath, fileBuffer);
          fileUrl = `/uploads/${batchId}/${encodeURIComponent(sanitizedFileName)}`;
        } catch (saveErr) {
          console.warn(`[Upload File Save] Failed to save file "${file.name}":`, saveErr);
        }

        // Construct Nanonets LabelFile?async=true endpoint URL
        const nanonetsUrl = `https://app.nanonets.com/api/v2/OCR/Model/${modelId}/LabelFile?async=true`;

        // Prepare FormData for Nanonets API
        const nanonetsFormData = new FormData();
        nanonetsFormData.append("file", file, file.name);

        try {
          const res = await fetch(nanonetsUrl, {
            method: "POST",
            headers: {
              Authorization: authHeader,
            },
            body: nanonetsFormData,
            signal: AbortSignal.timeout(15000),
          });

          const responseText = await res.text();
          let jsonResponse: any = null;
          try {
            jsonResponse = JSON.parse(responseText);
          } catch {
            jsonResponse = { rawText: responseText };
          }

          if (!res.ok) {
            const errorMsg = jsonResponse?.message || `HTTP ${res.status}: ${res.statusText}`;

            // STEP 2 LOG ERROR
            await createBatchLog({
              batchId,
              step: "OCR_DISPATCH",
              stepNumber: 2,
              level: "ERROR",
              title: `Gagal Kirim OCR: ${category}`,
              message: `Gagal mengirim file "${file.name}" ke Nanonets OCR: ${errorMsg}`,
              fileType: category,
              fileName: file.name,
              details: { error: errorMsg },
            });

            return {
              fileName: file.name,
              category,
              modelId,
              requestId: null,
              status: "FAILED",
              error: errorMsg,
              rawResponse: jsonResponse,
            };
          }

          // Extract request_file_id
          const requestFileId =
            jsonResponse?.result?.[0]?.request_file_id ||
            jsonResponse?.result?.request_file_id ||
            jsonResponse?.request_file_id ||
            jsonResponse?.result?.[0]?.request_id ||
            jsonResponse?.result?.request_id ||
            jsonResponse?.request_id ||
            extractNanonetsId(jsonResponse);
          
          console.log(`[Upload] Final requestFileId stored as fileId: "${requestFileId}"`);

          // STEP 2 LOG SUCCESS: File dispatched to Nanonets OCR
          await createBatchLog({
            batchId,
            step: "OCR_DISPATCH",
            stepNumber: 2,
            level: "INFO",
            title: `Pengiriman OCR: ${category}`,
            message: `File "${file.name}" (${category}) berhasil dikirim ke Nanonets OCR Model (${modelId}). Request File ID: "${requestFileId}"`,
            fileType: category,
            fileName: file.name,
            details: { modelId, requestFileId },
          });

          // Check if predictions exist directly in upload response
          let initialIsi: string | null = null;
          try {
            const preds =
              jsonResponse?.result?.[0]?.prediction ||
              jsonResponse?.result?.prediction ||
              jsonResponse?.prediction;
            if (Array.isArray(preds) && preds.length > 0) {
              const filtered = filterCategoryData(jsonResponse, category);
              try {
                const activeSteps = await loadServerWorkflowSteps();
                if (activeSteps.length > 0) {
                  if (filtered.fields) {
                    filtered.fields = applyDataActionsToFields(filtered.fields, category, activeSteps);
                  }
                  if (filtered.table && Array.isArray(filtered.table)) {
                    filtered.table = applyDataActionsToTableRows(filtered.table, category, activeSteps);
                  }
                }
              } catch (actErr) {
                console.warn("[Upload Data Actions] Error applying actions:", actErr);
              }
              initialIsi = JSON.stringify({
                ...filtered,
                fileUrl,
                originalFileName: file.name,
              });

              // STEP 3 & 4 LOGS for direct inline prediction
              await createBatchLog({
                batchId,
                step: "OCR_COMPLETE",
                stepNumber: 3,
                level: "SUCCESS",
                title: `OCR Langsung Selesai: ${category}`,
                message: `Hasil OCR file "${file.name}" langsung diterima dari respons upload.`,
                fileType: category,
                fileName: file.name,
              });

              await createBatchLog({
                batchId,
                step: "DATA_EXTRACTED",
                stepNumber: 4,
                level: "SUCCESS",
                title: `Ekstraksi Data: ${category}`,
                message: `Data ${category} berhasil difilter dan tersimpan di database.`,
                fileType: category,
                fileName: file.name,
                details: filtered,
              });
            } else {
              // Mark pending OCR explicitly so webhook fallback and lock guards identify unfinished files
              initialIsi = JSON.stringify({
                fields: {},
                table: [],
                ...(fileUrl ? { fileUrl } : {}),
                originalFileName: file.name,
                ocrPending: true,
              });
            }
          } catch {
            initialIsi = JSON.stringify({
              fields: {},
              table: [],
              ...(fileUrl ? { fileUrl } : {}),
              originalFileName: file.name,
              ocrPending: true,
            });
          }

          // Save request_file_id into detail_batches table
          if (batch?.id && requestFileId) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (db as any).detailBatch.create({
                data: {
                  batchId: batch.id,
                  fileType: category,
                  fileId: requestFileId,
                  isi: initialIsi,
                },
              });
            } catch (err) {
              console.warn("DB DetailBatch creation failed:", err);
            }
          }

          return {
            fileName: file.name,
            category,
            modelId,
            requestId: requestFileId,
            status: "SUCCESS",
            rawResponse: jsonResponse,
          };
        } catch (fetchErr: unknown) {
          const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);

          await createBatchLog({
            batchId,
            step: "OCR_DISPATCH",
            stepNumber: 2,
            level: "ERROR",
            title: `Error Pengiriman OCR: ${category}`,
            message: `Terjadi kendala jaringan saat pengiriman file "${file.name}": ${errMsg}`,
            fileType: category,
            fileName: file.name,
          });

          return {
            fileName: file.name,
            category,
            modelId,
            requestId: null,
            status: "FAILED",
            error: errMsg,
          };
        }
      })
    );

    // Evaluate final batch status
    const failedCount = results.filter((r) => r.status === "FAILED").length;
    let finalBatchStatus = failedCount === results.length ? "FAILED" : "PROSES";

    if (batch?.id && finalBatchStatus !== "FAILED") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fullBatch = await (db as any).batch.findUnique({
          where: { id: batch.id },
          include: { details: true },
        });

        if (fullBatch && Array.isArray(fullBatch.details)) {
          const isBatchReady = !hasIncompleteBatchDetails({
            totalFile: fullBatch.totalFile || files.length,
            details: fullBatch.details,
          });
          if (isBatchReady) {
            const { evaluateBatchMatching } = await import("~/server/nanonets");
            const [serverGroups, serverDataActions] = await Promise.all([
              loadServerEquivalencyGroups(),
              loadServerWorkflowSteps(),
            ]);
            const matchResult = evaluateBatchMatching(
              fullBatch.details,
              serverGroups,
              serverDataActions
            );
            finalBatchStatus = matchResult;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db as any).batch.update({
            where: { id: batch.id },
            data: { status: finalBatchStatus },
          });
        }
      } catch (err) {
        console.warn("Batch status evaluation failed:", err);
      }
    }

    // STEP 5 & STEP 6 LOGS
    await createBatchLog({
      batchId,
      step: "MATCHING_EVAL",
      stepNumber: 5,
      level: finalBatchStatus === "MATCHING" ? "SUCCESS" : finalBatchStatus === "MISMATCHING" ? "WARNING" : "INFO",
      title: "Evaluasi Pencocokan Document Batch",
      message: `Evaluasi awal batch #${batchId} menghasilkan status: ${finalBatchStatus}`,
      details: { finalBatchStatus },
    });

    if (finalBatchStatus === "MATCHING" || finalBatchStatus === "MISMATCHING") {
      await createBatchLog({
        batchId,
        step: "COMPLETED",
        stepNumber: 6,
        level: finalBatchStatus === "MATCHING" ? "SUCCESS" : "WARNING",
        title: "Data Sempurna",
        message: `Pemrosesan batch #${batchId} telah rampung sempurna dengan status akhir: ${finalBatchStatus}.`,
        details: { status: finalBatchStatus },
      });
    }

    return NextResponse.json({
      success: true,
      batchId,
      totalFile: files.length,
      status: finalBatchStatus,
      results,
    });
  } catch (error: unknown) {
    console.error("Error in /api/upload-batch:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

