import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";

import { resetDatabase } from "../../../tests/db";
import { SESSION_TTL_MS, createSession, deleteSession, findSessionUser } from "./session";
import { hashToken } from "./tokens";

async function makeUser(status: "ACTIVE" | "DISABLED" = "ACTIVE") {
  return db.user.create({ data: { email: `${status.toLowerCase()}@example.com`, displayName: "U", status } });
}

describe("sessions", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  it("resolves a fresh session to its user", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);

    expect(await findSessionUser(token)).toEqual({
      id: user.id,
      email: user.email,
      displayName: "U",
      role: "MEMBER",
    });
  });

  it("stores only the token hash", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);

    const row = await db.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toBe(token);
  });

  it("rejects an expired session", async () => {
    const user = await makeUser();
    const start = new Date("2026-01-01T00:00:00Z");
    const { token } = await createSession(user.id, start);

    const justBefore = new Date(start.getTime() + SESSION_TTL_MS - 1);
    expect(await findSessionUser(token, justBefore)).not.toBeNull();
    expect(await findSessionUser(token, new Date(start.getTime() + SESSION_TTL_MS))).toBeNull();
  });

  it("rejects the session of a disabled user", async () => {
    const user = await makeUser("DISABLED");
    const { token } = await createSession(user.id);

    expect(await findSessionUser(token)).toBeNull();
  });

  it.each([undefined, "", "not-a-token", "A".repeat(43)])("rejects token %j", async (token) => {
    expect(await findSessionUser(token)).toBeNull();
  });

  it("rejects a token after logout", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);

    expect(await deleteSession(token)).toBe(true);
    expect(await findSessionUser(token)).toBeNull();
    expect(await deleteSession(token)).toBe(false);
  });

  it("deleting one session leaves the user's other sessions alive", async () => {
    const user = await makeUser();
    const phone = await createSession(user.id);
    const laptop = await createSession(user.id);

    await deleteSession(phone.token);
    expect(await findSessionUser(laptop.token)).not.toBeNull();
  });
});
