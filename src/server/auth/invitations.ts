import "server-only";

import { displayNameSchema, emailSchema, tokenSchema, uuidSchema } from "@/lib/schemas";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { sendMail } from "@/server/mail";
import { invitationMessage } from "@/server/mail/templates";

import { assertAdmin } from "./admin-guard";
import type { SessionUser } from "./session";
import { generateToken, hashToken } from "./tokens";

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteResult =
  | { ok: true }
  | { ok: false; reason: "invalid_email" | "already_member" };

export type AcceptResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_name" | "invalid_invitation" };

export interface PendingInvitation {
  id: string;
  email: string;
  invitedBy: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Invites an email address and sends the invitation link.
 *
 * Checks: actor is ADMIN; email is valid; no user already has it. Any earlier
 * unaccepted invitation for the same address is revoked, so only the newest
 * link works.
 *
 * @throws ForbiddenError if the actor isn't an admin (audited as ACCESS_DENIED).
 * @throws if the email can't be sent; the new invitation is revoked first.
 */
export async function createInvitation(
  actor: SessionUser,
  rawEmail: string,
  ipAddress: string | null,
  now: Date = new Date(),
): Promise<InviteResult> {
  await assertAdmin(actor, ipAddress, "createInvitation");

  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, reason: "invalid_email" };
  const email = parsed.data;

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, reason: "already_member" };
  }

  const { token, hash } = generateToken();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
  const invitation = await db.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: { email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const created = await tx.invitation.create({
      data: { email, tokenHash: hash, invitedByUserId: actor.id, expiresAt },
    });
    await recordAudit(
      { action: "INVITATION_CREATED", actorUserId: actor.id, targetType: "invitation", targetId: created.id, ipAddress, details: { email } },
      tx,
    );
    return created;
  });

  const link = new URL(`/invite/${token}`, serverEnv().APP_URL).toString();
  try {
    await sendMail(invitationMessage({ to: email, inviterName: actor.displayName, link, expiresAt }));
  } catch (error) {
    // An unsent invitation must not stay live: nobody has the link.
    await db.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
    throw error;
  }
  return { ok: true };
}

/**
 * Invitations that can still be accepted, newest first.
 *
 * @throws ForbiddenError if the actor isn't an admin (audited as ACCESS_DENIED).
 */
export async function listPendingInvitations(
  actor: SessionUser,
  ipAddress: string | null,
  now: Date = new Date(),
): Promise<PendingInvitation[]> {
  await assertAdmin(actor, ipAddress, "listPendingInvitations");

  const rows = await db.invitation.findMany({
    where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
    include: { invitedBy: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    invitedBy: r.invitedBy.displayName,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  }));
}

/**
 * Revokes a pending invitation so its link stops working.
 *
 * @returns false if the id is malformed or the invitation was already
 * accepted or revoked.
 * @throws ForbiddenError if the actor isn't an admin (audited as ACCESS_DENIED).
 */
export async function revokeInvitation(
  actor: SessionUser,
  rawId: string,
  ipAddress: string | null,
): Promise<boolean> {
  await assertAdmin(actor, ipAddress, "revokeInvitation");

  const id = uuidSchema.safeParse(rawId);
  if (!id.success) return false;

  const { count } = await db.invitation.updateMany({
    where: { id: id.data, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) return false;
  await recordAudit({ action: "INVITATION_REVOKED", actorUserId: actor.id, targetType: "invitation", targetId: id.data, ipAddress });
  return true;
}

/**
 * Looks up an invitation for the acceptance page. Read-only and unaudited,
 * because link scanners and prefetching open pages without a person present.
 *
 * @returns the invited email, or null if the token isn't currently usable.
 */
export async function findAcceptableInvitation(
  rawToken: string,
  now: Date = new Date(),
): Promise<{ email: string } | null> {
  const token = tokenSchema.safeParse(rawToken);
  if (!token.success) return null;

  const inv = await db.invitation.findUnique({ where: { tokenHash: hashToken(token.data) } });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt <= now) return null;
  return { email: inv.email };
}

/**
 * Accepts an invitation: creates the user and marks the invitation used.
 * This is the only path that creates a MEMBER.
 *
 * Checks: name is valid; token matches an invitation that is unaccepted,
 * unrevoked and unexpired. Claiming the invitation is a conditional update,
 * so two simultaneous submissions can't both succeed.
 *
 * Failures are audited as INVITATION_EXPIRED_USE with the reason. The caller
 * starts the session; this function never touches cookies.
 */
export async function acceptInvitation(
  rawToken: string,
  rawDisplayName: string,
  ipAddress: string | null,
  now: Date = new Date(),
): Promise<AcceptResult> {
  const displayName = displayNameSchema.safeParse(rawDisplayName);
  if (!displayName.success) return { ok: false, reason: "invalid_name" };

  const token = tokenSchema.safeParse(rawToken);
  const inv = token.success
    ? await db.invitation.findUnique({ where: { tokenHash: hashToken(token.data) } })
    : null;

  const fail = async (reason: string): Promise<AcceptResult> => {
    await recordAudit({
      action: "INVITATION_EXPIRED_USE",
      actorUserId: null,
      targetType: inv ? "invitation" : undefined,
      targetId: inv?.id,
      ipAddress,
      details: { reason },
    });
    return { ok: false, reason: "invalid_invitation" };
  };

  if (!inv) return fail("unknown");
  if (inv.acceptedAt) return fail("used");
  if (inv.revokedAt) return fail("revoked");
  if (inv.expiresAt <= now) return fail("expired");

  try {
    const userId = await db.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: { id: inv.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { acceptedAt: now },
      });
      if (claimed.count === 0) throw new LostRaceError();

      const user = await tx.user.create({
        data: { email: inv.email, displayName: displayName.data, emailVerified: now },
      });
      await tx.invitation.update({ where: { id: inv.id }, data: { acceptedByUserId: user.id } });
      await recordAudit(
        { action: "INVITATION_ACCEPTED", actorUserId: user.id, targetType: "invitation", targetId: inv.id, ipAddress },
        tx,
      );
      return user.id;
    });
    return { ok: true, userId };
  } catch (error) {
    // Another request claimed it first, or the email was taken meanwhile
    // (unique constraint). Either way the transaction rolled back.
    if (error instanceof LostRaceError || isUniqueViolation(error)) return fail("used");
    throw error;
  }
}

class LostRaceError extends Error {}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
