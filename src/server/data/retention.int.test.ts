import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { signedGetUrl } from "@/server/storage";

import { resetDatabase } from "../../../tests/db";
import { albumWorld } from "../../../tests/factories";
import { FAMILY_PHOTO_EXIF, jpegWithExif } from "../../../tests/images";
import { createSession } from "../auth/session";
import { purgeExpired, RETENTION_DAYS, type SystemJob } from "./retention";
import { uploadPhoto } from "./photos";

const JOB: SystemJob = { kind: "system", name: "test" };
const DAY = 24 * 60 * 60 * 1000;
type World = Awaited<ReturnType<typeof albumWorld>>;

async function objectStatus(storageKey: string) {
  return (await fetch(await signedGetUrl(`${storageKey}/full`))).status;
}

describe("purgeExpired", () => {
  let w: World;
  beforeEach(async () => {
    await resetDatabase();
    w = await albumWorld();
  });
  afterAll(() => db.$disconnect());

  async function photo(albumId = w.shared.id) {
    const result = await uploadPhoto(w.owner, albumId, { bytes: await jpegWithExif(FAMILY_PHOTO_EXIF), filename: "p.jpg" });
    if (!result.ok) throw new Error(result.reason);
    return db.photo.findUniqueOrThrow({ where: { id: result.photoId } });
  }

  const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

  it("purges photos deleted past the cutoff: files, rows and metadata (GPS) all go", async () => {
    const old = await photo();
    await db.photo.update({ where: { id: old.id }, data: { deletedAt: daysAgo(RETENTION_DAYS + 1) } });
    expect(await objectStatus(old.storageKey)).toBe(200);

    const report = await purgeExpired(JOB);

    expect(report.photosPurged).toBe(1);
    expect(await db.photo.count({ where: { id: old.id } })).toBe(0);
    expect(await db.photoMetadata.count({ where: { photoId: old.id } })).toBe(0);
    expect(await objectStatus(old.storageKey)).toBe(404);
  });

  it("keeps live photos and recently deleted ones", async () => {
    const live = await photo();
    const recent = await photo();
    await db.photo.update({ where: { id: recent.id }, data: { deletedAt: daysAgo(RETENTION_DAYS - 1) } });

    expect((await purgeExpired(JOB)).photosPurged).toBe(0);
    expect(await objectStatus(live.storageKey)).toBe(200);
    expect(await objectStatus(recent.storageKey)).toBe(200);
  });

  it("purges an old deleted album with its photos and access rows, keeping the audit trail", async () => {
    const inAlbum = await photo(w.shared.id);
    await db.album.update({ where: { id: w.shared.id }, data: { deletedAt: daysAgo(RETENTION_DAYS + 5) } });
    const auditBefore = await db.auditLog.count();

    const report = await purgeExpired(JOB);

    expect(report).toMatchObject({ photosPurged: 1 });
    expect(await db.album.count({ where: { id: w.shared.id } })).toBe(0);
    expect(await db.albumAccess.count({ where: { albumId: w.shared.id } })).toBe(0);
    expect(await objectStatus(inAlbum.storageKey)).toBe(404);
    expect(await db.auditLog.count()).toBe(auditBefore);
    // The fixture's other deleted album is only seconds old: kept.
    expect(await db.album.count({ where: { id: w.deleted.id } })).toBe(1);
  });

  it("removes expired sessions and sign-in links only", async () => {
    const expired = await createSession(w.viewer.id, daysAgo(RETENTION_DAYS + 31));
    const live = await createSession(w.viewer.id);
    await db.loginToken.create({ data: { userId: w.viewer.id, tokenHash: "a".repeat(64), expiresAt: daysAgo(1) } });
    await db.loginToken.create({ data: { userId: w.viewer.id, tokenHash: "b".repeat(64), expiresAt: new Date(Date.now() + DAY) } });

    const report = await purgeExpired(JOB);

    expect(report).toMatchObject({ sessionsDeleted: 1, signInLinksDeleted: 1 });
    expect(await db.session.count()).toBe(1);
    expect(expired.token).not.toBe(live.token);
  });

  it("is idempotent", async () => {
    const old = await photo();
    await db.photo.update({ where: { id: old.id }, data: { deletedAt: daysAgo(RETENTION_DAYS + 1) } });
    await purgeExpired(JOB);
    expect(await purgeExpired(JOB)).toEqual({ photosPurged: 0, albumsPurged: 0, sessionsDeleted: 0, signInLinksDeleted: 0 });
  });
});
