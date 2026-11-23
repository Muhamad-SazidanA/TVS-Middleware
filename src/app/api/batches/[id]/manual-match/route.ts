import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { createBatchLog } from "~/server/logger";
import { evaluateDbBatchStatus } from "~/server/matchingEngine";
import { loadServerEquivalencyGroups } from "~/server/equivalencyLoader";
import { logSystemAudit } from "~/server/auditLogger";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const body = await req.json();
    const {
      detailId,
      fieldId,
      fieldName,
      fieldLabel,
      docCode,
      confirmed = true,
    } = body;

    if (!batchId || (!detailId && !fieldId && !fieldName)) {
      return NextResponse.json(
        { error: "Parameter batchId, detailId, dan fieldName/fieldId wajib diisi." },
        { status: 400 }
      );
    }

    // 1. Fetch detailBatch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detail = detailId
      ? await (db as any).detailBatch.findUnique({
          where: { id: Number(detailId) },
        })
      : null;

    if (!detail || detail.batchId !== batchId) {
      // Fallback: search detail in batch by matching fileType or docCode
      if (docCode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const batchDetails = await (db as any).detailBatch.findMany({
          where: { batchId },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detail = batchDetails.find((d: any) => {
          const ft = (d.fileType || "").toLowerCase();
          const dc = docCode.toLowerCase();
          return ft.includes(dc) || dc.includes(ft);
        }) || null;
      }
    }

    if (!detail) {
      return NextResponse.json(
        { error: "Dokumen detail tidak ditemukan dalam batch ini." },
        { status: 404 }
      );
    }

    // 2. Parse current isi
    let isiObj: {
      fields: Record<string, string>;
      table: Array<Record<string, string>>;
      manualEdits?: Record<string, { oldValue: string; newValue: string; editedAt: string }>;
      manualMatches?: Record<
        string,
        { confirmed: boolean; confirmedAt: string; confirmedBy: string }
      >;
      [key: string]: unknown;
    } = { fields: {}, table: [] };

    try {
      if (detail.isi) {
        isiObj = typeof detail.isi === "string" ? JSON.parse(detail.isi) : detail.isi;
      }
    } catch {
      isiObj = { fields: {}, table: [] };
    }

    if (!isiObj.fields || typeof isiObj.fields !== "object") {
      isiObj.fields = {};
    }
    if (!Array.isArray(isiObj.table)) {
      isiObj.table = [];
    }
    if (!isiObj.manualMatches || typeof isiObj.manualMatches !== "object") {
      isiObj.manualMatches = {};
    }

    const session = await auth();
    const actionByName = session?.user?.name || session?.user?.email || "Operator";
    const isConfirmed = Boolean(confirmed);

    const matchEntry = {
      confirmed: isConfirmed,
      confirmedAt: new Date().toISOString(),
      confirmedBy: actionByName,
    };

    if (fieldId) {
      isiObj.manualMatches[fieldId] = matchEntry;
    }
    if (fieldName) {
      isiObj.manualMatches[fieldName] = matchEntry;
      // Also register lowercased key without symbols
      const cleanKey = fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");
      isiObj.manualMatches[cleanKey] = matchEntry;
    }

    const updatedIsiStr = JSON.stringify(isiObj);

    // 3. Update detailBatch in DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedDetail = await (db as any).detailBatch.update({
      where: { id: detail.id },
      data: { isi: updatedIsiStr },
    });

    // 4. Audit Logging (SystemAuditLog, BatchLog, ActionLog)
    const displayName = fieldLabel || fieldName || fieldId;
    const docDisplayName = docCode || detail.fileType || "Dokumen Pendukung";

    await logSystemAudit({
      action: "OVERRIDE",
      category: "BATCH_DATA",
      title: isConfirmed
        ? `Konfirmasi Manual: ${displayName} (${docDisplayName})`
        : `Batal Konfirmasi Manual: ${displayName} (${docDisplayName})`,
      details: `${actionByName} ${
        isConfirmed ? "mengonfirmasi" : "membatalkan konfirmasi"
      } field "${displayName}" pada dokumen "${docDisplayName}" sebagai COCOK (MATCH) untuk Batch #${batchId}.`,
      metadata: {
        batchId,
        detailId: detail.id,
        fieldId,
        fieldName,
        fieldLabel: displayName,
        docCode: docDisplayName,
        confirmed: isConfirmed,
      },
      userName: actionByName,
      userEmail: session?.user?.email || undefined,
      userId: session?.user?.id || undefined,
    }).catch((err) => console.warn("[Audit] Failed to log manual-match system audit:", err));

    await createBatchLog({
      batchId,
      step: "MANUAL_OVERRIDE",
      stepNumber: 7,
      level: "INFO",
      title: isConfirmed
        ? `Konfirmasi Manual: ${displayName} (${docDisplayName})`
        : `Batal Konfirmasi Manual: ${displayName} (${docDisplayName})`,
      message: `${actionByName} ${
        isConfirmed ? "mengonfirmasi" : "membatalkan konfirmasi"
      } manual field "${displayName}" (${docDisplayName}) sebagai cocok.`,
      fileType: detail.fileType,
      fileName: detail.fileId,
      details: {
        fieldId,
        fieldName,
        fieldLabel: displayName,
        confirmed: isConfirmed,
        confirmedAt: new Date().toISOString(),
      },
    }).catch((err) => console.warn("[BatchLog] Failed to create log:", err));

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).actionLog.create({
        data: {
          batchId,
          docType: docDisplayName,
          docNumber: detail.nomorAju || detail.nomorInvoice || batchId,
          fieldName: displayName,
          oldValue: isConfirmed ? "MISMATCH" : "MATCH",
          newValue: isConfirmed ? "MATCH (Dikonfirmasi Manual)" : "MISMATCH",
          notes: isConfirmed
            ? `Konfirmasi manual oleh ${actionByName}`
            : `Batal konfirmasi manual oleh ${actionByName}`,
          actionBy: actionByName,
        },
      });
    } catch (alErr) {
      console.warn("Failed recording actionLog:", alErr);
    }

    // 5. Re-evaluate overall batch matching status
    const serverGroups = await loadServerEquivalencyGroups();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDetails = await (db as any).detailBatch.findMany({
      where: { batchId },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchRecord = await (db as any).batch.findUnique({
      where: { id: batchId },
    });

    const evaluatedStatus = evaluateDbBatchStatus(
      allDetails,
      batchRecord?.totalFile,
      serverGroups
    );

    const dbStatusStr =
      evaluatedStatus === "Matching"
        ? "MATCHING"
        : evaluatedStatus === "Mismatching"
        ? "MISMATCHING"
        : "PROSES";

    if (batchRecord && batchRecord.status !== dbStatusStr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).batch.update({
        where: { id: batchId },
        data: { status: dbStatusStr },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Status field "${displayName}" berhasil diperbarui.`,
      confirmed: isConfirmed,
      batchStatus: evaluatedStatus,
      updatedDetail,
    });
  } catch (error: unknown) {
    console.error("Error toggling manual match:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
