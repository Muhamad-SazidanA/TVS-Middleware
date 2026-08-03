import { NextResponse } from "next/server";
import { env } from "~/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = env.API_KEY || "244bd61f-32b0-11ef-94f2-cec13431d72d";
  const authHeader = "Basic " + Buffer.from(apiKey + ":").toString("base64");

  // 1. Fetch all models for this account
  let accountModels = null;
  try {
    const listRes = await fetch("https://app.nanonets.com/api/v2/OCR/Model/", {
      method: "GET",
      headers: { Authorization: authHeader },
      cache: "no-store",
    });
    if (listRes.ok) {
      accountModels = await listRes.json();
    } else {
      accountModels = { status: listRes.status, text: await listRes.text() };
    }
  } catch (err: unknown) {
    accountModels = { error: err instanceof Error ? err.message : String(err) };
  }

  const configuredModels = [
    { name: "MODEL_PIB", id: env.MODEL_PIB },
    { name: "MODEL_PIB_LANJUTAN", id: env.MODEL_PIB_LANJUTAN },
    { name: "MODEL_INVOICE", id: env.MODEL_INVOICE },
    { name: "MODEL_BL", id: env.MODEL_BL },
    { name: "MODEL_MASTER_BL", id: env.MODEL_MASTER_BL },
    { name: "MODEL_PACKING_LIST", id: env.MODEL_PACKING_LIST },
    { name: "MODEL_RECAP_DOCUMENT", id: env.MODEL_RECAP_DOCUMENT },
  ];

  const results = [];

  for (const m of configuredModels) {
    if (!m.id) {
      results.push({ model: m.name, id: null, status: "NOT_SET" });
      continue;
    }

    try {
      // Endpoint 1: Model Details query
      const res = await fetch(`https://app.nanonets.com/api/v2/OCR/Model/${m.id}`, {
        method: "GET",
        headers: { Authorization: authHeader },
        cache: "no-store",
      });

      const statusCode = res.status;
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      results.push({
        model: m.name,
        id: m.id,
        status: res.ok ? "CONNECTED" : "FAILED",
        statusCode,
        data,
      });
    } catch (err: unknown) {
      results.push({
        model: m.name,
        id: m.id,
        status: "EXCEPTION",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    apiKeyUsed: `${apiKey.substring(0, 8)}...`,
    accountModels,
    results,
  });
}
