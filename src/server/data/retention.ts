import "server-only";

import { db } from "@/server/db";
import { deleteObjects } from "@/server/storage";

/**
 * Stands in for the acting user in maintenance jobs that run with nobody
 * signed in. Only scripts create one; ESLint keeps this module out of
 * src/app/, so no request can reach these functions.
 */
export interface SystemJob {
  kind: "system";
  name: string;
}

/** How long soft-deleted photos and albums are kept before purging. */
export const RETENTION_DAYS = 30;

const BATCH = 100;

/** Counts of what one purge run removed. */
export interface PurgeReport {
  photosPurged: number;
  albumsPurged: number;
  sessionsDeleted: number;
  signInLinksDeleted: number;
}

/**
 * Permanently removes what soft delete only hid, once it's older than the
 * retention period:
 * - photos deleted, or in an album deleted, before the cutoff, plus failed
 *   (REJECTED) uploads: storage objects first, then rows (PhotoMetadata,
 *   including GPS, goes by cascade)
 * - albums deleted before the cutoff once their photos are gone (access
 *   rows go by cascade)
 * - expired sessions and sign-in links
 *
 * Audit rows are kept. Safe to re-run: if storage fails, rows stay so the
 * next run retries.
 *
 * @throws if storage deletion fails (nothing for that batch is removed).
 */
export async function purgeExpired(
  _job: SystemJob,
  now: Date = new Date(),
  retentionDays: number = RETENTION_DAYS,
): Promise<PurgeReport> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const purgeable = {
    OR: [
      { deletedAt: { lt: cutoff } },
      { album: { deletedAt: { lt: cutoff } } },
      { status: "REJECTED" as const, createdAt: { lt: cutoff } },
    ],
  };

  let photosPurged = 0;
  for (;;) {
    const batch = await db.photo.findMany({ where: purgeable, select: { id: true, storageKey: true }, take: BATCH });
    if (batch.length === 0) break;
    await deleteObjects(batch.flatMap((p) => [`${p.storageKey}/full`, `${p.storageKey}/thumb`]));
    const { count } = await db.photo.deleteMany({ where: { id: { in: batch.map((p) => p.id) } } });
    photosPurged += count;
  }

  const albums = await db.album.deleteMany({ where: { deletedAt: { lt: cutoff }, photos: { none: {} } } });
  const sessions = await db.session.deleteMany({ where: { expires: { lt: now } } });
  const links = await db.loginToken.deleteMany({ where: { expiresAt: { lt: now } } });

  return {
    photosPurged,
    albumsPurged: albums.count,
    sessionsDeleted: sessions.count,
    signInLinksDeleted: links.count,
  };
}
