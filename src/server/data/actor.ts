import "server-only";

import { requireUser, type SessionUser } from "@/server/auth";
import { requestIp } from "@/server/request";

/**
 * The acting user as every data-access function receives it: the signed-in
 * user plus the request IP, so denials can be audited with where they came from.
 */
export interface Actor extends SessionUser {
  ipAddress: string | null;
}

/**
 * The signed-in user as an Actor, or a redirect to /login. Call at the top of
 * every page and Server Action that touches album or photo data.
 */
export async function currentActor(): Promise<Actor> {
  const user = await requireUser();
  return { ...user, ipAddress: await requestIp() };
}
