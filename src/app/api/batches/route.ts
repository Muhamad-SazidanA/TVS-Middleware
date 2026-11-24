import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { evaluateBatchComparison } from "~/app/matching/_components/detailAdapter";
import { loadServerEquivalencyGroups } from "~/server/equivalencyLoader";

export const dynamic = "force-dynamic";

function parseIsi(isi?: string | null) {
  if (!isi) return { fields: {}, table: [] };
  try {
    const p = typeof isi === "string" ? JSON.parse(isi) : isi;
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: (p as any)?.fields || (p as any)?.prediction?.fields || p || {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      table: Array.isArray((p as any)?.table) ? (p as any).table : Array.isArray((p as any)?.prediction?.table) ? (p as any).prediction.table : [],
    };
  } catch {
    return { fields: {}, table: [] };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getVal(fields: Record<string, any>, ...keys: string[]): string {
  if (!fields) return "-";
  // 1. Exact match: prefer action-adjusted field if present
  for (const k of keys) {
    const actionKey = `${k}_action`;
    if (fields[actionKey] !== undefined && fields[actionKey] !== null && fields[actionKey] !== "") {
      const v = typeof fields[actionKey] === "object" ? fields[actionKey]?.value : fields[actionKey];
      if (v !== undefined && v !== null && v !== "") return String(v).trim();
    }
    if (fields[k] !== undefined && fields[k] !== null && fields[k] !== "") {
      const v = typeof fields[k] === "object" ? fields[k]?.value : fields[k];
      if (v !== undefined && v !== null && v !== "") return String(v).trim();
    }
  }

  // 2. Normalized case-insensitive lookup (spaces, underscores, dots stripped)
  const normMap: Record<string, any> = {};
  for (const [rk, rv] of Object.entries(fields)) {
    normMap[rk.toLowerCase().replace(/[\s_.-]+/g, "")] = rv;
  }
  for (const k of keys) {
    const cleanK = k.toLowerCase().replace(/[\s_.-]+/g, "");
    const actionCleanK = `${cleanK}action`;
    if (normMap[actionCleanK] !== undefined && normMap[actionCleanK] !== null && normMap[actionCleanK] !== "") {
      const v = typeof normMap[actionCleanK] === "object" ? normMap[actionCleanK]?.value : normMap[actionCleanK];
      if (v !== undefined && v !== null && v !== "") return String(v).trim();
    }
    if (normMap[cleanK] !== undefined && normMap[cleanK] !== null && normMap[cleanK] !== "") {
      const v = typeof normMap[cleanK] === "object" ? normMap[cleanK]?.value : normMap[cleanK];
      if (v !== undefined && v !== null && v !== "") return String(v).trim();
    }
  }

  return "-";
}

// 1. READ ALL BATCHES (GET)
export async function GET(req: Request) {
  try {
    const session = await auth();
    const userRole = (session?.user as { role?: string })?.role || "STAFF";
    const currentUserId = session?.user?.id;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase() || "";
    const statusFilter = searchParams.get("status") || "ALL";
    const scope = searchParams.get("scope")?.toLowerCase() || ""; // "personal" | "all_data"
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    if (scope === "all_data") {
      whereClause.status = "APPROVED";
    } else if (scope === "personal") {
      if (userRole === "STAFF" && currentUserId) {
        whereClause.createdById = currentUserId;
      }
    } else {
      // Default: if staff and no explicit all_data scope, filter to personal workspace
      if (userRole === "STAFF" && currentUserId) {
        whereClause.createdById = currentUserId;
      }
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        whereClause.createdAt.gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = e;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawBatches: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rawBatches = await (db as any).batch.findMany({
        where: whereClause,
        include: {
          details: true,
          createdBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (dbErr) {
      console.warn("Error querying database for batches:", dbErr);
      rawBatches = [];
    }

    const serverGroups = await loadServerEquivalencyGroups();

    // Process and format batches with dynamic live DB evaluation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedBatches = rawBatches.map((batch: any, index: number) => {
      let batchTitle = `Batch #${batch.id}`;
      let batchSubtext = "";

      let pibAjuNo = "";
      let importirName = "";
      let docNo = "";

      for (const det of batch.details || []) {
        if (det.nomorAju && String(det.nomorAju).trim() && !pibAjuNo) {
          pibAjuNo = String(det.nomorAju).trim();
        }
        if (!det.isi) continue;
        const p = parseIsi(det.isi);
        const f = p?.fields || {};
        const ft = (det.fileType || "").trim().toLowerCase();
        const isPib = ft === "pib" || ft.includes("file acuan") || ft.startsWith("pib");

        if (isPib && (!pibAjuNo || pibAjuNo === "-")) {
          const ajuVal = getVal(
            f,
            "No_Pengajuan",
            "No Pengajuan",
            "Nomor_Pengajuan",
            "Nomor Pengajuan",
            "No_Aju",
            "No Aju",
            "Nomor_Aju",
            "Nomor Aju"
          );
          if (ajuVal && ajuVal !== "-") pibAjuNo = ajuVal;
        }

        if (!importirName || importirName === "-") {
          const val = getVal(f, "Nama_Importir", "Nama Importir", "Consignee", "Importir");
          if (val && val !== "-") importirName = val;
        }
        if (!docNo || docNo === "-") {
          const val = getVal(
            f,
            "No_Pengajuan",
            "No Pengajuan",
            "Nomor_Pengajuan",
            "Nomor Pengajuan",
            "No_Aju",
            "No Aju",
            "Nomor_Aju",
            "Nomor Aju",
            "Invoice_Number",
            "Invoice Number"
          );
          if (val && val !== "-") docNo = val;
        }
      }

      const noPengajuan = pibAjuNo && pibAjuNo !== "-" ? pibAjuNo : docNo && docNo !== "-" ? docNo : null;

      const dateStr = batch.createdAt
        ? new Date(batch.createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "";

      if (noPengajuan) {
        batchTitle = noPengajuan;
        batchSubtext = `Batch #${batch.id}`;
      } else if (importirName) {
        batchTitle = importirName;
        batchSubtext = dateStr ? `Batch #${batch.id} • ${dateStr}` : `Batch #${batch.id}`;
      } else {
        batchTitle = `Batch #${batch.id}`;
        batchSubtext = dateStr ? `${batch.totalFile || (batch.details || []).length} File • ${dateStr}` : `${batch.totalFile || (batch.details || []).length} File`;
      }

      // Dynamic evaluation from DB details using the unified detailAdapter engine
      const evalResult = evaluateBatchComparison(batch, serverGroups);
      const evaluatedStatus = evalResult.status;
      const docStatuses = evalResult.docStatuses;

      return {
        id: batch.id,
        no: index + 1,
        nama: batchTitle,
        noPengajuan,
        subtext: batchSubtext,
        totalFile: batch.totalFile || (batch.details || []).length || 0,
        status: evaluatedStatus,
        rawStatus: batch.status || "PENDING",
        errorMessage: batch.errorMessage || null,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        approvedAt: batch.approvedAt,
        createdBy: batch.createdBy ? { id: batch.createdBy.id, name: batch.createdBy.name, email: batch.createdBy.email } : null,
        approvedBy: batch.approvedBy ? { id: batch.approvedBy.id, name: batch.approvedBy.name, email: batch.approvedBy.email } : null,
        crossCheckSummary: {
          total: evalResult.totalFields,
          evaluated: evalResult.totalFields,
          matched: evalResult.matchedFields,
          mismatches: evalResult.mismatchedFields,
          scorePercentage:
            evalResult.totalFields > 0
              ? Math.round((evalResult.matchedFields / evalResult.totalFields) * 100)
              : 100,
          isFullyConsistent: evalResult.mismatchedFields === 0,
        },
        docStatuses,
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
    const session = await auth();
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
    else if (status === "APPROVED" || status === "Approved") dbStatus = "APPROVED";
    else if (status === "DRAFT" || status === "Draft") dbStatus = "DRAFT";
    else dbStatus = status || "PROSES";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createdBatch = await (db as any).batch.create({
      data: {
        id: newBatchId,
        totalFile: Number(totalFile) || 0,
        status: dbStatus,
        createdById: session?.user?.id || null,
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
