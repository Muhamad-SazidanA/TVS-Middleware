import { NextResponse } from "next/server";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "ALL";
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (category !== "ALL" && category !== "all") {
      where.category = category.toUpperCase();
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { details: { contains: search } },
        { userName: { contains: search } },
        { userEmail: { contains: search } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaDb = db as any;

    const [logs, total, totalCreates, totalUpdates, totalDeletes, totalOverrides] = await Promise.all([
      prismaDb.systemAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prismaDb.systemAuditLog.count({ where }),
      prismaDb.systemAuditLog.count({ where: { action: "CREATE" } }),
      prismaDb.systemAuditLog.count({ where: { action: "UPDATE" } }),
      prismaDb.systemAuditLog.count({ where: { action: "DELETE" } }),
      prismaDb.systemAuditLog.count({ where: { action: "OVERRIDE" } }),
    ]);

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        totalAll: total,
        totalCreates,
        totalUpdates,
        totalDeletes,
        totalOverrides,
      },
    });
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil log audit sistem." },
      { status: 500 }
    );
  }
}
