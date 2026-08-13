import { NextResponse } from "next/server";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Batch ID is required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logs = await (db as any).batchLog.findMany({
      where: { batchId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      batchId: id,
      totalLogs: logs.length,
      logs,
    });
  } catch (error: unknown) {
    console.error("Error fetching batch logs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error", logs: [] },
      { status: 500 }
    );
  }
}
