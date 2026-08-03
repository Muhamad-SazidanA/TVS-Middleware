import { NextResponse } from "next/server";
import { env } from "~/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = env.API_KEY || "244bd61f-32b0-11ef-94f2-cec13431d72d";
  const authHeader = "Basic " + Buffer.from(apiKey + ":").toString("base64");

  // 1. Get all models associated with this account
  let accountModels = null;
  try {
    const listRes = await fetch("https://app.nanonets.com/api/v2/OCR/Model/", {
      method: "GET",
      headers: { Authorization: authHeader },
      cache: "no-store",
    });
    const text = await listRes.text();
    try {
      accountModels = JSON.parse(text);
    } catch {
      accountModels = { status: listRes.status, rawText: text };
    }
  } catch (err: unknown) {
    accountModels = { error: err instanceof Error ? err.message : String(err) };
  }

  // 2. Test each model ID in .env
  const configuredModels = [
    { name: "MODEL_PIB", id: env.MODEL_PIB },
    { name: "MODEL_PIB_LANJUTAN", id: env.MODEL_PIB_LANJUTAN },
    { name: "MODEL_INVOICE", id: env.MODEL_INVOICE },
    { name: "MODEL_BL", id: env.MODEL_BL },
    { name: "MODEL_MASTER_BL", id: env.MODEL_MASTER_BL },
    { name: "MODEL_PACKING_LIST", id: env.MODEL_PACKING_LIST },
    { name: "MODEL_RECAP_DOCUMENT", id: env.MODEL_RECAP_DOCUMENT },
  ];

  const modelResults = [];

  for (const m of configuredModels) {
    if (!m.id) {
      modelResults.push({ modelName: m.name, id: null, status: "MISSING_IN_ENV" });
      continue;
    }

    try {
      // Nanonets OCR model details endpoint
      const res = await fetch(`https://app.nanonets.com/api/v2/OCR/Model/${m.id}`, {
        method: "GET",
        headers: { Authorization: authHeader },
        cache: "no-store",
      });

      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      modelResults.push({
        modelName: m.name,
        modelId: m.id,
        status: res.ok ? "CONNECTED_OK" : `FAILED_${res.status}`,
        statusCode: res.status,
        response: parsed,
      });
    } catch (err: unknown) {
      modelResults.push({
        modelName: m.name,
        modelId: m.id,
        status: "EXCEPTION",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    apiKeyConfigured: `${apiKey.substring(0, 8)}...`,
    accountModels,
    modelResults,
  });
}
