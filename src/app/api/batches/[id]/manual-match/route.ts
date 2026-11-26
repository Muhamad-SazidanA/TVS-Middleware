import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { createBatchLog } from "~/server/logger";
import { evaluateBatchComparison } from "~/app/matching/_components/detailAdapter";
import { loadServerEquivalencyGroups } from "~/server/equivalencyLoader";
import { logSystemAudit } from "~/server/auditLogger";
import { getBatchMutationLock } from "~/server/batchGuards";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const lockCheck = await getBatchMutationLock(batchId);
    if (lockCheck.blocked) {
      return NextResponse.json({ error: lockCheck.error }, { status: lockCheck.httpStatus });
    }

    const body = await req.json();
    const {
      detailId,
      fieldId,
      fieldName,
      fieldLabel,
      docCode,
      confirmed = true,
      bulk = false,
      fields = [],
    } = body;

    // Handle Bulk Approval for all fields in a document/batch
    if (bulk && Array.isArray(fields) && fields.length > 0) {
      const session = await auth();
      const actionByName = session?.user?.name || session?.user?.email || "Operator";
      const matchEntry = {
        confirmed: true,
        confirmedAt: new Date().toISOString(),
        confirmedBy: actionByName,
      };

      // 1. Fetch all detail batches for this batch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const batchDetails = await (db as any).detailBatch.findMany({
        where: { batchId },
      });

      // Group fields by detail and prepare bulk ActionLog rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detailUpdateMap = new Map<number, any>();
      const bulkActionLogs: Array<{
        batchId: string;
        docType: string;
        docNumber: string;
        fieldName: string;
        oldValue: string;
        newValue: string;
        notes: string;
        actionBy: string;
      }> = [];
      const targetDocLabel = docCode || "Dokumen Aktif";

      for (const f of fields) {
        let targetDetail = f.detailId
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? batchDetails.find((d: any) => d.id === Number(f.detailId))
          : null;

        if (!targetDetail && f.docCode) {
          const dc = f.docCode.toLowerCase();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          targetDetail = batchDetails.find((d: any) => {
            const ft = (d.fileType || "").toLowerCase();
            return ft.includes(dc) || dc.includes(ft);
          });
        }

        if (!targetDetail && docCode) {
          const dc = docCode.toLowerCase();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          targetDetail = batchDetails.find((d: any) => {
            const ft = (d.fileType || "").toLowerCase();
            return ft.includes(dc) || dc.includes(ft);
          });
        }

        if (targetDetail) {
          let isiObj = detailUpdateMap.get(targetDetail.id);
          if (!isiObj) {
            try {
              isiObj =
                typeof targetDetail.isi === "string"
                  ? JSON.parse(targetDetail.isi)
                  : targetDetail.isi || {};
            } catch {
              isiObj = {};
            }
            if (!isiObj.manualMatches || typeof isiObj.manualMatches !== "object") {
              isiObj.manualMatches = {};
            }
            if (!Array.isArray(isiObj.manualMatchHistory)) {
              isiObj.manualMatchHistory = [];
            }
            detailUpdateMap.set(targetDetail.id, isiObj);
          }

          if (f.fieldId) {
            isiObj.manualMatches[f.fieldId] = matchEntry;
          }
          if (f.fieldLabel) {
            isiObj.manualMatches[f.fieldLabel] = matchEntry;
          }
          if (f.fieldName) {
            isiObj.manualMatches[f.fieldName] = matchEntry;
            const cleanKey = f.fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");
            isiObj.manualMatches[cleanKey] = matchEntry;
          }

          const fDisplayName = f.fieldLabel || f.fieldName || f.fieldId || "-";
          const fDocDisplay = f.docCode || targetDetail.fileType || targetDocLabel;

          isiObj.manualMatchHistory.push({
            fieldId: f.fieldId,
            fieldName: f.fieldName || fDisplayName,
            fieldLabel: fDisplayName,
            docCode: fDocDisplay,
            confirmed: true,
            actionMode: "MASSAL",
            confirmedAt: matchEntry.confirmedAt,
            confirmedBy: actionByName,
          });

          bulkActionLogs.push({
            batchId,
            docType: fDocDisplay,
            docNumber: targetDetail.nomorAju || targetDetail.nomorInvoice || batchId,
            fieldName: fDisplayName,
            oldValue: "MISMATCH",
            newValue: "MATCH (Setujui Massal)",
            notes: `[Setujui Massal (All)] Disetujui via Setujui ${targetDocLabel} oleh ${actionByName}`,
            actionBy: actionByName,
          });
        }
      }

      // Update all affected details in DB
      for (const [dId, updatedIsi] of detailUpdateMap.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).detailBatch.update({
          where: { id: dId },
          data: { isi: JSON.stringify(updatedIsi) },
        });
      }

      if (bulkActionLogs.length > 0) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db as any).actionLog.createMany({
            data: bulkActionLogs,
          });
        } catch (alErr) {
          console.warn("Failed recording bulk actionLogs:", alErr);
        }
      }
      await logSystemAudit({
        action: "OVERRIDE",
        category: "BATCH_DATA",
        title: `Konfirmasi Massal: Seluruh Field ${targetDocLabel}`,
        details: `${actionByName} menyetujui seluruh ${fields.length} field pada "${targetDocLabel}" sebagai MATCH untuk Batch #${batchId}.`,
        metadata: { batchId, docCode: targetDocLabel, count: fields.length },
        userName: actionByName,
        userEmail: session?.user?.email || undefined,
        userId: session?.user?.id || undefined,
      }).catch((err) => console.warn("[Audit] Failed bulk manual-match audit:", err));

      await createBatchLog({
        batchId,
        step: "MANUAL_OVERRIDE",
        stepNumber: 7,
        level: "INFO",
        title: `Konfirmasi Massal: Seluruh Field ${targetDocLabel}`,
        message: `${actionByName} menyetujui seluruh ${fields.length} field pada "${targetDocLabel}" sebagai MATCH.`,
        details: { docCode: targetDocLabel, count: fields.length },
      }).catch((err) => console.warn("[BatchLog] Failed to create log:", err));

      // Re-evaluate matching
      const serverGroups = await loadServerEquivalencyGroups();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allDetails = await (db as any).detailBatch.findMany({ where: { batchId } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const batchRecord = await (db as any).batch.findUnique({ where: { id: batchId } });
      const evalResult = evaluateBatchComparison(
        { ...batchRecord, details: allDetails },
        serverGroups
      );

      const dbStatusStr =
        evalResult.status === "Matching"
          ? "MATCHING"
          : evalResult.status === "Mismatching"
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
        message: `Seluruh field ${targetDocLabel} (${fields.length} field) berhasil disetujui.`,
        confirmed: true,
        batchStatus: evalResult.status,
        docStatuses: evalResult.docStatuses,
      });
    }

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
      manualMatchHistory?: Array<{
        fieldId?: string;
        fieldName?: string;
        fieldLabel?: string;
        docCode?: string;
        confirmed: boolean;
        actionMode: "SATUAN" | "MASSAL";
        confirmedAt: string;
        confirmedBy: string;
      }>;
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
    if (!Array.isArray(isiObj.manualMatchHistory)) {
      isiObj.manualMatchHistory = [];
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

    const displayName = fieldLabel || fieldName || fieldId;
    const docDisplayName = docCode || detail.fileType || "Dokumen Pendukung";

    isiObj.manualMatchHistory.push({
      fieldId,
      fieldName: fieldName || displayName,
      fieldLabel: displayName,
      docCode: docDisplayName,
      confirmed: isConfirmed,
      actionMode: "SATUAN",
      confirmedAt: matchEntry.confirmedAt,
      confirmedBy: actionByName,
    });

    const updatedIsiStr = JSON.stringify(isiObj);

    // 3. Update detailBatch in DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedDetail = await (db as any).detailBatch.update({
      where: { id: detail.id },
      data: { isi: updatedIsiStr },
    });

    // 4. Audit Logging (SystemAuditLog, BatchLog, ActionLog)

    await logSystemAudit({
      action: "OVERRIDE",
      category: "BATCH_DATA",
      title: isConfirmed
        ? `Konfirmasi Manual: ${displayName} (${docDisplayName})`
        : `Batal Konfirmasi Manual: ${displayName} (${docDisplayName})`,
      details: `${actionByName} ${
        isConfirmed ? "mengonfirmasi" : "membatalkan konfirmasi"
      } field "${displayName}" pada dokumen "${docDisplayName}" sebagai MATCH untuk Batch #${batchId}.`,
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
      } manual field "${displayName}" (${docDisplayName}) sebagai Match.`,
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
          newValue: isConfirmed ? "MATCH (Setujui Satuan)" : "MISMATCH",
          notes: isConfirmed
            ? `[Setujui Satuan] Konfirmasi manual oleh ${actionByName}`
            : `[Batal Setujui Satuan] Batal konfirmasi manual oleh ${actionByName}`,
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

    const evalResult = evaluateBatchComparison(
      {
        ...batchRecord,
        details: allDetails,
      },
      serverGroups
    );

    const dbStatusStr =
      evalResult.status === "Matching"
        ? "MATCHING"
        : evalResult.status === "Mismatching"
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
      batchStatus: evalResult.status,
      docStatuses: evalResult.docStatuses,
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
