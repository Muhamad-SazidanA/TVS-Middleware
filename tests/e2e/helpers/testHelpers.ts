import fs from "fs";
import path from "path";

// Ensure environment validation does not block pure unit/E2E runner execution
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = process.env.DATABASE_URL || "mysql://user:pass@localhost:3306/usc_middleware";

/**
 * Loads a JSON fixture from the tests/e2e/fixtures directory
 */
export function loadFixture<T = any>(fixtureFileName: string): T {
  const filePath = path.join(process.cwd(), "tests", "e2e", "fixtures", fixtureFileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fixture not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Normalizes an HS Code for customs comparison (strips dots, spaces, dashes)
 */
export function normalizeHsCode(hs?: string | null): string {
  if (!hs) return "";
  return hs.replace(/[^0-9]/g, "").trim();
}

/**
 * Normalizes alphanumeric identifiers (e.g. invoice numbers, B/L numbers)
 */
export function normalizeIdentifier(val?: string | null): string {
  if (!val) return "";
  return val.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Parses numeric values safely (handles commas, currency symbols, whitespace)
 */
export function parseNumericValue(val?: string | number | null): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val)
    .replace(/(?:USD|IDR|Rp|RP|\$|EUR|SGD|JPY|CNY)\s*/gi, "")
    .replace(/\s*(?:kg|kgs|pcs|pc|ton|ctn|pkgs|pkg)\b/gi, "")
    .replace(/,/g, "")
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Compares two numeric values with optional epsilon tolerance
 */
export function areNumbersEqual(a: number, b: number, epsilon = 0.01): boolean {
  return Math.abs(a - b) <= epsilon;
}
