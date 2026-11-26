import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { env } from "~/env";
import { CATEGORY_MODEL_MAP } from "~/server/nanonets";
import { logSystemAudit } from "~/server/auditLogger";

const SETTINGS_FILE_PATH = path.join(process.cwd(), "src", "config", "system_settings.json");

interface ModelConfig {
  name: string;
  key: string;
  modelId: string;
  status: "Active" | "Testing" | "Inactive";
}

interface SystemSettings {
  apiKey: string;
  strictMatching: boolean;
  autoMatchingTrigger: boolean;
  models: ModelConfig[];
}

function getDefaultSettings(): SystemSettings {
  const defaultModels: ModelConfig[] = [
    { name: "PIB (Pemberitahuan Impor Barang)", key: "pib", modelId: CATEGORY_MODEL_MAP["PIB"] || env.MODEL_PIB || "233e650f-2b0e-4c56-8d98-35f40e032a60", status: "Active" },
    { name: "Invoice", key: "invoice", modelId: CATEGORY_MODEL_MAP["Commercial Invoice"] || env.MODEL_INVOICE || "dab11666-7657-46e7-8efb-3fed630ee96e", status: "Active" },
    { name: "Packing List (PL)", key: "packing_list", modelId: CATEGORY_MODEL_MAP["Packing List"] || env.MODEL_PACKING_LIST || "133a8cb8-762f-4002-9878-bbb333706775", status: "Active" },
    { name: "Bill of Lading (BL)", key: "bl", modelId: CATEGORY_MODEL_MAP["Bill of Lading"] || env.MODEL_BL || "53b28ee1-0693-4d6a-8e16-844e405874c9", status: "Active" },
    { name: "Form AK (Certificate of Origin)", key: "ak", modelId: CATEGORY_MODEL_MAP["Form AK"] || env.MODEL_AK || "12a16d1c-9b37-4a19-809f-84e594f541ea", status: "Active" },
    { name: "Weight List (WL)", key: "wl", modelId: CATEGORY_MODEL_MAP["Weight List"] || env.MODEL_WL || "a43ce59b-e997-4fd5-8c7e-cd8eacc033ac", status: "Active" },
    { name: "Mill Test Certificate (MTC)", key: "ms", modelId: CATEGORY_MODEL_MAP["Mill Test Certificate"] || env.MODEL_MS || "09bd8ce7-8037-4ade-a5ed-7f49a9bfd6c8", status: "Active" },
  ];

  return {
    apiKey: env.API_KEY || "80ca02b6-a812-11ef-a5c2-9eec1a95a8bf",
    strictMatching: true,
    autoMatchingTrigger: true,
    models: defaultModels,
  };
}

function normalizeSettingsModels(models: ModelConfig[]): ModelConfig[] {
  return models.map((m) =>
    m.key === "invoice" || /commercial\s*invoice/i.test(m.name || "")
      ? { ...m, name: "Invoice" }
      : m
  );
}

function loadSystemSettings(): SystemSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const raw = fs.readFileSync(SETTINGS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      const merged: SystemSettings = {
        ...getDefaultSettings(),
        ...parsed,
      };
      return {
        ...merged,
        models: normalizeSettingsModels(
          Array.isArray(merged.models) ? merged.models : getDefaultSettings().models
        ),
      };
    }
  } catch (err) {
    console.warn("[SystemSettings] Failed to read settings file, falling back to defaults:", err);
  }
  return getDefaultSettings();
}

function saveSystemSettings(settings: SystemSettings): void {
  const dir = path.dirname(SETTINGS_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

export async function GET() {
  try {
    const settings = loadSystemSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Connection Test Action
    if (body.action === "test-connection") {
      const targetApiKey = body.apiKey || loadSystemSettings().apiKey;
      const startTime = Date.now();

      try {
        const authHeader = `Basic ${Buffer.from(`${targetApiKey}:`).toString("base64")}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch("https://app.nanonets.com/api/v2/OCR/Model/", {
          method: "GET",
          headers: {
            Authorization: authHeader,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;

        if (response.ok) {
          return NextResponse.json({
            success: true,
            status: "connected",
            latency,
            message: `Berhasil terhubung ke Nanonets OCR Engine API. Latency: ${latency}ms (HTTP ${response.status})`,
          });
        } else if (response.status === 401 || response.status === 403) {
          return NextResponse.json({
            success: false,
            status: "unauthorized",
            latency,
            message: `Kredensial API Key tidak valid atau ditolak oleh Nanonets (HTTP ${response.status}).`,
          });
        } else {
          return NextResponse.json({
            success: false,
            status: "error",
            latency,
            message: `Nanonets API mengembalikan status HTTP ${response.status} (${response.statusText}).`,
          });
        }
      } catch (netErr: any) {
        const latency = Date.now() - startTime;
        if (netErr?.name === "AbortError") {
          return NextResponse.json({
            success: false,
            status: "timeout",
            latency,
            message: "Koneksi ke Nanonets API mengalami timeout (> 8000ms). Periksa koneksi internet.",
          });
        }
        return NextResponse.json({
          success: false,
          status: "network_error",
          latency,
          message: `Gagal menghubungi server Nanonets: ${netErr?.message || "Network unreachable"}`,
        });
      }
    }

    // 2. Save Settings Action
    const current = loadSystemSettings();
    const updated: SystemSettings = {
      apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : current.apiKey,
      strictMatching: typeof body.strictMatching === "boolean" ? body.strictMatching : current.strictMatching,
      autoMatchingTrigger: typeof body.autoMatchingTrigger === "boolean" ? body.autoMatchingTrigger : current.autoMatchingTrigger,
      models: Array.isArray(body.models) ? body.models : current.models,
    };

    saveSystemSettings(updated);

    await logSystemAudit({
      action: "UPDATE",
      category: "SYSTEM_SETTING",
      title: "Perbarui Pengaturan OCR & Engine",
      details: `Memperbarui konfigurasi sistem (Kredensial API, Mode Strict: ${updated.strictMatching ? "Aktif" : "Nonaktif"}, Model OCR: ${updated.models.length} model).`,
      metadata: {
        strictMatching: updated.strictMatching,
        autoMatchingTrigger: updated.autoMatchingTrigger,
        modelCount: updated.models.length,
      },
    }).catch((err) => console.warn("[Audit] Failed to log Settings update:", err));

    return NextResponse.json({
      success: true,
      message: "Konfigurasi sistem berhasil disimpan.",
      settings: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
