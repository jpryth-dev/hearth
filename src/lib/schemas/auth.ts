import { z } from "zod";

/**
 * An email address as typed by a person: trimmed and lower-cased before the
 * format check, so " Bob@Example.com " and "bob@example.com" are one account.
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** The name shown to other family members. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(60, "Use 60 characters or fewer");

/**
 * A raw invitation, sign-in or session token: 32 random bytes, base64url.
 * Checking the shape first means junk from a URL or cookie never reaches a
 * database lookup.
 */
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
