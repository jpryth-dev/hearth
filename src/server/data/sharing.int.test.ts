import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

import { resetDatabase } from "../../../tests/db";
import { albumWorld, makeActor } from "../../../tests/factories";
import { albumRole } from "./access";
import { getAlbum } from "./albums";
import { grantAlbumAccess, listAlbumAccess, revokeAlbumAccess } from "./sharing";

type World = Awaited<ReturnType<typeof albumWorld>>;

describe("sharing", () => {
  let w: World;
  beforeEach(async () => {
    await resetDatabase();
    w = await albumWorld();
  });
  afterAll(() => db.$disconnect());

  describe("listAlbumAccess", () => {
    it("shows the owner who has access", async () => {
      const members = await listAlbumAccess(w.owner, w.shared.id);
      expect(members.map((m) => [m.userId, m.accessLevel])).toEqual([
        [w.viewer.id, "VIEW"],
        [w.contributor.id, "CONTRIBUTE"],
      ]);
    });

    it.each(["viewer", "contributor", "stranger", "admin"] as const)("is not found for the %s", async (who) => {
      await expect(listAlbumAccess(w[who], w.shared.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("grantAlbumAccess", () => {
    it("shares with a member, who can then see the album", async () => {
      expect(await grantAlbumAccess(w.owner, w.ownerPrivate.id, w.stranger.email.toUpperCase(), "VIEW")).toEqual({
        ok: true,
        change: "granted",
      });
      expect(await albumRole(w.stranger, w.ownerPrivate.id)).toBe("VIEW");

      const audit = await db.auditLog.findFirstOrThrow({ where: { action: "ACCESS_GRANTED" } });
      expect(audit).toMatchObject({ actorUserId: w.owner.id, targetId: w.ownerPrivate.id });
      expect(audit.details).toEqual({ userId: w.stranger.id, accessLevel: "VIEW" });
    });

    it("changes an existing level, and reports no-ops", async () => {
      expect(await grantAlbumAccess(w.owner, w.shared.id, w.viewer.email, "CONTRIBUTE")).toEqual({
        ok: true,
        change: "changed",
      });
      expect(await albumRole(w.viewer, w.shared.id)).toBe("CONTRIBUTE");
      expect(await grantAlbumAccess(w.owner, w.shared.id, w.viewer.email, "CONTRIBUTE")).toEqual({
        ok: true,
        change: "unchanged",
      });
      const changes = await db.auditLog.findMany({ where: { action: "ACCESS_CHANGED" } });
      expect(changes).toHaveLength(1);
      expect(changes[0]?.details).toEqual({ userId: w.viewer.id, accessLevel: "CONTRIBUTE", previous: "VIEW" });
    });

    it.each(["viewer", "contributor", "stranger", "admin"] as const)(
      "denies the %s, even granting themselves",
      async (who) => {
        await expect(grantAlbumAccess(w[who], w.ownerPrivate.id, w[who].email, "CONTRIBUTE")).rejects.toBeInstanceOf(
          NotFoundError,
        );
        expect(await albumRole(w[who], w.ownerPrivate.id)).toBeNull();
      },
    );

    it("won't let a contributor escalate on a shared album", async () => {
      await expect(grantAlbumAccess(w.contributor, w.shared.id, w.stranger.email, "VIEW")).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(await albumRole(w.stranger, w.shared.id)).toBeNull();
    });

    it("rejects unknown and disabled addresses, the owner, and bad levels", async () => {
      const disabled = await makeActor({ status: "DISABLED" });
      expect(await grantAlbumAccess(w.owner, w.shared.id, "nobody@example.com", "VIEW")).toEqual({
        ok: false,
        reason: "no_such_member",
      });
      expect(await grantAlbumAccess(w.owner, w.shared.id, disabled.email, "VIEW")).toEqual({
        ok: false,
        reason: "no_such_member",
      });
      expect(await grantAlbumAccess(w.owner, w.shared.id, w.owner.email, "VIEW")).toEqual({ ok: false, reason: "self" });
      expect(await grantAlbumAccess(w.owner, w.shared.id, w.stranger.email, "OWNER")).toEqual({
        ok: false,
        reason: "invalid_level",
      });
      expect(await grantAlbumAccess(w.owner, w.shared.id, "nope", "VIEW")).toEqual({ ok: false, reason: "invalid_email" });
    });

    it("can't share a deleted album", async () => {
      await expect(grantAlbumAccess(w.owner, w.deleted.id, w.stranger.email, "VIEW")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("revokeAlbumAccess", () => {
    it("removes access immediately, and audits it", async () => {
      expect(await revokeAlbumAccess(w.owner, w.shared.id, w.viewer.id)).toBe(true);

      await expect(getAlbum(w.viewer, w.shared.id)).rejects.toBeInstanceOf(NotFoundError);
      const audit = await db.auditLog.findFirstOrThrow({ where: { action: "ACCESS_REVOKED" } });
      expect(audit.details).toEqual({ userId: w.viewer.id });
    });

    it("returns false when there's nothing to revoke", async () => {
      expect(await revokeAlbumAccess(w.owner, w.shared.id, w.stranger.id)).toBe(false);
      expect(await revokeAlbumAccess(w.owner, w.shared.id, "junk")).toBe(false);
    });

    it.each(["viewer", "contributor", "stranger", "admin"] as const)("denies the %s", async (who) => {
      await expect(revokeAlbumAccess(w[who], w.shared.id, w.contributor.id)).rejects.toBeInstanceOf(NotFoundError);
      expect(await albumRole(w.contributor, w.shared.id)).toBe("CONTRIBUTE");
    });
  });
});
