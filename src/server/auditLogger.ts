import { db } from "~/server/db";
import { auth } from "~/server/auth";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "OVERRIDE";
export type AuditCategory = "DATA_ACTION" | "EQUIVALENCY" | "BATCH_DATA" | "SYSTEM_SETTING";

export interface LogAuditParams {
  action: AuditAction;
  category: AuditCategory;
  title: string;
  details?: string;
  metadata?: Record<string, unknown> | string;
  ipAddress?: string;
  userName?: string;
  userEmail?: string;
  userId?: string;
}

export async function logSystemAudit(params: LogAuditParams) {
  try {
    let { userName, userEmail, userId } = params;

    if (!userName && !userEmail) {
      const session = await auth().catch(() => null);
      if (session?.user) {
        userName = session.user.name || undefined;
        userEmail = session.user.email || undefined;
        userId = session.user.id || undefined;
      }
    }

    const metaStr =
      typeof params.metadata === "object"
        ? JSON.stringify(params.metadata)
        : params.metadata;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (db as any).systemAuditLog.create({
      data: {
        action: params.action,
        category: params.category,
        title: params.title,
        details: params.details || "",
        metadata: metaStr || null,
        userName: userName || "Operator",
        userEmail: userEmail || "operator@usc.co.id",
        userId: userId || null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err) {
    console.warn("Gagal mencatat audit log sistem:", err);
    return null;
  }
}
