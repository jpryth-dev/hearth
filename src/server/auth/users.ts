import "server-only";

import type { UserRole, UserStatus } from "@/generated/prisma/client";
import { uuidSchema } from "@/lib/schemas";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";

import { assertAdmin } from "./admin-guard";
import type { SessionUser } from "./session";

export interface ManagedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  joinedAt: Date;
}

export type StatusChangeResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "self" | "last_admin" | "unchanged" };

export interface AdminContext {
  actor: SessionUser;
  ipAddress: string | null;
}

/**
 * Everyone with an account, for the admin user list.
 *
 * @throws ForbiddenError if the actor isn't an admin (audited).
 */
export async function listUsers(ctx: AdminContext): Promise<ManagedUser[]> {
  await assertAdmin(ctx.actor, ctx.ipAddress, "listUsers");
  const rows = await db.user.findMany({ orderBy: [{ status: "asc" }, { displayName: "asc" }] });
  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    joinedAt: u.createdAt,
  }));
}

/**
 * Switches a user off. Their sessions and unused sign-in links are deleted in
 * the same transaction, so they're out on their very next request.
 *
 * Checks: actor is ADMIN; the target exists and isn't the actor; disabling
 * wouldn't leave no active admin. Audited as USER_DISABLED.
 * @throws ForbiddenError if the actor isn't an admin (audited).
 */
export async function disableUser(ctx: AdminContext, rawUserId: string): Promise<StatusChangeResult> {
  await assertAdmin(ctx.actor, ctx.ipAddress, "disableUser");
  const id = uuidSchema.safeParse(rawUserId);
  if (!id.success) return { ok: false, reason: "not_found" };
  if (id.data === ctx.actor.id) return { ok: false, reason: "self" };

  return db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: id.data } });
    if (!target) return { ok: false, reason: "not_found" } as const;
    if (target.status === "DISABLED") return { ok: false, reason: "unchanged" } as const;
    if (target.role === "ADMIN") {
      const otherActiveAdmins = await tx.user.count({
        where: { role: "ADMIN", status: "ACTIVE", id: { not: target.id } },
      });
      if (otherActiveAdmins === 0) return { ok: false, reason: "last_admin" } as const;
    }

    await tx.user.update({ where: { id: target.id }, data: { status: "DISABLED" } });
    await tx.session.deleteMany({ where: { userId: target.id } });
    await tx.loginToken.deleteMany({ where: { userId: target.id, usedAt: null } });
    await recordAudit(
      { action: "USER_DISABLED", actorUserId: ctx.actor.id, targetType: "user", targetId: target.id, ipAddress: ctx.ipAddress },
      tx,
    );
    return { ok: true } as const;
  });
}

/**
 * Switches a user back on. They sign in again with an emailed link; their
 * albums and grants were never removed.
 *
 * Checks: actor is ADMIN; the target exists and is DISABLED. Audited as USER_ENABLED.
 * @throws ForbiddenError if the actor isn't an admin (audited).
 */
export async function enableUser(ctx: AdminContext, rawUserId: string): Promise<StatusChangeResult> {
  await assertAdmin(ctx.actor, ctx.ipAddress, "enableUser");
  const id = uuidSchema.safeParse(rawUserId);
  if (!id.success) return { ok: false, reason: "not_found" };

  const { count } = await db.user.updateMany({ where: { id: id.data, status: "DISABLED" }, data: { status: "ACTIVE" } });
  if (count === 0) {
    const exists = await db.user.count({ where: { id: id.data } });
    return { ok: false, reason: exists ? "unchanged" : "not_found" };
  }
  await recordAudit({
    action: "USER_ENABLED",
    actorUserId: ctx.actor.id,
    targetType: "user",
    targetId: id.data,
    ipAddress: ctx.ipAddress,
  });
  return { ok: true };
}
