import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// WEBHOOK HANDLER (TEMPORARILY COMMENTED OUT AS REQUESTED)
/*
import { db } from "~/server/db";

export async function POST(req: Request) {
  try {
    const responseText = await req.text();
    let body: any = null;

    try {
      body = JSON.parse(responseText);
    } catch {
      body = { rawText: responseText };
    }

    console.log("Received Nanonets Webhook payload:", JSON.stringify(body, null, 2));

    const resultItem =
      Array.isArray(body?.result) && body.result.length > 0
        ? body.result[0]
        : Array.isArray(body) && body.length > 0
        ? body[0]
        : body;

    const requestId =
      resultItem?.request_file_id ||
      resultItem?.request_id ||
      body?.request_file_id ||
      body?.request_id ||
      resultItem?.id ||
      null;

    if (!requestId) {
      return NextResponse.json(
        { success: false, message: "Missing request_id or request_file_id" },
        { status: 400 }
      );
    }

    // Update DetailBatch record in DB matching fileId (request_file_id)
    let updatedDetail = null;
    try {
      updatedDetail = await (db as any).detailBatch.updateMany({
        where: { fileId: requestId },
        data: {
          isi: JSON.stringify(body),
        },
      });
    } catch (err) {
      console.warn("DB DetailBatch update by fileId failed:", err);
    }

    return NextResponse.json({
      success: true,
      message: "Nanonets Webhook processed successfully",
      requestId,
      updatedCount: updatedDetail?.count || 0,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
*/

export async function POST() {
  return NextResponse.json({
    status: "WEBHOOK_DISABLED_TEMPORARILY",
    message: "Webhook processing is currently commented out as requested.",
  });
}
