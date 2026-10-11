import "server-only";

import { emailSchema, tokenSchema } from "@/lib/schemas";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { sendMail } from "@/server/mail";
import { signInMessage } from "@/server/mail/templates";

import { generateToken, hashToken } from "./tokens";

export const SIGN_IN_TOKEN_TTL_MS = 15 * 60 * 1000;
/** Unused, unexpired links a user may hold at once; caps mailbox flooding. */
export const MAX_LIVE_SIGN_IN_TOKENS = 3;

export type ConsumeResult = { ok: true; userId: string } | { ok: false };

/**
 * Emails a single-use sign-in link if the address belongs to an ACTIVE user.
 *
 * Returns nothing either way, so callers show the same response for every
 * address and can't be used to discover who has an account. Unknown, disabled
 * and rate-limited requests are audited as LOGIN_FAILURE.
 *
 * @throws if the email can't be sent; the unsent token is deleted first.
 */
export async function requestSignInLink(
  rawEmail: string,
  ipAddress: string | null,
  now: Date = new Date(),
): Promise<void> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return;
  const email = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") {
    await recordAudit({
      action: "LOGIN_FAILURE",
      actorUserId: null,
      targetType: user ? "user" : undefined,
      targetId: user?.id,
      ipAddress,
      details: { reason: user ? "disabled" : "unknown_email", email },
    });
    return;
  }

  const live = await db.loginToken.count({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
  });
  if (live >= MAX_LIVE_SIGN_IN_TOKENS) {
    await recordAudit({
      action: "LOGIN_FAILURE",
      actorUserId: null,
      targetType: "user",
      targetId: user.id,
      ipAddress,
      details: { reason: "rate_limited" },
    });
    return;
  }

  const { token, hash } = generateToken();
  const row = await db.loginToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt: new Date(now.getTime() + SIGN_IN_TOKEN_TTL_MS) },
  });
  const link = new URL(`/login/verify/${token}`, serverEnv().APP_URL).toString();
  try {
    await sendMail(signInMessage({ to: email, link }));
  } catch (error) {
    await db.loginToken.delete({ where: { id: row.id } });
    throw error;
  }
}

/**
 * Whether a sign-in link can still be used. Read-only and unaudited, for the
 * confirmation page that opening the link shows.
 */
export async function isUsableSignInToken(rawToken: string, now: Date = new Date()): Promise<boolean> {
  const token = tokenSchema.safeParse(rawToken);
  if (!token.success) return false;

  const row = await db.loginToken.findUnique({
    where: { tokenHash: hashToken(token.data) },
    include: { user: { select: { status: true } } },
  });
  return !!row && !row.usedAt && row.expiresAt > now && row.user.status === "ACTIVE";
}

/**
 * Uses a sign-in link. On success every other outstanding link for the user
 * is also spent, so an older email can't be used later.
 *
 * Checks: token matches a row that is unused and unexpired, and the user is
 * ACTIVE. Claiming is a conditional update, so the link works exactly once
 * even under concurrent submissions. Failures are audited as LOGIN_FAILURE.
 * The caller starts the session.
 */
export async function consumeSignInToken(
  rawToken: string,
  ipAddress: string | null,
  now: Date = new Date(),
): Promise<ConsumeResult> {
  const token = tokenSchema.safeParse(rawToken);
  const row = token.success
    ? await db.loginToken.findUnique({ where: { tokenHash: hashToken(token.data) }, include: { user: true } })
    : null;

  const fail = async (reason: string): Promise<ConsumeResult> => {
    await recordAudit({
      action: "LOGIN_FAILURE",
      actorUserId: null,
      targetType: row ? "user" : undefined,
      targetId: row?.userId,
      ipAddress,
      details: { reason },
    });
    return { ok: false };
  };

  if (!row) return fail("unknown_link");
  if (row.usedAt) return fail("used_link");
  if (row.expiresAt <= now) return fail("expired_link");
  if (row.user.status !== "ACTIVE") return fail("disabled");

  const claimed = await db.loginToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count === 0) return fail("used_link");

  await db.loginToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } });
  return { ok: true, userId: row.userId };
}
