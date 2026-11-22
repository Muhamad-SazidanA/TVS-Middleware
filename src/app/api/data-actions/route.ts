import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { WorkflowStep } from "~/types/workflow";

export const dynamic = "force-dynamic";

const CONFIG_PATH = path.join(process.cwd(), "src", "config", "data_actions.json");

function readConfigSteps(): WorkflowStep[] {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WorkflowStep[]) : [];
  } catch (err) {
    console.warn("[DataActions API] Failed to read config:", err);
    return [];
  }
}

function writeConfigSteps(steps: WorkflowStep[]): boolean {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(steps, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("[DataActions API] Failed to write config:", err);
    return false;
  }
}

export async function GET() {
  try {
    const steps = readConfigSteps();
    return NextResponse.json({
      success: true,
      steps,
      total: steps.length,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !Array.isArray(body.steps)) {
      return NextResponse.json(
        { success: false, message: "Payload tidak valid: array 'steps' wajib disertakan" },
        { status: 400 }
      );
    }
    const steps = body.steps as WorkflowStep[];

    const ok = writeConfigSteps(steps);
    if (!ok) {
      return NextResponse.json(
        { success: false, message: "Gagal menyimpan konfigurasi Data Actions ke server" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Konfigurasi Data Actions berhasil disimpan di server",
      count: steps.length,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}

