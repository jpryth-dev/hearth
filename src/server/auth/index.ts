/**
 * Authentication: who is making this request.
 *
 * Contract:
 * - Sessions live in the database. The cookie holds a random token and the
 *   database only its SHA-256 hash.
 * - A session is valid only while unexpired and while its user is ACTIVE.
 * - Tokens are never logged or returned to the client except as the cookie
 *   or the emailed link they belong in.
 * - This module answers "who is this?". What they may see is decided by the
 *   data-access layer (`src/server/data/`).
 *
 * Auth.js isn't used: its adapter didn't fit the schema, and its email provider
 * creates users on first sign-in, which an invitation-only app can't allow.
 *
 * @packageDocumentation
 */
export { endSession, getCurrentUser, requireAdmin, requireUser, startSession } from "./current-user";
export type { SessionUser } from "./session";
