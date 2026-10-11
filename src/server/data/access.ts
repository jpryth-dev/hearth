import "server-only";

import type { AccessLevel } from "@/generated/prisma/client";
import { uuidSchema } from "@/lib/schemas";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

import type { Actor } from "./actor";

/** What an actor may do with an album, from least to most. */
export type AlbumRole = AccessLevel | "OWNER";

const RANK: Record<AlbumRole, number> = { VIEW: 1, CONTRIBUTE: 2, OWNER: 3 };

/**
 * The actor's role on an album, or null if they have none.
 *
 * The single source of truth for album visibility: the owner, or a holder of
 * an AlbumAccess row. Nothing else, including the ADMIN role, grants access.
 * Soft-deleted albums return null for everyone, the owner included.
 */
export async function albumRole(actor: Actor, albumId: string): Promise<AlbumRole | null> {
  const album = await db.album.findFirst({
    where: { id: albumId, deletedAt: null },
    select: { ownerId: true, access: { where: { userId: actor.id }, select: { accessLevel: true } } },
  });
  if (!album) return null;
  if (album.ownerId === actor.id) return "OWNER";
  return album.access[0]?.accessLevel ?? null;
}

/**
 * Checks the actor holds at least `minimum` on an album.
 *
 * Checks: the id is a UUID; the album exists and isn't deleted; the actor's
 * role ranks at or above `minimum`.
 *
 * @returns the validated album id and the actor's role.
 * @throws NotFoundError when any check fails, so a stranger can't tell a
 * private album from a missing one. Denials on well-formed ids are audited
 * as ACCESS_DENIED.
 */
export async function requireAlbumRole(
  actor: Actor,
  rawAlbumId: string,
  minimum: AlbumRole,
  operation: string,
): Promise<{ albumId: string; role: AlbumRole }> {
  const id = uuidSchema.safeParse(rawAlbumId);
  if (!id.success) throw new NotFoundError("album");

  const role = await albumRole(actor, id.data);
  if (!role || RANK[role] < RANK[minimum]) {
    await recordAudit({
      action: "ACCESS_DENIED",
      actorUserId: actor.id,
      targetType: "album",
      targetId: id.data,
      ipAddress: actor.ipAddress,
      details: { operation, required: minimum, held: role },
    });
    throw new NotFoundError("album");
  }
  return { albumId: id.data, role };
}
