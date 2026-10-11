import "server-only";

import { recordAudit } from "@/server/audit";
import { ForbiddenError } from "@/server/errors";

import type { SessionUser } from "./session";

/**
 * Throws unless the actor is an admin. Denials are audited as ACCESS_DENIED
 * first, so probing admin functions shows up in the activity report.
 *
 * Admin grants user and invitation management only, never album access.
 * @throws ForbiddenError for non-admins.
 */
export async function assertAdmin(actor: SessionUser, ipAddress: string | null, operation: string): Promise<void> {
  if (actor.role === "ADMIN") return;
  await recordAudit({ action: "ACCESS_DENIED", actorUserId: actor.id, ipAddress, details: { operation } });
  throw new ForbiddenError(operation);
}
