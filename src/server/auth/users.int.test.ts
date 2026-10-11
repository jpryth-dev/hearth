import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { ForbiddenError } from "@/server/errors";

import { resetDatabase } from "../../../tests/db";
import { makeUser } from "../../../tests/factories";
import { clearMailbox, mailTo } from "../../../tests/mailpit";
import { createSession, findSessionUser } from "./session";
import { requestSignInLink } from "./sign-in";
import { disableUser, enableUser, listUsers } from "./users";

const IP = "192.0.2.10";

describe("user management", () => {
  beforeEach(async () => {
    await resetDatabase();
    await clearMailbox();
  });
  afterAll(() => db.$disconnect());

  async function adminCtx() {
    return { actor: await makeUser({ role: "ADMIN" }), ipAddress: IP };
  }

  it("lists users for admins only", async () => {
    const ctx = await adminCtx();
    const member = await makeUser();
    expect((await listUsers(ctx)).map((u) => u.id).sort()).toEqual([ctx.actor.id, member.id].sort());

    await expect(listUsers({ actor: member, ipAddress: IP })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.auditLog.count({ where: { action: "ACCESS_DENIED", actorUserId: member.id } })).toBe(1);
  });

  it("disabling ends sessions and unused sign-in links at once", async () => {
    const ctx = await adminCtx();
    const member = await makeUser({ email: "leaving@example.com" });
    const { token } = await createSession(member.id);
    await requestSignInLink("leaving@example.com", IP);
    expect(await db.loginToken.count({ where: { userId: member.id } })).toBe(1);

    expect(await disableUser(ctx, member.id)).toEqual({ ok: true });

    expect(await findSessionUser(token)).toBeNull();
    expect(await db.session.count({ where: { userId: member.id } })).toBe(0);
    expect(await db.loginToken.count({ where: { userId: member.id } })).toBe(0);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "USER_DISABLED" } });
    expect(audit).toMatchObject({ actorUserId: ctx.actor.id, targetId: member.id, ipAddress: IP });
  });

  it("a disabled user can't request a sign-in link; re-enabling restores it", async () => {
    const ctx = await adminCtx();
    const member = await makeUser({ email: "back@example.com" });
    await disableUser(ctx, member.id);

    await requestSignInLink("back@example.com", IP);
    expect(await mailTo("back@example.com")).toHaveLength(0);

    expect(await enableUser(ctx, member.id)).toEqual({ ok: true });
    await requestSignInLink("back@example.com", IP);
    expect(await mailTo("back@example.com")).toHaveLength(1);
    expect(await db.auditLog.count({ where: { action: "USER_ENABLED", targetId: member.id } })).toBe(1);
  });

  it("members can't disable or enable anyone", async () => {
    const member = await makeUser();
    const other = await makeUser();
    const ctx = { actor: member, ipAddress: IP };

    await expect(disableUser(ctx, other.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(enableUser(ctx, other.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.user.findUniqueOrThrow({ where: { id: other.id } })).status).toBe("ACTIVE");
  });

  it("refuses to disable yourself", async () => {
    const ctx = await adminCtx();
    expect(await disableUser(ctx, ctx.actor.id)).toEqual({ ok: false, reason: "self" });
  });

  it("refuses to disable the last active admin", async () => {
    // An acting admin normally counts as an active admin themselves, so this
    // guard matters when the actor was disabled mid-request (stale session
    // data): it still must not leave Hearth with no active admin.
    const first = await adminCtx();
    const second = await makeUser({ role: "ADMIN" });
    await db.user.update({ where: { id: first.actor.id }, data: { status: "DISABLED" } });

    expect(await disableUser(first, second.id)).toEqual({ ok: false, reason: "last_admin" });
    expect((await db.user.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("ACTIVE");
  });

  it("reports unknown and unchanged targets", async () => {
    const ctx = await adminCtx();
    const member = await makeUser();
    expect(await disableUser(ctx, crypto.randomUUID())).toEqual({ ok: false, reason: "not_found" });
    expect(await disableUser(ctx, "junk")).toEqual({ ok: false, reason: "not_found" });
    expect(await enableUser(ctx, member.id)).toEqual({ ok: false, reason: "unchanged" });
    await disableUser(ctx, member.id);
    expect(await disableUser(ctx, member.id)).toEqual({ ok: false, reason: "unchanged" });
  });
});
