import { NextResponse } from "next/server";
import { env } from "~/env";
import { db } from "~/server/db";
import { getModelIdForCategory } from "~/server/nanonets";

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

    // 1. Generate sequential formatted Batch ID (0001, 0002, 0003...)
    let formattedBatchId = "0001";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await (db as any).batch.count();
      formattedBatchId = String(count + 1).padStart(4, "0");
    } catch {
      formattedBatchId = `0001`;
    }

    // Create Batch record in DB with PENDING status (Masuk Antrian)
    let batch = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch = await (db as any).batch.create({
        data: {
          id: formattedBatchId,
          totalFile: files.length,
          status: "PENDING",
        },
      });
    } catch (dbErr) {
      console.warn("Database batch record creation fallback:", dbErr);
    }

    const batchId = batch?.id || formattedBatchId;

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

          // Extract request_file_id / request_id from Nanonets response
          const requestId =
            jsonResponse?.result?.[0]?.request_file_id ||
            jsonResponse?.result?.[0]?.request_id ||
            jsonResponse?.request_file_id ||
            jsonResponse?.request_id ||
            jsonResponse?.result?.request_id ||
            null;

          // Save into DetailBatch table: ID, Batch_ID, File Type, File ID (request_file_id), Isi (null)
          if (batch?.id && requestId) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (db as any).detailBatch.create({
                data: {
                  batchId: batch.id,
                  fileType: category,
                  fileId: requestId,
                  isi: null, // Empty for now, populated by Webhook
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
            requestId,
            status: "SUCCESS",
            rawResponse: jsonResponse,
          };
        } catch (fetchErr: unknown) {
          const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);

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

    // Update Batch status in DB (SUCCESS if all files successfully dispatched to nanonets and request_file_id obtained)
    const failedCount = results.filter((r) => r.status === "FAILED").length;
    const finalBatchStatus =
      failedCount === 0
        ? "SUCCESS"
        : failedCount === results.length
        ? "FAILED"
        : "PARTIAL_FAILED";

    if (batch?.id) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).batch.update({
          where: { id: batch.id },
          data: { status: finalBatchStatus },
        });
      } catch (err) {
        console.warn("Batch status update failed:", err);
      }
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
