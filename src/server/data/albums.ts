import "server-only";

import { db } from "@/server/db";

import { requireAlbumRole, type AlbumRole } from "./access";
import type { Actor } from "./actor";

export interface AlbumSummary {
  id: string;
  title: string;
  description: string | null;
  ownerName: string;
  role: AlbumRole;
  createdAt: Date;
}

/**
 * Every album the actor owns or has been granted, newest first. Soft-deleted
 * albums are excluded.
 */
export async function listVisibleAlbums(actor: Actor): Promise<AlbumSummary[]> {
  const rows = await db.album.findMany({
    where: {
      deletedAt: null,
      OR: [{ ownerId: actor.id }, { access: { some: { userId: actor.id } } }],
    },
    include: {
      owner: { select: { displayName: true } },
      access: { where: { userId: actor.id }, select: { accessLevel: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    ownerName: a.owner.displayName,
    // The where clause guarantees one of these holds.
    role: a.ownerId === actor.id ? "OWNER" : (a.access[0]?.accessLevel ?? "VIEW"),
    createdAt: a.createdAt,
  }));
}

/**
 * One album, if the actor may view it.
 *
 * Checks: requireAlbumRole(VIEW).
 * @throws NotFoundError if the album is missing, deleted or not visible.
 */
export async function getAlbum(actor: Actor, rawAlbumId: string): Promise<AlbumSummary> {
  const { albumId, role } = await requireAlbumRole(actor, rawAlbumId, "VIEW", "getAlbum");
  const album = await db.album.findUniqueOrThrow({
    where: { id: albumId },
    include: { owner: { select: { displayName: true } } },
  });
  return {
    id: album.id,
    title: album.title,
    description: album.description,
    ownerName: album.owner.displayName,
    role,
    createdAt: album.createdAt,
  };
}
