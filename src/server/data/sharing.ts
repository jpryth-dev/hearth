import "server-only";

import type { AccessLevel } from "@/generated/prisma/client";
import { accessLevelSchema, emailSchema, uuidSchema } from "@/lib/schemas";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";

import { requireAlbumRole } from "./access";
import type { Actor } from "./actor";

export interface AlbumMember {
  userId: string;
  displayName: string;
  email: string;
  accessLevel: AccessLevel;
}

export type GrantResult =
  | { ok: true; change: "granted" | "changed" | "unchanged" }
  | { ok: false; reason: "invalid_email" | "invalid_level" | "no_such_member" | "self" };

/**
 * Who the album is shared with, by name.
 *
 * Checks: requireAlbumRole(OWNER). Viewers and contributors don't see the
 * list; they only know the album was shared with them.
 * @throws NotFoundError if the actor isn't the owner (audited).
 */
export async function listAlbumAccess(actor: Actor, rawAlbumId: string): Promise<AlbumMember[]> {
  const { albumId } = await requireAlbumRole(actor, rawAlbumId, "OWNER", "listAlbumAccess");
  const rows = await db.albumAccess.findMany({
    where: { albumId },
    include: { user: { select: { displayName: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    userId: r.userId,
    displayName: r.user.displayName,
    email: r.user.email,
    accessLevel: r.accessLevel,
  }));
}

/**
 * Shares an album with an existing member, or changes their level.
 *
 * Checks: requireAlbumRole(OWNER); email and level are valid; the email
 * belongs to an ACTIVE user who isn't the owner. Audited as ACCESS_GRANTED
 * or ACCESS_CHANGED.
 * @throws NotFoundError if the actor isn't the owner (audited).
 */
export async function grantAlbumAccess(
  actor: Actor,
  rawAlbumId: string,
  rawEmail: string,
  rawLevel: string,
): Promise<GrantResult> {
  const { albumId } = await requireAlbumRole(actor, rawAlbumId, "OWNER", "grantAlbumAccess");

  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) return { ok: false, reason: "invalid_email" };
  const level = accessLevelSchema.safeParse(rawLevel);
  if (!level.success) return { ok: false, reason: "invalid_level" };

  const grantee = await db.user.findUnique({ where: { email: email.data } });
  if (!grantee || grantee.status !== "ACTIVE") return { ok: false, reason: "no_such_member" };
  if (grantee.id === actor.id) return { ok: false, reason: "self" };

  return db.$transaction(async (tx) => {
    const existing = await tx.albumAccess.findUnique({
      where: { albumId_userId: { albumId, userId: grantee.id } },
    });
    if (existing?.accessLevel === level.data) return { ok: true, change: "unchanged" } as const;

    await tx.albumAccess.upsert({
      where: { albumId_userId: { albumId, userId: grantee.id } },
      create: { albumId, userId: grantee.id, accessLevel: level.data, grantedByUserId: actor.id },
      update: { accessLevel: level.data, grantedByUserId: actor.id },
    });
    await recordAudit(
      {
        action: existing ? "ACCESS_CHANGED" : "ACCESS_GRANTED",
        actorUserId: actor.id,
        targetType: "album",
        targetId: albumId,
        ipAddress: actor.ipAddress,
        details: { userId: grantee.id, accessLevel: level.data, ...(existing && { previous: existing.accessLevel }) },
      },
      tx,
    );
    return { ok: true, change: existing ? "changed" : "granted" } as const;
  });
}

/**
 * Removes someone's access. Effective immediately: every read checks
 * AlbumAccess at request time, and nothing caches it.
 *
 * Checks: requireAlbumRole(OWNER). Audited as ACCESS_REVOKED.
 * @returns false if the user id is malformed or had no access.
 * @throws NotFoundError if the actor isn't the owner (audited).
 */
export async function revokeAlbumAccess(actor: Actor, rawAlbumId: string, rawUserId: string): Promise<boolean> {
  const { albumId } = await requireAlbumRole(actor, rawAlbumId, "OWNER", "revokeAlbumAccess");
  const userId = uuidSchema.safeParse(rawUserId);
  if (!userId.success) return false;

  return db.$transaction(async (tx) => {
    const { count } = await tx.albumAccess.deleteMany({ where: { albumId, userId: userId.data } });
    if (count === 0) return false;
    await recordAudit(
      {
        action: "ACCESS_REVOKED",
        actorUserId: actor.id,
        targetType: "album",
        targetId: albumId,
        ipAddress: actor.ipAddress,
        details: { userId: userId.data },
      },
      tx,
    );
    return true;
  });
}
