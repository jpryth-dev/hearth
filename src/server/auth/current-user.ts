import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { serverEnv } from "@/server/env";

import { sessionCookieConfig } from "./cookie";
import { createSession, deleteSession, findSessionUser, type SessionUser } from "./session";

function cookieConfig() {
  return sessionCookieConfig(serverEnv().APP_URL);
}

/**
 * Creates a session for the user and sets the cookie. Call only from a Server
 * Action or Route Handler (Next forbids setting cookies during render), and
 * only after the caller has proven who the user is.
 */
export async function startSession(userId: string): Promise<void> {
  const { token, expires } = await createSession(userId);
  const { name, secure } = cookieConfig();
  (await cookies()).set(name, token, { httpOnly: true, secure, sameSite: "lax", path: "/", expires });
}

/**
 * The signed-in user for this request, or null. Memoised per request, so
 * layouts, pages and actions can all call it without repeat queries.
 *
 * Checks: see findSessionUser (shape, existence, expiry, ACTIVE status).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(cookieConfig().name)?.value;
  return findSessionUser(token);
});

/**
 * The signed-in user, or a redirect to /login. Use at the top of every page
 * and Server Action that needs a user: a page-level check does not cover the
 * actions it renders.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The signed-in admin, or a 404 for anyone else so admin pages don't reveal
 * that they exist. Admin grants user-management rights only, never album
 * access.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  return user;
}

/**
 * Deletes the current session row and clears the cookie.
 *
 * @returns the user who was signed in, or null if there was no valid session.
 */
export async function endSession(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  const store = await cookies();
  const { name, secure } = cookieConfig();
  await deleteSession(store.get(name)?.value);
  store.set(name, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  return user;
}
