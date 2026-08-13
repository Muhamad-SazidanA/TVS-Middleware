import { db } from "~/server/db";

export type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export interface CreateBatchLogParams {
  batchId: string;
  step: string;
  stepNumber: number;
  level?: LogLevel;
  title: string;
  message: string;
  fileType?: string | null;
  fileName?: string | null;
  details?: Record<string, unknown> | string | null;
}

/**
  Helper function for recording step-by-step audit logs into database.
  Runs safely in background without throwing errors if DB log write fails.
 */
export async function createBatchLog(params: CreateBatchLogParams): Promise<void> {
  try {
    const {
      batchId,
      step,
      stepNumber,
      level = "INFO",
      title,
      message,
      fileType,
      fileName,
      details,
    } = params;

    let detailsStr: string | null = null;
    if (details) {
      if (typeof details === "string") {
        detailsStr = details;
      } else {
        try {
          detailsStr = JSON.stringify(details);
        } catch {
          detailsStr = String(details);
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).batchLog.create({
      data: {
        batchId,
        step,
        stepNumber: Number(stepNumber) || 1,
        level,
        title,
        message,
        fileType: fileType || null,
        fileName: fileName || null,
        details: detailsStr,
      },
    });
  } catch (err) {
    console.warn("[createBatchLog] Failed to write log to DB:", err);
  }
}
