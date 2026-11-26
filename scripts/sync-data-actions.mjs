import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export const LEGACY_HIDDEN_GLOBAL_STEP_IDS = new Set([
  "step-1794889000001",
  "step-1794889000002",
]);

export const DEFAULT_DATA_ACTIONS_PATH = path.resolve(
  process.cwd(),
  "src",
  "config",
  "data_actions.json"
);

export const DEFAULT_SYNC_MARKER_PATH = path.resolve(
  process.cwd(),
  "src",
  "config",
  ".data-actions-v2-synced"
);

/**
 * One-time migration for persisted Docker config volumes: removes the two legacy hidden
 * `docScope: "all"` dimension rules while leaving every user-configured step untouched.
 */
export function syncDataActionsConfigIfNeeded(options = {}) {
  const {
    configPath = DEFAULT_DATA_ACTIONS_PATH,
    markerPath = DEFAULT_SYNC_MARKER_PATH,
    logger = console,
  } = options;

  if (fs.existsSync(markerPath)) {
    return { skipped: true, removedCount: 0 };
  }

  let removedCount = 0;
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter(
        (step) => !LEGACY_HIDDEN_GLOBAL_STEP_IDS.has(String(step?.id || ""))
      );
      removedCount = parsed.length - filtered.length;
      if (removedCount > 0) {
        fs.writeFileSync(configPath, JSON.stringify(filtered, null, 2), "utf-8");
      }
    }
  }

  const markerDir = path.dirname(markerPath);
  if (!fs.existsSync(markerDir)) {
    fs.mkdirSync(markerDir, { recursive: true });
  }
  fs.writeFileSync(markerPath, new Date().toISOString(), "utf-8");

  logger.log(
    removedCount > 0
      ? `[data-actions-sync] Removed ${removedCount} hidden legacy rule(s) from ${path.basename(configPath)}.`
      : "[data-actions-sync] Data Actions config already clean."
  );

  return { skipped: false, removedCount };
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  try {
    syncDataActionsConfigIfNeeded();
  } catch (err) {
    console.error("[data-actions-sync] Failed:", err);
    process.exitCode = 1;
  }
}
