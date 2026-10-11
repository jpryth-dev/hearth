import "server-only";

import type { UserRole } from "@/generated/prisma/client";
import { tokenSchema } from "@/lib/schemas";
import { db } from "@/server/db";

import { generateToken, hashToken } from "./tokens";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** The signed-in user as the rest of the app sees them. */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

/**
 * Creates a session row for a user.
 *
 * @returns the raw token for the cookie and its expiry. The raw token is not
 * stored anywhere else.
 */
export async function createSession(
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; expires: Date }> {
  const { token, hash } = generateToken();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  await db.session.create({ data: { userId, tokenHash: hash, expires } });
  return { token, expires };
}

/**
 * Resolves a raw session token to its user.
 *
 * Checks: token shape, session exists, not expired, user is ACTIVE.
 * Disabling a user therefore ends every session they hold at once.
 *
 * @returns the user, or null for any failure. Callers can't tell why, so
 * nothing leaks about which tokens exist.
 */
export async function findSessionUser(
  rawToken: string | undefined,
  now: Date = new Date(),
): Promise<SessionUser | null> {
  const parsed = tokenSchema.safeParse(rawToken);
  if (!parsed.success) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(parsed.data) },
    include: { user: true },
  });
  if (!session || session.expires <= now || session.user.status !== "ACTIVE") {
    return null;
  }
  const { id, email, displayName, role } = session.user;
  return { id, email, displayName, role };
}

/**
 * Deletes the session for a raw token, if it exists.
 *
 * @returns true if a session was deleted.
 */
export async function deleteSession(rawToken: string | undefined): Promise<boolean> {
  const parsed = tokenSchema.safeParse(rawToken);
  if (!parsed.success) return false;

  const { count } = await db.session.deleteMany({ where: { tokenHash: hashToken(parsed.data) } });
  return count > 0;
}
