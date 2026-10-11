import "server-only";

import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export type AuditTarget = "album" | "photo" | "user" | "invitation";

export interface AuditEntry {
  action: AuditAction;
  /** Null for anonymous events, such as a bad sign-in link. */
  actorUserId: string | null;
  targetType?: AuditTarget;
  targetId?: string;
  ipAddress?: string | null;
  /** Never put tokens, signed URLs or raw EXIF here. */
  details?: Prisma.InputJsonObject;
}

/**
 * Appends an AuditLog row. Pass the transaction client when the event is part
 * of a larger write, so the audit row commits or rolls back with it.
 */
export async function recordAudit(
  entry: AuditEntry,
  client: Prisma.TransactionClient = db,
): Promise<void> {
  await client.auditLog.create({
    data: {
      action: entry.action,
      actorUserId: entry.actorUserId,
      targetType: entry.targetType,
      targetId: entry.targetId,
      ipAddress: entry.ipAddress ?? null,
      details: entry.details,
    },
  });
}
