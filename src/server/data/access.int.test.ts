import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

import { resetDatabase } from "../../../tests/db";
import { albumWorld } from "../../../tests/factories";
import { albumRole, requireAlbumRole } from "./access";
import { getAlbum, listVisibleAlbums } from "./albums";

type World = Awaited<ReturnType<typeof albumWorld>>;

describe("album authorization", () => {
  let w: World;
  beforeEach(async () => {
    await resetDatabase();
    w = await albumWorld();
  });
  afterAll(() => db.$disconnect());

  describe("albumRole", () => {
    it("gives each person exactly their role on the shared album", async () => {
      expect(await albumRole(w.owner, w.shared.id)).toBe("OWNER");
      expect(await albumRole(w.contributor, w.shared.id)).toBe("CONTRIBUTE");
      expect(await albumRole(w.viewer, w.shared.id)).toBe("VIEW");
      expect(await albumRole(w.stranger, w.shared.id)).toBeNull();
    });

    it("gives admins no access by role", async () => {
      expect(await albumRole(w.admin, w.shared.id)).toBeNull();
      expect(await albumRole(w.admin, w.ownerPrivate.id)).toBeNull();
    });

    it("hides a deleted album from everyone, owner and grantees included", async () => {
      expect(await albumRole(w.owner, w.deleted.id)).toBeNull();
      expect(await albumRole(w.viewer, w.deleted.id)).toBeNull();
    });
  });

  describe("requireAlbumRole", () => {
    it("allows a role at or above the minimum", async () => {
      await expect(requireAlbumRole(w.owner, w.shared.id, "OWNER", "t")).resolves.toEqual({
        albumId: w.shared.id,
        role: "OWNER",
      });
      await expect(requireAlbumRole(w.contributor, w.shared.id, "VIEW", "t")).resolves.toMatchObject({
        role: "CONTRIBUTE",
      });
    });

    it.each([
      ["viewer", "CONTRIBUTE"],
      ["viewer", "OWNER"],
      ["contributor", "OWNER"],
      ["stranger", "VIEW"],
      ["admin", "VIEW"],
    ] as const)("denies the %s when %s is required, and audits it", async (who, minimum) => {
      await expect(requireAlbumRole(w[who], w.shared.id, minimum, "test-op")).rejects.toBeInstanceOf(NotFoundError);

      const audit = await db.auditLog.findFirstOrThrow({ where: { action: "ACCESS_DENIED" } });
      expect(audit).toMatchObject({
        actorUserId: w[who].id,
        targetType: "album",
        targetId: w.shared.id,
        ipAddress: "198.51.100.1",
      });
      expect(audit.details).toMatchObject({ operation: "test-op", required: minimum });
    });

    it("treats a missing album exactly like a forbidden one", async () => {
      const missing = await requireAlbumRole(w.stranger, crypto.randomUUID(), "VIEW", "t").catch((e: unknown) => e);
      const forbidden = await requireAlbumRole(w.stranger, w.shared.id, "VIEW", "t").catch((e: unknown) => e);
      expect(missing).toBeInstanceOf(NotFoundError);
      expect(forbidden).toBeInstanceOf(NotFoundError);
      expect((missing as Error).message).toBe((forbidden as Error).message);
    });

    it.each(["", "not-a-uuid", "../albums", "1 or 1=1"])("rejects malformed id %j without a query", async (id) => {
      await expect(requireAlbumRole(w.owner, id, "VIEW", "t")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("listVisibleAlbums", () => {
    const titles = async (who: keyof World) =>
      (await listVisibleAlbums(w[who] as World["owner"])).map((a) => `${a.title}:${a.role}`).sort();

    it("lists owned and granted albums only, never deleted ones", async () => {
      expect(await titles("owner")).toEqual(["Private:OWNER", "Shared:OWNER"]);
      expect(await titles("viewer")).toEqual(["Shared:VIEW"]);
      expect(await titles("contributor")).toEqual(["Shared:CONTRIBUTE"]);
      expect(await titles("stranger")).toEqual([]);
      expect(await titles("admin")).toEqual([]);
    });
  });

  describe("getAlbum", () => {
    it("returns the album to people who can view it", async () => {
      const album = await getAlbum(w.viewer, w.shared.id);
      expect(album).toMatchObject({ id: w.shared.id, title: "Shared", role: "VIEW" });
      expect(Object.keys(album).sort()).toEqual(["createdAt", "description", "id", "ownerName", "role", "title"]);
    });

    it("is not found for strangers, admins and deleted albums", async () => {
      await expect(getAlbum(w.stranger, w.shared.id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(getAlbum(w.admin, w.ownerPrivate.id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(getAlbum(w.owner, w.deleted.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
