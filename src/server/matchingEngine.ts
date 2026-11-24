import {
  evaluateCanonicalBatchMatching,
  type CanonicalBatchReport,
  type FieldComparisonResult,
  type MatchedItemResult,
  type StandardLineItem,
  getFieldVal,
  getVal,
  getItemField,
  extractStandardLineItem,
  matchDocumentItemsStrict,
  parseDocIsi,
  compareFieldStrict,
} from "~/utils/canonicalMatcher";
import { loadServerEquivalencyGroups, type DbEquivalencyGroup } from "~/server/equivalencyLoader";

export {
  evaluateCanonicalBatchMatching,
  type CanonicalBatchReport,
  type FieldComparisonResult,
  type MatchedItemResult,
  type StandardLineItem,
  getFieldVal,
  getVal,
  getItemField,
  extractStandardLineItem,
  matchDocumentItemsStrict,
  parseDocIsi,
  compareFieldStrict,
};

/**
 * Server-side Canonical Matching Evaluator.
 * Loads active equivalency groups from MySQL database via Prisma and executes canonical match.
 */
export async function evaluateBatchMatchingCanonical(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Array<{ fileType: string; isi?: string | null; [key: string]: any }>,
  totalFile?: number,
  batchId = "0"
): Promise<CanonicalBatchReport> {
  const serverGroups = await loadServerEquivalencyGroups();
  return evaluateCanonicalBatchMatching(details, totalFile, batchId, serverGroups);
}

/**
 * Synchronous canonical evaluation for webhooks and API routes.
 */
export function evaluateBatchMatchingSync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Array<{ fileType: string; isi?: string | null; [key: string]: any }>,
  totalFile?: number,
  batchId = "0"
): CanonicalBatchReport {
  return evaluateCanonicalBatchMatching(details, totalFile, batchId);
}

import { evaluateBatchComparison } from "~/app/matching/_components/detailAdapter";

/**
 * Evaluates batch status for DB batches using unified detailAdapter comparison engine.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function evaluateDbBatchStatus(details: any[], totalFile?: number, dbGroups?: DbEquivalencyGroup[]): "Matching" | "Mismatching" | "Proses" {
  const result = evaluateBatchComparison({ details, totalFile }, dbGroups);
  return result.status;
}
