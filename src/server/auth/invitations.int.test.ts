import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { ForbiddenError } from "@/server/errors";

import { resetDatabase } from "../../../tests/db";
import { makeUser } from "../../../tests/factories";
import { clearMailbox, firstLink, mailTo } from "../../../tests/mailpit";
import {
  INVITATION_TTL_MS,
  acceptInvitation,
  createInvitation,
  findAcceptableInvitation,
  listPendingInvitations,
  revokeInvitation,
} from "./invitations";

const IP = "203.0.113.7";

/** Invites an address and returns the raw token from the emailed link. */
async function inviteAndGetToken(email: string, now?: Date): Promise<string> {
  const admin = await makeUser({ role: "ADMIN" });
  expect(await createInvitation(admin, email, IP, now)).toEqual({ ok: true });
  const [mail] = await mailTo(email);
  return firstLink(mail?.text ?? "").split("/invite/")[1] ?? "";
}

async function auditActions() {
  return (await db.auditLog.findMany({ orderBy: { createdAt: "asc" } })).map((a) => a.action);
}

describe("invitations", () => {
  beforeEach(async () => {
    await resetDatabase();
    await clearMailbox();
  });
  afterAll(() => db.$disconnect());

  describe("creating", () => {
    it("lets an admin invite and emails a link that stores only a hash", async () => {
      const token = await inviteAndGetToken("New@Example.com ");

      const inv = await db.invitation.findFirstOrThrow();
      expect(inv.email).toBe("new@example.com");
      expect(inv.tokenHash).not.toContain(token);
      expect(await findAcceptableInvitation(token)).toEqual({ email: "new@example.com" });
      expect(await auditActions()).toEqual(["INVITATION_CREATED"]);
    });

    it("denies a member, audits it, and sends nothing", async () => {
      const member = await makeUser();

      await expect(createInvitation(member, "x@example.com", IP)).rejects.toBeInstanceOf(ForbiddenError);
      expect(await db.invitation.count()).toBe(0);
      expect(await mailTo("x@example.com")).toEqual([]);
      expect(await auditActions()).toEqual(["ACCESS_DENIED"]);
      const denial = await db.auditLog.findFirstOrThrow({ where: { action: "ACCESS_DENIED" } });
      expect(denial).toMatchObject({ actorUserId: member.id, ipAddress: IP });
      expect(denial.details).toEqual({ operation: "createInvitation" });
    });

    it("refuses an address that already belongs to a user", async () => {
      const admin = await makeUser({ role: "ADMIN" });
      await makeUser({ email: "taken@example.com" });

      expect(await createInvitation(admin, "taken@example.com", IP)).toEqual({ ok: false, reason: "already_member" });
      expect(await db.invitation.count()).toBe(0);
    });

    it("rejects an invalid email", async () => {
      const admin = await makeUser({ role: "ADMIN" });
      expect(await createInvitation(admin, "not an email", IP)).toEqual({ ok: false, reason: "invalid_email" });
    });

    it("re-inviting revokes the earlier link", async () => {
      const first = await inviteAndGetToken("again@example.com");
      await clearMailbox();
      const second = await inviteAndGetToken("again@example.com");

      expect(await findAcceptableInvitation(first)).toBeNull();
      expect(await findAcceptableInvitation(second)).not.toBeNull();
    });
  });

  describe("listing and revoking", () => {
    it("lists only pending invitations, for admins only", async () => {
      const admin = await makeUser({ role: "ADMIN" });
      await createInvitation(admin, "pending@example.com", IP);
      await createInvitation(admin, "revoked@example.com", IP);
      const toRevoke = await db.invitation.findFirstOrThrow({ where: { email: "revoked@example.com" } });
      await revokeInvitation(admin, toRevoke.id, IP);

      expect((await listPendingInvitations(admin, IP)).map((i) => i.email)).toEqual(["pending@example.com"]);

      const member = await makeUser();
      await expect(listPendingInvitations(member, IP)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("denies revocation by a member", async () => {
      const token = await inviteAndGetToken("keep@example.com");
      const inv = await db.invitation.findFirstOrThrow();
      const member = await makeUser();

      await expect(revokeInvitation(member, inv.id, IP)).rejects.toBeInstanceOf(ForbiddenError);
      expect(await findAcceptableInvitation(token)).not.toBeNull();
    });

    it("returns false for a malformed or unknown id", async () => {
      const admin = await makeUser({ role: "ADMIN" });
      expect(await revokeInvitation(admin, "../1", IP)).toBe(false);
      expect(await revokeInvitation(admin, crypto.randomUUID(), IP)).toBe(false);
    });
  });

  describe("accepting", () => {
    it("creates a verified member and marks the invitation used", async () => {
      const token = await inviteAndGetToken("joiner@example.com");

      const result = await acceptInvitation(token, "  Joiner  ", IP);
      expect(result.ok).toBe(true);

      const user = await db.user.findUniqueOrThrow({ where: { email: "joiner@example.com" } });
      expect(user).toMatchObject({ displayName: "Joiner", role: "MEMBER", status: "ACTIVE" });
      expect(user.emailVerified).not.toBeNull();
      const inv = await db.invitation.findFirstOrThrow();
      expect(inv.acceptedByUserId).toBe(user.id);
      expect(await auditActions()).toContain("INVITATION_ACCEPTED");
    });

    it("works only once", async () => {
      const token = await inviteAndGetToken("once@example.com");
      await acceptInvitation(token, "Once", IP);

      expect(await acceptInvitation(token, "Twice", IP)).toEqual({ ok: false, reason: "invalid_invitation" });
      expect(await db.user.count({ where: { email: "once@example.com" } })).toBe(1);
      const failure = await db.auditLog.findFirstOrThrow({ where: { action: "INVITATION_EXPIRED_USE" } });
      expect(failure.details).toEqual({ reason: "used" });
    });

    it("lets exactly one of two simultaneous acceptances win", async () => {
      const token = await inviteAndGetToken("race@example.com");

      const results = await Promise.all([acceptInvitation(token, "A", IP), acceptInvitation(token, "B", IP)]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await db.user.count({ where: { email: "race@example.com" } })).toBe(1);
    });

    it("rejects an expired invitation", async () => {
      const sent = new Date(Date.now() - INVITATION_TTL_MS - 1000);
      const token = await inviteAndGetToken("late@example.com", sent);

      expect(await findAcceptableInvitation(token)).toBeNull();
      expect(await acceptInvitation(token, "Late", IP)).toEqual({ ok: false, reason: "invalid_invitation" });
      expect(await db.user.count({ where: { email: "late@example.com" } })).toBe(0);
    });

    it("rejects a revoked invitation", async () => {
      const token = await inviteAndGetToken("revoked@example.com");
      const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });
      const inv = await db.invitation.findFirstOrThrow();
      await revokeInvitation({ ...admin }, inv.id, IP);

      expect(await acceptInvitation(token, "Nope", IP)).toEqual({ ok: false, reason: "invalid_invitation" });
    });

    it("rejects unknown and malformed tokens, and audits them anonymously", async () => {
      expect(await acceptInvitation("A".repeat(43), "X", IP)).toEqual({ ok: false, reason: "invalid_invitation" });
      expect(await acceptInvitation("garbage", "X", IP)).toEqual({ ok: false, reason: "invalid_invitation" });
      expect(await db.user.count()).toBe(0);
      const rows = await db.auditLog.findMany({ where: { action: "INVITATION_EXPIRED_USE" } });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.actorUserId === null && r.ipAddress === IP)).toBe(true);
    });

    it("rejects a blank name without using the invitation", async () => {
      const token = await inviteAndGetToken("blank@example.com");

      expect(await acceptInvitation(token, "   ", IP)).toEqual({ ok: false, reason: "invalid_name" });
      expect(await findAcceptableInvitation(token)).not.toBeNull();
    });

    it("never stores the raw token in the audit log", async () => {
      const token = await inviteAndGetToken("audit@example.com");
      await acceptInvitation(token, "Audit", IP);
      await acceptInvitation(token, "Again", IP);

      const dump = JSON.stringify(await db.auditLog.findMany());
      expect(dump).not.toContain(token);
    });
  });
});
