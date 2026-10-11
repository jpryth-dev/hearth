import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

import { resetDatabase } from "../../../tests/db";
import { albumWorld, makeActor } from "../../../tests/factories";
import { createAlbum, deleteAlbum, getAlbum, listVisibleAlbums, updateAlbum } from "./albums";

type World = Awaited<ReturnType<typeof albumWorld>>;

describe("album writes", () => {
  let w: World;
  beforeEach(async () => {
    await resetDatabase();
    w = await albumWorld();
  });
  afterAll(() => db.$disconnect());

  describe("createAlbum", () => {
    it("creates an album only its creator can see, and audits it", async () => {
      const member = await makeActor();
      const result = await createAlbum(member, { title: "  Beach  ", description: "  " });
      if (!result.ok) throw new Error("expected ok");

      const album = await db.album.findUniqueOrThrow({ where: { id: result.id } });
      expect(album).toMatchObject({ ownerId: member.id, title: "Beach", description: null, deletedAt: null });
      expect(await db.albumAccess.count({ where: { albumId: album.id } })).toBe(0);
      expect((await listVisibleAlbums(w.owner)).map((a) => a.id)).not.toContain(album.id);
      expect(await db.auditLog.count({ where: { action: "ALBUM_CREATED", targetId: album.id } })).toBe(1);
    });

    it("returns field errors for bad input", async () => {
      expect(await createAlbum(w.owner, { title: " ", description: "x".repeat(1001) })).toEqual({
        ok: false,
        errors: { title: "Give the album a title", description: "Use 1000 characters or fewer" },
      });
    });
  });

  describe("updateAlbum", () => {
    it("lets the owner rename", async () => {
      expect(await updateAlbum(w.owner, w.shared.id, { title: "Renamed", description: "New" })).toEqual({
        ok: true,
        id: w.shared.id,
      });
      expect((await getAlbum(w.viewer, w.shared.id)).title).toBe("Renamed");
    });

    it.each(["viewer", "contributor", "stranger", "admin"] as const)("denies the %s", async (who) => {
      await expect(updateAlbum(w[who], w.shared.id, { title: "Hijacked", description: "" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect((await db.album.findUniqueOrThrow({ where: { id: w.shared.id } })).title).toBe("Shared");
      expect(await db.auditLog.count({ where: { action: "ACCESS_DENIED", actorUserId: w[who].id } })).toBe(1);
    });

    it("checks ownership before validating input, so strangers learn nothing", async () => {
      await expect(updateAlbum(w.stranger, w.shared.id, { title: "", description: "" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("deleteAlbum", () => {
    it("hides the album from everyone at once, and audits it", async () => {
      await deleteAlbum(w.owner, w.shared.id);

      for (const who of ["owner", "viewer", "contributor"] as const) {
        await expect(getAlbum(w[who], w.shared.id)).rejects.toBeInstanceOf(NotFoundError);
        expect((await listVisibleAlbums(w[who])).map((a) => a.id)).not.toContain(w.shared.id);
      }
      expect(await db.album.count({ where: { id: w.shared.id } })).toBe(1);
      expect(await db.auditLog.count({ where: { action: "ALBUM_DELETED", targetId: w.shared.id } })).toBe(1);
    });

    it.each(["viewer", "contributor", "stranger", "admin"] as const)("denies the %s", async (who) => {
      await expect(deleteAlbum(w[who], w.shared.id)).rejects.toBeInstanceOf(NotFoundError);
      expect((await db.album.findUniqueOrThrow({ where: { id: w.shared.id } })).deletedAt).toBeNull();
    });

    it("can't delete an already-deleted album", async () => {
      await expect(deleteAlbum(w.owner, w.deleted.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
