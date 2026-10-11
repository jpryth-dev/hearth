import "server-only";

import { albumInputSchema, type AlbumInput } from "@/lib/schemas";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";

import { requireAlbumRole, type AlbumRole } from "./access";
import type { Actor } from "./actor";

/** An album as the UI sees it, with the viewer's own role on it. */
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

/** Created/updated id, or the first error per field for the form. */
export type AlbumWriteResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

/**
 * Creates an album owned by the actor. Any signed-in member may create one;
 * it starts visible to the owner only.
 *
 * Checks: input passes albumInputSchema. Audited as ALBUM_CREATED.
 */
export async function createAlbum(actor: Actor, input: AlbumInput): Promise<AlbumWriteResult> {
  const parsed = albumInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error.issues) };

  const album = await db.$transaction(async (tx) => {
    const created = await tx.album.create({ data: { ownerId: actor.id, ...parsed.data } });
    await recordAudit(
      { action: "ALBUM_CREATED", actorUserId: actor.id, targetType: "album", targetId: created.id, ipAddress: actor.ipAddress },
      tx,
    );
    return created;
  });
  return { ok: true, id: album.id };
}

/**
 * Renames or re-describes an album.
 *
 * Checks: requireAlbumRole(OWNER); input passes albumInputSchema.
 * @throws NotFoundError if the actor isn't the owner (audited).
 */
export async function updateAlbum(actor: Actor, rawAlbumId: string, input: AlbumInput): Promise<AlbumWriteResult> {
  const { albumId } = await requireAlbumRole(actor, rawAlbumId, "OWNER", "updateAlbum");
  const parsed = albumInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error.issues) };

  await db.album.update({ where: { id: albumId }, data: parsed.data });
  return { ok: true, id: albumId };
}

/**
 * Soft-deletes an album. It disappears for everyone at once, because every
 * read filters on deletedAt; access rows are kept for the audit trail.
 *
 * Checks: requireAlbumRole(OWNER). Audited as ALBUM_DELETED.
 * @throws NotFoundError if the actor isn't the owner (audited).
 */
export async function deleteAlbum(actor: Actor, rawAlbumId: string): Promise<void> {
  const { albumId } = await requireAlbumRole(actor, rawAlbumId, "OWNER", "deleteAlbum");
  await db.$transaction(async (tx) => {
    await tx.album.update({ where: { id: albumId }, data: { deletedAt: new Date() } });
    await recordAudit(
      { action: "ALBUM_DELETED", actorUserId: actor.id, targetType: "album", targetId: albumId, ipAddress: actor.ipAddress },
      tx,
    );
  });
}
