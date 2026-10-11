import "server-only";

import { randomUUID } from "node:crypto";

import { photoFilenameSchema, uuidSchema } from "@/lib/schemas";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { processImage, type RejectionReason } from "@/server/images";
import { deleteObjects, putObject, signedGetUrl } from "@/server/storage";

import { requireAlbumRole, type AlbumRole } from "./access";
import type { Actor } from "./actor";

/** The new photo's id, or why the file was refused. */
export type UploadResult = { ok: true; photoId: string } | { ok: false; reason: RejectionReason };

/** A photo in an album grid. */
export interface PhotoSummary {
  id: string;
  width: number | null;
  height: number | null;
  /** Signed, expires in minutes. Don't cache or log. */
  thumbUrl: string;
  uploadedBy: string;
}

/** One photo for its own page. GPS is deliberately absent. */
export interface PhotoDetail {
  id: string;
  albumId: string;
  albumTitle: string;
  /** Signed, expires in minutes. Don't cache or log. */
  fullUrl: string;
  width: number | null;
  height: number | null;
  originalFilename: string | null;
  uploadedBy: string;
  uploadedAt: Date;
  takenAt: Date | null;
  camera: string | null;
  canDelete: boolean;
}

const fullKey = (storageKey: string) => `${storageKey}/full`;
const thumbKey = (storageKey: string) => `${storageKey}/thumb`;

/**
 * Adds a photo to an album.
 *
 * Checks: requireAlbumRole(CONTRIBUTE), before the bytes are touched; then
 * processImage verifies the content, re-encodes it without EXIF/GPS, and
 * extracts metadata. The storage key is a fresh random UUID.
 *
 * Rejected files store nothing and are audited as PHOTO_REJECTED. Accepted
 * ones are audited as PHOTO_UPLOADED.
 * @throws NotFoundError if the actor can't contribute (audited).
 * @throws if storage fails; the row is marked REJECTED and partial objects removed.
 */
export async function uploadPhoto(
  actor: Actor,
  rawAlbumId: string,
  upload: { bytes: Buffer; filename: string },
): Promise<UploadResult> {
  const { albumId } = await requireAlbumRole(actor, rawAlbumId, "CONTRIBUTE", "uploadPhoto");

  const processed = await processImage(upload.bytes);
  if (!processed.ok) {
    await recordAudit({
      action: "PHOTO_REJECTED",
      actorUserId: actor.id,
      targetType: "album",
      targetId: albumId,
      ipAddress: actor.ipAddress,
      details: { reason: processed.reason, byteSize: upload.bytes.length },
    });
    return { ok: false, reason: processed.reason };
  }
  const { full, thumb, metadata, mimeType } = processed.image;

  const storageKey = randomUUID();
  const photo = await db.photo.create({
    data: {
      albumId,
      uploadedByUserId: actor.id,
      storageKey,
      originalFilename: photoFilenameSchema.parse(upload.filename),
      mimeType,
      byteSize: full.data.length,
      width: full.width,
      height: full.height,
      status: "PROCESSING",
    },
  });

  try {
    await putObject(fullKey(storageKey), full.data, mimeType);
    await putObject(thumbKey(storageKey), thumb.data, mimeType);
  } catch (error) {
    await deleteObjects([fullKey(storageKey), thumbKey(storageKey)]).catch(() => undefined);
    await db.photo.update({ where: { id: photo.id }, data: { status: "REJECTED", rejectionReason: "storage_error" } });
    throw error;
  }

  await db.$transaction(async (tx) => {
    await tx.photo.update({ where: { id: photo.id }, data: { status: "READY" } });
    await tx.photoMetadata.create({
      data: {
        photoId: photo.id,
        takenAt: metadata.takenAt,
        cameraMake: metadata.cameraMake,
        cameraModel: metadata.cameraModel,
        gpsLatitude: metadata.gpsLatitude,
        gpsLongitude: metadata.gpsLongitude,
        rawExif: metadata.rawExif ?? undefined,
      },
    });
    await recordAudit(
      { action: "PHOTO_UPLOADED", actorUserId: actor.id, targetType: "photo", targetId: photo.id, ipAddress: actor.ipAddress },
      tx,
    );
  });
  return { ok: true, photoId: photo.id };
}

/**
 * The album's ready, undeleted photos, newest first, with signed thumbnail URLs.
 *
 * Checks: requireAlbumRole(VIEW), before any URL is signed.
 * @throws NotFoundError if the actor can't view the album (audited).
 */
export async function listPhotos(actor: Actor, rawAlbumId: string): Promise<PhotoSummary[]> {
  const { albumId } = await requireAlbumRole(actor, rawAlbumId, "VIEW", "listPhotos");
  const rows = await db.photo.findMany({
    where: { albumId, status: "READY", deletedAt: null },
    include: { uploadedBy: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      thumbUrl: await signedGetUrl(thumbKey(p.storageKey)),
      uploadedBy: p.uploadedBy.displayName,
    })),
  );
}

/** Loads an undeleted, ready photo and checks the actor can view its album. */
async function loadVisiblePhoto(actor: Actor, rawPhotoId: string, operation: string) {
  const id = uuidSchema.safeParse(rawPhotoId);
  if (!id.success) throw new NotFoundError("photo");
  const photo = await db.photo.findFirst({ where: { id: id.data, status: "READY", deletedAt: null } });
  if (!photo) throw new NotFoundError("photo");
  // Audits the denial against the album if the actor can't see it.
  const { role } = await requireAlbumRole(actor, photo.albumId, "VIEW", operation);
  return { photo, role };
}

function mayDelete(actor: Actor, uploaderId: string, role: AlbumRole): boolean {
  return role === "OWNER" || (role === "CONTRIBUTE" && uploaderId === actor.id);
}

/**
 * One photo with a signed full-size URL and display details. GPS is stored
 * but deliberately not returned until a feature needs it.
 *
 * Checks: the photo exists, is READY and undeleted; requireAlbumRole(VIEW)
 * on its album (which also hides photos in deleted albums).
 * @throws NotFoundError otherwise (audited when the photo exists).
 */
export async function getPhoto(actor: Actor, rawPhotoId: string): Promise<PhotoDetail> {
  const { photo, role } = await loadVisiblePhoto(actor, rawPhotoId, "getPhoto");
  const details = await db.photo.findUniqueOrThrow({
    where: { id: photo.id },
    include: {
      album: { select: { title: true } },
      uploadedBy: { select: { displayName: true } },
      metadata: { select: { takenAt: true, cameraMake: true, cameraModel: true } },
    },
  });
  const camera = [details.metadata?.cameraMake, details.metadata?.cameraModel].filter(Boolean).join(" ");
  return {
    id: photo.id,
    albumId: photo.albumId,
    albumTitle: details.album.title,
    fullUrl: await signedGetUrl(fullKey(photo.storageKey)),
    width: photo.width,
    height: photo.height,
    originalFilename: photo.originalFilename,
    uploadedBy: details.uploadedBy.displayName,
    uploadedAt: photo.createdAt,
    takenAt: details.metadata?.takenAt ?? null,
    camera: camera || null,
    canDelete: mayDelete(actor, photo.uploadedByUserId, role),
  };
}

/**
 * Soft-deletes a photo. Its files stay in the bucket but can no longer be
 * signed, because every read filters on deletedAt.
 *
 * Checks: the actor can view the album; and is its owner, or uploaded the
 * photo and still holds CONTRIBUTE. Audited as PHOTO_DELETED.
 * @returns the album id, for redirecting.
 * @throws NotFoundError if the actor can't view it (audited).
 * @throws ForbiddenError if they can view but not delete (audited).
 */
export async function deletePhoto(actor: Actor, rawPhotoId: string): Promise<string> {
  const { photo, role } = await loadVisiblePhoto(actor, rawPhotoId, "deletePhoto");
  if (!mayDelete(actor, photo.uploadedByUserId, role)) {
    await recordAudit({
      action: "ACCESS_DENIED",
      actorUserId: actor.id,
      targetType: "photo",
      targetId: photo.id,
      ipAddress: actor.ipAddress,
      details: { operation: "deletePhoto", held: role },
    });
    throw new ForbiddenError("deletePhoto");
  }
  await db.$transaction(async (tx) => {
    await tx.photo.update({ where: { id: photo.id }, data: { deletedAt: new Date() } });
    await recordAudit(
      { action: "PHOTO_DELETED", actorUserId: actor.id, targetType: "photo", targetId: photo.id, ipAddress: actor.ipAddress },
      tx,
    );
  });
  return photo.albumId;
}
