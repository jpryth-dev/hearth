import "server-only";

import { headers } from "next/headers";

/**
 * Best-effort client IP for audit rows. X-Forwarded-For is set by whatever
 * proxy is in front of the app and can be spoofed if there is none, so treat
 * the value as a hint for the activity report, never for access decisions.
 */
export async function requestIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || null;
}
