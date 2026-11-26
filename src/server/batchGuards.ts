import { db } from "~/server/db";
import {
  isDetailPendingOcr,
  getLockErrorForBatchRecord,
  type BatchLockCheckResult,
} from "~/utils/workflowStatus";

export { isDetailPendingOcr, getLockErrorForBatchRecord, type BatchLockCheckResult };

export async function getBatchMutationLock(batchId: string): Promise<BatchLockCheckResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batch = await (db as any).batch.findUnique({
    where: { id: batchId },
    include: { details: true },
  });
  return getLockErrorForBatchRecord(batch);
}
