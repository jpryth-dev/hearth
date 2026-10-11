import "server-only";

import { createHash, randomBytes } from "node:crypto";

export interface GeneratedToken {
  /** Goes in the cookie or emailed link. Never stored, never logged. */
  token: string;
  /** What the database stores and looks up by. */
  hash: string;
}

/** Creates a 256-bit random token and its storage hash. */
export function generateToken(): GeneratedToken {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

/**
 * SHA-256 of a token, hex encoded. Tokens are high-entropy random values, so
 * a fast unsalted hash is enough: there is nothing to brute-force.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
