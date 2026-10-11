import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";

import { resetDatabase } from "../tests/db";
import { SEED_ALBUMS, SEED_USERS, seed } from "./seed-data";

describe("seed", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  it("is idempotent", async () => {
    await seed(db);
    await seed(db);

    expect(await db.user.count()).toBe(4);
    expect(await db.album.count()).toBe(4);
    expect(await db.albumAccess.count()).toBe(3);
  });

  it("gives admin no access rows, so the role implies no album access", async () => {
    await seed(db);

    const admin = await db.user.findUniqueOrThrow({ where: { email: SEED_USERS.admin.email } });
    expect(await db.albumAccess.count({ where: { userId: admin.id } })).toBe(0);
  });

  it("shares the deleted album with Bob so soft-delete filtering is testable", async () => {
    await seed(db);

    const bob = await db.user.findUniqueOrThrow({ where: { email: SEED_USERS.bob.email } });
    const grants = await db.albumAccess.findMany({ where: { userId: bob.id }, include: { album: true } });
    expect(grants.map((g) => g.albumId).sort()).toEqual([SEED_ALBUMS.shared, SEED_ALBUMS.deleted].sort());
    expect(grants.find((g) => g.albumId === SEED_ALBUMS.deleted)?.album.deletedAt).not.toBeNull();
  });
});
