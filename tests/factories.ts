import type { SessionUser } from "@/server/auth";
import { db } from "@/server/db";

/** Creates a user and returns it in the shape the auth layer hands out. */
export async function makeUser(
  overrides: { email?: string; role?: "ADMIN" | "MEMBER"; status?: "ACTIVE" | "DISABLED" } = {},
): Promise<SessionUser> {
  const user = await db.user.create({
    data: {
      email: overrides.email ?? `user-${crypto.randomUUID()}@example.com`,
      displayName: overrides.role === "ADMIN" ? "Admin" : "Member",
      role: overrides.role ?? "MEMBER",
      status: overrides.status ?? "ACTIVE",
    },
  });
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}
