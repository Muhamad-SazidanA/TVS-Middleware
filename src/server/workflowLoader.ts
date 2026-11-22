import fs from "fs";
import path from "path";
import type { WorkflowStep } from "~/types/workflow";

const CONFIG_PATH = path.join(process.cwd(), "src", "config", "data_actions.json");

/**
 * Loads server-side workflow steps from src/config/data_actions.json
 * Kept strictly in server module to prevent Webpack client-bundle 'fs' errors.
 */
export async function loadServerWorkflowSteps(): Promise<WorkflowStep[]> {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return [];
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WorkflowStep[]) : [];
  } catch (err) {
    console.warn("[workflowLoader] Failed to read config:", err);
    return [];
  }
}

/**
 * Persists workflow steps to src/config/data_actions.json
 */
export function saveServerWorkflowSteps(steps: WorkflowStep[]): boolean {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(steps, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("[workflowLoader] Failed to save config:", err);
    return false;
  }
}
