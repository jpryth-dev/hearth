import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/errors";

import { resetDatabase } from "../../../tests/db";
import { albumWorld, grant, makeActor } from "../../../tests/factories";
import { FAMILY_PHOTO_EXIF, jpegWithExif } from "../../../tests/images";
import { deleteAlbum, listVisibleAlbums } from "./albums";
import { deletePhoto, getPhoto, listPhotos, uploadPhoto } from "./photos";

type World = Awaited<ReturnType<typeof albumWorld>>;

async function fetchImage(url: string) {
  const res = await fetch(url);
  expect(res.status).toBe(200);
  return Buffer.from(await res.arrayBuffer());
}

describe("photos", () => {
  let w: World;
  let photoBytes: Buffer;
  beforeEach(async () => {
    await resetDatabase();
    w = await albumWorld();
    photoBytes = await jpegWithExif(FAMILY_PHOTO_EXIF);
  });
  afterAll(() => db.$disconnect());

  async function upload(who: keyof World = "contributor", albumId = w.shared.id, filename = "beach.jpg") {
    const result = await uploadPhoto(w[who] as World["owner"], albumId, { bytes: photoBytes, filename });
    if (!result.ok) throw new Error(result.reason);
    return result.photoId;
  }

  describe("uploadPhoto", () => {
    it("stores a stripped copy under a random key and keeps metadata in the database", async () => {
      const photoId = await upload("contributor", w.shared.id, "../../etc/beach.jpg");

      const photo = await db.photo.findUniqueOrThrow({ where: { id: photoId }, include: { metadata: true } });
      expect(photo).toMatchObject({ status: "READY", mimeType: "image/webp", originalFilename: "beach.jpg" });
      expect(photo.storageKey).toMatch(/^[0-9a-f-]{36}$/);
      expect(photo.storageKey).not.toContain("beach");
      expect(photo.metadata).toMatchObject({ cameraMake: "TestCam", cameraModel: "T-1000" });
      expect(Number(photo.metadata?.gpsLatitude)).toBe(51.5);

      const stored = await fetchImage((await getPhoto(w.owner, photoId)).fullUrl);
      const meta = await sharp(stored).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(stored.includes(Buffer.from("TestCam"))).toBe(false);

      expect(await db.auditLog.count({ where: { action: "PHOTO_UPLOADED", targetId: photoId } })).toBe(1);
    });

    it("lets the owner upload too", async () => {
      await expect(upload("owner")).resolves.toBeTruthy();
    });

    it.each(["viewer", "stranger", "admin"] as const)("denies the %s and stores nothing", async (who) => {
      await expect(upload(who)).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.photo.count()).toBe(0);
      expect(await db.auditLog.count({ where: { action: "ACCESS_DENIED", actorUserId: w[who].id } })).toBe(1);
    });

    it("denies uploads to a deleted album, even by its owner", async () => {
      await expect(upload("owner", w.deleted.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rejects a non-image without storing anything, and audits it", async () => {
      const result = await uploadPhoto(w.contributor, w.shared.id, {
        bytes: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
        filename: "cat.jpg",
      });
      expect(result).toEqual({ ok: false, reason: "unsupported_type" });
      expect(await db.photo.count()).toBe(0);
      const audit = await db.auditLog.findFirstOrThrow({ where: { action: "PHOTO_REJECTED" } });
      expect(audit.details).toMatchObject({ reason: "unsupported_type" });
    });
  });

  describe("listPhotos", () => {
    it("shows every viewer the photos with working thumbnail URLs", async () => {
      const photoId = await upload();
      for (const who of ["owner", "viewer", "contributor"] as const) {
        const photos = await listPhotos(w[who], w.shared.id);
        expect(photos.map((p) => p.id)).toEqual([photoId]);
        await fetchImage(photos[0]?.thumbUrl ?? "");
      }
    });

    it.each(["stranger", "admin"] as const)("is not found for the %s", async (who) => {
      await upload();
      await expect(listPhotos(w[who], w.shared.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("leaves out deleted and unfinished photos", async () => {
      const kept = await upload();
      const removed = await upload();
      await deletePhoto(w.owner, removed);
      await db.photo.create({
        data: { albumId: w.shared.id, uploadedByUserId: w.owner.id, storageKey: crypto.randomUUID(), status: "PROCESSING" },
      });

      expect((await listPhotos(w.viewer, w.shared.id)).map((p) => p.id)).toEqual([kept]);
    });

    it("hides every photo once the album is deleted", async () => {
      await upload();
      await deleteAlbum(w.owner, w.shared.id);
      await expect(listPhotos(w.viewer, w.shared.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("getPhoto", () => {
    it("returns display details but not GPS", async () => {
      const photoId = await upload();
      const photo = await getPhoto(w.viewer, photoId);
      expect(photo).toMatchObject({ id: photoId, camera: "TestCam T-1000", canDelete: false });
      expect(JSON.stringify(photo)).not.toMatch(/gps|51\.5/i);
    });

    it("is not found for strangers and admins, and the denial is audited", async () => {
      const photoId = await upload();
      for (const who of ["stranger", "admin"] as const) {
        await expect(getPhoto(w[who], photoId)).rejects.toBeInstanceOf(NotFoundError);
      }
      expect(await db.auditLog.count({ where: { action: "ACCESS_DENIED", targetId: w.shared.id } })).toBe(2);
    });

    it("is not found once the photo or its album is deleted", async () => {
      const photoId = await upload();
      await deleteAlbum(w.owner, w.shared.id);
      await expect(getPhoto(w.owner, photoId)).rejects.toBeInstanceOf(NotFoundError);
    });

    it.each(["", "nope", "00000000-0000-4000-8000-000000000000"])("is not found for id %j", async (id) => {
      await expect(getPhoto(w.owner, id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("deletePhoto", () => {
    it("lets the album owner delete anyone's photo", async () => {
      const photoId = await upload("contributor");
      expect(await deletePhoto(w.owner, photoId)).toBe(w.shared.id);
      expect(await db.auditLog.count({ where: { action: "PHOTO_DELETED", targetId: photoId } })).toBe(1);
    });

    it("lets a contributor delete their own photo", async () => {
      const photoId = await upload("contributor");
      await expect(deletePhoto(w.contributor, photoId)).resolves.toBe(w.shared.id);
    });

    it("forbids viewers and other contributors", async () => {
      const photoId = await upload("owner");
      const other = await makeActor();
      await grant(w.shared.id, other.id, "CONTRIBUTE", w.owner.id);

      await expect(deletePhoto(w.viewer, photoId)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(deletePhoto(other, photoId)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(deletePhoto(w.contributor, photoId)).rejects.toBeInstanceOf(ForbiddenError);
      expect((await db.photo.findUniqueOrThrow({ where: { id: photoId } })).deletedAt).toBeNull();
    });

    it("forbids an uploader who was downgraded to viewer", async () => {
      const photoId = await upload("contributor");
      await db.albumAccess.update({
        where: { albumId_userId: { albumId: w.shared.id, userId: w.contributor.id } },
        data: { accessLevel: "VIEW" },
      });
      await expect(deletePhoto(w.contributor, photoId)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it.each(["stranger", "admin"] as const)("is not found for the %s", async (who) => {
      const photoId = await upload();
      await expect(deletePhoto(w[who], photoId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("gallery navigation and album covers", () => {
    async function threePhotos() {
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        ids.push(await upload());
        // Distinct timestamps make "newest first" unambiguous.
        await db.photo.update({ where: { id: ids[i] }, data: { createdAt: new Date(Date.UTC(2026, 0, 1 + i)) } });
      }
      return ids as [string, string, string]; // oldest .. newest
    }

    it("gives each photo its position and newer/older neighbours", async () => {
      const [oldest, middle, newest] = await threePhotos();

      expect(await getPhoto(w.viewer, newest)).toMatchObject({ position: 1, total: 3, previousId: null, nextId: middle });
      expect(await getPhoto(w.viewer, middle)).toMatchObject({ position: 2, total: 3, previousId: newest, nextId: oldest });
      expect(await getPhoto(w.viewer, oldest)).toMatchObject({ position: 3, total: 3, previousId: middle, nextId: null });
      expect((await listPhotos(w.viewer, w.shared.id)).map((p) => p.id)).toEqual([newest, middle, oldest]);
    });

    it("skips deleted photos when navigating", async () => {
      const [oldest, middle, newest] = await threePhotos();
      await deletePhoto(w.owner, middle);
      expect(await getPhoto(w.viewer, newest)).toMatchObject({ total: 2, nextId: oldest });
    });

    it("shows each visible album with its newest photo as cover and a count of visible photos", async () => {
      const [, , newest] = await threePhotos();
      await db.photo.create({
        data: { albumId: w.shared.id, uploadedByUserId: w.owner.id, storageKey: crypto.randomUUID(), status: "PROCESSING" },
      });

      const cards = await listVisibleAlbums(w.viewer);
      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ id: w.shared.id, photoCount: 3 });
      const cover = await fetchImage(cards[0]?.coverUrl ?? "");
      const newestRow = await db.photo.findUniqueOrThrow({ where: { id: newest } });
      expect(cards[0]?.coverUrl).toContain(newestRow.storageKey);
      expect(cover.length).toBeGreaterThan(0);

      const owners = await listVisibleAlbums(w.owner);
      expect(owners.find((a) => a.id === w.ownerPrivate.id)).toMatchObject({ photoCount: 0, coverUrl: null });
    });

    it("never signs a cover for an album the actor can't see", async () => {
      await threePhotos();
      expect(await listVisibleAlbums(w.stranger)).toEqual([]);
      expect(await listVisibleAlbums(w.admin)).toEqual([]);
    });
  });
});
