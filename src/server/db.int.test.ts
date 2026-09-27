import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { resetDatabase } from "../../tests/db";
import { db } from "./db";

describe("db client (integration)", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  it("is connected to the test database", async () => {
    const [row] = await db.$queryRaw<{ name: string }[]>`select current_database() as name`;
    expect(row?.name).toMatch(/_test$/);
  });

  it("round-trips a user with schema defaults", async () => {
    const created = await db.user.create({
      data: { email: "test@example.com", displayName: "Test User" },
    });

    const found = await db.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(found).toMatchObject({ email: "test@example.com", role: "MEMBER", status: "ACTIVE" });
  });
});
